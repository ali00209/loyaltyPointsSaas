// ---------------------------------------------------------------------------
// Points rule engine: safe expression AST + typed event catalog.
//
// Everything the engine consumes is JSON (never eval'd). A rule is:
//   {
//     eventType: EventType,
//     perItem: boolean,          // purchase rules only: evaluate per line item
//     conditions: RuleGroupType, // react-querybuilder format
//     formula: Expr,             // built from structured columns at eval time
//   }
// Points = floor(eval(formula, facts)), clamped to >= 0.
// ---------------------------------------------------------------------------

// ----------------------------- Expression AST ------------------------------

export type BinOp = "+" | "-" | "*" | "/";
export type CmpOp = "==" | "!=" | ">=" | "<=" | ">" | "<";

export type FunctionName =
  "floor" | "ceil" | "round" | "min" | "max" | "clamp" | "if";

export type Expr =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "null" }
  | { type: "field"; name: string }
  | { type: "neg"; operand: Expr }
  | { type: "bin"; op: BinOp; left: Expr; right: Expr }
  | { type: "cmp"; op: CmpOp; left: Expr; right: Expr }
  | { type: "and"; left: Expr; right: Expr }
  | { type: "or"; left: Expr; right: Expr }
  | { type: "not"; operand: Expr }
  | { type: "call"; fn: FunctionName; args: Expr[] };

export const isExpr = (v: unknown): v is Expr =>
  Boolean(
    v &&
    typeof v === "object" &&
    typeof (v as { type?: unknown }).type === "string",
  );

// ------------------------------ Evaluation ---------------------------------

export type EvalContext = Record<string, unknown>;

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}

function toBoolean(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  return false;
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a === b;
  if (typeof a === "number" || typeof b === "number")
    return toNumber(a) === toNumber(b);
  if (typeof a === "string" || typeof b === "string")
    return String(a) === String(b);
  return a === b;
}

function compare(
  op: CmpOp,
  left: Expr,
  right: Expr,
  ctx: EvalContext,
): boolean {
  const l = evalExpr(left, ctx);
  const r = evalExpr(right, ctx);
  switch (op) {
    case "==":
      return looseEquals(l, r);
    case "!=":
      return !looseEquals(l, r);
    case ">":
      return toNumber(l) > toNumber(r);
    case ">=":
      return toNumber(l) >= toNumber(r);
    case "<":
      return toNumber(l) < toNumber(r);
    case "<=":
      return toNumber(l) <= toNumber(r);
  }
}

export function evalExpr(expr: Expr, ctx: EvalContext): unknown {
  switch (expr.type) {
    case "num":
    case "str":
    case "bool":
      return expr.value;
    case "null":
      return null;
    case "field":
      return ctx[expr.name] ?? null;
    case "neg":
      return -toNumber(evalExpr(expr.operand, ctx));
    case "bin": {
      const l = toNumber(evalExpr(expr.left, ctx));
      const r = toNumber(evalExpr(expr.right, ctx));
      switch (expr.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? 0 : l / r;
      }
      break;
    }
    case "cmp":
      return compare(expr.op, expr.left, expr.right, ctx);
    case "and":
      return (
        toBoolean(evalExpr(expr.left, ctx)) &&
        toBoolean(evalExpr(expr.right, ctx))
      );
    case "or":
      return (
        toBoolean(evalExpr(expr.left, ctx)) ||
        toBoolean(evalExpr(expr.right, ctx))
      );
    case "not":
      return !toBoolean(evalExpr(expr.operand, ctx));
    case "call": {
      const args = expr.args.map((a) => evalExpr(a, ctx));
      switch (expr.fn) {
        case "floor":
          return Math.floor(toNumber(args[0]));
        case "ceil":
          return Math.ceil(toNumber(args[0]));
        case "round":
          return Math.round(toNumber(args[0]));
        case "min":
          return Math.min(...args.map(toNumber));
        case "max":
          return Math.max(...args.map(toNumber));
        case "clamp":
          return Math.min(
            Math.max(toNumber(args[0]), toNumber(args[1])),
            toNumber(args[2]),
          );
        case "if":
          return toBoolean(args[0]) ? args[1] : args[2];
      }
      break;
    }
  }
  return 0;
}

/** Evaluate a formula and convert to whole points (floor, clamp >= 0). */
export function evaluateFormula(formula: Expr, ctx: EvalContext): number {
  const value = toNumber(evalExpr(formula, ctx));
  return Math.max(0, Math.floor(value));
}

// ------------------------------- Parser ------------------------------------

// Text-mode parser for the "Advanced" editor. Produces the same AST as the
// structured builder, so rules authored either way are equivalent.

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string }
  | { kind: "eof" };

const OP_CHARS = "+-*/()<>=!,&|";

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j])) j++;
      const raw = input.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Invalid number "${raw}"`);
      tokens.push({ kind: "num", value });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < input.length && input[j] !== quote) {
        if (input[j] === "\\" && j + 1 < input.length) {
          value += input[j + 1];
          j += 2;
        } else {
          value += input[j];
          j++;
        }
      }
      if (input[j] !== quote) throw new Error("Unterminated string");
      tokens.push({ kind: "str", value });
      i = j + 1;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++;
      tokens.push({ kind: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    if (OP_CHARS.includes(ch)) {
      let j = i;
      while (j < input.length && OP_CHARS.includes(input[j])) j++;
      tokens.push({ kind: "op", value: input.slice(i, j) });
      i = j;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  tokens.push({ kind: "eof" });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(input: string) {
    this.tokens = tokenize(input);
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expectOp(value: string): void {
    const tok = this.next();
    if (tok.kind !== "op" || tok.value !== value) {
      throw new Error(`Expected "${value}"`);
    }
  }

  private expectOpValue(...values: string[]): string {
    const tok = this.next();
    if (tok.kind !== "op" || !values.includes(tok.value)) {
      throw new Error(`Expected one of: ${values.join(", ")}`);
    }
    return tok.value;
  }

  parse(): Expr {
    const expr = this.parseOr();
    if (this.peek().kind !== "eof")
      throw new Error("Unexpected trailing tokens");
    return expr;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    let tok = this.peek();
    while (tok.kind === "op" && tok.value === "||") {
      this.next();
      left = { type: "or", left, right: this.parseAnd() };
      tok = this.peek();
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseComparison();
    let tok = this.peek();
    while (tok.kind === "op" && tok.value === "&&") {
      this.next();
      left = { type: "and", left, right: this.parseComparison() };
      tok = this.peek();
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    const tok = this.peek();
    if (
      tok.kind === "op" &&
      ["==", "!=", ">=", "<=", ">", "<"].includes(tok.value)
    ) {
      this.next();
      const right = this.parseAdditive();
      left = { type: "cmp", op: tok.value as CmpOp, left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    let tok = this.peek();
    while (tok.kind === "op" && (tok.value === "+" || tok.value === "-")) {
      const op = this.expectOpValue("+", "-") as BinOp;
      left = { type: "bin", op, left, right: this.parseMultiplicative() };
      tok = this.peek();
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    let tok = this.peek();
    while (tok.kind === "op" && (tok.value === "*" || tok.value === "/")) {
      const op = this.expectOpValue("*", "/") as BinOp;
      left = { type: "bin", op, left, right: this.parseUnary() };
      tok = this.peek();
    }
    return left;
  }

  private parseUnary(): Expr {
    const tok = this.peek();
    if (tok.kind === "op" && tok.value === "-") {
      this.next();
      return { type: "neg", operand: this.parseUnary() };
    }
    if (tok.kind === "op" && tok.value === "!") {
      this.next();
      return { type: "not", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const tok = this.next();
    switch (tok.kind) {
      case "num":
        return { type: "num", value: tok.value };
      case "str":
        return { type: "str", value: tok.value };
      case "eof":
        throw new Error("Unexpected end of expression");
      case "op":
        if (tok.value === "(") {
          const inner = this.parseOr();
          this.expectOp(")");
          return inner;
        }
        throw new Error(`Unexpected token "${tok.value}"`);
      case "ident": {
        if (tok.value === "true") return { type: "bool", value: true };
        if (tok.value === "false") return { type: "bool", value: false };
        if (tok.value === "null") return { type: "null" };
        const next = this.peek();
        if (next.kind === "op" && next.value === "(") {
          return this.parseCall(tok.value);
        }
        return { type: "field", name: tok.value };
      }
    }
  }

  private parseCall(fnName: string): Expr {
    if (!isFunctionName(fnName))
      throw new Error(`Unknown function "${fnName}"`);
    this.expectOp("(");
    const args: Expr[] = [];
    let next = this.peek();
    if (!(next.kind === "op" && next.value === ")")) {
      args.push(this.parseOr());
      next = this.peek();
      while (next.kind === "op" && next.value === ",") {
        this.expectOp(",");
        args.push(this.parseOr());
        next = this.peek();
      }
    }
    this.expectOp(")");
    return { type: "call", fn: fnName as FunctionName, args };
  }
}

function isFunctionName(name: string): boolean {
  return ["floor", "ceil", "round", "min", "max", "clamp", "if"].includes(name);
}

/** Parse a user-written expression string into an AST. Throws on invalid input. */
export function parseExpression(input: string): Expr {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Expression is empty");
  return new Parser(trimmed).parse();
}

// ----------------------------- Serializer ----------------------------------

const PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  ">": 4,
  ">=": 4,
  "<": 4,
  "<=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
};

function serializeExpr(expr: Expr, parentPrec = 0): string {
  switch (expr.type) {
    case "num":
      return Number.isInteger(expr.value)
        ? String(expr.value)
        : String(Math.round(expr.value * 1e6) / 1e6);
    case "str":
      return JSON.stringify(expr.value);
    case "bool":
      return expr.value ? "true" : "false";
    case "null":
      return "null";
    case "field":
      return expr.name;
    case "neg":
      return `-${serializeExpr(expr.operand, 7)}`;
    case "not":
      return `!${serializeExpr(expr.operand, 7)}`;
    case "bin":
      return wrapBinary(
        serializeExpr(expr.left, PRECEDENCE[expr.op]),
        expr.op,
        serializeExpr(expr.right, PRECEDENCE[expr.op] + 1),
        PRECEDENCE[expr.op],
        parentPrec,
      );
    case "cmp":
      return wrapBinary(
        serializeExpr(expr.left, PRECEDENCE[expr.op]),
        expr.op,
        serializeExpr(expr.right, PRECEDENCE[expr.op] + 1),
        PRECEDENCE[expr.op],
        parentPrec,
      );
    case "and":
      return wrapBinary(
        serializeExpr(expr.left, PRECEDENCE["&&"]),
        "&&",
        serializeExpr(expr.right, PRECEDENCE["&&"] + 1),
        PRECEDENCE["&&"],
        parentPrec,
      );
    case "or":
      return wrapBinary(
        serializeExpr(expr.left, PRECEDENCE["||"]),
        "||",
        serializeExpr(expr.right, PRECEDENCE["||"] + 1),
        PRECEDENCE["||"],
        parentPrec,
      );
    case "call": {
      const args = expr.args.map((a) => serializeExpr(a, 0)).join(", ");
      if (expr.fn === "if" && expr.args.length >= 3) {
        const [cond, then, else_] = expr.args;
        return `if(${serializeExpr(cond, 0)}, ${serializeExpr(then, 0)}, ${serializeExpr(else_, 0)})`;
      }
      return `${expr.fn}(${args})`;
    }
  }
}

function wrapBinary(
  left: string,
  op: string,
  right: string,
  prec: number,
  parentPrec: number,
): string {
  const s = `${left} ${op} ${right}`;
  return prec < parentPrec ? `(${s})` : s;
}

/** Serialize an AST back to a human-readable expression string. */
export function serializeExpression(expr: Expr): string {
  return serializeExpr(expr, 0);
}

// --------------------------- Structured builder ----------------------------

export interface StructuredFormula {
  type: "rate" | "flat";
  basis: string;
  rate: number; // percentage (e.g. 5 = 5%), divided by 100 at eval for rate mode
  flatAmount: number; // fixed points for flat mode
  rounding: "floor" | "round" | "ceil";
  minPoints: number | null;
  maxPoints: number | null;
}

export interface FormulaGroup {
  conditions: RuleGroupType;
  formula: StructuredFormula;
}

/** Build an AST from friendly "structured" fields. */
export function buildStructuredFormula(f: StructuredFormula): Expr {
  let expr: Expr;

  if (f.type === "flat") {
    expr = { type: "num", value: f.flatAmount };
  } else {
    // Rate mode: basis × (rate / 100)
    const basisNode: Expr = { type: "field", name: f.basis };
    expr = {
      type: "bin",
      op: "*",
      left: basisNode,
      right: { type: "num", value: f.rate / 100 },
    };
  }

  if (f.rounding === "round") {
    expr = { type: "call", fn: "round", args: [expr] };
  } else if (f.rounding === "ceil") {
    expr = { type: "call", fn: "ceil", args: [expr] };
  } else {
    expr = { type: "call", fn: "floor", args: [expr] };
  }
  if (f.minPoints != null) {
    expr = {
      type: "call",
      fn: "max",
      args: [expr, { type: "num", value: f.minPoints }],
    };
  }
  if (f.maxPoints != null) {
    expr = {
      type: "call",
      fn: "min",
      args: [expr, { type: "num", value: f.maxPoints }],
    };
  }
  return expr;
}

// ------------------------------- Conditions --------------------------------

import type { RuleGroupType, RuleType } from "react-querybuilder";

export type { RuleGroupType, RuleType };

/** Default empty query (matches everything). */
export const EMPTY_CONDITIONS: RuleGroupType = { combinator: "and", rules: [] };

/** Evaluate a RuleGroupType against a facts object. */
export function conditionsMatch(
  conditions: RuleGroupType,
  ctx: EvalContext,
): boolean {
  return evaluateRuleGroup(conditions, ctx);
}

function evaluateRuleGroup(group: RuleGroupType, ctx: EvalContext): boolean {
  if (group.rules.length === 0) return true;
  const results = group.rules.map((rule) => {
    if ("combinator" in rule) return evaluateRuleGroup(rule, ctx);
    return evaluateRule(rule as RuleType, ctx);
  });
  return group.combinator === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

function evaluateRule(rule: RuleType, ctx: EvalContext): boolean {
  const actual = ctx[rule.field];
  const op = rule.operator;
  const value = rule.value;
  switch (op) {
    case "isSet":
      return (
        actual != null &&
        actual !== "" &&
        !(typeof actual === "number" && Number.isNaN(actual))
      );
    case "=":
    case "eq":
      return looseEquals(actual, value);
    case "!=":
    case "neq":
      return !looseEquals(actual, value);
    case ">":
    case "gt":
      return toNumber(actual) > toNumber(value);
    case ">=":
    case "gte":
      return toNumber(actual) >= toNumber(value);
    case "<":
    case "lt":
      return toNumber(actual) < toNumber(value);
    case "<=":
    case "lte":
      return toNumber(actual) <= toNumber(value);
    case "contains":
      return typeof actual === "string" && String(value) !== ""
        ? actual.toLowerCase().includes(String(value).toLowerCase())
        : false;
    case "in":
      return String(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .some((v) => looseEquals(actual, v));
    case "between":
    case "notBetween": {
      const parts = String(value)
        .split(",")
        .map((s) => s.trim());
      if (parts.length !== 2 || parts[0] === "" || parts[1] === "")
        return op === "notBetween";
      const num = toNumber(actual);
      const lo = toNumber(parts[0]);
      const hi = toNumber(parts[1]);
      const inRange = num >= lo && num <= hi;
      return op === "notBetween" ? !inRange : inRange;
    }
  }
  return false;
}

// -------------------------------- Rules ------------------------------------

export interface EarnRuleConfig {
  eventType: string;
  perItem: boolean;
  formulaGroups: FormulaGroup[];
}

/** The facts a rule can reference, keyed by event type. */
export function factsForEvent(
  eventType: string,
  perItem: boolean,
): Record<string, "number" | "string" | "boolean"> {
  if (eventType === "purchase") {
    return perItem
      ? {
          quantity: "number",
          unitPrice: "number",
          productId: "string",
          productPrice: "number",
          productCategory: "string",
        }
      : {
          orderAmount: "number",
          itemQuantity: "number",
          itemCount: "number",
        };
  }
  if (eventType === "visit") {
    return {
      visitCount: "number",
      locationId: "string",
      checkedInAt: "string",
    };
  }
  const catalogFieldTypes: Record<
    string,
    Record<string, "number" | "string" | "boolean">
  > = {
    review: {
      productId: "string",
      productPrice: "number",
      productCategory: "string",
      rating: "number",
    },
    social_share: { platform: "string" },
    newsletter_signup: {},
    customer_signup: {},
    referral: {},
  };
  return catalogFieldTypes[eventType] ?? {};
}

// ------------------------- Expression helpers ------------------------------

export function collectFields(
  expr: Expr,
  out: Set<string> = new Set(),
): Set<string> {
  switch (expr.type) {
    case "field":
      out.add(expr.name);
      break;
    case "neg":
    case "not":
      collectFields(expr.operand, out);
      break;
    case "bin":
    case "cmp":
    case "and":
    case "or":
      collectFields(expr.left, out);
      collectFields(expr.right, out);
      break;
    case "call":
      expr.args.forEach((a) => collectFields(a, out));
      break;
    default:
      break;
  }
  return out;
}

// ------------------------------ Validation ---------------------------------

export function validateFormula(expr: Expr, allowedFields: Set<string>): void {
  if (!isExpr(expr)) throw new Error("Formula must be a valid expression");
  for (const field of collectFields(expr)) {
    if (!allowedFields.has(field)) {
      throw new Error(`Unknown field "${field}"`);
    }
  }
  const bad = findInvalidCalls(expr);
  if (bad) throw new Error(bad);
}

function findInvalidCalls(expr: Expr): string | null {
  switch (expr.type) {
    case "call":
      if (expr.fn === "if" && expr.args.length !== 3)
        return "if() needs 3 arguments";
      if (expr.fn === "clamp" && expr.args.length !== 3)
        return "clamp() needs 3 arguments";
      if (expr.fn === "min" && expr.args.length < 1)
        return "min() needs at least 1 argument";
      if (expr.fn === "max" && expr.args.length < 1)
        return "max() needs at least 1 argument";
      for (const arg of expr.args) {
        const inner = findInvalidCalls(arg);
        if (inner) return inner;
      }
      break;
    case "bin":
    case "cmp":
    case "and":
    case "or":
      return findInvalidCalls(expr.left) ?? findInvalidCalls(expr.right);
    case "neg":
    case "not":
      return findInvalidCalls(expr.operand);
    default:
      break;
  }
  return null;
}

const VALID_RB_OPERATORS = new Set([
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "contains",
  "in",
  "between",
  "notBetween",
  "isSet",
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
]);

function validateRuleGroup(
  group: RuleGroupType,
  allowedFields: Set<string>,
): void {
  if (!group || typeof group !== "object")
    throw new Error("Conditions must be an object");
  if (group.combinator !== "and" && group.combinator !== "or") {
    throw new Error('Conditions combinator must be "and" or "or"');
  }
  if (!Array.isArray(group.rules))
    throw new Error("Conditions rules must be an array");
  for (const rule of group.rules) {
    if ("combinator" in rule) {
      validateRuleGroup(rule as RuleGroupType, allowedFields);
    } else {
      const r = rule as RuleType;
      if (!VALID_RB_OPERATORS.has(r.operator))
        throw new Error(`Unknown operator "${r.operator}"`);
      if (!allowedFields.has(r.field))
        throw new Error(`Unknown field "${r.field}"`);
    }
  }
}

export function validateConditions(
  conditions: RuleGroupType,
  allowedFields: Set<string>,
): void {
  validateRuleGroup(conditions, allowedFields);
}

/** Safe facts accepted by automatic redemption rules. */
export const REDEMPTION_FACT_FIELDS = {
  orderAmount: "number",
  itemQuantity: "number",
  itemCount: "number",
  quantity: "number",
  unitPrice: "number",
  productId: "string",
  productCategory: "string",
  productIds: "string",
  productCategories: "string",
  pointsBalance: "number",
} as const;

export function validateRedemptionConditions(conditions: RuleGroupType): void {
  validateConditions(conditions, new Set(Object.keys(REDEMPTION_FACT_FIELDS)));
}

export function validateRule(rule: EarnRuleConfig): void {
  if (!rule || typeof rule !== "object")
    throw new Error("Rule must be an object");
  if (typeof rule.eventType !== "string" || rule.eventType.length === 0) {
    throw new Error("Rule must have an eventType");
  }
  if (rule.perItem && rule.eventType !== "purchase") {
    throw new Error("perItem evaluation is only valid for purchase events");
  }
  if (!Array.isArray(rule.formulaGroups) || rule.formulaGroups.length === 0) {
    throw new Error("Rule must have at least one formula group");
  }
  const facts = factsForEvent(rule.eventType, Boolean(rule.perItem));
  const allowed = new Set(Object.keys(facts));
  for (const group of rule.formulaGroups) {
    if (!group.conditions || typeof group.conditions !== "object") {
      throw new Error("Each formula group must have conditions");
    }
    if (!group.formula || typeof group.formula !== "object") {
      throw new Error("Each formula group must have a formula");
    }
    validateConditions(group.conditions, allowed);
    validateFormula(buildStructuredFormula(group.formula), allowed);
  }
}

// ---------------------------- Event catalog ---------------------------------

export type EventType =
  | "purchase"
  | "visit"
  | "review"
  | "referral"
  | "newsletter_signup"
  | "social_share"
  | "customer_signup";

export type Poster = "owner" | "customer" | "apiKey" | "system";

export interface EventFieldDef {
  type: "number" | "string" | "boolean";
  description: string;
}

export interface EventCatalogEntry {
  label: string;
  description: string;
  /** Facts available to rules. */
  fields: Record<string, EventFieldDef>;
  /** Derive the dedupe key. Return null for no dedupe (repeatable events). */
  deriveKey: (
    customerId: string,
    payload: Record<string, unknown>,
  ) => string | null;
  /** Who is allowed to post this event type. */
  allowedPosters: Poster[];
  /** If set, the event is emitted by the system, not posted. */
  autoEmit?: "signup" | "referral";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export const EVENT_CATALOG: Record<EventType, EventCatalogEntry> = {
  purchase: {
    label: "Purchase",
    description: "An order placed at the POS, with line items.",
    fields: {
      orderAmount: { type: "number", description: "Order total (PKR)" },
      itemQuantity: { type: "number", description: "Total units in the order" },
      itemCount: { type: "number", description: "Distinct line items" },
      quantity: {
        type: "number",
        description: "Units in this line item (per-item rules)",
      },
      unitPrice: {
        type: "number",
        description: "Unit price of the line item (per-item rules)",
      },
      productId: {
        type: "string",
        description: "Product of the line item (per-item rules)",
      },
      productPrice: {
        type: "number",
        description: "Catalog price of the product (per-item rules)",
      },
      productCategory: {
        type: "string",
        description: "Category of the product (per-item rules)",
      },
    },
    deriveKey: (_customerId, payload) =>
      str(payload.orderNumber) ? `purchase:${payload.orderNumber}` : null,
    allowedPosters: ["apiKey", "owner"],
  },
  visit: {
    label: "Visit",
    description: "A customer checks in at a location (QR stamp card).",
    fields: {
      visitCount: {
        type: "number",
        description: "This customer's lifetime visit number",
      },
      locationId: {
        type: "string",
        description: "Location checked into (optional)",
      },
      checkedInAt: {
        type: "string",
        description: "Check-in timestamp (optional)",
      },
    },
    deriveKey: (customerId) =>
      `visit:${customerId}:${new Date().toISOString().slice(0, 10)}`,
    allowedPosters: ["customer", "owner"],
  },
  review: {
    label: "Review",
    description: "A customer reviews an item they purchased.",
    fields: {
      productId: { type: "string", description: "The reviewed product" },
      productPrice: {
        type: "number",
        description: "Catalog price of the reviewed product",
      },
      productCategory: {
        type: "string",
        description: "Category of the reviewed product",
      },
      rating: { type: "number", description: "Star rating (1–5)" },
    },
    deriveKey: (customerId, payload) =>
      `review:${customerId}:${str(payload.productId)}`,
    allowedPosters: ["customer", "owner"],
  },
  referral: {
    label: "Referral",
    description: "A referred customer signs up using a referral code.",
    fields: {},
    deriveKey: (customerId, payload) =>
      str(payload.referredCustomerId)
        ? `referral:${customerId}:${payload.referredCustomerId}`
        : null,
    allowedPosters: ["system"],
    autoEmit: "referral",
  },
  newsletter_signup: {
    label: "Newsletter Signup",
    description: "A customer opts into the email newsletter.",
    fields: {},
    deriveKey: (customerId) => `newsletter:${customerId}`,
    allowedPosters: ["customer", "owner"],
  },
  social_share: {
    label: "Social Share",
    description: "A customer shares the brand on social media.",
    fields: {
      platform: {
        type: "string",
        description: "Platform shared to (e.g. instagram)",
      },
    },
    deriveKey: (customerId, payload) =>
      `share:${customerId}:${str(payload.platform) || "generic"}:${new Date()
        .toISOString()
        .slice(0, 10)}`,
    allowedPosters: ["customer", "owner"],
  },
  customer_signup: {
    label: "Customer Signup",
    description: "A customer account is created (auto-emitted).",
    fields: {},
    deriveKey: (customerId) => `signup:${customerId}`,
    allowedPosters: ["system"],
    autoEmit: "signup",
  },
};

export const EVENT_TYPES = Object.keys(EVENT_CATALOG) as EventType[];

export function eventLabel(eventType: string): string {
  return EVENT_CATALOG[eventType as EventType]?.label ?? eventType;
}

/** Validate an event payload against its catalog schema. Throws on error. */
export function validateEventPayload(
  eventType: EventType,
  payload: unknown,
): asserts payload is Record<string, unknown> {
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("Event payload must be an object");
  }
  const p = payload as Record<string, unknown>;
  switch (eventType) {
    case "purchase": {
      const orderAmount = p.orderAmount;
      if (
        orderAmount == null ||
        Number.isNaN(Number(orderAmount)) ||
        Number(orderAmount) < 0
      ) {
        throw new Error("Purchase requires a valid orderAmount");
      }
      if (p.items !== undefined) {
        if (!Array.isArray(p.items)) {
          throw new Error("If provided, items must be an array");
        }
        for (const item of p.items) {
          if (!item || typeof item !== "object")
            throw new Error("Invalid line item");
          const it = item as Record<string, unknown>;
          if (typeof it.productId !== "string")
            throw new Error("Line item requires productId");
          const qty = Number(it.quantity);
          const price = Number(it.unitPrice);
          if (!Number.isFinite(qty) || qty <= 0)
            throw new Error("Line item requires quantity > 0");
          if (!Number.isFinite(price) || price < 0)
            throw new Error("Line item requires a unit price");
        }
      }
      break;
    }
    case "review": {
      if (typeof p.purchaseId !== "string")
        throw new Error("Review requires purchaseId");
      if (typeof p.productId !== "string")
        throw new Error("Review requires productId");
      const rating = Number(p.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5)
        throw new Error("Rating must be 1–5");
      break;
    }
    case "social_share":
      if (p.platform !== undefined && typeof p.platform !== "string") {
        throw new Error("Platform must be a string");
      }
      break;
    case "visit":
      if (p.locationId !== undefined && typeof p.locationId !== "string") {
        throw new Error("locationId must be a string");
      }
      if (p.checkedInAt !== undefined && typeof p.checkedInAt !== "string") {
        throw new Error("checkedInAt must be a string");
      }
      break;
    default:
      break;
  }
}

/** Derive the dedupe key for an event, if its type has one. */
export function deriveEventKey(
  eventType: EventType,
  customerId: string,
  payload: Record<string, unknown>,
): string | null {
  const entry = EVENT_CATALOG[eventType];
  if (!entry) throw new Error(`Unknown event type "${eventType}"`);
  return entry.deriveKey(customerId, payload);
}

/** Whether a poster is allowed to post an event of this type. */
export function canPost(eventType: EventType, poster: Poster): boolean {
  return EVENT_CATALOG[eventType].allowedPosters.includes(poster);
}
