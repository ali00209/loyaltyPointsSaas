CREATE TYPE "redemption_mode" AS ENUM ('fixed', 'per_point');

ALTER TABLE "redemption_rules"
  ADD COLUMN "redemption_mode" "redemption_mode" NOT NULL DEFAULT 'fixed';
