import { and, eq, gt, inArray, isNotNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  customerRuleBalances,
  customers,
  earningRules,
  pointTransactions,
  redemptionRewards,
  tenantEarningRules,
} from "@/db/schema";
import {
  calculatePoints,
  evaluateRules,
  type EarnRuleConfig,
  type TransactionFacts,
} from "@/lib/rules";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PointsError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PointsError";
    this.status = status;
  }
}

function expiresAfter(days: number | null): Date | null {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function isRuleActive(rule: {
  active: boolean;
  activeFrom?: Date | null;
  activeUntil?: Date | null;
}): boolean {
  if (!rule.active) return false;
  const now = new Date();
  if (rule.activeFrom && now < rule.activeFrom) return false;
  if (rule.activeUntil && now > rule.activeUntil) return false;
  return true;
}

function toOrderAmount(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

// Expire any buckets past their expires_at. Used inside write transactions
// and by the cron endpoint.
export async function expireWithinTx(tx: Tx, tenantId?: string): Promise<number> {
  const conditions: SQL[] = [
    isNotNull(customerRuleBalances.expiresAt),
    lte(customerRuleBalances.expiresAt, new Date()),
    gt(customerRuleBalances.remainingPoints, 0),
  ];
  if (tenantId) conditions.push(eq(customerRuleBalances.tenantId, tenantId));

  const due = await tx
    .select()
    .from(customerRuleBalances)
    .where(and(...conditions));

  if (due.length === 0) return 0;

  const groups = new Map<string, { tenantId: string; customerId: string; buckets: typeof due }>();
  for (const bucket of due) {
    const key = `${bucket.tenantId}:${bucket.customerId}`;
    const group = groups.get(key);
    if (group) group.buckets.push(bucket);
    else groups.set(key, { tenantId: bucket.tenantId, customerId: bucket.customerId, buckets: [bucket] });
  }

  for (const group of groups.values()) {
    const points = group.buckets.reduce((s, b) => s + b.remainingPoints, 0);
    await tx.insert(pointTransactions).values({
      tenantId: group.tenantId,
      customerId: group.customerId,
      transactionType: "expire",
      points: -points,
      description: "Points expired",
      metadata: { source: "expiry" },
    });
    await tx
      .update(customers)
      .set({ currentBalance: sql`${customers.currentBalance} - ${points}` })
      .where(
        and(
          eq(customers.id, group.customerId),
          eq(customers.tenantId, group.tenantId),
        ),
      );
    await tx
      .update(customerRuleBalances)
      .set({ remainingPoints: 0 })
      .where(
        inArray(
          customerRuleBalances.id,
          group.buckets.map((b) => b.id),
        ),
      );
  }

  return due.length;
}

// Run a callback inside a transaction that first expires due points.
export async function withExpiry<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await expireWithinTx(tx);
    return fn(tx);
  });
}

// Cron sweep: expire due points across every tenant.
export async function expireDuePoints(): Promise<number> {
  return db.transaction(async (tx) => expireWithinTx(tx));
}

async function creditPoints(
  tx: Tx,
  args: {
    tenantId: string;
    customerId: string;
    ruleId: string | null;
    points: number;
    expiresAt: Date | null;
  },
): Promise<void> {
  await tx.insert(customerRuleBalances).values({
    tenantId: args.tenantId,
    customerId: args.customerId,
    ruleId: args.ruleId,
    remainingPoints: args.points,
    expiresAt: args.expiresAt,
  });
  await tx
    .update(customers)
    .set({
      currentBalance: sql`${customers.currentBalance} + ${args.points}`,
      totalPointsEarned: sql`${customers.totalPointsEarned} + ${args.points}`,
    })
    .where(
      and(
        eq(customers.id, args.customerId),
        eq(customers.tenantId, args.tenantId),
      ),
    );
}

// Consume points FIFO (earliest expiry first, non-expiring points last).
async function consumePoints(
  tx: Tx,
  args: { tenantId: string; customerId: string; amount: number },
): Promise<void> {
  const buckets = await tx
    .select()
    .from(customerRuleBalances)
    .where(
      and(
        eq(customerRuleBalances.tenantId, args.tenantId),
        eq(customerRuleBalances.customerId, args.customerId),
        gt(customerRuleBalances.remainingPoints, 0),
      ),
    )
    .orderBy(
      sql`${customerRuleBalances.expiresAt} IS NOT NULL DESC, ${customerRuleBalances.expiresAt} ASC, ${customerRuleBalances.createdAt} ASC`,
    );

  let remaining = args.amount;
  for (const bucket of buckets) {
    if (remaining <= 0) break;
    const take = Math.min(bucket.remainingPoints, remaining);
    remaining -= take;
    await tx
      .update(customerRuleBalances)
      .set({
        remainingPoints: sql`${customerRuleBalances.remainingPoints} - ${take}`,
      })
      .where(eq(customerRuleBalances.id, bucket.id));
  }

  await tx
    .update(customers)
    .set({ currentBalance: sql`${customers.currentBalance} - ${args.amount}` })
    .where(
      and(
        eq(customers.id, args.customerId),
        eq(customers.tenantId, args.tenantId),
      ),
    );
}

export interface EarnInput {
  tenantId: string;
  customerId: string;
  ruleId: string;
  orderAmount?: number | string | null;
  itemQuantity?: number | null;
  productId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function applyEarn(input: EarnInput) {
  return withExpiry(async (tx) => {
    const [assignment] = await tx
      .select()
      .from(tenantEarningRules)
      .where(
        and(
          eq(tenantEarningRules.tenantId, input.tenantId),
          eq(tenantEarningRules.ruleId, input.ruleId),
        ),
      )
      .limit(1);

    if (!assignment || !assignment.active) {
      throw new PointsError("Rule is not assigned and active for your program");
    }

    const [rule] = await tx
      .select()
      .from(earningRules)
      .where(eq(earningRules.id, input.ruleId))
      .limit(1);

    if (!rule || !isRuleActive(rule)) {
      throw new PointsError("Rule is not active");
    }

    const config: EarnRuleConfig = {
      triggerType: rule.triggerType,
      conditions: rule.conditions,
      pointsFormula: rule.pointsFormula,
    };

    const facts: TransactionFacts = {
      orderAmount: Number(input.orderAmount ?? 0),
      itemQuantity: Number(input.itemQuantity ?? 0),
      productId: input.productId || null,
    };

    if (evaluateRules([config], facts).length === 0) {
      throw new PointsError("Order does not match this rule's conditions");
    }

    const points = calculatePoints(rule.pointsFormula, facts);

    const [transaction] = await tx
      .insert(pointTransactions)
      .values({
        tenantId: input.tenantId,
        customerId: input.customerId,
        transactionType: "earn",
        points,
        orderAmount: toOrderAmount(input.orderAmount),
        itemQuantity: input.itemQuantity ?? null,
        ruleId: rule.id,
        description: input.description || null,
        metadata: input.metadata ?? {},
      })
      .returning();

    await creditPoints(tx, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      ruleId: rule.id,
      points,
      expiresAt: expiresAfter(rule.pointsExpireAfterDays),
    });

    return { transaction, pointsAwarded: points };
  });
}

export interface RedeemInput {
  tenantId: string;
  customerId: string;
  rewardId: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function applyRedeem(input: RedeemInput) {
  return withExpiry(async (tx) => {
    const [reward] = await tx
      .select()
      .from(redemptionRewards)
      .where(
        and(
          eq(redemptionRewards.id, input.rewardId),
          eq(redemptionRewards.tenantId, input.tenantId),
        ),
      )
      .limit(1);

    if (!reward) throw new PointsError("Reward not found", 404);
    if (!reward.active) throw new PointsError("Reward is inactive");

    if (reward.inventoryLimit != null) {
      const [updated] = await tx
        .update(redemptionRewards)
        .set({ redeemedCount: sql`${redemptionRewards.redeemedCount} + 1` })
        .where(
          and(
            eq(redemptionRewards.id, input.rewardId),
            eq(redemptionRewards.tenantId, input.tenantId),
            lt(sql`${redemptionRewards.redeemedCount}`, reward.inventoryLimit),
          ),
        )
        .returning({ id: redemptionRewards.id });
      if (!updated) throw new PointsError("Reward is out of stock");
    } else {
      await tx
        .update(redemptionRewards)
        .set({ redeemedCount: sql`${redemptionRewards.redeemedCount} + 1` })
        .where(
          and(
            eq(redemptionRewards.id, input.rewardId),
            eq(redemptionRewards.tenantId, input.tenantId),
          ),
        );
    }

    const [customer] = await tx
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId)),
      )
      .limit(1);

    if (!customer) throw new PointsError("Customer not found", 404);
    if (customer.currentBalance < reward.pointsCost) {
      throw new PointsError("Customer does not have enough points");
    }

    await consumePoints(tx, {
      tenantId: input.tenantId,
      customerId: input.customerId,
      amount: reward.pointsCost,
    });

    const [transaction] = await tx
      .insert(pointTransactions)
      .values({
        tenantId: input.tenantId,
        customerId: input.customerId,
        transactionType: "redeem",
        points: -reward.pointsCost,
        rewardId: reward.id,
        description: input.description || null,
        metadata: input.metadata ?? {},
      })
      .returning();

    return { transaction, pointsAwarded: -reward.pointsCost };
  });
}

export interface AdjustInput {
  tenantId: string;
  customerId: string;
  points: number;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function applyAdjust(input: AdjustInput) {
  return withExpiry(async (tx) => {
    const [customer] = await tx
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, input.customerId), eq(customers.tenantId, input.tenantId)),
      )
      .limit(1);

    if (!customer) throw new PointsError("Customer not found", 404);

    const signed = Math.round(input.points);
    if (signed === 0) throw new PointsError("Adjustment cannot be 0 points");

    if (signed < 0) {
      await consumePoints(tx, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        amount: Math.abs(signed),
      });
    } else {
      await creditPoints(tx, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        ruleId: null,
        points: signed,
        expiresAt: null,
      });
    }

    const [transaction] = await tx
      .insert(pointTransactions)
      .values({
        tenantId: input.tenantId,
        customerId: input.customerId,
        transactionType: "adjust",
        points: signed,
        description: input.description || null,
        metadata: input.metadata ?? {},
      })
      .returning();

    return { transaction, pointsAwarded: signed };
  });
}

// Used to reset the demo when reseeding.
export async function resetDemoData() {
  await pool.query("TRUNCATE customer_rule_balances, point_transactions, redemption_rewards, tenant_earning_rules, earning_rules, customers, products, users, tenants RESTART IDENTITY CASCADE");
}
