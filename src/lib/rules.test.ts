import { describe, it, expect } from "vitest";
import { normalizePakistaniMobile } from "./phone";
import {
  buildStructuredFormula,
  conditionsMatch,
  collectFields,
  deriveEventKey,
  evaluateFormula,
  evalExpr,
  eventLabel,
  factsForEvent,
  parseExpression,
  serializeExpression,
  validateConditions,
  validateEventPayload,
  validateRule,
  EMPTY_CONDITIONS,
  type EarnRuleConfig,
  type FormulaGroup,
  type RuleGroupType,
} from "./rules";

function purchaseFacts(over: Record<string, unknown> = {}) {
  return { orderAmount: 30, itemQuantity: 3, itemCount: 2, ...over };
}

function rule(partial: Partial<EarnRuleConfig> = {}): EarnRuleConfig {
  return {
    eventType: "purchase",
    perItem: false,
    formulaGroups: partial.formulaGroups ?? [
      {
        conditions: EMPTY_CONDITIONS,
        formula: { type: "rate", basis: "orderAmount", rate: 100, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
      },
    ],
    ...partial,
  };
}

describe("normalizePakistaniMobile", () => {
  it("normalizes local and international Pakistani mobile numbers", () => {
    expect(normalizePakistaniMobile("0300-1234567")).toBe("+923001234567");
    expect(normalizePakistaniMobile("+92 300 1234567")).toBe("+923001234567");
    expect(normalizePakistaniMobile("00923001234567")).toBe("+923001234567");
  });

  it("rejects non-Pakistani or malformed numbers", () => {
    expect(normalizePakistaniMobile("0300123456")).toBeNull();
    expect(normalizePakistaniMobile("+14155550101")).toBeNull();
  });
});

describe("parseExpression", () => {
  it("parses arithmetic with precedence", () => {
    const ast = parseExpression("1 + 2 * 3");
    expect(evalExpr(ast, {})).toBe(7);
  });

  it("parses parens", () => {
    expect(evalExpr(parseExpression("(1 + 2) * 3"), {})).toBe(9);
  });

  it("parses fields from context", () => {
    expect(evalExpr(parseExpression("orderAmount * 0.1"), { orderAmount: 25 })).toBeCloseTo(2.5);
  });

  it("parses comparisons", () => {
    expect(evalExpr(parseExpression("orderAmount >= 20"), { orderAmount: 25 })).toBe(true);
    expect(evalExpr(parseExpression("orderAmount >= 20"), { orderAmount: 10 })).toBe(false);
  });

  it("parses && and || with precedence", () => {
    expect(evalExpr(parseExpression("true || false && false"), {})).toBe(true);
  });

  it("parses negation and boolean not", () => {
    expect(evalExpr(parseExpression("-2 * 3"), {})).toBe(-6);
    expect(evalExpr(parseExpression("!false"), {})).toBe(true);
  });

  it("parses function calls", () => {
    expect(evalExpr(parseExpression("floor(2.9)"), {})).toBe(2);
    expect(evalExpr(parseExpression("round(2.5)"), {})).toBe(3);
    expect(evalExpr(parseExpression("clamp(15, 0, 10)"), {})).toBe(10);
    expect(evalExpr(parseExpression("min(3, 8, 1)"), {})).toBe(1);
    expect(evalExpr(parseExpression("if(orderAmount > 20, 50, 0)"), { orderAmount: 30 })).toBe(50);
  });

  it("parses string literals", () => {
    expect(evalExpr(parseExpression("'hi' == 'hi'"), {})).toBe(true);
  });

  it("rejects garbage", () => {
    expect(() => parseExpression("orderAmount +")).toThrow();
    expect(() => parseExpression("")).toThrow();
    expect(() => parseExpression("2 ** 3")).toThrow();
  });

  it("rejects unknown functions", () => {
    expect(() => parseExpression("sqrt(4)")).toThrow(/Unknown function/);
  });
});

describe("serializeExpression", () => {
  it("round-trips a formula", () => {
    const ast = parseExpression("(orderAmount * 0.1) + if(quantity > 2, 5, 0)");
    expect(parseExpression(serializeExpression(ast))).toEqual(ast);
  });

  it("prints precedence-correct parentheses", () => {
    expect(serializeExpression(parseExpression("(1 + 2) * 3"))).toBe("(1 + 2) * 3");
    expect(serializeExpression(parseExpression("1 + 2 * 3"))).toBe("1 + 2 * 3");
  });
});

describe("evaluateFormula", () => {
  it("floors fractional points", () => {
    expect(evaluateFormula(parseExpression("orderAmount * 0.1"), { orderAmount: 25 })).toBe(2);
  });

  it("clamps negative results to zero", () => {
    expect(evaluateFormula(parseExpression("orderAmount - 100"), { orderAmount: 10 })).toBe(0);
  });

  it("honors explicit round", () => {
    expect(evaluateFormula(parseExpression("round(orderAmount * 0.1)"), { orderAmount: 25 })).toBe(3);
  });

  it("returns whole numbers directly", () => {
    expect(evaluateFormula(parseExpression("50"), {})).toBe(50);
  });

  it("if() picks branches", () => {
    const f = parseExpression("if(orderAmount >= 100, 100, 10)");
    expect(evaluateFormula(f, { orderAmount: 150 })).toBe(100);
    expect(evaluateFormula(f, { orderAmount: 50 })).toBe(10);
  });
});

describe("collectFields", () => {
  it("collects every referenced field", () => {
    const fields = collectFields(parseExpression("orderAmount * 0.1 + quantity"));
    expect([...fields].sort()).toEqual(["orderAmount", "quantity"]);
  });
});

describe("buildStructuredFormula", () => {
  it("rate mode: 10% of orderAmount", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 10, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, { orderAmount: 25 })).toBe(2);
  });

  it("rate mode: 100% of orderAmount = full amount as points", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 100, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, { orderAmount: 25 })).toBe(25);
  });

  it("rate mode: applies maxPoints cap", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 100, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: 10 });
    expect(evaluateFormula(ast, { orderAmount: 25 })).toBe(10);
  });

  it("rate mode: applies minPoints floor", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 10, flatAmount: 0, rounding: "floor", minPoints: 5, maxPoints: null });
    expect(evaluateFormula(ast, { orderAmount: 10 })).toBe(5);
  });

  it("rate mode: rounds instead of floors when requested", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 10, flatAmount: 0, rounding: "round", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, { orderAmount: 25 })).toBe(3);
  });

  it("flat mode: returns fixed points regardless of facts", () => {
    const ast = buildStructuredFormula({ type: "flat", basis: "", rate: 0, flatAmount: 50, rounding: "floor", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, {})).toBe(50);
    expect(evaluateFormula(ast, { orderAmount: 999 })).toBe(50);
  });

  it("flat mode: applies rounding", () => {
    const ast = buildStructuredFormula({ type: "flat", basis: "", rate: 0, flatAmount: 50, rounding: "ceil", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, {})).toBe(50);
  });

  it("flat mode: applies minPoints", () => {
    const ast = buildStructuredFormula({ type: "flat", basis: "", rate: 0, flatAmount: 5, rounding: "floor", minPoints: 10, maxPoints: null });
    expect(evaluateFormula(ast, {})).toBe(10);
  });

  it("flat mode: applies maxPoints", () => {
    const ast = buildStructuredFormula({ type: "flat", basis: "", rate: 0, flatAmount: 100, rounding: "floor", minPoints: null, maxPoints: 50 });
    expect(evaluateFormula(ast, {})).toBe(50);
  });

  it("rate mode: 200% of quantity = 2 points per item", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "quantity", rate: 200, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, { quantity: 3 })).toBe(6);
  });

  it("rate mode: 300% of orderAmount = 3 points per dollar", () => {
    const ast = buildStructuredFormula({ type: "rate", basis: "orderAmount", rate: 300, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null });
    expect(evaluateFormula(ast, { orderAmount: 50 })).toBe(150);
  });
});

describe("conditionsMatch", () => {
  const facts = purchaseFacts({ productId: "p1", productCategory: "coffee" });

  it("empty conditions match everything", () => {
    expect(conditionsMatch(EMPTY_CONDITIONS, facts)).toBe(true);
  });

  it("matches with combinator=and", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "orderAmount", operator: ">=", value: 20 },
        { field: "orderAmount", operator: "<", value: 50 },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("fails when one 'and' condition fails", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "orderAmount", operator: ">=", value: 40 },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(false);
  });

  it("matches when any condition passes (or)", () => {
    const c: RuleGroupType = {
      combinator: "or",
      rules: [
        { field: "orderAmount", operator: ">", value: 100 },
        { field: "productId", operator: "=", value: "p1" },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("supports contains and in", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "productCategory", operator: "contains", value: "cof" },
        { field: "productId", operator: "in", value: "p1,p2" },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("supports isSet", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "productCategory", operator: "isSet", value: null },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
    expect(conditionsMatch(c, { ...facts, productCategory: null })).toBe(false);
  });

  it("compares numbers loosely against numeric strings", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "orderAmount", operator: "=", value: "30" },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("supports nested rule groups", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [
        { field: "orderAmount", operator: ">=", value: 20 },
        {
          combinator: "or",
          rules: [
            { field: "productCategory", operator: "=", value: "coffee" },
            { field: "productCategory", operator: "=", value: "Bakery" },
          ],
        },
      ],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("between: matches value within range", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "between", value: "20,40" }],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("between: rejects value outside range", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "between", value: "50,100" }],
    };
    expect(conditionsMatch(c, facts)).toBe(false);
  });

  it("notBetween: rejects value within range", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "notBetween", value: "20,40" }],
    };
    expect(conditionsMatch(c, facts)).toBe(false);
  });

  it("notBetween: matches value outside range", () => {
    const c: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "notBetween", value: "50,100" }],
    };
    expect(conditionsMatch(c, facts)).toBe(true);
  });

  it("between: treats malformed value as no-match (except notBetween)", () => {
    const bad: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "between", value: "" }],
    };
    expect(conditionsMatch(bad, facts)).toBe(false);

    const badNotBetween: RuleGroupType = {
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "notBetween", value: "" }],
    };
    expect(conditionsMatch(badNotBetween, facts)).toBe(true);
  });
});

describe("validateConditions", () => {
  const allowed = new Set(["orderAmount", "productId"]);

  it("accepts valid conditions", () => {
    expect(() => validateConditions(EMPTY_CONDITIONS, allowed)).not.toThrow();
    expect(() => validateConditions({
      combinator: "and",
      rules: [{ field: "orderAmount", operator: ">=", value: 10 }],
    }, allowed)).not.toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() => validateConditions({
      combinator: "and",
      rules: [{ field: "nope", operator: "=", value: 1 }],
    }, allowed)).toThrow(/Unknown field/);
  });

  it("rejects bad operators", () => {
    expect(() => validateConditions({
      combinator: "and",
      rules: [{ field: "orderAmount", operator: "like" as never, value: 1 }],
    }, allowed)).toThrow(/Unknown operator/);
  });
});

describe("factsForEvent", () => {
  it("gives order-level facts for order purchases", () => {
    expect(factsForEvent("purchase", false)).toHaveProperty("orderAmount");
    expect(factsForEvent("purchase", false)).not.toHaveProperty("quantity");
  });

  it("gives item-level facts for per-item purchases", () => {
    expect(factsForEvent("purchase", true)).toHaveProperty("quantity");
    expect(factsForEvent("purchase", true)).toHaveProperty("productId");
  });

  it("gives review facts", () => {
    expect(factsForEvent("review", false)).toHaveProperty("rating");
  });
});

describe("validateRule", () => {
  it("accepts a valid flat-rate rule", () => {
    expect(() => validateRule(rule())).not.toThrow();
  });

  it("accepts a per-item purchase rule", () => {
    expect(() =>
      validateRule(rule({
        perItem: true,
        formulaGroups: [{
          conditions: { combinator: "and", rules: [{ field: "productId", operator: "=", value: "p1" }] },
          formula: { type: "rate", basis: "quantity", rate: 300, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
        }],
      })),
    ).not.toThrow();
  });

  it("rejects perItem on non-purchase events", () => {
    expect(() =>
      validateRule(rule({ eventType: "review", perItem: true })),
    ).toThrow(/perItem/);
  });

  it("rejects unknown formula fields", () => {
    expect(() =>
      validateRule(rule({
        formulaGroups: [{
          conditions: EMPTY_CONDITIONS,
          formula: { type: "rate", basis: "tax", rate: 100, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
        }],
      })),
    ).toThrow(/Unknown field "tax"/);
  });

  it("rejects unknown condition fields", () => {
    expect(() =>
      validateRule(rule({
        formulaGroups: [{
          conditions: { combinator: "and", rules: [{ field: "tax", operator: "=", value: 1 }] },
          formula: { type: "rate", basis: "orderAmount", rate: 100, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
        }],
      })),
    ).toThrow(/Unknown field "tax"/);
  });
});

describe("deriveEventKey", () => {
  it("derives dedupe keys per type", () => {
    expect(deriveEventKey("review", "c1", { productId: "p1" })).toBe("review:c1:p1");
    expect(deriveEventKey("newsletter_signup", "c1", {})).toBe("newsletter:c1");
    expect(deriveEventKey("customer_signup", "c1", {})).toBe("signup:c1");
  });

  it("uses orderNumber as purchase idempotency key", () => {
    expect(deriveEventKey("purchase", "c1", { orderNumber: "ORD-1" })).toBe("purchase:ORD-1");
    expect(deriveEventKey("purchase", "c1", {})).toBeNull();
  });

  it("derives referral keys from referrer and referred ids", () => {
    expect(deriveEventKey("referral", "r1", { referredCustomerId: "c2" })).toBe("referral:r1:c2");
  });

  it("derives a once-per-day visit key per customer", () => {
    expect(deriveEventKey("visit", "c1", {})).toMatch(/^visit:c1:\d{4}-\d{2}-\d{2}$/);
  });
});

describe("validateEventPayload", () => {
  it("accepts a purchase with only orderAmount (items optional)", () => {
    expect(() => validateEventPayload("purchase", { orderAmount: 10 })).not.toThrow();
  });

  it("accepts a valid purchase with items", () => {
    expect(() =>
      validateEventPayload("purchase", {
        orderAmount: 25,
        items: [{ productId: "p1", quantity: 2, unitPrice: 12.5 }],
      }),
    ).not.toThrow();
  });

  it("rejects purchase with empty items array", () => {
    expect(() =>
      validateEventPayload("purchase", { orderAmount: 10, items: [] }),
    ).toThrow(/non-empty array/);
  });

  it("rejects invalid review payloads", () => {
    expect(() => validateEventPayload("review", { productId: "p1" })).toThrow(/purchaseId/);
    expect(() =>
      validateEventPayload("review", { purchaseId: "e1", productId: "p1", rating: 9 }),
    ).toThrow(/1–5/);
  });

  it("accepts a bare visit with optional locationId/checkedInAt", () => {
    expect(() => validateEventPayload("visit", {})).not.toThrow();
    expect(() => validateEventPayload("visit", { locationId: "downtown", checkedInAt: "2026-01-01T10:00:00Z" })).not.toThrow();
  });

  it("rejects invalid visit locationId", () => {
    expect(() => validateEventPayload("visit", { locationId: 42 })).toThrow(/locationId/);
  });
});

describe("eventLabel", () => {
  it("labels known types and falls back to the raw type", () => {
    expect(eventLabel("purchase")).toBe("Purchase");
    expect(eventLabel("visit")).toBe("Visit");
    expect(eventLabel("nope")).toBe("nope");
  });
});
