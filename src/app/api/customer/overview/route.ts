import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, earningRules, pointTransactions } from "@/db/schema";
import { requireCustomerSession } from "@/lib/api-guard";
import { eventLabel } from "@/lib/rules";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const guard = await requireCustomerSession();
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

  const activity = await db
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
    .limit(20);

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
  });
}
