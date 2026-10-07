import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { POST as runExpiry } from "@/app/api/cron/expire/route";
import { db } from "@/db";
import { customerRuleBalances, customers, pointTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jsonBody, resetTestState, seedCustomer, seedTenant } from "@/test/helpers";
import { setRequestHeader } from "@/test/next-headers";

const TEST_CRON_SECRET = "cron-secret-for-tests";
const originalCronSecret = process.env.CRON_SECRET;

beforeEach(async () => {
  process.env.CRON_SECRET = TEST_CRON_SECRET;
  await resetTestState();
});

afterAll(() => {
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("POST /api/cron/expire", () => {
  it("rejects a missing secret", async () => {
    const res = await runExpiry();

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("rejects a wrong secret", async () => {
    setRequestHeader("authorization", "Bearer not-the-secret");

    const res = await runExpiry();

    expect(res.status).toBe(401);
  });

  it("expires due buckets and zeroes the customer's balance", async () => {
    setRequestHeader("authorization", `Bearer ${TEST_CRON_SECRET}`);
    const tenant = await seedTenant();
    const customer = await seedCustomer(tenant.id, {
      currentBalance: 50,
      totalPointsEarned: 50,
    });
    await db.insert(customerRuleBalances).values({
      tenantId: tenant.id,
      customerId: customer.id,
      ruleId: null,
      remainingPoints: 50,
      expiresAt: new Date(Date.now() - 60_000),
    });
    await db.insert(customerRuleBalances).values({
      tenantId: tenant.id,
      customerId: customer.id,
      ruleId: null,
      remainingPoints: 25,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await runExpiry();

    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ expiredBuckets: 1 });

    const [updated] = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(updated.currentBalance).toBe(0);
    expect(updated.totalPointsEarned).toBe(50);

    const buckets = await db
      .select()
      .from(customerRuleBalances)
      .orderBy(customerRuleBalances.remainingPoints);
    expect(buckets.map((b) => b.remainingPoints)).toEqual([0, 25]);

    const ledger = await db.select().from(pointTransactions);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ transactionType: "expire", points: -50 });
  });

  it("is open when no CRON_SECRET is configured", async () => {
    delete process.env.CRON_SECRET;

    const res = await runExpiry();

    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ expiredBuckets: 0 });
  });
});
