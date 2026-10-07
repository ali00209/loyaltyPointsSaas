import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { GET as customerMe } from "@/app/api/customer/me/route";
import { POST as customerLogin } from "@/app/api/customer/login/route";
import { POST as customerSignup } from "@/app/api/customer/signup/route";
import { POST as createRule } from "@/app/api/rules/route";
import { db } from "@/db";
import { customers, events, tenantSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  hashTestPassword,
  jsonBody,
  openPortalSession,
  resetTestState,
  seedApiKey,
  seedCustomer,
  seedOwner,
  seedTenant,
  signInCustomer,
  signInOwner,
  TEST_PASSWORD,
  useBearer,
} from "@/test/helpers";

interface SignupResult {
  customer: { id: string; name: string; email: string | null; referralCode: string | null };
  signupPointsAwarded: number;
  referralPointsAwarded: number;
}

beforeEach(resetTestState);

async function seedPortalTenant(options: { suspended?: boolean; closed?: boolean } = {}) {
  const tenant = await seedTenant({ suspended: options.suspended ?? false });
  if (options.closed) {
    await db.insert(tenantSettings).values({
      tenantId: tenant.id,
      key: "publicStorefront",
      value: false,
    });
  }
  return tenant;
}

describe("POST /api/customer/signup", () => {
  it("requires a portal session", async () => {
    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("creates a portal customer with a normalized phone and session cookie", async () => {
    const tenant = await seedPortalTenant();
    openPortalSession(tenant.id);

    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", phone: "0300-1234567", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(201);
    expect(res.cookies.get("customer_token")?.value).toBeTruthy();

    const payload = await jsonBody<SignupResult>(res);
    expect(payload.customer.name).toBe("Cara");
    expect(payload.signupPointsAwarded).toBe(0);

    const [stored] = await db.select().from(customers).where(eq(customers.id, payload.customer.id));
    expect(stored.tenantId).toBe(tenant.id);
    expect(stored.phone).toBe("+923001234567");
    expect(stored.passwordHash).toBeTruthy();

    const signupEvents = await db.select().from(events);
    expect(signupEvents).toHaveLength(1);
    expect(signupEvents[0].eventType).toBe("customer_signup");
  });

  it("awards points from a signup rule", async () => {
    const tenant = await seedPortalTenant();
    const owner = await seedOwner(tenant.id);
    signInOwner(owner.id);
    const rule = await createRule(
      apiRequest("/api/rules", {
        method: "POST",
        body: {
          name: "Welcome bonus",
          eventType: "customer_signup",
          formulaGroups: [
            {
              conditions: { combinator: "and", rules: [] },
              formula: { type: "flat", flatAmount: 100, rounding: "floor" },
            },
          ],
        },
      }),
    );
    expect(rule.status).toBe(201);

    openPortalSession(tenant.id);
    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<SignupResult>(res);
    expect(payload.signupPointsAwarded).toBe(100);

    const [stored] = await db.select().from(customers).where(eq(customers.id, payload.customer.id));
    expect(stored.currentBalance).toBe(100);
  });

  it("rejects a duplicate email in the same program", async () => {
    const tenant = await seedPortalTenant();
    await seedCustomer(tenant.id, { email: "cara@example.com" });
    openPortalSession(tenant.id);

    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Clone", email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(409);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/already exists/);
  });

  it("rejects a malformed phone number", async () => {
    const tenant = await seedPortalTenant();
    openPortalSession(tenant.id);

    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", phone: "12345", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({ error: "Invalid Pakistani mobile number" });
  });

  it("refuses signups for a suspended program", async () => {
    const tenant = await seedPortalTenant({ suspended: true });
    openPortalSession(tenant.id);

    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({
      error: "This loyalty program is suspended",
    });
  });

  it("refuses signups while the storefront is closed", async () => {
    const tenant = await seedPortalTenant({ closed: true });
    openPortalSession(tenant.id);

    const res = await customerSignup(
      apiRequest("/api/customer/signup", {
        method: "POST",
        body: { name: "Cara", email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({
      error: "The customer portal is closed for this program",
    });
    expect(await db.select().from(customers)).toHaveLength(0);
  });
});

describe("POST /api/customer/login", () => {
  async function seedLoginCustomer() {
    const tenant = await seedPortalTenant();
    const customer = await seedCustomer(tenant.id, {
      email: "cara@example.com",
      phone: "+923001234567",
      passwordHash: await hashTestPassword(TEST_PASSWORD),
      currentBalance: 75,
    });
    openPortalSession(tenant.id);
    return { tenant, customer };
  }

  it("logs in by email", async () => {
    const { customer } = await seedLoginCustomer();

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { email: "Cara@Example.COM", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("customer_token")?.value).toBeTruthy();

    const payload = await jsonBody<{ customer: { id: string; currentBalance: number } }>(res);
    expect(payload.customer.id).toBe(customer.id);
    expect(payload.customer.currentBalance).toBe(75);
  });

  it("logs in by local-format phone", async () => {
    const { customer } = await seedLoginCustomer();

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { phone: "0300-1234567", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ customer: { id: string } }>(res);
    expect(payload.customer.id).toBe(customer.id);
  });

  it("rejects a wrong password", async () => {
    await seedLoginCustomer();

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { email: "cara@example.com", password: "wrong-password" },
      }),
    );

    expect(res.status).toBe(401);
    expect(res.cookies.get("customer_token")).toBeUndefined();
  });

  it("rejects an unknown account", async () => {
    await seedLoginCustomer();

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { email: "ghost@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(401);
  });

  it("blocks a disabled account", async () => {
    const tenant = await seedPortalTenant();
    await seedCustomer(tenant.id, {
      email: "cara@example.com",
      passwordHash: await hashTestPassword(TEST_PASSWORD),
      isActive: false,
    });
    openPortalSession(tenant.id);

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { email: "cara@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({ error: "This account is disabled" });
  });

  it("rejects supplying both email and phone", async () => {
    const { customer } = await seedLoginCustomer();

    const res = await customerLogin(
      apiRequest("/api/customer/login", {
        method: "POST",
        body: { email: customer.email, phone: "0300-1234567", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ details: { message: string }[] }>(res);
    expect(payload.details[0].message).toMatch(/exactly one of email or phone/);
  });
});

describe("GET /api/customer/me", () => {
  it("requires a session", async () => {
    const res = await customerMe(apiRequest("/api/customer/me"));

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("returns the signed-in customer with their program", async () => {
    const tenant = await seedPortalTenant();
    const customer = await seedCustomer(tenant.id, { currentBalance: 40 });
    signInCustomer(customer.id, tenant.id);

    const res = await customerMe(apiRequest("/api/customer/me"));

    expect(res.status).toBe(200);
    const payload = await jsonBody<{
      customer: { id: string; currentBalance: number; tenant: { id: string; slug: string } };
    }>(res);
    expect(payload.customer.id).toBe(customer.id);
    expect(payload.customer.currentBalance).toBe(40);
    expect(payload.customer.tenant.id).toBe(tenant.id);
    expect(payload.customer.tenant.slug).toBe(tenant.slug);
  });

  it("resolves a customer through a POS API key", async () => {
    const tenant = await seedPortalTenant();
    const customer = await seedCustomer(tenant.id);
    const rawKey = await seedApiKey(tenant.id);
    useBearer(rawKey);

    const res = await customerMe(
      apiRequest(`/api/customer/me?customerEmail=${encodeURIComponent(customer.email!)}`),
    );

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ customer: { id: string } }>(res);
    expect(payload.customer.id).toBe(customer.id);
  });

  it("rejects a lookup without identifiers", async () => {
    const tenant = await seedPortalTenant();
    const rawKey = await seedApiKey(tenant.id);
    useBearer(rawKey);

    const res = await customerMe(apiRequest("/api/customer/me"));

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({
      error: "customerEmail or customerPhone is required",
    });
  });
});
