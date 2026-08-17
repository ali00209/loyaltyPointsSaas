import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  return NextResponse.json({ tenant });
}
