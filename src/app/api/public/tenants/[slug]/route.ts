import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createPortalTenantToken } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      brandingConfig: tenants.brandingConfig,
      suspended: tenants.suspended,
    })
    .from(tenants)
    .where(eq(tenants.slug, String(slug).toLowerCase()))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const response = NextResponse.json({ tenant });
  response.cookies.set("portal_tenant_token", createPortalTenantToken(tenant.id), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
    path: "/",
  });
  return response;
}
