import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, redemptionCheckouts, redemptionRules } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const history = await db.select({
    id: redemptionCheckouts.id,
    checkoutId: redemptionCheckouts.checkoutId,
    orderId: redemptionCheckouts.orderId,
    customerId: redemptionCheckouts.customerId,
    customerName: customers.name,
    ruleId: redemptionCheckouts.redemptionRuleId,
    ruleName: redemptionRules.name,
    pointsCost: redemptionCheckouts.pointsCost,
    orderAmount: redemptionCheckouts.orderAmount,
    eligibleSubtotal: redemptionCheckouts.eligibleSubtotal,
    discountAmount: redemptionCheckouts.discountAmount,
    status: redemptionCheckouts.status,
    createdAt: redemptionCheckouts.createdAt,
    updatedAt: redemptionCheckouts.updatedAt,
    refundReason: redemptionCheckouts.metadata,
  }).from(redemptionCheckouts)
    .innerJoin(customers, eq(redemptionCheckouts.customerId, customers.id))
    .leftJoin(redemptionRules, eq(redemptionCheckouts.redemptionRuleId, redemptionRules.id))
    .where(and(
      eq(redemptionCheckouts.tenantId, guard.tenantId),
      eq(customers.tenantId, guard.tenantId),
    ))
    .orderBy(desc(redemptionCheckouts.createdAt))
    .limit(200);
  return NextResponse.json({
    history: history.map((entry) => ({
      ...entry,
      refundReason:
        typeof entry.refundReason?.refundReason === "string"
          ? entry.refundReason.refundReason
          : null,
    })),
  });
}
