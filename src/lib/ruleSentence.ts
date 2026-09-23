// ---------------------------------------------------------------------------
// Sentence-style conditions: pure render + simplify helpers over RuleGroupType.
//
// Authoring UI (ConditionSentenceEditor) emits one-level groups with the
// operators below (comparisons + between). Older rules may still nest groups
// or use richer operators (in / contains / isSet); those render read-only via
// the same renderer and can be flattened with simplifyConditions.
// ---------------------------------------------------------------------------

import type { RuleGroupType, RuleType } from "react-querybuilder";
import { formatPKR } from "@/lib/money";

export interface AuthoringField {
  name: string;
  label: string;
  type: "number" | "string";
}

export const SENTENCE_OPERATORS = {
  "=": { name: "=", phrase: "is", numeric: false },
  "!=": { name: "!=", phrase: "is not", numeric: false },
  ">": { name: ">", phrase: "is greater than", numeric: true },
  ">=": { name: ">=", phrase: "is at least", numeric: true },
  "<": { name: "<", phrase: "is less than", numeric: true },
  "<=": { name: "<=", phrase: "is at most", numeric: true },
  between: { name: "between", phrase: "is between", numeric: true },
  notBetween: { name: "notBetween", phrase: "is not between", numeric: true },
} as const;

export type AuthoredOperator = keyof typeof SENTENCE_OPERATORS;

export const AUTHORED_OPERATORS = Object.keys(
  SENTENCE_OPERATORS,
) as AuthoredOperator[];

const AUTHORED_SET = new Set<string>(AUTHORED_OPERATORS);

const ALIAS_TO_CANONICAL: Record<string, AuthoredOperator> = {
  eq: "=",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

const LEGACY_PHRASES: Record<string, string> = {
  contains: "contains",
  in: "includes any of",
  isSet: "is set",
};

function canonicalOperator(op: string): AuthoredOperator | null {
  if (AUTHORED_SET.has(op)) return op as AuthoredOperator;
  return ALIAS_TO_CANONICAL[op] ?? null;
}

function operatorPhrase(op: string): string {
  const canonical = canonicalOperator(op);
  if (canonical) return SENTENCE_OPERATORS[canonical].phrase;
  return LEGACY_PHRASES[op] ?? op;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    const n = Math.round(v * 1e6) / 1e6;
    return Number.isInteger(n) ? String(n) : String(n);
  }
  return String(v);
}

function fieldLabel(field: string, labels: Record<string, string>): string {
  return labels[field] ?? field;
}

/** Render one condition as prose. Handles both authored and legacy operators. */
export function ruleSentence(
  rule: RuleType,
  labels: Record<string, string>,
): string {
  const label = fieldLabel(rule.field, labels);
  const op = rule.operator;
  let value = rule.value;

  if (op === "isSet") return `${label} is set`;

  if (op === "between" || op === "notBetween") {
    const [lo, hi] = String(value ?? "")
      .split(",")
      .map((s) => s.trim());
    return `${label} ${operatorPhrase(op)} ${lo} and ${hi}`;
  }

  if (op === "in") {
    const list = String(value ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return `${label} ${operatorPhrase(op)} ${list.join(", ") || "<empty>"}`;
  }

  if (op === "contains") {
    return `${label} ${operatorPhrase(op)} ${formatValue(value)}`;
  }

  return `${label} ${operatorPhrase(op)}${formatValue(value) ? ` ${formatValue(value)}` : " <value>"}`;
}

/**
 * Render an entire conditions group to one prose sentence. Nested groups render
 * as parenthesized sub-sentences. Empty conditions yield "" (meaning: all
 * events qualify).
 */
export function renderConditionsSentence(
  conditions: RuleGroupType,
  labels: Record<string, string>,
): string {
  const parts = conditions.rules.map((rule) => {
    if ("combinator" in rule) {
      return `(${renderConditionsSentence(rule as RuleGroupType, labels)})`;
    }
    return ruleSentence(rule as RuleType, labels);
  });
  if (parts.length === 0) return "";
  return parts.join(` ${conditions.combinator} `);
}

/** True when the group uses nesting, an alias, or an operator outside the authored set. */
export function isLegacyConditions(conditions: RuleGroupType): boolean {
  return conditions.rules.some((rule) => {
    if ("combinator" in rule) return true;
    const op = (rule as RuleType).operator;
    return !AUTHORED_SET.has(op);
  });
}

/**
 * Flatten any group into a single-level, authored-operator group. Same-operand
 * aliases (eq/gt/gte/…) are normalized; conditions that can't be expressed
 * (in / contains / isSet / nested) are dropped. The caller previews the result
 * before applying — this is a best-effort helper.
 */
export function simplifyConditions(conditions: RuleGroupType): RuleGroupType {
  const leaves: RuleType[] = [];
  const walk = (group: RuleGroupType) => {
    for (const rule of group.rules) {
      if ("combinator" in rule) {
        walk(rule as RuleGroupType);
        continue;
      }
      const r = rule as RuleType;
      const canonical = canonicalOperator(r.operator);
      if (canonical) leaves.push({ ...r, operator: canonical });
    }
  };
  walk(conditions);
  const combinator = conditions.combinator === "or" ? "or" : "and";
  return { combinator, rules: leaves };
}

/** Operators selectable for a field in the sentence editor. */
export function operatorsForField(field: AuthoringField): AuthoredOperator[] {
  if (field.type === "string") return ["=", "!="];
  return AUTHORED_OPERATORS;
}

// ---------------------- Earning rule preview --------------------------------

export interface FormulaSentenceInput {
  formulaType: "rate" | "flat" | "perAmount";
  structured: {
    basis?: string;
    rate?: number;
    flatAmount?: number;
    pointsPerUnit?: number;
    spendUnit?: number;
  };
  conditions: RuleGroupType;
}

/**
 * Render one earning formula group to prose — the award formula plus any
 * conditions ("when …"). Handles flat, rate, and per-spending modes.
 */
export function renderFormulaGroupSentence(
  input: FormulaSentenceInput,
  labels: Record<string, string>,
): string {
  const { structured: s } = input;
  let award: string;
  if (input.formulaType === "flat") {
    award = `Earn ${formatValue(s.flatAmount ?? 0)} points`;
  } else if (input.formulaType === "perAmount") {
    const points = s.pointsPerUnit ?? 1;
    const spend = s.spendUnit ?? 100;
    award = `Earn ${formatValue(points)} point${points === 1 ? "" : "s"} for every ${formatPKR(spend)} spent`;
  } else {
    const basisLabel = s.basis ? (labels[s.basis] ?? s.basis) : "…";
    award = `Earn ${formatValue(s.rate ?? 0)}% of ${basisLabel} in points`;
  }

  const when = renderConditionsSentence(input.conditions, labels);
  return when ? `${award}, when ${when}.` : `${award}.`;
}

// ---------------------- Redemption rule preview -----------------------------

export interface RedemptionSentenceInput {
  redemptionMode: "fixed" | "per_point";
  discountType: "fixed" | "percent";
  discountValue: number;
  pointsCost: number;
  priority?: number;
  perCustomerLimit?: number | null;
  tenantUsageLimit?: number | null;
  active?: boolean;
  conditions: RuleGroupType;
}

/**
 * Render a complete redemption rule to prose — reward, conditions, and limits.
 * `labels` maps fact field names to display labels (see AuthoringField.label).
 */
export function renderRedemptionRuleSentence(
  input: RedemptionSentenceInput,
  labels: Record<string, string>,
): string {
  const reward =
    input.redemptionMode === "per_point"
      ? `Each point is worth ${formatPKR(input.discountValue)} off an eligible order`
      : input.discountType === "percent"
        ? `Redeem ${formatValue(input.pointsCost)} points to get ${formatValue(input.discountValue)}% off an eligible order`
        : `Redeem ${formatValue(input.pointsCost)} points to get ${formatPKR(input.discountValue)} off an eligible order`;

  const when = renderConditionsSentence(input.conditions, labels);
  const conditionClause = when ? `, when ${when}` : "";

  const limits: string[] = [];
  if (input.perCustomerLimit != null) {
    limits.push(
      `each customer may redeem it up to ${formatValue(input.perCustomerLimit)} times`,
    );
  }
  if (input.tenantUsageLimit != null) {
    limits.push(
      `it can be used at most ${formatValue(input.tenantUsageLimit)} times in total`,
    );
  }
  const limitClause = limits.length > 0 ? `. ${limits.join(", and ")}` : "";

  const priorityClause = ` It is ranked at priority ${formatValue(input.priority ?? 0)}.`;
  const state = input.active === false ? " (inactive)" : "";
  return `${reward}${conditionClause}.${limitClause}${priorityClause}${state}`;
}
