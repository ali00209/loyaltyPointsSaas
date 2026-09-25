import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { FormulaGroup, RuleGroupType } from "@/lib/rules";

export const roleEnum = pgEnum("user_role", ["admin", "owner"]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "earn",
  "redeem",
  "adjust",
  "expire",
]);

export const redemptionDiscountTypeEnum = pgEnum("redemption_discount_type", [
  "fixed",
  "percent",
]);

export const redemptionModeEnum = pgEnum("redemption_mode", [
  "fixed",
  "per_point",
]);

export const billingCycleEnum = pgEnum("billing_cycle", [
  "weekly",
  "monthly",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "canceled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "issued",
  "voided",
]);

export const redemptionCheckoutStatusEnum = pgEnum(
  "redemption_checkout_status",
  ["reserved", "finalized", "released", "refunded"],
);

export const eventTypeEnum = pgEnum("event_type", [
  "purchase",
  "visit",
  "review",
  "referral",
  "newsletter_signup",
  "social_share",
  "customer_signup",
]);

export interface BrandingConfig {
  logoUrl?: string | null;
  brandColor?: string | null;
}

// Tenants (businesses on the platform). slug powers the public portal /p/{slug}.
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandingConfig: jsonb("branding_config")
    .$type<BrandingConfig>()
    .notNull()
    .default({}),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Platform users. Admins run the SaaS (tenantId NULL); owners belong to a tenant.
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("owner"),
  tenantId: uuid("tenant_id").references(() => tenants.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer catalog (tenant-scoped). Email is the portal login handle and is
// unique per tenant. referralCode powers /p/{slug}?ref=CODE attribution.
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    referralCode: text("referral_code"),
    isActive: boolean("is_active").notNull().default(true),
    totalPointsEarned: integer("total_points_earned").notNull().default(0),
    currentBalance: integer("current_balance").notNull().default(0),
    joinDate: timestamp("join_date").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customers_email_tenant_idx")
      .on(table.email, table.tenantId)
      .where(sql`${table.email} is not null`),
    uniqueIndex("customers_phone_tenant_idx")
      .on(table.phone, table.tenantId)
      .where(sql`${table.phone} is not null`),
    uniqueIndex("customers_referral_code_tenant_idx")
      .on(table.referralCode, table.tenantId)
      .where(sql`${table.referralCode} is not null`),
  ],
);

// Optional catalog products; joins give purchase/review rules their derived
// facts (productPrice, productCategory).
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  category: text("category").notNull().default("General"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Earning rules are authored by the tenant owner from the owner dashboard.
// Each rule belongs to exactly one tenant.
export const earningRules = pgTable("earning_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  eventType: eventTypeEnum("event_type").notNull(),
  perItem: boolean("per_item").notNull().default(false),
  formulaGroups: jsonb("formula_groups")
    .$type<FormulaGroup[]>()
    .notNull()
    .default([]),
  pointsExpireAfterDays: integer("points_expire_after_days"),
  active: boolean("active").notNull().default(true),
  activeFrom: timestamp("active_from"),
  activeUntil: timestamp("active_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Rewards are created by the tenant themselves.
export const redemptionRewards = pgTable("redemption_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pointsCost: integer("points_cost").notNull(),
  inventoryLimit: integer("inventory_limit"),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  details: jsonb("details")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Merchant-private, automatically applied checkout benefits. The legacy
// redemption_rewards table remains for historical data compatibility.
export const redemptionRules = pgTable(
  "redemption_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    redemptionMode: redemptionModeEnum("redemption_mode").notNull().default("fixed"),
    discountType: redemptionDiscountTypeEnum("discount_type").notNull(),
    discountValue: numeric("discount_value", {
      precision: 12,
      scale: 2,
    }).notNull(),
    pointsCost: integer("points_cost").notNull(),
    priority: integer("priority").notNull().default(0),
    conditions: jsonb("conditions")
      .$type<RuleGroupType>()
      .notNull()
      .default({ combinator: "and", rules: [] }),
    active: boolean("active").notNull().default(true),
    activeFrom: timestamp("active_from"),
    activeUntil: timestamp("active_until"),
    perCustomerLimit: integer("per_customer_limit"),
    tenantUsageLimit: integer("tenant_usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "redemption_rules_discount_value_positive",
      sql`${table.discountValue} > 0`,
    ),
    check(
      "redemption_rules_points_cost_positive",
      sql`${table.pointsCost} > 0`,
    ),
    check(
      "redemption_rules_limits_positive",
      sql`(${table.perCustomerLimit} is null or ${table.perCustomerLimit} > 0) and (${table.tenantUsageLimit} is null or ${table.tenantUsageLimit} > 0)`,
    ),
  ],
);

// Ingested point-earning events. eventKey is unique per tenant when present
// (null for repeatable events), giving idempotency / dedupe.
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    eventKey: text("event_key"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("events_key_tenant_idx")
      .on(table.eventKey, table.tenantId)
      .where(sql`${table.eventKey} is not null`),
  ],
);

// POS / API access: one hashed key per tenant, owner-managed and rotatable.
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Default"),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ledger of point activity (earn / redeem / adjust / expire).
export const pointTransactions = pgTable("point_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  transactionType: transactionTypeEnum("transaction_type").notNull(),
  points: integer("points").notNull(),
  orderAmount: numeric("order_amount", { precision: 12, scale: 2 }),
  itemQuantity: integer("item_quantity"),
  ruleId: uuid("rule_id").references(() => earningRules.id, {
    onDelete: "set null",
  }),
  rewardId: uuid("reward_id").references(() => redemptionRewards.id, {
    onDelete: "set null",
  }),
  redemptionRuleId: uuid("redemption_rule_id").references(
    () => redemptionRules.id,
    {
      onDelete: "set null",
    },
  ),
  eventId: uuid("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const redemptionCheckouts = pgTable(
  "redemption_checkouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    checkoutId: text("checkout_id").notNull(),
    orderId: text("order_id"),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    redemptionRuleId: uuid("redemption_rule_id").references(
      () => redemptionRules.id,
      {
        onDelete: "set null",
      },
    ),
    pointsCost: integer("points_cost").notNull().default(0),
    orderAmount: numeric("order_amount", { precision: 12, scale: 2 }).notNull(),
    eligibleSubtotal: numeric("eligible_subtotal", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: numeric("discount_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    discountType: redemptionDiscountTypeEnum("discount_type"),
    status: redemptionCheckoutStatusEnum("status")
      .notNull()
      .default("reserved"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("redemption_checkouts_tenant_checkout_idx").on(
      table.tenantId,
      table.checkoutId,
    ),
    uniqueIndex("redemption_checkouts_tenant_order_idx")
      .on(table.tenantId, table.orderId)
      .where(sql`${table.orderId} is not null`),
  ],
);

// Per-earn point buckets used for FIFO expiry. ruleId is null for manual
// adjust credits, which never expire.
export const customerRuleBalances = pgTable("customer_rule_balances", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => earningRules.id, {
    onDelete: "set null",
  }),
  remainingPoints: integer("remaining_points").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Billing (SaaS platform charges merchants) ──────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: string;
}

// Plan templates the platform admin offers. Owners request a plan; the admin
// approves it into an active subscription.
export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  billingCycle: billingCycleEnum("billing_cycle").notNull().default("monthly"),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SubscriptionStatus = "pending" | "active" | "canceled";

// One active subscription per tenant (partial unique index). pending = owner
// requested a plan, admin approves it.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("pending"),
    nextBillingAt: timestamp("next_billing_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("subscriptions_active_tenant_idx")
      .on(table.tenantId)
      .where(sql`${table.status} = 'active'`),
  ],
);

// Invoices are frozen once issued (real-invoice semantics). status is the
// base state; the effective state (due / overdue / partially_paid / paid) is
// derived from payments vs total.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").unique(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    lineItems: jsonb("line_items")
      .$type<InvoiceLineItem[]>()
      .notNull()
      .default([]),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    taxPercent: numeric("tax_percent", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    issuedAt: timestamp("issued_at"),
    dueAt: timestamp("due_at"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    memo: text("memo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "invoices_total_positive",
      sql`${table.total} >= 0`,
    ),
    check(
      "invoices_amounts_match",
      sql`${table.subtotal} + ${table.taxAmount} = ${table.total}`,
    ),
  ],
);

// Manual payment recordings against an invoice (offline: bank transfer, cash…).
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  note: text("note"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Atomic per-platform counters (single counter row: "invoice").
export const billingCounters = pgTable("billing_counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});
