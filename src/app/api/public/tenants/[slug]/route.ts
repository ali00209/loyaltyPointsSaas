import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createPortalTenantToken } from "@/lib/auth";
import { getAppSettings } from "@/lib/settings";

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

  // A closed storefront is indistinguishable from a program that never
  // existed, so name and branding are not disclosed here either.
  if (!tenant) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const { publicStorefront } = await getAppSettings(tenant.id);
  if (!publicStorefront) {
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
