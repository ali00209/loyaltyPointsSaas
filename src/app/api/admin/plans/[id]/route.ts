import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { UpdatePlanSchema, parseBody } from "@/lib/validations";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const parsed = await parseBody(req, UpdatePlanSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) setValues.name = body.name;
  if (body.price !== undefined) setValues.price = body.price.toFixed(2);
  if (body.billingCycle !== undefined) setValues.billingCycle = body.billingCycle;
  if (body.taxPercent !== undefined) setValues.taxPercent = body.taxPercent.toFixed(2);
  if (body.active !== undefined) setValues.active = body.active;

  const [plan] = await db
    .update(plans)
    .set(setValues)
    .where(eq(plans.id, id))
    .returning();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const [deleted] = await db
    .delete(plans)
    .where(eq(plans.id, id))
    .returning({ id: plans.id });

  if (!deleted) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}