import { db } from "@/db";
import {
  customers,
  earningRules,
  pointTransactions,
  redemptionRewards,
} from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { applyAdjust, applyRedeem, PointsError } from "@/lib/points";
import { CreateTransactionSchema, parseBody } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const result = await db
    .select({
      id: pointTransactions.id,
      tenantId: pointTransactions.tenantId,
      customerId: pointTransactions.customerId,
      customerName: customers.name,
      transactionType: pointTransactions.transactionType,
      points: pointTransactions.points,
      ruleId: pointTransactions.ruleId,
      ruleName: earningRules.name,
      rewardId: pointTransactions.rewardId,
      rewardName: redemptionRewards.name,
      eventId: pointTransactions.eventId,
      description: pointTransactions.description,
      orderAmount: pointTransactions.orderAmount,
      itemQuantity: pointTransactions.itemQuantity,
      metadata: pointTransactions.metadata,
      createdAt: pointTransactions.createdAt,
    })
    .from(pointTransactions)
    .leftJoin(customers, eq(pointTransactions.customerId, customers.id))
    .leftJoin(earningRules, eq(pointTransactions.ruleId, earningRules.id))
    .leftJoin(
      redemptionRewards,
      eq(pointTransactions.rewardId, redemptionRewards.id),
    )
    .where(eq(pointTransactions.tenantId, tenantId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(200);

  return NextResponse.json({ transactions: result });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, CreateTransactionSchema);
  if (parsed.error) return parsed.error;
  const { customerId, transactionType, rewardId, points, description, metadata } = parsed.data;

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  try {
    switch (transactionType) {
      case "redeem": {
        if (!rewardId) {
          return NextResponse.json(
            { error: "Redemption requires a reward" },
            { status: 400 },
          );
        }
        return NextResponse.json(
          await applyRedeem({
            tenantId,
            customerId,
            rewardId,
            description,
            metadata,
          }),
          { status: 201 },
        );
      }
      case "adjust": {
        if (!points || points === 0) {
          return NextResponse.json(
            { error: "Adjustment needs a non-zero point amount" },
            { status: 400 },
          );
        }
        return NextResponse.json(
          await applyAdjust({
            tenantId,
            customerId,
            points,
            description,
            metadata,
          }),
          { status: 201 },
        );
      }
      default:
        return NextResponse.json(
          {
            error:
              "Invalid transaction type. Use the Record Event action to award points",
          },
          { status: 400 },
        );
    }
  } catch (err) {
    if (err instanceof PointsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Transaction error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
