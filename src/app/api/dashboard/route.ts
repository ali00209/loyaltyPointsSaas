import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  customers,
  earningRules,
  pointTransactions,
  redemptionRules,
  redemptionCheckouts,
} from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { and, eq, desc, sql } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const [customerStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalPoints: sql<number>`coalesce(sum(${customers.currentBalance}), 0)::int`,
    })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  const [redemptionStats] = await db
    .select({
      count: sql<number>`coalesce(sum(case when ${pointTransactions.transactionType} = 'redeem' then 1 else 0 end), 0)::int`,
    })
    .from(pointTransactions)
    .where(eq(pointTransactions.tenantId, tenantId));

  const [ruleStats] = await db
    .select({
      activeCount: sql<number>`count(*) filter (where ${earningRules.active} = true)::int`,
    })
    .from(earningRules)
    .where(eq(earningRules.tenantId, tenantId));

  const [txStats] = await db
    .select({
      totalEarned: sql<number>`coalesce(sum(case when ${pointTransactions.transactionType} = 'earn' then ${pointTransactions.points} else 0 end), 0)::int`,
      totalRedeemed: sql<number>`coalesce(sum(case when ${pointTransactions.transactionType} = 'redeem' then abs(${pointTransactions.points}) else 0 end), 0)::int`,
    })
    .from(pointTransactions)
    .where(eq(pointTransactions.tenantId, tenantId));

  const recentTransactions = await db
    .select({
      id: pointTransactions.id,
      customerName: customers.name,
      transactionType: pointTransactions.transactionType,
      points: pointTransactions.points,
      description: pointTransactions.description,
      createdAt: pointTransactions.createdAt,
    })
    .from(pointTransactions)
    .leftJoin(customers, eq(pointTransactions.customerId, customers.id))
    .where(eq(pointTransactions.tenantId, tenantId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(10);

  const topCustomers = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.totalPointsEarned))
    .limit(5);

  const topRedemptionRules = await db
    .select({
      id: redemptionRules.id,
      name: redemptionRules.name,
      redeemedCount: sql<number>`count(*)::int`,
    })
    .from(redemptionCheckouts)
    .innerJoin(redemptionRules, eq(redemptionCheckouts.redemptionRuleId, redemptionRules.id))
    .where(and(eq(redemptionCheckouts.tenantId, tenantId), eq(redemptionCheckouts.status, "finalized")))
    .groupBy(redemptionRules.id, redemptionRules.name)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return NextResponse.json({
    stats: {
      totalCustomers: customerStats.count,
      totalPoints: customerStats.totalPoints,
      totalEarned: txStats.totalEarned,
      totalRedeemed: txStats.totalRedeemed,
      totalRewards: redemptionStats.count,
      activeRules: ruleStats.activeCount,
    },
    recentTransactions,
    topCustomers,
    topRewards: topRedemptionRules,
  });
}
