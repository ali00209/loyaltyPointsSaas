import type { EventType, RuleGroupType, StructuredFormula } from "@/lib/rules";

export type { EventType, RuleGroupType, StructuredFormula };

// A rule belonging to a tenant.
export interface EarningRule extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  eventType: EventType;
  perItem: boolean;
  conditions: RuleGroupType;
  formulaType: string;
  formulaBasis: string | null;
  formulaRate: number;
  formulaFlatAmount: number | null;
  formulaRounding: string;
  formulaMinPoints: number | null;
  formulaMaxPoints: number | null;
  formulaText: string;
  pointsExpireAfterDays: number | null;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// Input for creating/updating a rule.
export interface EarningRuleInput {
  name: string;
  description?: string | null;
  eventType?: EventType;
  perItem?: boolean;
  conditions?: RuleGroupType;
  structured?: StructuredFormula;
  pointsExpireAfterDays?: number | null;
  active?: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
}

// Alias — rules are now directly tenant-owned, no assignment layer.
export type AssignedRule = EarningRule;
