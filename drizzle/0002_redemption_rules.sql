CREATE TYPE "public"."redemption_discount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."redemption_checkout_status" AS ENUM('reserved', 'finalized', 'released', 'refunded');--> statement-breakpoint
CREATE TABLE "redemption_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
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
);--> statement-breakpoint
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
);--> statement-breakpoint
ALTER TABLE "point_transactions" ADD COLUMN "redemption_rule_id" uuid;--> statement-breakpoint
ALTER TABLE "redemption_rules" ADD CONSTRAINT "redemption_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_checkouts" ADD CONSTRAINT "redemption_checkouts_redemption_rule_id_redemption_rules_id_fk" FOREIGN KEY ("redemption_rule_id") REFERENCES "public"."redemption_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_redemption_rule_id_redemption_rules_id_fk" FOREIGN KEY ("redemption_rule_id") REFERENCES "public"."redemption_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_checkouts_tenant_checkout_idx" ON "redemption_checkouts" USING btree ("tenant_id","checkout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_checkouts_tenant_order_idx" ON "redemption_checkouts" USING btree ("tenant_id","order_id") WHERE "redemption_checkouts"."order_id" is not null;
