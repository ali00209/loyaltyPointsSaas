import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, earningRules, pointTransactions, redemptionRewards, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const rows = await db
    .select({
      id: pointTransactions.id,
      customerId: pointTransactions.customerId,
      customerName: customers.name,
      transactionType: pointTransactions.transactionType,
      points: pointTransactions.points,
      ruleId: pointTransactions.ruleId,
      ruleName: earningRules.name,
      rewardId: pointTransactions.rewardId,
      rewardName: redemptionRewards.name,
      description: pointTransactions.description,
      orderAmount: pointTransactions.orderAmount,
      itemQuantity: pointTransactions.itemQuantity,
      createdAt: pointTransactions.createdAt,
    })
    .from(pointTransactions)
    .leftJoin(customers, eq(pointTransactions.customerId, customers.id))
    .leftJoin(earningRules, eq(pointTransactions.ruleId, earningRules.id))
    .leftJoin(redemptionRewards, eq(pointTransactions.rewardId, redemptionRewards.id))
    .where(eq(pointTransactions.tenantId, id))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(200);

  return NextResponse.json({ transactions: rows });
}
