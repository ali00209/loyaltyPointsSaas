import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules, tenantEarningRules, tenants, users } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
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

  const assignments = await db
    .select({
      assignmentId: tenantEarningRules.id,
      assignmentActive: tenantEarningRules.active,
      id: earningRules.id,
      name: earningRules.name,
      triggerType: earningRules.triggerType,
      pointsFormula: earningRules.pointsFormula,
    })
    .from(tenantEarningRules)
    .innerJoin(earningRules, eq(tenantEarningRules.ruleId, earningRules.id))
    .where(eq(tenantEarningRules.tenantId, id));

  return NextResponse.json({
    tenant: {
      ...tenant,
      brandingConfig: tenant.brandingConfig,
      assignedRules: assignments.map((a) => ({
        assignmentId: a.assignmentId,
        assignmentActive: a.assignmentActive,
        id: a.id,
        name: a.name,
        triggerType: a.triggerType,
        pointsPerUnit: a.pointsFormula.pointsPerUnit,
      })),
    },
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await req.json();

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setValues.name = body.name;
  if (body.brandingConfig !== undefined) setValues.brandingConfig = body.brandingConfig;
  if (body.suspended !== undefined) setValues.suspended = Boolean(body.suspended);

  const [tenant] = await db
    .update(tenants)
    .set(setValues)
    .where(eq(tenants.id, id))
    .returning();

  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}
