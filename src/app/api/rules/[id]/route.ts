import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { compileRuleBody, parseExpiryDays, parseOptionalDate } from "@/lib/rule-builder";
import { UpdateRuleSchema, parseBody } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { id } = await params;

  const parsed = await parseBody(req, UpdateRuleSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setValues.name = body.name;
  if (body.description !== undefined) setValues.description = body.description;
  if (body.active !== undefined) setValues.active = body.active;
  if (body.pointsExpireAfterDays !== undefined) {
    setValues.pointsExpireAfterDays = parseExpiryDays(body.pointsExpireAfterDays);
  }
  if (body.activeFrom !== undefined) setValues.activeFrom = parseOptionalDate(body.activeFrom);
  if (body.activeUntil !== undefined) setValues.activeUntil = parseOptionalDate(body.activeUntil);

  const engineKeys = ["eventType", "perItem", "formulaGroups"];
  if (engineKeys.some((k) => body[k as keyof typeof body] !== undefined)) {
    try {
      const compiled = compileRuleBody({ ...body, name: body.name ?? "placeholder" });
      setValues.eventType = compiled.eventType;
      setValues.perItem = compiled.perItem;
      setValues.formulaGroups = compiled.formulaGroups;
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }
  }

  const [rule] = await db
    .update(earningRules)
    .set(setValues)
    .where(and(eq(earningRules.id, id), eq(earningRules.tenantId, tenantId)))
    .returning();

  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { id } = await params;

  const [deleted] = await db
    .delete(earningRules)
    .where(and(eq(earningRules.id, id), eq(earningRules.tenantId, tenantId)))
    .returning({ id: earningRules.id });

  if (!deleted) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
