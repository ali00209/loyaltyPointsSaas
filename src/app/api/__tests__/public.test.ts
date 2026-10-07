import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import { GET as publicTenant } from "@/app/api/public/tenants/[slug]/route";
import { db } from "@/db";
import { tenantSettings } from "@/db/schema";
import { jsonBody, resetTestState, routeParams, seedTenant } from "@/test/helpers";

interface PublicTenant {
  tenant: { id: string; name: string; slug: string; suspended: boolean };
}

beforeEach(resetTestState);

function lookup(slug: string) {
  return publicTenant(
    new Request(`http://localhost/api/public/tenants/${slug}`),
    routeParams({ slug }),
  );
}

describe("GET /api/public/tenants/[slug]", () => {
  it("serves a program and opens a portal session", async () => {
    const tenant = await seedTenant({ name: "Acme Coffee", slug: "acme-coffee" });

    const res = await lookup("acme-coffee");

    expect(res.status).toBe(200);
    const payload = await jsonBody<PublicTenant>(res);
    expect(payload.tenant).toMatchObject({
      id: tenant.id,
      name: "Acme Coffee",
      slug: "acme-coffee",
      suspended: false,
    });
    expect(res.cookies.get("portal_tenant_token")?.value).toBeTruthy();
  });

  it("matches the slug case-insensitively", async () => {
    await seedTenant({ slug: "acme-coffee" });

    const res = await lookup("Acme-Coffee");

    expect(res.status).toBe(200);
    expect((await jsonBody<PublicTenant>(res)).tenant.slug).toBe("acme-coffee");
  });

  it("404s for an unknown slug", async () => {
    const res = await lookup("does-not-exist");

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({ error: "Program not found" });
    expect(res.cookies.get("portal_tenant_token")).toBeUndefined();
  });

  it("hides a program whose storefront is closed", async () => {
    const tenant = await seedTenant({ slug: "acme-coffee" });
    await db.insert(tenantSettings).values({
      tenantId: tenant.id,
      key: "publicStorefront",
      value: false,
    });

    const res = await lookup("acme-coffee");

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({ error: "Program not found" });
    expect(res.cookies.get("portal_tenant_token")).toBeUndefined();
  });
});
