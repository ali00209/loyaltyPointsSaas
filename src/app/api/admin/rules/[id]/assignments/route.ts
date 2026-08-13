import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules, tenantEarningRules, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await req.json();
  const tenantId = body.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const [rule] = await db.select().from(earningRules).where(eq(earningRules.id, id)).limit(1);
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const existing = await db
    .select()
    .from(tenantEarningRules)
    .where(and(eq(tenantEarningRules.ruleId, id), eq(tenantEarningRules.tenantId, tenantId)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "Rule already assigned to this tenant" }, { status: 409 });
  }

  const [assignment] = await db
    .insert(tenantEarningRules)
    .values({ tenantId, ruleId: id })
    .returning();

  return NextResponse.json({ assignment }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(tenantEarningRules)
    .where(and(eq(tenantEarningRules.ruleId, id), eq(tenantEarningRules.tenantId, tenantId)))
    .returning({ id: tenantEarningRules.id });

  if (!deleted) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
