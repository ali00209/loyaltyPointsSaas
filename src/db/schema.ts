import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  uuid,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

import type { RuleConditions, PointsFormula } from "@/lib/rules";

export const roleEnum = pgEnum("user_role", ["admin", "owner"]);

export const triggerTypeEnum = pgEnum("trigger_type", [
  "per_product",
  "price_range",
  "bulk_quantity",
  "flat_rate",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "earn",
  "redeem",
  "adjust",
  "expire",
]);

export const rewardTypeEnum = pgEnum("reward_type", [
  "discount",
  "gift_card",
  "physical_item",
  "store_credit",
]);

export interface BrandingConfig {
  logoUrl?: string | null;
  brandColor?: string | null;
}

// Tenants (businesses on the platform)
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  brandingConfig: jsonb("branding_config").$type<BrandingConfig>().notNull().default({}),
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
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer catalog (tenant-scoped)
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  totalPointsEarned: integer("total_points_earned").notNull().default(0),
  currentBalance: integer("current_balance").notNull().default(0),
  joinDate: timestamp("join_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Optional catalog used by per_product rules (tenant-scoped)
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

// Earning rules are authored by platform admins and assigned to tenants.
export const earningRules = pgTable("earning_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: triggerTypeEnum("trigger_type").notNull(),
  conditions: jsonb("conditions").$type<RuleConditions>().notNull().default({}),
  pointsFormula: jsonb("points_formula").$type<PointsFormula>().notNull(),
  pointsExpireAfterDays: integer("points_expire_after_days"),
  active: boolean("active").notNull().default(true),
  activeFrom: timestamp("active_from"),
  activeUntil: timestamp("active_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Which rules a tenant has applied to their program.
export const tenantEarningRules = pgTable("tenant_earning_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => earningRules.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rewards are created by the tenant themselves.
export const redemptionRewards = pgTable("redemption_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pointsCost: integer("points_cost").notNull(),
  rewardType: rewardTypeEnum("reward_type").notNull(),
  inventoryLimit: integer("inventory_limit"),
  redeemedCount: integer("redeemed_count").notNull().default(0),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  ruleId: uuid("rule_id").references(() => earningRules.id, { onDelete: "set null" }),
  rewardId: uuid("reward_id").references(() => redemptionRewards.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
