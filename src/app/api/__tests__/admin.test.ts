import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { GET as listTenants, POST as createTenant } from "@/app/api/admin/tenants/route";
import { db } from "@/db";
import { customers, redemptionRules, tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  jsonBody,
  resetTestState,
  seedAdmin,
  seedCustomer,
  seedOwner,
  seedTenant,
  signInOwner,
} from "@/test/helpers";

interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  suspended: boolean;
  ownerEmail: string | null;
  customerCount: number;
  rewardCount: number;
}

beforeEach(resetTestState);

describe("guarding /api/admin/tenants", () => {
  it("rejects anonymous requests", async () => {
    const res = await listTenants();

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("rejects tenant owners", async () => {
    const tenant = await seedTenant();
    signInOwner((await seedOwner(tenant.id)).id);

    const res = await listTenants();

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({ error: "Admin access required" });
  });
});

describe("GET /api/admin/tenants", () => {
  it("lists every program with owner and usage counts", async () => {
    const admin = await seedAdmin();
    signInOwner(admin.id);

    const tenant = await seedTenant({ name: "Acme Coffee" });
    await seedOwner(tenant.id, { email: "owner@acme.test" });
    await seedCustomer(tenant.id);
    await seedCustomer(tenant.id);
    await db
      .insert(redemptionRules)
      .values({
        tenantId: tenant.id,
        name: "50 off",
        discountType: "fixed",
        discountValue: "50",
        pointsCost: 100,
      });
    const empty = await seedTenant({ name: "Bare Program" });

    const res = await listTenants();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ tenants: AdminTenant[] }>(res);
    const acme = payload.tenants.find((t) => t.id === tenant.id)!;
    const bare = payload.tenants.find((t) => t.id === empty.id)!;

    expect(acme).toMatchObject({
      name: "Acme Coffee",
      ownerEmail: "owner@acme.test",
      customerCount: 2,
      rewardCount: 1,
      suspended: false,
    });
    expect(bare).toMatchObject({ customerCount: 0, rewardCount: 0, ownerEmail: null });
  });
});

describe("POST /api/admin/tenants", () => {
  it("provisions a program and its owner", async () => {
    const admin = await seedAdmin();
    signInOwner(admin.id);

    const res = await createTenant(
      apiRequest("/api/admin/tenants", {
        method: "POST",
        body: {
          name: "Brew Bar",
          ownerName: "Olive Owner",
          ownerEmail: "olive@brewbar.test",
          ownerPassword: "secret123",
        },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<{ tenant: { id: string; slug: string; ownerEmail: string } }>(res);
    expect(payload.tenant.slug).toBe("brew-bar");
    expect(payload.tenant.ownerEmail).toBe("olive@brewbar.test");

    const [storedTenant] = await db.select().from(tenants).where(eq(tenants.id, payload.tenant.id));
    expect(storedTenant.name).toBe("Brew Bar");

    const [owner] = await db.select().from(users).where(eq(users.email, "olive@brewbar.test"));
    expect(owner.role).toBe("owner");
    expect(owner.tenantId).toBe(payload.tenant.id);
    expect(owner.passwordHash).not.toBe("secret123");
  });

  it("rejects a duplicate owner email", async () => {
    const admin = await seedAdmin();
    const tenant = await seedTenant();
    await seedOwner(tenant.id, { email: "taken@acme.test" });
    signInOwner(admin.id);

    const res = await createTenant(
      apiRequest("/api/admin/tenants", {
        method: "POST",
        body: {
          name: "Brew Bar",
          ownerName: "Olive Owner",
          ownerEmail: "taken@acme.test",
          ownerPassword: "secret123",
        },
      }),
    );

    expect(res.status).toBe(409);
    expect(await jsonBody(res)).toEqual({ error: "Owner email already registered" });
    expect(await db.select().from(tenants)).toHaveLength(1);
  });

  it("rejects an invalid slug", async () => {
    const admin = await seedAdmin();
    signInOwner(admin.id);

    const res = await createTenant(
      apiRequest("/api/admin/tenants", {
        method: "POST",
        body: {
          name: "Brew Bar",
          ownerName: "Olive",
          ownerEmail: "olive@brewbar.test",
          ownerPassword: "secret123",
          slug: "Not A Slug",
        },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toBe("Validation failed");
  });
});
