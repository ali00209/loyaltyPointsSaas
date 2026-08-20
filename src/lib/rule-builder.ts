import {
  buildStructuredFormula,
  EVENT_TYPES,
  serializeExpression,
  validateRule,
  type EarnRuleConfig,
  type FormulaGroup,
  type RuleGroupType,
  type StructuredFormula,
} from "@/lib/rules";

/**
 * Accept an owner-authored rule body and compile it into a validated
 * EarnRuleConfig. The body must include formulaGroups array.
 * Throws with a human-readable message on invalid input.
 */
export function compileRuleBody(body: Record<string, unknown>): EarnRuleConfig {
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    throw new Error("Rule name is required");
  }

  const eventType = String(body.eventType ?? "");
  if (!EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number])) {
    throw new Error(`Event type must be one of: ${EVENT_TYPES.join(", ")}`);
  }

  const perItem = body.perItem === true;

  // Accept new formulaGroups array format
  let formulaGroups: FormulaGroup[] = [];

  if (Array.isArray(body.formulaGroups) && body.formulaGroups.length > 0) {
    formulaGroups = body.formulaGroups.map((g: Record<string, unknown>) => {
      const conditions = parseConditions(g.conditions);
      const formula = parseStructuredFormula(g.formula ?? g);
      return { conditions, formula };
    });
  } else if (body.conditions || body.structured) {
    // Legacy single-group format: wrap into a single-element array
    const conditions = parseConditions(body.conditions);
    const formula = parseStructuredFormula(body.structured);
    formulaGroups = [{ conditions, formula }];
  } else {
    throw new Error("At least one formula group is required");
  }

  const config: EarnRuleConfig = {
    eventType: eventType as EarnRuleConfig["eventType"],
    perItem,
    formulaGroups,
  };
  validateRule(config);
  return config;
}

function parseConditions(raw: unknown): RuleGroupType {
  if (raw && typeof raw === "object") {
    const c = raw as Record<string, unknown>;
    if (typeof c.combinator === "string" && Array.isArray(c.rules)) {
      return c as unknown as RuleGroupType;
    }
  }
  return { combinator: "and", rules: [] };
}

function parseStructuredFormula(raw: unknown): StructuredFormula {
  if (!raw || typeof raw !== "object") {
    throw new Error("Structured formula fields are required");
  }
  const s = raw as Record<string, unknown>;
  const formulaType = (s.type as "rate" | "flat") ?? "rate";

  if (formulaType === "flat") {
    const flatAmount = typeof s.flatAmount === "number" ? s.flatAmount : 0;
    if (flatAmount <= 0) throw new Error("Flat amount must be a positive number");
    return {
      type: "flat",
      basis: "",
      rate: 0,
      flatAmount,
      rounding: (s.rounding as StructuredFormula["rounding"]) ?? "floor",
      minPoints: typeof s.minPoints === "number" ? s.minPoints : null,
      maxPoints: typeof s.maxPoints === "number" ? s.maxPoints : null,
    };
  }

  // Rate mode
  if (typeof s.rate !== "number" || s.rate < 0) {
    throw new Error("Formula rate must be a non-negative number");
  }
  if (typeof s.basis !== "string" || !s.basis) {
    throw new Error("Basis is required for rate formulas");
  }
  return {
    type: "rate",
    basis: s.basis,
    rate: s.rate,
    flatAmount: 0,
    rounding: (s.rounding as StructuredFormula["rounding"]) ?? "floor",
    minPoints: typeof s.minPoints === "number" ? s.minPoints : null,
    maxPoints: typeof s.maxPoints === "number" ? s.maxPoints : null,
  };
}

/** Human-readable expression for display. */
export function formulaTextFromGroups(groups: FormulaGroup[]): string {
  if (!groups || groups.length === 0) return "No formula";
  return groups
    .map((g, i) => {
      const expr = serializeExpression(buildStructuredFormula(g.formula));
      return `Group ${i + 1}: ${expr}`;
    })
    .join(" | ");
}

/** Compute formulaText directly from DB row. */
export function formulaTextFromColumns(row: {
  formulaGroups?: FormulaGroup[] | null;
}): string {
  const groups = (row.formulaGroups as FormulaGroup[]) ?? [];
  return formulaTextFromGroups(groups);
}

export function parseOptionalDate(value: unknown): Date | null {
  if (!value || value === "" || value === "null") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseExpiryDays(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}
