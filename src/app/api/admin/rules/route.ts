import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules, tenantEarningRules } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { basisForTrigger, validateRule, type RuleConditions, type TriggerType } from "@/lib/rules";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const rows = await db
    .select({
      id: earningRules.id,
      name: earningRules.name,
      description: earningRules.description,
      triggerType: earningRules.triggerType,
      conditions: earningRules.conditions,
      pointsFormula: earningRules.pointsFormula,
      pointsExpireAfterDays: earningRules.pointsExpireAfterDays,
      active: earningRules.active,
      activeFrom: earningRules.activeFrom,
      activeUntil: earningRules.activeUntil,
      createdAt: earningRules.createdAt,
      updatedAt: earningRules.updatedAt,
      assignedCount: sql<number>`count(${tenantEarningRules.id})::int`,
    })
    .from(earningRules)
    .leftJoin(tenantEarningRules, eq(tenantEarningRules.ruleId, earningRules.id))
    .groupBy(earningRules.id)
    .orderBy(desc(earningRules.createdAt));

  return NextResponse.json({ rules: rows });
}

function buildRuleFromBody(body: Record<string, unknown>) {
  const pointsPerUnit = Number(body.pointsPerUnit);
  if (!Number.isFinite(pointsPerUnit) || pointsPerUnit <= 0) {
    throw new Error("Points/unit must be greater than 0");
  }

  const conditions: RuleConditions = {
    productId: body.productId ? String(body.productId) : null,
    minPrice: body.minPrice == null || body.minPrice === "" ? null : Number(body.minPrice),
    maxPrice: body.maxPrice == null || body.maxPrice === "" ? null : Number(body.maxPrice),
    minQuantity:
      body.minQuantity == null || body.minQuantity === "" ? null : Math.floor(Number(body.minQuantity)),
  };

  const rule = {
    triggerType: String(body.triggerType || "flat_rate") as TriggerType,
    conditions,
    pointsFormula: { basis: basisForTrigger(String(body.triggerType || "flat_rate")), pointsPerUnit },
  };

  validateRule(rule);
  return rule;
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || value === "" || value === "null") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Rule name required" }, { status: 400 });
  }

  let compiled;
  try {
    compiled = buildRuleFromBody(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const [rule] = await db
    .insert(earningRules)
    .values({
      name: body.name,
      description: body.description || null,
      triggerType: compiled.triggerType,
      conditions: compiled.conditions,
      pointsFormula: compiled.pointsFormula,
      pointsExpireAfterDays:
        body.pointsExpireAfterDays == null || body.pointsExpireAfterDays === ""
          ? null
          : Math.floor(Number(body.pointsExpireAfterDays)),
      active: body.active !== undefined ? Boolean(body.active) : true,
      activeFrom: parseOptionalDate(body.activeFrom),
      activeUntil: parseOptionalDate(body.activeUntil),
    })
    .returning();

  return NextResponse.json({ rule }, { status: 201 });
}
