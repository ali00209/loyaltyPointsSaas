CREATE TYPE "public"."tenant_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "approval_status" "tenant_approval_status" DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
-- Tenants created before approval review existed are already live, so the
-- ADD COLUMN default above must not lock them out: grandfather them in.
-- Everything registered after this migration starts as "pending".
UPDATE "tenants" SET "approval_status" = 'approved';
