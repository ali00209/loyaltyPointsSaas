import { describe, it, expect } from "vitest";
import {
  basisForTrigger,
  calculatePoints,
  evaluateRules,
  ruleMatches,
  validateRule,
  type EarnRuleConfig,
  type RuleConditions,
  type TransactionFacts,
} from "./rules";

function rule(partial: Partial<EarnRuleConfig> = {}): EarnRuleConfig {
  return {
    triggerType: "flat_rate",
    conditions: {},
    pointsFormula: { basis: "orderAmount", pointsPerUnit: 1 },
    ...partial,
  };
}

describe("basisForTrigger", () => {
  it("maps per_product and bulk_quantity to itemQuantity", () => {
    expect(basisForTrigger("per_product")).toBe("itemQuantity");
    expect(basisForTrigger("bulk_quantity")).toBe("itemQuantity");
  });

  it("maps flat_rate and price_range to orderAmount", () => {
    expect(basisForTrigger("flat_rate")).toBe("orderAmount");
    expect(basisForTrigger("price_range")).toBe("orderAmount");
  });
});

describe("calculatePoints", () => {
  it("flat rate: 1 pt per $1", () => {
    expect(
      calculatePoints({ basis: "orderAmount", pointsPerUnit: 1 }, { orderAmount: 25 }),
    ).toBe(25);
  });

  it("per product: 3 items at 5 pts each", () => {
    expect(
      calculatePoints({ basis: "itemQuantity", pointsPerUnit: 5 }, { itemQuantity: 3 }),
    ).toBe(15);
  });

  it("floors fractional results", () => {
    expect(
      calculatePoints({ basis: "orderAmount", pointsPerUnit: 1 }, { orderAmount: 12.5 }),
    ).toBe(12);
  });

  it("fractional rate floors too", () => {
    expect(
      calculatePoints({ basis: "orderAmount", pointsPerUnit: 0.5 }, { orderAmount: 3 }),
    ).toBe(1);
  });
});

describe("ruleMatches", () => {
  const facts: TransactionFacts = {
    orderAmount: 30,
    itemQuantity: 3,
    productId: "prod-123",
  };

  it("flat_rate always matches", () => {
    expect(ruleMatches(rule(), facts)).toBe(true);
  });

  it("per_product matches the targeted product", () => {
    const r = rule({
      triggerType: "per_product",
      pointsFormula: { basis: "itemQuantity", pointsPerUnit: 3 },
      conditions: { productId: "prod-123" },
    });
    expect(ruleMatches(r, facts)).toBe(true);
  });

  it("per_product does not match another product", () => {
    const r = rule({
      triggerType: "per_product",
      conditions: { productId: "prod-999" },
    });
    expect(ruleMatches(r, facts)).toBe(false);
  });

  it("per_product with no productId matches anything", () => {
    const r = rule({ triggerType: "per_product" });
    expect(ruleMatches(r, facts)).toBe(true);
  });

  it("price_range matches within bounds", () => {
    const r = rule({
      triggerType: "price_range",
      conditions: { minPrice: 20, maxPrice: 50 },
    });
    expect(ruleMatches(r, facts)).toBe(true);
  });

  it("price_range excludes out-of-range orders", () => {
    const r = rule({
      triggerType: "price_range",
      conditions: { minPrice: 40 },
    });
    expect(ruleMatches(r, facts)).toBe(false);
  });

  it("bulk_quantity requires the minimum quantity", () => {
    const r = rule({
      triggerType: "bulk_quantity",
      conditions: { minQuantity: 5 },
    });
    expect(ruleMatches(r, facts)).toBe(false);
  });
});

describe("evaluateRules", () => {
  it("returns only matching rules", () => {
    const rules = [
      rule(),
      rule({
        triggerType: "price_range",
        conditions: { minPrice: 100 },
      }),
    ];
    const result = evaluateRules(rules, { orderAmount: 30, itemQuantity: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].triggerType).toBe("flat_rate");
  });

  it("returns an empty array when nothing matches", () => {
    const result = evaluateRules(
      [rule({ triggerType: "price_range", conditions: { maxPrice: 10 } })],
      { orderAmount: 30, itemQuantity: 1 },
    );
    expect(result).toEqual([]);
  });
});

describe("validateRule", () => {
  it("accepts a valid flat_rate rule", () => {
    expect(() => validateRule(rule())).not.toThrow();
  });

  it("rejects an unknown triggerType", () => {
    expect(() => validateRule(rule({ triggerType: "nope" as never }))).toThrow(
      /valid triggerType/i,
    );
  });

  it("rejects a missing or zero pointsPerUnit", () => {
    expect(() =>
      validateRule(rule({ pointsFormula: { basis: "orderAmount", pointsPerUnit: 0 } })),
    ).toThrow(/pointsPerUnit > 0/i);
  });

  it("rejects a price_range with no bounds", () => {
    expect(() =>
      validateRule(rule({ triggerType: "price_range", conditions: {} })),
    ).toThrow(/min or max price/i);
  });

  it("rejects a price_range where max < min", () => {
    const conditions: RuleConditions = { minPrice: 50, maxPrice: 20 };
    expect(() => validateRule(rule({ triggerType: "price_range", conditions }))).toThrow(
      /max must be >= min/i,
    );
  });

  it("rejects a bulk_quantity with minQuantity < 1", () => {
    expect(() =>
      validateRule(
        rule({ triggerType: "bulk_quantity", conditions: { minQuantity: 0 } }),
      ),
    ).toThrow(/minQuantity >= 1/i);
  });
});
