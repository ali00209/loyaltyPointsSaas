export type TriggerType = "flat_rate" | "per_product" | "price_range" | "bulk_quantity";

export type RewardBasis = "orderAmount" | "itemQuantity";

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

// A rule as authored by the platform admin.
export interface EarningRule extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  triggerType: TriggerType;
  conditions: RuleConditions;
  pointsFormula: PointsFormula;
  pointsExpireAfterDays: number | null;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  assignedCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EarningRuleInput {
  name: string;
  description?: string | null;
  triggerType?: TriggerType;
  productId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minQuantity?: number | null;
  pointsPerUnit?: number;
  pointsExpireAfterDays?: number | null;
  active?: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
}

// A rule assigned to the current tenant (read-only view + toggle).
export interface AssignedRule extends EarningRule {
  assignmentId: string;
  assignmentActive: boolean;
  productName?: string | null;
}
