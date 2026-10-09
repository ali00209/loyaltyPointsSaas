import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { GET as me } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  jsonBody,
  rawRequest,
  resetTestState,
  seedAdmin,
  seedOwner,
  seedTenant,
  signInOwner,
  TEST_PASSWORD,
} from "@/test/helpers";

interface RegisteredUser {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    tenant?: { approvalStatus: string } | null;
  };
}

beforeEach(resetTestState);

describe("POST /api/auth/register", () => {
  const body = {
    email: "owner@acme.test",
    password: "secret123",
    name: "Olive Owner",
    businessName: "Acme Coffee",
  };

  it("creates a tenant and owner that await admin approval, with no session yet", async () => {
    const res = await register(apiRequest("/api/auth/register", { method: "POST", body }));

    expect(res.status).toBe(201);
    // Nothing to sign in to until an admin approves the tenant.
    expect(res.cookies.get("auth_token")).toBeUndefined();

    const payload = await jsonBody<RegisteredUser>(res);
    expect(payload.user.email).toBe("owner@acme.test");
    expect(payload.user.role).toBe("owner");
    expect(payload.user.tenantId).toBeTruthy();
    expect(payload.user.tenant?.approvalStatus).toBe("pending");

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, payload.user.tenantId!));
    expect(tenant.name).toBe("Acme Coffee");
    expect(tenant.slug).toBe("acme-coffee");
    expect(tenant.approvalStatus).toBe("pending");

    const [owner] = await db.select().from(users).where(eq(users.id, payload.user.id));
    expect(owner.role).toBe("owner");
    expect(owner.tenantId).toBe(payload.user.tenantId);
    expect(owner.passwordHash).not.toBe("secret123");
  });

  it("keeps the new account locked out until an admin approves it", async () => {
    await register(apiRequest("/api/auth/register", { method: "POST", body }));

    const signIn = () =>
      login(
        apiRequest("/api/auth/login", {
          method: "POST",
          body: { email: body.email, password: body.password },
        }),
      );

    const blocked = await signIn();
    expect(blocked.status).toBe(403);
    expect(await jsonBody(blocked)).toEqual({
      error: "Your account is awaiting admin approval.",
    });
    expect(blocked.cookies.get("auth_token")).toBeUndefined();

    await db
      .update(tenants)
      .set({ approvalStatus: "approved" })
      .where(eq(tenants.slug, "acme-coffee"));

    const approved = await signIn();
    expect(approved.status).toBe(200);
    expect(approved.cookies.get("auth_token")?.value).toBeTruthy();
  });

  it("rejects a duplicate email", async () => {
    await register(apiRequest("/api/auth/register", { method: "POST", body }));
    const res = await register(apiRequest("/api/auth/register", { method: "POST", body }));

    expect(res.status).toBe(409);
    expect(await jsonBody(res)).toEqual({ error: "Email already registered" });
  });

  it("rejects an invalid body", async () => {
    const res = await register(
      apiRequest("/api/auth/register", {
        method: "POST",
        body: { ...body, email: "not-an-email" },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string; details: { field: string }[] }>(res);
    expect(payload.error).toBe("Validation failed");
    expect(payload.details.some((d) => d.field === "email")).toBe(true);
  });

  it("rejects a malformed JSON body", async () => {
    const res = await register(rawRequest("/api/auth/register", { body: "{ not json" }));

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({ error: "Invalid JSON in request body" });
  });
});

describe("POST /api/auth/login", () => {
  it("authenticates an owner and sets the session cookie", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);

    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: owner.email, password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(200);
    expect(res.cookies.get("auth_token")?.value).toBeTruthy();

    const payload = await jsonBody<{ user: { id: string; tenant: { name: string } } }>(res);
    expect(payload.user.id).toBe(owner.id);
    expect(payload.user.tenant.name).toBe(tenant.name);
  });

  it("rejects a wrong password", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);

    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: owner.email, password: "wrong-password" },
      }),
    );

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Invalid credentials" });
    expect(res.cookies.get("auth_token")).toBeUndefined();
  });

  it("rejects an unknown email", async () => {
    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: "nobody@example.com", password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Invalid credentials" });
  });

  it("blocks a suspended program", async () => {
    const tenant = await seedTenant({ suspended: true });
    const owner = await seedOwner(tenant.id);

    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: owner.email, password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(res.cookies.get("auth_token")).toBeUndefined();
  });

  it("blocks a program awaiting approval", async () => {
    const tenant = await seedTenant({ approvalStatus: "pending" });
    const owner = await seedOwner(tenant.id);

    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: owner.email, password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({
      error: "Your account is awaiting admin approval.",
    });
    expect(res.cookies.get("auth_token")).toBeUndefined();
  });

  it("blocks a declined registration", async () => {
    const tenant = await seedTenant({ approvalStatus: "rejected" });
    const owner = await seedOwner(tenant.id);

    const res = await login(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: { email: owner.email, password: TEST_PASSWORD },
      }),
    );

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({
      error: "Your registration was declined. Contact support.",
    });
    expect(res.cookies.get("auth_token")).toBeUndefined();
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session", async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Not authenticated" });
  });

  it("returns the signed-in user", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    signInOwner(owner.id);

    const res = await me();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ user: { id: string; role: string; tenantId: string | null } }>(res);
    expect(payload.user.id).toBe(owner.id);
    expect(payload.user.role).toBe("owner");
    expect(payload.user.tenantId).toBe(tenant.id);
  });

  it("ignores an admin session for owner-scoped identity", async () => {
    const admin = await seedAdmin();
    signInOwner(admin.id);

    const res = await me();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ user: { role: string; tenantId: string | null } }>(res);
    expect(payload.user.role).toBe("admin");
    expect(payload.user.tenantId).toBeNull();
  });
});
