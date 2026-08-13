import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { basisForTrigger, validateRule, type RuleConditions, type TriggerType } from "@/lib/rules";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const body = await req.json();

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setValues.name = body.name;
  if (body.description !== undefined) setValues.description = body.description;
  if (body.active !== undefined) setValues.active = Boolean(body.active);
  if (body.pointsExpireAfterDays !== undefined) {
    setValues.pointsExpireAfterDays =
      body.pointsExpireAfterDays == null || body.pointsExpireAfterDays === ""
        ? null
        : Math.floor(Number(body.pointsExpireAfterDays));
  }
  if (body.activeFrom !== undefined) {
    setValues.activeFrom =
      !body.activeFrom || body.activeFrom === "null"
        ? null
        : new Date(String(body.activeFrom));
  }
  if (body.activeUntil !== undefined) {
    setValues.activeUntil =
      !body.activeUntil || body.activeUntil === "null"
        ? null
        : new Date(String(body.activeUntil));
  }

  const structuredKeys = [
    "triggerType",
    "productId",
    "minPrice",
    "maxPrice",
    "minQuantity",
    "pointsPerUnit",
  ];
  if (structuredKeys.some((k) => body[k] !== undefined)) {
    const triggerType = String(body.triggerType || "flat_rate") as TriggerType;
    const conditions: RuleConditions = {
      productId: body.productId ? String(body.productId) : null,
      minPrice: body.minPrice == null || body.minPrice === "" ? null : Number(body.minPrice),
      maxPrice: body.maxPrice == null || body.maxPrice === "" ? null : Number(body.maxPrice),
      minQuantity:
        body.minQuantity == null || body.minQuantity === ""
          ? null
          : Math.floor(Number(body.minQuantity)),
    };
    const pointsPerUnit = Number(body.pointsPerUnit);
    if (!Number.isFinite(pointsPerUnit) || pointsPerUnit <= 0) {
      return NextResponse.json({ error: "Points/unit must be greater than 0" }, { status: 400 });
    }
    try {
      validateRule({ triggerType, conditions, pointsFormula: { basis: basisForTrigger(triggerType), pointsPerUnit } });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
    setValues.triggerType = triggerType;
    setValues.conditions = conditions;
    setValues.pointsFormula = { basis: basisForTrigger(triggerType), pointsPerUnit };
  }

  const [rule] = await db
    .update(earningRules)
    .set(setValues)
    .where(eq(earningRules.id, id))
    .returning();

  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const [deleted] = await db
    .delete(earningRules)
    .where(eq(earningRules.id, id))
    .returning({ id: earningRules.id });

  if (!deleted) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
