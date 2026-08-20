import type { EventType, FormulaGroup, RuleGroupType, StructuredFormula } from "@/lib/rules";
export type { EventType, FormulaGroup, RuleGroupType, StructuredFormula };

export interface EarningRule extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  eventType: EventType;
  perItem: boolean;
  formulaGroups: FormulaGroup[];
  formulaText: string;
  pointsExpireAfterDays: number | null;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EarningRuleInput {
  name: string;
  description?: string | null;
  eventType?: EventType;
  perItem?: boolean;
  formulaGroups?: FormulaGroup[];
  pointsExpireAfterDays?: number | null;
  active?: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
}

export type AssignedRule = EarningRule;
