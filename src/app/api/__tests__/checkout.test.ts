import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { POST as checkout } from "@/app/api/checkout/route";
import { db } from "@/db";
import {
  customerRuleBalances,
  customers,
  pointTransactions,
  redemptionCheckouts,
  redemptionRules,
  tenantSettings,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  jsonBody,
  resetTestState,
  seedApiKey,
  seedCustomer,
  seedOwner,
  seedTenant,
  signInOwner,
  useBearer,
} from "@/test/helpers";

interface CheckoutResult {
  checkoutId: string;
  status: string;
  matched: boolean;
  idempotent: boolean;
  reason: string | null;
  remainingBalance?: number;
  benefit: {
    ruleName: string;
    discountAmount: number;
    discountType: string;
    pointsCost: number;
  } | null;
}

beforeEach(resetTestState);

async function seedRedeemableProgram(balance: number) {
  const tenant = await seedTenant();
  const owner = await seedOwner(tenant.id);
  const customer = await seedCustomer(tenant.id, {
    currentBalance: balance,
    totalPointsEarned: balance,
  });
  await db.insert(customerRuleBalances).values({
    tenantId: tenant.id,
    customerId: customer.id,
    ruleId: null,
    remainingPoints: balance,
    expiresAt: null,
  });
  const [rule] = await db
    .insert(redemptionRules)
    .values({
      tenantId: tenant.id,
      name: "50 off",
      discountType: "fixed",
      discountValue: "50",
      pointsCost: 100,
    })
    .returning();
  return { tenant, owner, customer, rule };
}

function reserveBody(customerEmail: string, checkoutId = "co-1") {
  return { checkoutId, customerEmail, orderAmount: 200 };
}

describe("POST /api/checkout", () => {
  it("requires authentication", async () => {
    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: { checkoutId: "co-1" } }),
    );

    expect(res.status).toBe(401);
  });

  it("reserves the matching benefit and spends the customer's points", async () => {
    const { owner, customer } = await seedRedeemableProgram(150);
    signInOwner(owner.id);

    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<CheckoutResult>(res);
    expect(payload.matched).toBe(true);
    expect(payload.status).toBe("reserved");
    expect(payload.idempotent).toBe(false);
    expect(payload.benefit).toMatchObject({
      ruleName: "50 off",
      discountType: "fixed",
      discountAmount: 50,
      pointsCost: 100,
    });
    expect(payload.remainingBalance).toBe(50);

    const [stored] = await db.select().from(redemptionCheckouts);
    expect(stored).toMatchObject({
      checkoutId: "co-1",
      customerId: customer.id,
      pointsCost: 100,
      discountAmount: "50.00",
      status: "reserved",
    });

    const [spend] = await db.select().from(pointTransactions);
    expect(spend).toMatchObject({ transactionType: "redeem", points: -100 });

    const [balance] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(balance.currentBalance).toBe(50);

    const [rule] = await db.select().from(redemptionRules);
    expect(rule.usageCount).toBe(1);
  });

  it("is idempotent for a repeated checkout id", async () => {
    const { owner, customer } = await seedRedeemableProgram(150);
    signInOwner(owner.id);

    const first = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );
    expect(first.status).toBe(201);

    const second = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );

    expect(second.status).toBe(201);
    const payload = await jsonBody<CheckoutResult>(second);
    expect(payload.idempotent).toBe(true);

    expect(await db.select().from(redemptionCheckouts)).toHaveLength(1);
    expect(await db.select().from(pointTransactions)).toHaveLength(1);

    const [balance] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(balance.currentBalance).toBe(50);
  });

  it("reserves without a benefit when points run short", async () => {
    const { owner, customer } = await seedRedeemableProgram(10);
    signInOwner(owner.id);

    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<CheckoutResult>(res);
    expect(payload.matched).toBe(false);
    expect(payload.benefit).toBeNull();
    expect(payload.reason).toMatch(/Insufficient points/);

    const [balance] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(balance.currentBalance).toBe(10);
    // Nothing is reserved when no benefit matches.
    expect(await db.select().from(redemptionCheckouts)).toHaveLength(0);
    expect(await db.select().from(pointTransactions)).toHaveLength(0);
  });

  it("404s for an unknown customer", async () => {
    const { owner } = await seedRedeemableProgram(150);
    signInOwner(owner.id);

    const res = await checkout(
      apiRequest("/api/checkout", {
        method: "POST",
        body: reserveBody("nobody@example.com"),
      }),
    );

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({ error: "Customer not found" });
  });

  it("works with a POS API key instead of an owner session", async () => {
    const { tenant, customer } = await seedRedeemableProgram(150);
    const rawKey = await seedApiKey(tenant.id);
    useBearer(rawKey);

    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );

    expect(res.status).toBe(201);
    expect((await jsonBody<CheckoutResult>(res)).matched).toBe(true);
  });

  it("rejects an unknown API key", async () => {
    useBearer("loy_invalid");

    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: { checkoutId: "co-1" } }),
    );

    expect(res.status).toBe(401);
  });

  it("refuses when auto-apply is turned off for the program", async () => {
    const { tenant, owner, customer } = await seedRedeemableProgram(150);
    await db.insert(tenantSettings).values({
      tenantId: tenant.id,
      key: "autoApplyRedemptions",
      value: false,
    });
    signInOwner(owner.id);

    const res = await checkout(
      apiRequest("/api/checkout", { method: "POST", body: reserveBody(customer.email!) }),
    );

    expect(res.status).toBe(409);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/Automatic redemption is disabled/);
    expect(await db.select().from(redemptionCheckouts)).toHaveLength(0);
  });

  it("rejects a body without a checkout or order id", async () => {
    const { owner, customer } = await seedRedeemableProgram(150);
    signInOwner(owner.id);

    const res = await checkout(
      apiRequest("/api/checkout", {
        method: "POST",
        body: { customerEmail: customer.email, orderAmount: 100 },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string; details: { field: string }[] }>(res);
    expect(payload.error).toBe("Validation failed");
    expect(payload.details.map((d) => d.field)).toContain("checkoutId");
  });
});
