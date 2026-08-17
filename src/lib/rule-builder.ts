import {
  buildStructuredFormula,
  EVENT_TYPES,
  serializeExpression,
  validateRule,
  type EarnRuleConfig,
  type RuleGroupType,
  type StructuredFormula,
} from "@/lib/rules";

/**
 * Accept an owner-authored rule body and compile it into a validated
 * EarnRuleConfig. The body must include structured formula fields and
 * optionally a RuleGroupType conditions object.
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

  let conditions: RuleGroupType;
  if (body.conditions && typeof body.conditions === "object") {
    const c = body.conditions as Record<string, unknown>;
    if (typeof c.combinator !== "string" || !Array.isArray(c.rules)) {
      throw new Error("Conditions must be a valid rule group (combinator + rules array)");
    }
    conditions = c as unknown as RuleGroupType;
  } else {
    conditions = { combinator: "and", rules: [] };
  }

  if (!body.structured || typeof body.structured !== "object") {
    throw new Error("Structured formula fields are required");
  }
  const s = body.structured as Record<string, unknown>;
  const formulaType = (s.type as "rate" | "flat") ?? "rate";

  if (formulaType === "flat") {
    const flatAmount = typeof s.flatAmount === "number" ? s.flatAmount : 0;
    if (flatAmount <= 0) throw new Error("Flat amount must be a positive number");
    const structured: StructuredFormula = {
      type: "flat",
      basis: "",
      rate: 0,
      flatAmount,
      rounding: (s.rounding as StructuredFormula["rounding"]) ?? "floor",
      minPoints: typeof s.minPoints === "number" ? s.minPoints : null,
      maxPoints: typeof s.maxPoints === "number" ? s.maxPoints : null,
    };
    const formula = buildStructuredFormula(structured);
    const config: EarnRuleConfig = {
      eventType: eventType as EarnRuleConfig["eventType"],
      perItem,
      conditions,
      formula,
    };
    validateRule(config);
    return config;
  }

  // Rate mode
  if (typeof s.rate !== "number" || s.rate < 0) {
    throw new Error("Formula rate must be a non-negative number");
  }
  if (typeof s.basis !== "string" || !s.basis) {
    throw new Error("Basis is required for rate formulas");
  }
  const structured: StructuredFormula = {
    type: "rate",
    basis: s.basis,
    rate: s.rate,
    flatAmount: 0,
    rounding: (s.rounding as StructuredFormula["rounding"]) ?? "floor",
    minPoints: typeof s.minPoints === "number" ? s.minPoints : null,
    maxPoints: typeof s.maxPoints === "number" ? s.maxPoints : null,
  };

  const formula = buildStructuredFormula(structured);
  const config: EarnRuleConfig = {
    eventType: eventType as EarnRuleConfig["eventType"],
    perItem,
    conditions,
    formula,
  };
  validateRule(config);
  return config;
}

/** Human-readable expression for display. */
export function formulaText(config: EarnRuleConfig): string {
  return serializeExpression(config.formula);
}

/** Compute formulaText directly from DB columns. */
export function formulaTextFromColumns(row: {
  formulaType?: string | null;
  formulaBasis: string | null;
  formulaRate: string | number;
  formulaFlatAmount: number | null;
  formulaRounding: string;
  formulaMinPoints: number | null;
  formulaMaxPoints: number | null;
}): string {
  const formulaType = row.formulaType ?? "rate";
  if (formulaType === "flat") {
    const amt = row.formulaFlatAmount ?? 0;
    return `${amt} pts`;
  }
  const structured: StructuredFormula = {
    type: "rate",
    basis: row.formulaBasis ?? "orderAmount",
    rate: Number(row.formulaRate),
    flatAmount: 0,
    rounding: row.formulaRounding as StructuredFormula["rounding"],
    minPoints: row.formulaMinPoints,
    maxPoints: row.formulaMaxPoints,
  };
  return serializeExpression(buildStructuredFormula(structured));
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
