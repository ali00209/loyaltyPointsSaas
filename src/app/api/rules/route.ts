import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { compileRuleBody, formulaTextFromColumns, parseExpiryDays, parseOptionalDate } from "@/lib/rule-builder";
import type { EventType } from "@/lib/rules";
import { CreateRuleSchema, ToggleRuleSchema, parseBody } from "@/lib/validations";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const rules = await db
    .select()
    .from(earningRules)
    .where(eq(earningRules.tenantId, tenantId))
    .orderBy(desc(earningRules.createdAt));

  return NextResponse.json({
    rules: rules.map((r) => ({
      ...r,
      formulaText: formulaTextFromColumns(r),
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, CreateRuleSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  let compiled;
  try {
    compiled = compileRuleBody(body);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const s = body.structured ?? {};
  const formulaType = s.type ?? "rate";
  const [rule] = await db
    .insert(earningRules)
    .values({
      tenantId,
      name: body.name,
      description: body.description ?? null,
      eventType: compiled.eventType as EventType,
      perItem: compiled.perItem,
      conditions: compiled.conditions,
      formulaType,
      formulaBasis: formulaType === "flat" ? null : String(s.basis ?? "orderAmount"),
      formulaRate: String(s.rate ?? 1),
      formulaFlatAmount: formulaType === "flat" ? (typeof s.flatAmount === "number" ? s.flatAmount : 0) : null,
      formulaRounding: String(s.rounding ?? "floor"),
      formulaMinPoints: typeof s.minPoints === "number" ? s.minPoints : null,
      formulaMaxPoints: typeof s.maxPoints === "number" ? s.maxPoints : null,
      pointsExpireAfterDays: parseExpiryDays(body.pointsExpireAfterDays),
      active: body.active !== undefined ? body.active : true,
      activeFrom: parseOptionalDate(body.activeFrom),
      activeUntil: parseOptionalDate(body.activeUntil),
    })
    .returning();

  return NextResponse.json({ rule }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, ToggleRuleSchema);
  if (parsed.error) return parsed.error;
  const { id, active } = parsed.data;

  const [rule] = await db
    .update(earningRules)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(earningRules.id, id), eq(earningRules.tenantId, tenantId)))
    .returning();

  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  return NextResponse.json({ rule });
}
