import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  pointTransactions,
  products,
  redemptionCheckouts,
  redemptionRules,
} from "@/db/schema";
import {
  conditionsMatch,
  validateRedemptionConditions,
  type RuleGroupType,
} from "@/lib/rules";
import { normalizePakistaniMobile } from "@/lib/phone";
import { consumePoints, restorePoints, withExpiry, PointsError } from "@/lib/points";
import type {
  CheckoutBenefit,
  CheckoutItem,
  CheckoutPreview,
  CheckoutResult,
  RedemptionRuleInput,
} from "@/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const ITEM_FACTS = new Set(["quantity", "unitPrice", "productId", "productCategory"]);

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function active(rule: typeof redemptionRules.$inferSelect): boolean {
  if (!rule.active) return false;
  const now = new Date();
  return !(rule.activeFrom && now < rule.activeFrom) &&
    !(rule.activeUntil && now > rule.activeUntil);
}

function conditionFields(group: RuleGroupType, fields = new Set<string>()): Set<string> {
  for (const rule of group.rules) {
    if ("combinator" in rule) conditionFields(rule, fields);
    else fields.add(rule.field);
  }
  return fields;
}

function customerLimitReached(
  rule: typeof redemptionRules.$inferSelect,
  customerCount: number,
  tenantCount: number,
): boolean {
  return (rule.perCustomerLimit != null && customerCount >= rule.perCustomerLimit) ||
    (rule.tenantUsageLimit != null && tenantCount >= rule.tenantUsageLimit);
}

async function lookupCustomer(
  tx: Tx,
  tenantId: string,
  input: { customerId?: string; customerEmail?: string; customerPhone?: string },
) {
  const matches = new Map<string, typeof customers.$inferSelect>();
  if (input.customerId) {
    const [row] = await tx.select().from(customers).where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)),
    ).limit(1);
    if (!row) throw new PointsError("Customer not found", 404);
    matches.set(row.id, row);
  }
  if (input.customerEmail?.trim()) {
    const email = input.customerEmail.trim().toLowerCase();
    const rows = await tx.select().from(customers).where(
      and(eq(customers.tenantId, tenantId), eq(customers.email, email)),
    ).limit(2);
    if (rows.length > 1) throw new PointsError("Customer lookup is ambiguous", 409);
    if (!rows[0]) throw new PointsError("Customer not found", 404);
    matches.set(rows[0].id, rows[0]);
  }
  if (input.customerPhone?.trim()) {
    const phone = normalizePakistaniMobile(input.customerPhone);
    if (!phone) throw new PointsError("Invalid Pakistani mobile number");
    const rows = await tx.select().from(customers).where(
      and(eq(customers.tenantId, tenantId), eq(customers.phone, phone)),
    ).limit(2);
    if (rows.length > 1) throw new PointsError("Customer lookup is ambiguous", 409);
    if (!rows[0]) throw new PointsError("Customer not found", 404);
    matches.set(rows[0].id, rows[0]);
  }
  if (matches.size === 0) throw new PointsError("customerId, customerEmail, or customerPhone is required");
  if (matches.size > 1) throw new PointsError("Customer identifiers identify different customers", 409);
  return [...matches.values()][0];
}

function normalizeItems(items: CheckoutItem[]): CheckoutItem[] {
  return items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  })).filter((item) => item.quantity > 0 && item.unitPrice >= 0);
}

async function selectBenefit(
  tx: Tx,
  tenantId: string,
  customer: typeof customers.$inferSelect,
  orderAmount: number,
  inputItems: CheckoutItem[],
): Promise<{
  candidate: {
    rule: typeof redemptionRules.$inferSelect;
    eligibleSubtotal: number;
    discountAmount: number;
    pointsCost: number;
    customerCount: number;
    tenantCount: number;
  } | null;
  reason: string | null;
}> {
  const items = normalizeItems(inputItems);
  const ids = items.map((item) => item.productId).filter((id): id is string => Boolean(id));
  const catalog = ids.length
    ? await tx.select().from(products).where(
      and(eq(products.tenantId, tenantId), inArray(products.id, ids)),
    )
    : [];
  const catalogMap = new Map(catalog.map((product) => [product.id, product]));
  const itemFacts = items.map((item) => {
    const product = item.productId ? catalogMap.get(item.productId) : undefined;
    return {
      item,
      facts: {
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        productId: product?.id ?? item.productId ?? "",
        productCategory: product?.category ?? item.category ?? "",
      },
    };
  });
  const orderFacts = {
    orderAmount,
    itemQuantity: itemFacts.reduce((sum, entry) => sum + entry.item.quantity, 0),
    itemCount: itemFacts.length,
    productIds: itemFacts.map((entry) => entry.facts.productId).filter(Boolean).join(","),
    productCategories: itemFacts.map((entry) => entry.facts.productCategory).filter(Boolean).join(","),
    pointsBalance: customer.currentBalance,
  };
  const rules = await tx.select().from(redemptionRules).where(
    and(eq(redemptionRules.tenantId, tenantId), eq(redemptionRules.active, true)),
  ).orderBy(desc(redemptionRules.priority), redemptionRules.id);

  const candidates: Array<{
    rule: typeof redemptionRules.$inferSelect;
    eligibleSubtotal: number;
    discountAmount: number;
    pointsCost: number;
    customerCount: number;
    tenantCount: number;
  }> = [];
  let matchedOrder = false;
  for (const rule of rules) {
    if (!active(rule)) continue;
    const conditions = rule.conditions as RuleGroupType;
    const fields = conditionFields(conditions);
    const requiresItems = [...fields].some((field) => ITEM_FACTS.has(field));
    let eligibleSubtotal = 0;
    if (requiresItems) {
      for (const entry of itemFacts) {
        if (conditionsMatch(conditions, { ...orderFacts, ...entry.facts })) {
          eligibleSubtotal += entry.item.quantity * entry.item.unitPrice;
        }
      }
    } else if (conditionsMatch(conditions, orderFacts)) {
      eligibleSubtotal = itemFacts.reduce((sum, entry) => sum + entry.item.quantity * entry.item.unitPrice, 0);
      if (eligibleSubtotal === 0) eligibleSubtotal = orderAmount;
    }
    eligibleSubtotal = money(Math.min(Math.max(eligibleSubtotal, 0), orderAmount));
    if (eligibleSubtotal <= 0) continue;
    matchedOrder = true;
    const statuses = ["reserved", "finalized"] as const;
    const [{ customerCount }] = await tx.select({
      customerCount: sql<number>`count(*)::int`,
    }).from(redemptionCheckouts).where(and(
      eq(redemptionCheckouts.tenantId, tenantId),
      eq(redemptionCheckouts.redemptionRuleId, rule.id),
      eq(redemptionCheckouts.customerId, customer.id),
      inArray(redemptionCheckouts.status, statuses),
    ));
    const [{ tenantCount }] = await tx.select({
      tenantCount: sql<number>`count(*)::int`,
    }).from(redemptionCheckouts).where(and(
      eq(redemptionCheckouts.tenantId, tenantId),
      eq(redemptionCheckouts.redemptionRuleId, rule.id),
      inArray(redemptionCheckouts.status, statuses),
    ));
    if (customerLimitReached(rule, Number(customerCount), Number(tenantCount))) continue;

    const value = Number(rule.discountValue);
    const pointsCost = rule.redemptionMode === "per_point"
      ? Math.min(customer.currentBalance, Math.floor((eligibleSubtotal + 0.000001) / value))
      : rule.pointsCost;
    if (pointsCost <= 0) continue;
    const discountAmount = money(Math.min(
      eligibleSubtotal,
      rule.redemptionMode === "per_point"
        ? pointsCost * value
        : rule.discountType === "percent"
          ? eligibleSubtotal * value / 100
          : value,
    ));
    candidates.push({ rule, eligibleSubtotal, discountAmount, pointsCost, customerCount: Number(customerCount), tenantCount: Number(tenantCount) });
  }

  candidates.sort((a, b) =>
    b.rule.priority - a.rule.priority ||
    b.discountAmount - a.discountAmount ||
    a.pointsCost - b.pointsCost ||
    a.rule.id.localeCompare(b.rule.id),
  );
  const highestPriorityCandidate = candidates[0] ?? null;
  const insufficientPoints =
    highestPriorityCandidate &&
    customer.currentBalance < highestPriorityCandidate.pointsCost;
  const candidate = insufficientPoints ? null : highestPriorityCandidate;
  return {
    candidate,
    reason: candidate
      ? null
      : insufficientPoints
        ? `Insufficient points: this customer has ${customer.currentBalance.toLocaleString()} points, but the highest-priority matching rule requires ${highestPriorityCandidate.pointsCost.toLocaleString()}.`
        : matchedOrder
          ? "No redemption rule is currently available for this customer (usage limit reached)."
          : "No redemption rule matches this order.",
  };
}

function resultFromRow(row: typeof redemptionCheckouts.$inferSelect, idempotent = false): CheckoutResult {
  return {
    checkoutId: row.checkoutId,
    orderId: row.orderId,
    status: row.status,
    matched: Boolean(row.redemptionRuleId),
    benefit: row.redemptionRuleId ? {
      ruleId: row.redemptionRuleId,
      ruleName: typeof row.metadata?.ruleName === "string" ? row.metadata.ruleName : undefined,
      discountType: row.discountType!,
      discountValue: Number(row.metadata?.discountValue ?? 0),
      discountAmount: Number(row.discountAmount),
      eligibleSubtotal: Number(row.eligibleSubtotal),
      pointsCost: row.pointsCost,
    } : null,
    idempotent,
    reason: null,
  };
}

async function previewSelection(
  tx: Tx,
  tenantId: string,
  input: {
    checkoutId?: string;
    orderId?: string;
    customerId?: string;
    customerEmail?: string;
    customerPhone?: string;
    orderAmount: number;
    items?: CheckoutItem[];
  },
): Promise<CheckoutPreview> {
  const customer = await lookupCustomer(tx, tenantId, input);
  const selection = await selectBenefit(
    tx,
    tenantId,
    customer,
    input.orderAmount,
    input.items ?? [],
  );
  const candidate = selection.candidate;
  return {
    checkoutId: input.checkoutId ?? "",
    orderId: input.orderId ?? null,
    status: "reserved",
    matched: Boolean(candidate),
    customerId: customer.id,
    customerName: customer.name,
    customerBalance: customer.currentBalance,
    remainingBalance: customer.currentBalance - (candidate?.pointsCost ?? 0),
    reason: selection.reason,
    benefit: candidate
      ? {
          ruleId: candidate.rule.id,
          ruleName: candidate.rule.name,
          discountType: candidate.rule.discountType,
          discountValue: Number(candidate.rule.discountValue),
          discountAmount: candidate.discountAmount,
          eligibleSubtotal: candidate.eligibleSubtotal,
          pointsCost: candidate.pointsCost,
        }
      : null,
  };
}

export async function reserveCheckout(input: {
  tenantId: string;
  checkoutId?: string;
  orderId?: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderAmount: number;
  items?: CheckoutItem[];
}) {
  const checkoutId = input.checkoutId?.trim() || input.orderId?.trim();
  if (!checkoutId) throw new PointsError("checkoutId or orderId is required");
  const orderAmount = money(Number(input.orderAmount));
  if (!Number.isFinite(orderAmount) || orderAmount < 0) throw new PointsError("orderAmount must be a non-negative number");

  try {
    return await withExpiry(async (tx) => {
    const existing = await tx.select().from(redemptionCheckouts).where(and(
      eq(redemptionCheckouts.tenantId, input.tenantId),
      or(
        eq(redemptionCheckouts.checkoutId, checkoutId),
        ...(input.orderId ? [eq(redemptionCheckouts.orderId, input.orderId)] : []),
      ),
    )).limit(1);
    if (existing[0]) return resultFromRow(existing[0], true);
    const customer = await lookupCustomer(tx, input.tenantId, input);
    const selection = await selectBenefit(tx, input.tenantId, customer, orderAmount, input.items ?? []);
    const candidate = selection.candidate;
    if (!candidate) {
      return {
        checkoutId,
        orderId: input.orderId ?? null,
        status: "reserved" as const,
        matched: false,
        benefit: null,
        idempotent: false,
        reason: selection.reason,
        remainingBalance: customer.currentBalance,
      };
    }
    const rule = candidate?.rule;
    if (rule) {
      const [updated] = await tx.update(redemptionRules).set({
        usageCount: sql`${redemptionRules.usageCount} + 1`,
      }).where(eq(redemptionRules.id, rule.id)).returning();
      if (!updated) throw new PointsError("Redemption rule is unavailable");
      await consumePoints(tx, {
        tenantId: input.tenantId,
        customerId: customer.id,
        amount: candidate.pointsCost,
      });
      await tx.insert(pointTransactions).values({
        tenantId: input.tenantId,
        customerId: customer.id,
        transactionType: "redeem",
        points: -candidate.pointsCost,
        redemptionRuleId: rule.id,
        orderAmount: String(orderAmount),
        description: `Reserved ${rule.name} checkout benefit`,
        metadata: { checkoutId, orderId: input.orderId ?? null, lifecycle: "reserve", discountAmount: candidate.discountAmount },
      });
    }
    const [row] = await tx.insert(redemptionCheckouts).values({
      tenantId: input.tenantId,
      checkoutId,
      orderId: input.orderId ?? null,
      customerId: customer.id,
      redemptionRuleId: rule?.id ?? null,
      pointsCost: candidate?.pointsCost ?? 0,
      orderAmount: String(orderAmount),
      eligibleSubtotal: String(candidate?.eligibleSubtotal ?? 0),
      discountAmount: String(candidate?.discountAmount ?? 0),
      discountType: rule?.discountType ?? null,
      metadata: rule ? {
        discountValue: Number(rule.discountValue),
        ruleName: rule.name,
        redemptionMode: rule.redemptionMode,
      } : {},
    }).returning();
    return {
      ...resultFromRow(row),
      remainingBalance: customer.currentBalance - candidate.pointsCost,
    };
    });
  } catch (error) {
    if (error instanceof Error && /duplicate key value/i.test(error.message)) {
      const existing = await db.select().from(redemptionCheckouts).where(and(
        eq(redemptionCheckouts.tenantId, input.tenantId),
        or(
          eq(redemptionCheckouts.checkoutId, checkoutId),
          ...(input.orderId ? [eq(redemptionCheckouts.orderId, input.orderId)] : []),
        ),
      )).limit(1);
      if (existing[0]) return resultFromRow(existing[0], true);
    }
    throw error;
  }
}

export async function previewCheckout(input: {
  checkoutId?: string;
  orderId?: string;
  tenantId: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderAmount: number;
  items?: CheckoutItem[];
}): Promise<CheckoutPreview> {
  const orderAmount = money(Number(input.orderAmount));
  if (!Number.isFinite(orderAmount) || orderAmount < 0) {
    throw new PointsError("orderAmount must be a non-negative number");
  }
  return db.transaction((tx) =>
    previewSelection(tx, input.tenantId, { ...input, orderAmount }),
  );
}

export async function confirmCheckout(input: {
  tenantId: string;
  checkoutId: string;
  orderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderAmount: number;
  items?: CheckoutItem[];
}): Promise<CheckoutResult> {
  const reserved = await reserveCheckout(input);
  if (!reserved.matched) return reserved;
  const finalized = await finalizeCheckout(input.tenantId, {
    checkoutId: reserved.checkoutId,
    orderId: reserved.orderId ?? undefined,
  });
  const [checkout] = await db
    .select({ customerId: redemptionCheckouts.customerId })
    .from(redemptionCheckouts)
    .where(and(
      eq(redemptionCheckouts.tenantId, input.tenantId),
      eq(redemptionCheckouts.checkoutId, reserved.checkoutId),
    ))
    .limit(1);
  const [customer] = await db
    .select({ currentBalance: customers.currentBalance })
    .from(customers)
    .where(and(
      eq(customers.id, checkout?.customerId ?? ""),
      eq(customers.tenantId, input.tenantId),
    ))
    .limit(1);
  return {
    ...finalized,
    remainingBalance: customer?.currentBalance,
  };
}

async function transitionCheckout(
  tenantId: string,
  identifier: { checkoutId?: string; orderId?: string },
  target: "finalized" | "released" | "refunded",
  reason?: string,
) {
  return withExpiry(async (tx) => {
    const row = await findCheckout(tx, tenantId, identifier);
    if (!row) throw new PointsError("Checkout not found", 404);
    if (row.status === target || row.status === "released" || row.status === "refunded") {
      return resultFromRow(row, true);
    }
    if (target === "finalized" && row.status !== "reserved") {
      throw new PointsError("Checkout cannot be finalized");
    }
    if (target === "refunded") {
      if (row.status !== "finalized") {
        throw new PointsError("Only confirmed checkouts can be refunded");
      }
      if (!reason?.trim()) throw new PointsError("Refund reason is required");
    }
    const [updated] = await tx.update(redemptionCheckouts).set({
      status: target,
      metadata: target === "refunded"
        ? { ...row.metadata, refundReason: reason!.trim() }
        : row.metadata,
      updatedAt: new Date(),
    }).where(and(
      eq(redemptionCheckouts.id, row.id),
      eq(redemptionCheckouts.status, row.status),
    )).returning();
    if (!updated) {
      const current = await findCheckout(tx, tenantId, identifier);
      if (current) return resultFromRow(current, true);
      throw new PointsError("Checkout not found", 404);
    }
    if ((target === "released" || target === "refunded") &&
      (row.status === "reserved" || row.status === "finalized")) {
      if (row.pointsCost > 0) {
        await tx.insert(pointTransactions).values({
          tenantId,
          customerId: row.customerId,
          transactionType: "adjust",
          points: row.pointsCost,
          redemptionRuleId: row.redemptionRuleId,
          orderAmount: row.orderAmount,
          description: target === "refunded" ? "Points restored after order refund" : "Checkout reservation released",
          metadata: { checkoutId: row.checkoutId, orderId: row.orderId, lifecycle: target, restoredPoints: row.pointsCost },
        });
        await restorePoints(tx, {
          tenantId,
          customerId: row.customerId,
          amount: row.pointsCost,
        });
        if (row.redemptionRuleId) {
          await tx.update(redemptionRules).set({
            usageCount: sql`GREATEST(${redemptionRules.usageCount} - 1, 0)`,
          }).where(and(eq(redemptionRules.id, row.redemptionRuleId), eq(redemptionRules.tenantId, tenantId)));
        }
      }
    }
    return resultFromRow(updated);
  });
}

async function findCheckout(
  tx: Tx,
  tenantId: string,
  identifier: { checkoutId?: string; orderId?: string },
) {
  const values = [
    identifier.checkoutId ? eq(redemptionCheckouts.checkoutId, identifier.checkoutId) : undefined,
    identifier.orderId ? eq(redemptionCheckouts.orderId, identifier.orderId) : undefined,
  ].filter(Boolean) as ReturnType<typeof eq>[];
  if (!values.length) throw new PointsError("checkoutId or orderId is required");
  return (await tx.select().from(redemptionCheckouts).where(and(
    eq(redemptionCheckouts.tenantId, tenantId),
    or(...values),
  )).limit(1))[0];
}

export const finalizeCheckout = (tenantId: string, identifier: { checkoutId?: string; orderId?: string }) =>
  transitionCheckout(tenantId, identifier, "finalized");
export const releaseCheckout = (tenantId: string, identifier: { checkoutId?: string; orderId?: string }) =>
  transitionCheckout(tenantId, identifier, "released");
export const refundCheckout = (
  tenantId: string,
  identifier: { checkoutId?: string; orderId?: string },
  reason?: string,
) => transitionCheckout(tenantId, identifier, "refunded", reason);

export function validateRedemptionRuleInput(input: RedemptionRuleInput) {
  if (!input.name?.trim()) throw new Error("Rule name is required");
  if (!["fixed", "percent"].includes(input.discountType)) throw new Error("Discount type must be fixed or percent");
  if (!Number.isFinite(input.discountValue) || input.discountValue <= 0) throw new Error("Discount value must be positive");
  if (input.discountType === "percent" && input.discountValue > 100) throw new Error("Percentage discount cannot exceed 100");
  if (!Number.isInteger(input.pointsCost) || input.pointsCost <= 0) throw new Error("Points cost must be a positive integer");
  validateRedemptionConditions(input.conditions ?? { combinator: "and", rules: [] });
}
