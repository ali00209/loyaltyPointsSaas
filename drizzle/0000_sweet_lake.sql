CREATE TYPE "public"."event_type" AS ENUM('purchase', 'visit', 'review', 'referral', 'newsletter_signup', 'social_share', 'customer_signup');--> statement-breakpoint
CREATE TYPE "public"."redemption_checkout_status" AS ENUM('reserved', 'finalized', 'released', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."redemption_discount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."redemption_mode" AS ENUM('fixed', 'per_point');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('earn', 'redeem', 'adjust', 'expire');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "customer_rule_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"rule_id" uuid,
	"remaining_points" integer NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text,
	"referral_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_points_earned" integer DEFAULT 0 NOT NULL,
	"current_balance" integer DEFAULT 0 NOT NULL,
	"join_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earning_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"event_type" "event_type" NOT NULL,
	"per_item" boolean DEFAULT false NOT NULL,
	"formula_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"points_expire_after_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"active_from" timestamp,
	"active_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"event_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"transaction_type" "transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"order_amount" numeric(12, 2),
	"item_quantity" integer,
	"rule_id" uuid,
	"reward_id" uuid,
	"redemption_rule_id" uuid,
	"event_id" uuid,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"checkout_id" text NOT NULL,
	"order_id" text,
	"customer_id" uuid NOT NULL,
	"redemption_rule_id" uuid,
	"points_cost" integer DEFAULT 0 NOT NULL,
	"order_amount" numeric(12, 2) NOT NULL,
	"eligible_subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_type" "redemption_discount_type",
	"status" "redemption_checkout_status" DEFAULT 'reserved' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"points_cost" integer NOT NULL,
	"inventory_limit" integer,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemption_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"redemption_mode" "redemption_mode" DEFAULT 'fixed' NOT NULL,
	"discount_type" "redemption_discount_type" NOT NULL,
	"discount_value" numeric(12, 2) NOT NULL,
	"points_cost" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb DEFAULT '{"combinator":"and","rules":[]}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"active_from" timestamp,
	"active_until" timestamp,
	"per_customer_limit" integer,
	"tenant_usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "redemption_rules_discount_value_positive" CHECK ("redemption_rules"."discount_value" > 0),
	CONSTRAINT "redemption_rules_points_cost_positive" CHECK ("redemption_rules"."points_cost" > 0),
	CONSTRAINT "redemption_rules_limits_positive" CHECK (("redemption_rules"."per_customer_limit" is null or "redemption_rules"."per_customer_limit" > 0) and ("redemption_rules"."tenant_usage_limit" is null or "redemption_rules"."tenant_usage_limit" > 0))
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"branding_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"tenant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rule_balances" ADD CONSTRAINT "customer_rule_balances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rule_balances" ADD CONSTRAINT "customer_rule_balances_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_rule_balances" ADD CONSTRAINT "customer_rule_balances_rule_id_earning_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."earning_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_rules" ADD CONSTRAINT "earning_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_rule_id_earning_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."earning_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_reward_id_redemption_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."redemption_rewards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_redemption_rule_id_redemption_rules_id_fk" FOREIGN KEY ("redemption_rule_id") REFERENCES "public"."redemption_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_redemption_rule_id_redemption_rules_id_fk" FOREIGN KEY ("redemption_rule_id") REFERENCES "public"."redemption_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_rewards" ADD CONSTRAINT "redemption_rewards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_rules" ADD CONSTRAINT "redemption_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_tenant_idx" ON "customers" USING btree ("email","tenant_id") WHERE "customers"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_tenant_idx" ON "customers" USING btree ("phone","tenant_id") WHERE "customers"."phone" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_referral_code_tenant_idx" ON "customers" USING btree ("referral_code","tenant_id") WHERE "customers"."referral_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "events_key_tenant_idx" ON "events" USING btree ("event_key","tenant_id") WHERE "events"."event_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_checkouts_tenant_checkout_idx" ON "redemption_checkouts" USING btree ("tenant_id","checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_checkouts_tenant_order_idx" ON "redemption_checkouts" USING btree ("tenant_id","order_id") WHERE "redemption_checkouts"."order_id" is not null;