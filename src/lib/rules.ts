export const REWARD_EVENT_TYPE = "earn-points";

export type RewardBasis = "orderAmount" | "itemQuantity";

export type TriggerType = "flat_rate" | "per_product" | "price_range" | "bulk_quantity";

export interface RuleConditions {
  productId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minQuantity?: number | null;
}

export interface PointsFormula {
  basis: RewardBasis;
  pointsPerUnit: number;
}

export interface EarnRuleConfig {
  triggerType: TriggerType;
  conditions: RuleConditions;
  pointsFormula: PointsFormula;
}

export interface TransactionFacts {
  orderAmount: number;
  itemQuantity: number;
  productId?: string | null;
}

export function basisForTrigger(type: string): RewardBasis {
  return type === "per_product" || type === "bulk_quantity" ? "itemQuantity" : "orderAmount";
}

export function toNum(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function calculatePoints(
  formula: PointsFormula,
  facts: { orderAmount?: number | string | null; itemQuantity?: number | string | null },
): number {
  const basisValue = Number(facts[formula.basis] ?? 0);
  return Math.floor(basisValue * formula.pointsPerUnit);
}

export function ruleMatches(rule: EarnRuleConfig, facts: TransactionFacts): boolean {
  const { triggerType, conditions } = rule;
  const orderAmount = Number(facts.orderAmount ?? 0);
  const itemQuantity = Number(facts.itemQuantity ?? 0);

  switch (triggerType) {
    case "per_product":
      if (conditions.productId && facts.productId !== conditions.productId) return false;
      return true;
    case "price_range":
      if (conditions.minPrice != null && orderAmount < conditions.minPrice) return false;
      if (conditions.maxPrice != null && orderAmount > conditions.maxPrice) return false;
      return true;
    case "bulk_quantity":
      if (conditions.minQuantity != null && itemQuantity < conditions.minQuantity) return false;
      return true;
    case "flat_rate":
    default:
      return true;
  }
}

export function evaluateRules(
  rules: EarnRuleConfig[],
  facts: TransactionFacts,
): EarnRuleConfig[] {
  return rules.filter((rule) => ruleMatches(rule, facts));
}

export function validateRule(rule: EarnRuleConfig): void {
  if (!rule || typeof rule !== "object") {
    throw new Error("Rule must be an object");
  }
  if (!["flat_rate", "per_product", "price_range", "bulk_quantity"].includes(rule.triggerType)) {
    throw new Error("Rule must have a valid triggerType");
  }
  if (
    !rule.pointsFormula ||
    typeof rule.pointsFormula.pointsPerUnit !== "number" ||
    rule.pointsFormula.pointsPerUnit <= 0
  ) {
    throw new Error("Rule must have pointsFormula.pointsPerUnit > 0");
  }
  if (rule.triggerType === "price_range") {
    const min = rule.conditions?.minPrice;
    const max = rule.conditions?.maxPrice;
    if (min == null && max == null) {
      throw new Error("Price range rules need a min or max price");
    }
    if (min != null && max != null && max < min) {
      throw new Error("Price range max must be >= min");
    }
  }
  if (rule.triggerType === "bulk_quantity" && (rule.conditions?.minQuantity ?? 1) < 1) {
    throw new Error("Bulk quantity rules need minQuantity >= 1");
  }
}
