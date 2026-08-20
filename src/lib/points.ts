import { and, eq, gt, inArray, isNotNull, lt, lte, sql, type SQL } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  customerRuleBalances,
  customers,
  earningRules,
  events,
  pointTransactions,
  products,
  redemptionRewards,
} from "@/db/schema";
import {
  buildStructuredFormula,
  conditionsMatch,
  deriveEventKey,
  evaluateFormula,
  eventLabel,
  validateEventPayload,
  type EventType,
  type FormulaGroup,
  type StructuredFormula,
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

export interface ApplyEventInput {
  tenantId: string;
  customerId: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  /** Caller-supplied idempotency key (overrides the derived key). */
  eventKey?: string | null;
  occurredAt?: Date;
  description?: string | null;
}

export interface AwardDetail {
  ruleId: string;
  ruleName: string;
  points: number;
}

export interface ApplyEventResult {
  eventId: string;
  duplicate: boolean;
  totalAwarded: number;
  awards: AwardDetail[];
}

function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof Error && /duplicate key value/i.test(err.message);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Compute the facts available to a rule for a single line item / order.
async function buildEventFacts(
  tx: Tx,
  input: ApplyEventInput,
): Promise<{ orderFacts: Record<string, unknown>; itemFacts: Record<string, unknown>[] }> {
  const orderFacts: Record<string, unknown> = {};
  const itemFacts: Record<string, unknown>[] = [];

  if (input.eventType === "purchase") {
    const items = (input.payload.items ?? []) as Record<string, unknown>[];
    const productIds = items
      .map((it) => it.productId)
      .filter((id): id is string => typeof id === "string" && isUuid(id));
    const catalog =
      productIds.length > 0
        ? await tx
            .select()
            .from(products)
            .where(and(eq(products.tenantId, input.tenantId), inArray(products.id, productIds)))
        : [];

    const productMap = new Map(catalog.map((p) => [p.id, p]));
    const totalQuantity = items.reduce(
      (sum, it) => sum + Number(it.quantity ?? 0),
      0,
    );
    orderFacts.orderAmount = Number(input.payload.orderAmount ?? 0);
    orderFacts.itemQuantity = totalQuantity;
    orderFacts.itemCount = items.length;

    for (const it of items) {
      const product = productMap.get(String(it.productId));
      const unitPrice = Number(it.unitPrice ?? 0);
      itemFacts.push({
        quantity: Number(it.quantity ?? 0),
        unitPrice,
        productId: String(it.productId),
        productPrice: product ? Number(product.price) : unitPrice,
        productCategory: product?.category ?? null,
      });
    }
  } else if (input.eventType === "review") {
    const productIds = [input.payload.productId].filter(
      (id): id is string => typeof id === "string" && isUuid(id),
    );
    const [product] =
      productIds.length > 0
        ? await tx
            .select()
            .from(products)
            .where(
              and(
                eq(products.tenantId, input.tenantId),
                inArray(products.id, productIds),
              ),
            )
            .limit(1)
        : [];
    if (product) {
      orderFacts.productId = product.id;
      orderFacts.productPrice = Number(product.price);
      orderFacts.productCategory = product.category;
    } else {
      orderFacts.productId = input.payload.productId ?? null;
    }
    orderFacts.rating = Number(input.payload.rating ?? 0);
  } else if (input.eventType === "social_share") {
    orderFacts.platform = input.payload.platform ?? null;
  }

  return { orderFacts, itemFacts };
}

interface MatchedRuleRow {
  rule: typeof earningRules.$inferSelect;
  points: number;
}

function bestGroupPoints(
  groups: FormulaGroup[],
  facts: Record<string, unknown>,
): number {
  let best = 0;
  for (const group of groups) {
    if (!conditionsMatch(group.conditions as never, facts)) continue;
    const formula = buildStructuredFormula(group.formula);
    const pts = evaluateFormula(formula, facts);
    if (pts > best) best = pts;
  }
  return best;
}

// Evaluate every active rule for this event type. Highest-value rule wins (no stacking).
async function evaluateRulesForEvent(
  tx: Tx,
  input: ApplyEventInput,
  orderFacts: Record<string, unknown>,
  itemFacts: Record<string, unknown>[],
): Promise<MatchedRuleRow[]> {
  const rows = await tx
    .select({ rule: earningRules })
    .from(earningRules)
    .where(
      and(
        eq(earningRules.tenantId, input.tenantId),
        eq(earningRules.eventType, input.eventType),
        eq(earningRules.active, true),
      ),
    );

  let bestMatch: MatchedRuleRow | null = null;

  for (const { rule } of rows) {
    if (!isRuleActive(rule)) continue;

    const groups = (rule.formulaGroups as FormulaGroup[]) ?? [];
    if (groups.length === 0) continue;

    let points = 0;
    if (rule.perItem) {
      for (const facts of itemFacts) {
        points += bestGroupPoints(groups, facts);
      }
    } else {
      points = bestGroupPoints(groups, orderFacts);
    }

    if (points <= 0) continue;

    // Highest value wins; first-in-list wins ties
    if (!bestMatch || points > bestMatch.points) {
      bestMatch = { rule, points };
    }
  }

  return bestMatch ? [bestMatch] : [];
}

export async function applyEvent(
  input: ApplyEventInput,
  outerTx?: Tx,
): Promise<ApplyEventResult> {
  validateEventPayload(input.eventType, input.payload);

  const eventKey =
    input.eventKey ?? deriveEventKey(input.eventType, input.customerId, input.payload);

  const run = async (tx: Tx) => {
    if (eventKey) {
      const [existing] = await tx
        .select({ id: events.id })
        .from(events)
        .where(and(eq(events.tenantId, input.tenantId), eq(events.eventKey, eventKey)))
        .limit(1);
      if (existing) {
        return {
          eventId: existing.id,
          duplicate: true,
          totalAwarded: 0,
          awards: [],
        };
      }
    }

    let eventId: string;
    try {
      const [eventRow] = await tx
        .insert(events)
        .values({
          tenantId: input.tenantId,
          customerId: input.customerId,
          eventType: input.eventType,
          eventKey,
          payload: input.payload,
          occurredAt: input.occurredAt ?? new Date(),
        })
        .returning({ id: events.id });
      eventId = eventRow.id;
    } catch (err) {
      if (isDuplicateKeyError(err) && eventKey) {
        return {
          eventId: "",
          duplicate: true,
          totalAwarded: 0,
          awards: [],
        };
      }
      throw err;
    }

    const { orderFacts, itemFacts } = await buildEventFacts(tx, input);
    const matches = await evaluateRulesForEvent(tx, input, orderFacts, itemFacts);

    const awards: AwardDetail[] = [];
    let totalAwarded = 0;

    for (const { rule, points } of matches) {
      await creditPoints(tx, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        ruleId: rule.id,
        points,
        expiresAt: expiresAfter(rule.pointsExpireAfterDays),
      });
      await tx.insert(pointTransactions).values({
        tenantId: input.tenantId,
        customerId: input.customerId,
        transactionType: "earn",
        points,
        orderAmount: orderFacts.orderAmount != null ? String(orderFacts.orderAmount) : null,
        itemQuantity:
          typeof orderFacts.itemQuantity === "number" ? orderFacts.itemQuantity : null,
        ruleId: rule.id,
        eventId,
        description: input.description ?? `Earned via ${eventLabel(input.eventType)}`,
        metadata: { eventType: input.eventType, eventKey: eventKey ?? undefined },
      });
      totalAwarded += points;
      awards.push({ ruleId: rule.id, ruleName: rule.name, points });
    }

    return { eventId, duplicate: false, totalAwarded, awards };
  };

  return outerTx ? run(outerTx) : withExpiry(run);
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
  await pool.query("TRUNCATE api_keys, events, customer_rule_balances, point_transactions, redemption_rewards, earning_rules, customers, products, users, tenants RESTART IDENTITY CASCADE");
}
