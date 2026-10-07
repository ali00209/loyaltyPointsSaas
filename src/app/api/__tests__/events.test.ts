import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { POST as postEvent } from "@/app/api/events/route";
import { POST as createRule } from "@/app/api/rules/route";
import { db } from "@/db";
import {
  customerRuleBalances,
  customers,
  events,
  pointTransactions,
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
  signInCustomer,
  signInOwner,
  useBearer,
} from "@/test/helpers";

interface EventResult {
  eventId: string;
  duplicate: boolean;
  totalAwarded: number;
  awards: Array<{ ruleId: string; ruleName: string; points: number }>;
}

beforeEach(resetTestState);

async function seedProgram() {
  const tenant = await seedTenant();
  const owner = await seedOwner(tenant.id);
  const customer = await seedCustomer(tenant.id);
  return { tenant, owner, customer };
}

/** Create a purchase rule through the API (owner session required). */
async function seedPurchaseRule(tenantId: string): Promise<string> {
  const owner = await seedOwner(tenantId);
  signInOwner(owner.id);
  const res = await createRule(
    apiRequest("/api/rules", {
      method: "POST",
      body: {
        name: "One point per rupee",
        eventType: "purchase",
        formulaGroups: [
          {
            conditions: { combinator: "and", rules: [] },
            formula: {
              type: "rate",
              basis: "orderAmount",
              rate: 100,
              rounding: "floor",
            },
          },
        ],
      },
    }),
  );
  expect(res.status).toBe(201);
  return (await jsonBody<{ rule: { id: string } }>(res)).rule.id;
}

describe("POST /api/events", () => {
  it("requires authentication", async () => {
    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: { eventType: "purchase" },
      }),
    );

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("awards points from the matching rule and records the ledger", async () => {
    const { tenant, owner, customer } = await seedProgram();
    const ruleId = await seedPurchaseRule(tenant.id);
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "purchase",
          customerId: customer.id,
          payload: { orderAmount: 50, orderNumber: "ORD-1" },
        },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<EventResult>(res);
    expect(payload.duplicate).toBe(false);
    expect(payload.totalAwarded).toBe(50);
    expect(payload.awards).toEqual([
      { ruleId, ruleName: "One point per rupee", points: 50 },
    ]);

    const [updated] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customer.id));
    expect(updated.currentBalance).toBe(50);
    expect(updated.totalPointsEarned).toBe(50);

    const buckets = await db.select().from(customerRuleBalances);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({
      ruleId,
      remainingPoints: 50,
      tenantId: tenant.id,
      customerId: customer.id,
    });
    expect(buckets[0].expiresAt).toBeNull();

    const ledger = await db.select().from(pointTransactions);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      transactionType: "earn",
      points: 50,
      orderAmount: "50.00",
      ruleId,
    });

    const storedEvents = await db.select().from(events);
    expect(storedEvents).toHaveLength(1);
    expect(storedEvents[0].eventKey).toBe("purchase:ORD-1");
    expect(storedEvents[0].payload).toMatchObject({ orderAmount: 50 });
  });

  it("treats a repeated idempotency key as a duplicate", async () => {
    const { tenant, owner, customer } = await seedProgram();
    await seedPurchaseRule(tenant.id);
    signInOwner(owner.id);

    const body = {
      eventType: "purchase",
      customerId: customer.id,
      payload: { orderAmount: 50, orderNumber: "ORD-1" },
    };
    const first = await postEvent(
      apiRequest("/api/events", { method: "POST", body }),
    );
    expect(first.status).toBe(201);

    const second = await postEvent(
      apiRequest("/api/events", { method: "POST", body }),
    );

    expect(second.status).toBe(200);
    const payload = await jsonBody<EventResult>(second);
    expect(payload.duplicate).toBe(true);
    expect(payload.totalAwarded).toBe(0);
    expect(payload.eventId).toBe((await jsonBody<EventResult>(first)).eventId);

    const [updated] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customer.id));
    expect(updated.currentBalance).toBe(50);
    expect(await db.select().from(events)).toHaveLength(1);
    expect(await db.select().from(pointTransactions)).toHaveLength(1);
  });

  it("keeps tenants isolated", async () => {
    const { owner } = await seedProgram();
    const otherTenant = await seedTenant();
    const foreignCustomer = await seedCustomer(otherTenant.id);
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "purchase",
          customerId: foreignCustomer.id,
          payload: { orderAmount: 10 },
        },
      }),
    );

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({
      error: "Customer not found in this program",
    });
  });

  it("rejects an unknown customer", async () => {
    const { owner } = await seedProgram();
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "purchase",
          customerId: "00000000-0000-4000-8000-000000000000",
          payload: { orderAmount: 10 },
        },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("accepts an API-key principal and resolves the customer by email", async () => {
    const { tenant, customer } = await seedProgram();
    await seedPurchaseRule(tenant.id);
    const rawKey = await seedApiKey(tenant.id);
    useBearer(rawKey);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "purchase",
          customerEmail: customer.email,
          payload: { orderAmount: 25, orderNumber: "ORD-2" },
        },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<EventResult>(res);
    expect(payload.totalAwarded).toBe(25);

    const [stored] = await db.select().from(events);
    expect(stored.customerId).toBe(customer.id);
  });

  it("rejects an invalid API key", async () => {
    useBearer("loy_not-a-real-key");

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: { eventType: "purchase" },
      }),
    );

    expect(res.status).toBe(401);
  });

  it("lets a customer session post their own visit", async () => {
    const { customer } = await seedProgram();
    signInCustomer(customer.id, customer.tenantId);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: { eventType: "visit", payload: {} },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<EventResult>(res);
    expect(payload.totalAwarded).toBe(0);

    const [stored] = await db.select().from(events);
    expect(stored.customerId).toBe(customer.id);
    expect(stored.eventType).toBe("visit");
  });

  it("blocks a customer session from posting purchases", async () => {
    const { customer } = await seedProgram();
    signInCustomer(customer.id, customer.tenantId);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: { eventType: "purchase", payload: { orderAmount: 100 } },
      }),
    );

    expect(res.status).toBe(403);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/cannot be posted by this principal/);
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it("rejects an unknown event type", async () => {
    const { owner, customer } = await seedProgram();
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: { eventType: "teleport", customerId: customer.id },
      }),
    );

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({
      error: 'Unknown event type "teleport"',
    });
  });

  it("rejects an invalid payload", async () => {
    const { owner, customer } = await seedProgram();
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "review",
          customerId: customer.id,
          payload: { productId: "p1" },
        },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/purchaseId/);
    expect(await db.select().from(events)).toHaveLength(0);
  });

  it("rejects a purchase whose basket is explicitly empty", async () => {
    const { owner, customer } = await seedProgram();
    signInOwner(owner.id);

    const res = await postEvent(
      apiRequest("/api/events", {
        method: "POST",
        body: {
          eventType: "purchase",
          customerId: customer.id,
          payload: { orderAmount: 10, items: [] },
        },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/non-empty array/);
    expect(await db.select().from(events)).toHaveLength(0);
  });
});
