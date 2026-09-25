import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { SelectPlanSchema, parseBody } from "@/lib/validations";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const [sub] = await db
    .select({ sub: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return NextResponse.json({
    subscription: sub
      ? {
          id: sub.sub.id,
          tenantId: sub.sub.tenantId,
          planId: sub.sub.planId,
          planName: sub.plan.name,
          planPrice: sub.plan.price,
          billingCycle: sub.plan.billingCycle,
          status: sub.sub.status,
          nextBillingAt: sub.sub.nextBillingAt,
          createdAt: sub.sub.createdAt,
          updatedAt: sub.sub.updatedAt,
        }
      : null,
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, SelectPlanSchema);
  if (parsed.error) return parsed.error;
  const { planId } = parsed.data;

  const [plan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.active, true)))
    .limit(1);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found or inactive" }, { status: 404 });
  }

  const [current] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  // Already active on the requested plan → nothing to do.
  if (current?.status === "active" && current.planId === planId) {
    return NextResponse.json({ subscription: current });
  }

  let subscription;
  if (current?.status === "pending") {
    const [updated] = await db
      .update(subscriptions)
      .set({ planId, updatedAt: new Date() })
      .where(eq(subscriptions.id, current.id))
      .returning();
    subscription = updated;
  } else {
    const [inserted] = await db
      .insert(subscriptions)
      .values({ tenantId, planId, status: "pending" })
      .returning();
    subscription = inserted;
  }

  return NextResponse.json({ subscription }, { status: 201 });
}