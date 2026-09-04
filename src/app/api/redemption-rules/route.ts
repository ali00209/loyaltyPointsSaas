import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { redemptionRules } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { validateRedemptionRuleInput } from "@/lib/redemption";
import type { RuleGroupType } from "@/lib/rules";
import {
  CreateRedemptionRuleSchema,
  parseBody,
  UpdateRedemptionRuleSchema,
} from "@/lib/validations";

const dateValue = (value: string | null | undefined) =>
  value ? new Date(value) : null;

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const rules = await db.select().from(redemptionRules)
    .where(eq(redemptionRules.tenantId, guard.tenantId))
    .orderBy(desc(redemptionRules.priority), desc(redemptionRules.createdAt));
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, CreateRedemptionRuleSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  try {
    validateRedemptionRuleInput(body as unknown as import("@/types").RedemptionRuleInput);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const [rule] = await db.insert(redemptionRules).values({
    tenantId: guard.tenantId,
    name: body.name,
    description: body.description ?? null,
    redemptionMode: body.redemptionMode,
    discountType: body.discountType,
    discountValue: String(body.discountValue),
    pointsCost: body.pointsCost,
    priority: body.priority ?? 0,
    conditions: (body.conditions as RuleGroupType | undefined) ?? { combinator: "and", rules: [] },
    active: body.active ?? true,
    activeFrom: dateValue(body.activeFrom),
    activeUntil: dateValue(body.activeUntil),
    perCustomerLimit: body.perCustomerLimit ?? null,
    tenantUsageLimit: body.tenantUsageLimit ?? null,
  }).returning();
  return NextResponse.json({ rule }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, UpdateRedemptionRuleSchema);
  if (parsed.error) return parsed.error;
  const { id, ...body } = parsed.data;
  const [existing] = await db.select().from(redemptionRules).where(
    and(eq(redemptionRules.id, id), eq(redemptionRules.tenantId, guard.tenantId)),
  ).limit(1);
  if (!existing) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  const candidate = {
    ...existing,
    ...body,
    discountValue: body.discountValue ?? Number(existing.discountValue),
    pointsCost: body.pointsCost ?? existing.pointsCost,
    conditions: (body.conditions as RuleGroupType | undefined) ?? (existing.conditions as RuleGroupType),
    redemptionMode: body.redemptionMode ?? existing.redemptionMode,
    discountType: body.discountType ?? existing.discountType,
  };
  try {
    validateRedemptionRuleInput(candidate as unknown as import("@/types").RedemptionRuleInput);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const setValues: Partial<typeof redemptionRules.$inferInsert> = {
    updatedAt: new Date(),
  };
  for (const key of [
    "name", "description", "redemptionMode", "discountType", "pointsCost", "priority", "conditions",
    "active", "perCustomerLimit", "tenantUsageLimit",
  ] as const) {
    if (body[key] !== undefined) setValues[key] = body[key] as never;
  }
  if (body.discountValue !== undefined) setValues.discountValue = String(body.discountValue);
  if (body.activeFrom !== undefined) setValues.activeFrom = dateValue(body.activeFrom);
  if (body.activeUntil !== undefined) setValues.activeUntil = dateValue(body.activeUntil);
  const [rule] = await db.update(redemptionRules).set(setValues).where(
    and(eq(redemptionRules.id, id), eq(redemptionRules.tenantId, guard.tenantId)),
  ).returning();
  return NextResponse.json({ rule });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
  await db.delete(redemptionRules).where(
    and(eq(redemptionRules.id, id), eq(redemptionRules.tenantId, guard.tenantId)),
  );
  return NextResponse.json({ success: true });
}
