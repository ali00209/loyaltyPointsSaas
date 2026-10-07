import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { DELETE as deleteRule, PUT as putRule } from "@/app/api/rules/[id]/route";
import { GET as listRules, POST as createRule, PUT as toggleRule } from "@/app/api/rules/route";
import { db } from "@/db";
import { earningRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  jsonBody,
  resetTestState,
  routeParams,
  seedAdmin,
  seedOwner,
  seedTenant,
  signInOwner,
} from "@/test/helpers";

interface Rule {
  id: string;
  tenantId: string;
  name: string;
  eventType: string;
  perItem: boolean;
  active: boolean;
  formulaGroups: Array<{ conditions: unknown; formula: { rate: number; basis: string } }>;
  formulaText?: string;
}

const purchaseRule = {
  name: "1 point per rupee",
  eventType: "purchase",
  formulaGroups: [
    {
      conditions: { combinator: "and", rules: [] },
      formula: { type: "rate", basis: "orderAmount", rate: 100, rounding: "floor" },
    },
  ],
};

beforeEach(resetTestState);

describe("guarding", () => {
  it("rejects anonymous requests", async () => {
    const res = await listRules();

    expect(res.status).toBe(401);
    expect(await jsonBody(res)).toEqual({ error: "Unauthorized" });
  });

  it("rejects admin users on owner endpoints", async () => {
    const admin = await seedAdmin();
    signInOwner(admin.id);

    const res = await listRules();

    expect(res.status).toBe(403);
    expect(await jsonBody(res)).toEqual({ error: "Owner account required" });
  });
});

describe("GET /api/rules", () => {
  it("lists only this program's rules with a readable formula", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const otherTenant = await seedTenant();
    await db
      .insert(earningRules)
      .values([
        { tenantId: tenant.id, name: "Mine", eventType: "purchase", formulaGroups: [] },
        { tenantId: otherTenant.id, name: "Theirs", eventType: "purchase", formulaGroups: [] },
      ]);
    signInOwner(owner.id);

    const res = await listRules();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ rules: Rule[] }>(res);
    expect(payload.rules).toHaveLength(1);
    expect(payload.rules[0].name).toBe("Mine");
    expect(payload.rules[0].tenantId).toBe(tenant.id);
    expect(typeof payload.rules[0].formulaText).toBe("string");
  });
});

describe("POST /api/rules", () => {
  it("persists a compiled rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    signInOwner(owner.id);

    const res = await createRule(
      apiRequest("/api/rules", { method: "POST", body: purchaseRule }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<{ rule: Rule }>(res);
    expect(payload.rule.tenantId).toBe(tenant.id);
    expect(payload.rule.eventType).toBe("purchase");
    expect(payload.rule.perItem).toBe(false);
    expect(payload.rule.active).toBe(true);
    expect(payload.rule.formulaGroups).toHaveLength(1);

    const [stored] = await db.select().from(earningRules).where(eq(earningRules.id, payload.rule.id));
    expect(stored.name).toBe("1 point per rupee");
  });

  it("rejects an unknown event type", async () => {
    const tenant = await seedTenant();
    signInOwner((await seedOwner(tenant.id)).id);

    const res = await createRule(
      apiRequest("/api/rules", { method: "POST", body: { ...purchaseRule, eventType: "teleport" } }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/Event type must be one of/);
  });

  it("rejects per-item rules on non-purchase events", async () => {
    const tenant = await seedTenant();
    signInOwner((await seedOwner(tenant.id)).id);

    const res = await createRule(
      apiRequest("/api/rules", {
        method: "POST",
        body: { ...purchaseRule, eventType: "review", perItem: true },
      }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toMatch(/perItem/);
  });

  it("rejects a body that fails schema validation", async () => {
    const tenant = await seedTenant();
    signInOwner((await seedOwner(tenant.id)).id);

    const res = await createRule(
      apiRequest("/api/rules", { method: "POST", body: { eventType: "purchase" } }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string; details: { field: string }[] }>(res);
    expect(payload.error).toBe("Validation failed");
    expect(payload.details.map((d) => d.field)).toContain("name");
  });
});

describe("PUT /api/rules (toggle)", () => {
  it("flips the active flag", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const [rule] = await db
      .insert(earningRules)
      .values({ tenantId: tenant.id, name: "Rule", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await toggleRule(
      apiRequest("/api/rules", { method: "PUT", body: { id: rule.id, active: false } }),
    );

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ rule: Rule }>(res);
    expect(payload.rule.active).toBe(false);

    const [stored] = await db.select().from(earningRules).where(eq(earningRules.id, rule.id));
    expect(stored.active).toBe(false);
  });

  it("404s on another program's rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const otherTenant = await seedTenant();
    const [foreign] = await db
      .insert(earningRules)
      .values({ tenantId: otherTenant.id, name: "Theirs", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await toggleRule(
      apiRequest("/api/rules", { method: "PUT", body: { id: foreign.id, active: false } }),
    );

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({ error: "Rule not found" });
  });
});

describe("PUT /api/rules/[id]", () => {
  it("renames a rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const [rule] = await db
      .insert(earningRules)
      .values({ tenantId: tenant.id, name: "Old name", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await putRule(
      apiRequest(`/api/rules/${rule.id}`, { method: "PUT", body: { name: "New name" } }),
      routeParams({ id: rule.id }),
    );

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ rule: Rule }>(res);
    expect(payload.rule.name).toBe("New name");
  });

  it("404s on another program's rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const otherTenant = await seedTenant();
    const [foreign] = await db
      .insert(earningRules)
      .values({ tenantId: otherTenant.id, name: "Theirs", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await putRule(
      apiRequest(`/api/rules/${foreign.id}`, { method: "PUT", body: { name: "Hijacked" } }),
      routeParams({ id: foreign.id }),
    );

    expect(res.status).toBe(404);
    const [stored] = await db.select().from(earningRules).where(eq(earningRules.id, foreign.id));
    expect(stored.name).toBe("Theirs");
  });
});

describe("DELETE /api/rules/[id]", () => {
  it("deletes a rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const [rule] = await db
      .insert(earningRules)
      .values({ tenantId: tenant.id, name: "Doomed", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await deleteRule(
      apiRequest(`/api/rules/${rule.id}`, { method: "DELETE" }),
      routeParams({ id: rule.id }),
    );

    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ success: true });

    const stored = await db.select().from(earningRules).where(eq(earningRules.id, rule.id));
    expect(stored).toHaveLength(0);
  });

  it("404s on another program's rule", async () => {
    const tenant = await seedTenant();
    const owner = await seedOwner(tenant.id);
    const otherTenant = await seedTenant();
    const [foreign] = await db
      .insert(earningRules)
      .values({ tenantId: otherTenant.id, name: "Theirs", eventType: "purchase", formulaGroups: [] })
      .returning();
    signInOwner(owner.id);

    const res = await deleteRule(
      apiRequest(`/api/rules/${foreign.id}`, { method: "DELETE" }),
      routeParams({ id: foreign.id }),
    );

    expect(res.status).toBe(404);

    const stored = await db.select().from(earningRules).where(eq(earningRules.id, foreign.id));
    expect(stored).toHaveLength(1);
  });
});
