import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, subscriptions, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const rows = await db
    .select({ sub: subscriptions, plan: plans, tenant: tenants })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
    .orderBy(desc(subscriptions.createdAt));

  return NextResponse.json({
    subscriptions: rows.map(({ sub, plan, tenant }) => ({
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: tenant.name,
      planId: sub.planId,
      planName: plan.name,
      planPrice: plan.price,
      billingCycle: plan.billingCycle,
      status: sub.status,
      nextBillingAt: sub.nextBillingAt,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    })),
  });
}