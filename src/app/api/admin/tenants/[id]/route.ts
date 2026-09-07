import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules, tenants, users } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { formulaTextFromColumns } from "@/lib/rule-builder";
import { UpdateTenantSchema, parseBody } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      brandingConfig: tenants.brandingConfig,
      suspended: tenants.suspended,
      createdAt: tenants.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(tenants)
    .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, "owner")))
    .where(eq(tenants.id, id))
    .limit(1);

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const rules = await db
    .select()
    .from(earningRules)
    .where(eq(earningRules.tenantId, id));

  return NextResponse.json({
    tenant: {
      ...tenant,
      brandingConfig: tenant.brandingConfig,
      assignedRules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        eventType: r.eventType,
        perItem: r.perItem,
        active: r.active,
        formulaText: formulaTextFromColumns(r),
      })),
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const parseResult = await parseBody(req, UpdateTenantSchema);
  if (parseResult.error) return parseResult.error;
  const body = parseResult.data;

  if (body.slug !== undefined) {
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, body.slug))
      .limit(1);
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: "Another tenant already uses this portal URL" },
        { status: 409 },
      );
    }
  }

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setValues.name = body.name;
  if (body.slug !== undefined) setValues.slug = body.slug;
  if (body.brandingConfig !== undefined) setValues.brandingConfig = body.brandingConfig;
  if (body.suspended !== undefined) setValues.suspended = body.suspended;

  const [tenant] = await db
    .update(tenants)
    .set(setValues)
    .where(eq(tenants.id, id))
    .returning();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}
