import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  billingCounters,
  invoices,
  plans,
  subscriptions,
  type InvoiceLineItem,
} from "@/db/schema";
import type {
  BillingCycle,
  InvoiceBaseStatus,
  InvoiceEffectiveStatus,
} from "@/types";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

export const BILLING_COUNTER_KEY = "invoice";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function fmtMoney(n: number): string {
  return round2(n).toFixed(2);
}

const asNum = (v: string | number | null | undefined): number =>
  Number(v ?? 0);

export function invoiceTotals(
  lineItems: InvoiceLineItem[],
  taxPercent: number | string = 0,
): { subtotal: string; taxAmount: string; total: string } {
  const subtotal = round2(
    lineItems.reduce(
      (sum, item) => sum + item.quantity * asNum(item.unitPrice),
      0,
    ),
  );
  const taxAmount = round2(subtotal * (asNum(taxPercent) / 100));
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: (subtotal + taxAmount).toFixed(2),
  };
}

export function paidAmount(paymentsList: { amount: string | number }[]): string {
  return fmtMoney(
    paymentsList.reduce((sum, p) => sum + asNum(p.amount), 0),
  );
}

export function effectiveInvoiceStatus(
  status: InvoiceBaseStatus,
  paid: number | string,
  total: number | string,
  dueAt: Date | string | null,
): InvoiceEffectiveStatus {
  if (status === "draft") return "draft";
  if (status === "voided") return "voided";
  const paidNum = asNum(paid);
  const totalNum = asNum(total);
  if (paidNum >= totalNum) return "paid";
  if (paidNum > 0) return "partially_paid";
  if (dueAt && new Date(dueAt) < new Date()) return "overdue";
  return "issued";
}

export function advanceBillingDate(from: Date, cycle: BillingCycle): Date {
  const d = new Date(from);
  if (cycle === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

const formatDay = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);

export function periodLabel(start: Date, cycle: BillingCycle): string {
  const end = new Date(advanceBillingDate(start, cycle).getTime() - 1);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** Assign the next sequential invoice number atomically (INV-00001). */
export async function nextInvoiceNumber(d: DbLike): Promise<string> {
  const [row] = await d
    .insert(billingCounters)
    .values({ key: BILLING_COUNTER_KEY, value: 1 })
    .onConflictDoUpdate({
      target: billingCounters.key,
      set: { value: sql`${billingCounters.value} + 1` },
    })
    .returning({ value: billingCounters.value });
  return `INV-${String(row.value).padStart(5, "0")}`;
}

/** Move a draft invoice to issued: freeze number, set issuedAt + 7d due. */
export async function issueInvoice(
  d: DbLike,
  invoiceId: string,
  tenantId?: string,
): Promise<void> {
  const [inv] = await d
    .select()
    .from(invoices)
    .where(
      tenantId
        ? and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId))
        : eq(invoices.id, invoiceId),
    )
    .limit(1);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status !== "draft") throw new Error("Only draft invoices can be issued");

  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await d
    .update(invoices)
    .set({
      invoiceNumber: await nextInvoiceNumber(d),
      status: "issued",
      issuedAt: now,
      dueAt: due,
      updatedAt: now,
    })
    .where(eq(invoices.id, invoiceId));
}

// Generate and issue an invoice for one active subscription period. Used on
// approval and by the cron sweep.
async function generateInvoiceForSubscription(
  d: DbLike,
  sub: typeof subscriptions.$inferSelect,
  plan: typeof plans.$inferSelect,
  periodStart: Date,
): Promise<boolean> {
  const periodEnd = advanceBillingDate(periodStart, plan.billingCycle);
  const lineItems: InvoiceLineItem[] = [
    {
      description: `${plan.name} — ${plan.billingCycle}`,
      quantity: 1,
      unitPrice: plan.price,
    },
  ];
  await d.insert(invoices).values({
    tenantId: sub.tenantId,
    invoiceNumber: await nextInvoiceNumber(d),
    status: "issued",
    lineItems,
    ...invoiceTotals(lineItems, plan.taxPercent),
    taxPercent: plan.taxPercent,
    issuedAt: new Date(),
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    periodStart: formatDay(periodStart),
    periodEnd: formatDay(new Date(periodEnd.getTime() - 1)),
  });
  await d
    .update(subscriptions)
    .set({ nextBillingAt: periodEnd, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));
  return true;
}

/**
 * Issue an invoice for the current period immediately with a 7-day due date.
 * Caller owns the transaction.
 */
export async function approveSubscription(
  d: DbLike,
  subscriptionId: string,
): Promise<void> {
  const [sub] = await d
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1);
  if (!sub) throw new Error("Subscription not found");

  const [plan] = await d
    .select()
    .from(plans)
    .where(eq(plans.id, sub.planId))
    .limit(1);
  if (!plan) throw new Error("Plan not found");

  // Demote any other active subscription for this tenant.
  await d
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(
      and(
        eq(subscriptions.tenantId, sub.tenantId),
        eq(subscriptions.status, "active"),
      ),
    );

  await d
    .update(subscriptions)
    .set({ status: "active", nextBillingAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));

  await generateInvoiceForSubscription(d, sub, plan, new Date());
}

/**
 * Sweep: issue invoices for every active subscription that has passed a billing
 * boundary. Catches up missed periods (bounded to avoid an unbounded burst).
 */
export async function generateDueInvoices(
  now: Date = new Date(),
  dbLike?: DbLike,
): Promise<number> {
  const run = async (d: DbLike) => {
    const active = await d
      .select({ sub: subscriptions, plan: plans })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .where(and(eq(subscriptions.status, "active"), isNotNull(subscriptions.nextBillingAt), lte(subscriptions.nextBillingAt, now)));

    let generated = 0;
    for (const { sub, plan } of active) {
      let boundary = sub.nextBillingAt as Date;
      let guard = 0;
      while (boundary <= now && guard < 24) {
        await generateInvoiceForSubscription(d, sub, plan, boundary);
        boundary = sub.nextBillingAt as Date;
        generated += 1;
        guard += 1;
      }
    }
    return generated;
  };
  return dbLike ? run(dbLike) : db.transaction(run);
}

export function updateSubscriptionStatus(
  d: DbLike,
  subscriptionId: string,
  status: "active" | "canceled",
): Promise<void> {
  return d
    .update(subscriptions)
    .set({ status, updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
    .then(() => undefined);
}

export function serializeInvoice(
  inv: typeof invoices.$inferSelect,
  paymentList: { amount: string | number }[],
) {
  const paid = paidAmount(paymentList);
  return {
    id: inv.id,
    tenantId: inv.tenantId,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    effectiveStatus: effectiveInvoiceStatus(
      inv.status,
      paid,
      inv.total,
      inv.dueAt,
    ),
    lineItems: inv.lineItems,
    subtotal: inv.subtotal,
    taxPercent: inv.taxPercent,
    taxAmount: inv.taxAmount,
    total: inv.total,
    issuedAt: inv.issuedAt,
    dueAt: inv.dueAt,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    memo: inv.memo,
    paid,
    outstanding: fmtMoney(asNum(inv.total) - asNum(paid)),
    payments: paymentList,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}