import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, earningRules, pointTransactions, redemptionCheckouts } from "@/db/schema";
import { requireCustomerAccess } from "@/lib/api-guard";
import { eventLabel } from "@/lib/rules";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const guard = await requireCustomerAccess(new URL(req.url).searchParams);
  if ("error" in guard) return guard.error;
  const { customer } = guard;

  const [summary] = await db
    .select({
      currentBalance: customers.currentBalance,
      totalPointsEarned: customers.totalPointsEarned,
    })
    .from(customers)
    .where(eq(customers.id, customer.id))
    .limit(1);

  const [activity, redemptions] = await Promise.all([
    db
    .select({
      id: pointTransactions.id,
      transactionType: pointTransactions.transactionType,
      points: pointTransactions.points,
      ruleName: earningRules.name,
      description: pointTransactions.description,
      metadata: pointTransactions.metadata,
      createdAt: pointTransactions.createdAt,
    })
    .from(pointTransactions)
    .leftJoin(earningRules, eq(pointTransactions.ruleId, earningRules.id))
    .where(
      and(
        eq(pointTransactions.customerId, customer.id),
        eq(pointTransactions.tenantId, customer.tenantId),
      ),
    )
    .orderBy(desc(pointTransactions.createdAt))
    .limit(20),
    db
      .select({
        checkoutId: redemptionCheckouts.checkoutId,
        orderId: redemptionCheckouts.orderId,
        discountAmount: redemptionCheckouts.discountAmount,
        pointsCost: redemptionCheckouts.pointsCost,
        status: redemptionCheckouts.status,
        createdAt: redemptionCheckouts.createdAt,
      })
      .from(redemptionCheckouts)
      .where(and(
        eq(redemptionCheckouts.customerId, customer.id),
        eq(redemptionCheckouts.tenantId, customer.tenantId),
      ))
      .orderBy(desc(redemptionCheckouts.createdAt))
      .limit(20),
  ]);

  return NextResponse.json({
    summary: {
      currentBalance: summary?.currentBalance ?? customer.currentBalance,
      totalPointsEarned: summary?.totalPointsEarned ?? 0,
    },
    referral: {
      code: customer.referralCode,
      link: `/p/${customer.tenant.slug}?ref=${customer.referralCode ?? ""}`,
    },
    activity: activity.map((a) => {
      const source =
        typeof a.metadata?.eventType === "string" ? eventLabel(a.metadata.eventType) : null;
      return {
        ...a,
        source,
      };
    }),
    redemptions: redemptions.map((r) => ({
      checkoutId: r.checkoutId,
      orderId: r.orderId,
      discountAmount: Number(r.discountAmount),
      pointsCost: r.pointsCost,
      status: r.status,
      createdAt: r.createdAt,
    })),
  });
}
