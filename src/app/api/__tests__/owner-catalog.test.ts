import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => import("@/test/next-headers"));

import {
  DELETE as deleteCustomer,
  GET as listCustomers,
  POST as createCustomer,
  PUT as updateCustomer,
} from "@/app/api/customers/route";
import {
  DELETE as deleteProduct,
  GET as listProducts,
  POST as createProduct,
  PUT as updateProduct,
} from "@/app/api/products/route";
import { db } from "@/db";
import { customers, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  apiRequest,
  jsonBody,
  resetTestState,
  seedCustomer,
  seedOwner,
  seedTenant,
  signInOwner,
} from "@/test/helpers";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
  category: string;
  active: boolean;
}

beforeEach(resetTestState);

async function signInProgramOwner() {
  const tenant = await seedTenant();
  const owner = await seedOwner(tenant.id);
  signInOwner(owner.id);
  return { tenant, owner };
}

describe("GET /api/customers", () => {
  it("lists only this program's customers", async () => {
    const { tenant } = await signInProgramOwner();
    const otherTenant = await seedTenant();
    await seedCustomer(tenant.id, { name: "Mine" });
    await seedCustomer(otherTenant.id, { name: "Theirs" });

    const res = await listCustomers();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ customers: Customer[] }>(res);
    expect(payload.customers.map((c) => c.name)).toEqual(["Mine"]);
  });

  it("requires an owner session", async () => {
    const res = await listCustomers();

    expect(res.status).toBe(401);
  });
});

describe("POST /api/customers", () => {
  it("normalizes a Pakistani mobile number", async () => {
    const { tenant } = await signInProgramOwner();

    const res = await createCustomer(
      apiRequest("/api/customers", {
        method: "POST",
        body: { name: "Cara", email: "cara@example.com", phone: "0300-1234567" },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<{ customer: Customer }>(res);
    expect(payload.customer.phone).toBe("+923001234567");

    const [stored] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, payload.customer.id));
    expect(stored.tenantId).toBe(tenant.id);
    expect(stored.phone).toBe("+923001234567");
    expect(stored.currentBalance).toBe(0);
  });

  it("rejects a duplicate phone number in the same program", async () => {
    const { tenant } = await signInProgramOwner();
    await seedCustomer(tenant.id, { phone: "+923001234567" });

    const res = await createCustomer(
      apiRequest("/api/customers", { method: "POST", body: { name: "Clone", phone: "03001234567" } }),
    );

    expect(res.status).toBe(409);
    expect(await jsonBody(res)).toEqual({
      error: "Phone number already exists in this program",
    });
  });

  it("allows the same phone number in a different program", async () => {
    const { tenant } = await signInProgramOwner();
    const otherTenant = await seedTenant();
    await seedCustomer(otherTenant.id, { phone: "+923001234567" });

    const res = await createCustomer(
      apiRequest("/api/customers", { method: "POST", body: { name: "Cara", phone: "03001234567" } }),
    );

    expect(res.status).toBe(201);
    expect((await jsonBody<{ customer: Customer }>(res)).customer.phone).toBe("+923001234567");
  });

  it("rejects a missing name", async () => {
    await signInProgramOwner();

    const res = await createCustomer(
      apiRequest("/api/customers", { method: "POST", body: { phone: "03001234567" } }),
    );

    expect(res.status).toBe(400);
    const payload = await jsonBody<{ error: string }>(res);
    expect(payload.error).toBe("Validation failed");
  });
});

describe("PUT /api/customers", () => {
  it("updates a customer", async () => {
    const { tenant } = await signInProgramOwner();
    const customer = await seedCustomer(tenant.id);

    const res = await updateCustomer(
      apiRequest("/api/customers", { method: "PUT", body: { id: customer.id, name: "Renamed" } }),
    );

    expect(res.status).toBe(200);
    expect((await jsonBody<{ customer: Customer }>(res)).customer.name).toBe("Renamed");
  });

  it("404s on another program's customer", async () => {
    await signInProgramOwner();
    const otherTenant = await seedTenant();
    const foreign = await seedCustomer(otherTenant.id);

    const res = await updateCustomer(
      apiRequest("/api/customers", { method: "PUT", body: { id: foreign.id, name: "Hijacked" } }),
    );

    expect(res.status).toBe(404);
    expect(await jsonBody(res)).toEqual({ error: "Not found" });
  });

  it("rejects a phone number another customer already owns", async () => {
    const { tenant } = await signInProgramOwner();
    const customer = await seedCustomer(tenant.id);
    await seedCustomer(tenant.id, { phone: "+923001234567" });

    const res = await updateCustomer(
      apiRequest("/api/customers", {
        method: "PUT",
        body: { id: customer.id, phone: "03001234567" },
      }),
    );

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/customers", () => {
  it("requires an id", async () => {
    await signInProgramOwner();

    const res = await deleteCustomer(apiRequest("/api/customers", { method: "DELETE" }));

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({ error: "Customer ID required" });
  });

  it("deletes a customer", async () => {
    const { tenant } = await signInProgramOwner();
    const customer = await seedCustomer(tenant.id);

    const res = await deleteCustomer(
      apiRequest(`/api/customers?id=${customer.id}`, { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    expect(await jsonBody(res)).toEqual({ success: true });

    const stored = await db.select().from(customers).where(eq(customers.id, customer.id));
    expect(stored).toHaveLength(0);
  });

  it("never deletes across programs", async () => {
    await signInProgramOwner();
    const otherTenant = await seedTenant();
    const foreign = await seedCustomer(otherTenant.id);

    const res = await deleteCustomer(
      apiRequest(`/api/customers?id=${foreign.id}`, { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    const stored = await db.select().from(customers).where(eq(customers.id, foreign.id));
    expect(stored).toHaveLength(1);
  });
});

describe("products", () => {
  it("creates a product scoped to the program", async () => {
    const { tenant } = await signInProgramOwner();

    const res = await createProduct(
      apiRequest("/api/products", {
        method: "POST",
        body: { name: "Flat White", sku: "FW-1", price: 12.5, category: "Coffee" },
      }),
    );

    expect(res.status).toBe(201);
    const payload = await jsonBody<{ product: Product }>(res);
    expect(Number(payload.product.price)).toBe(12.5);
    expect(payload.product.category).toBe("Coffee");
    expect(payload.product.active).toBe(true);

    const [stored] = await db.select().from(products).where(eq(products.id, payload.product.id));
    expect(stored.tenantId).toBe(tenant.id);
  });

  it("rejects a non-positive price", async () => {
    await signInProgramOwner();

    const res = await createProduct(
      apiRequest("/api/products", { method: "POST", body: { name: "Free", sku: "F-1", price: 0 } }),
    );

    expect(res.status).toBe(400);
    expect((await jsonBody<{ details: { field: string }[] }>(res)).details[0].field).toBe("price");
  });

  it("lists only this program's products", async () => {
    const { tenant } = await signInProgramOwner();
    const otherTenant = await seedTenant();
    await db.insert(products).values([
      { tenantId: tenant.id, name: "Mine", sku: "M-1", price: "1.00" },
      { tenantId: otherTenant.id, name: "Theirs", sku: "T-1", price: "2.00" },
    ]);

    const res = await listProducts();

    expect(res.status).toBe(200);
    const payload = await jsonBody<{ products: Product[] }>(res);
    expect(payload.products.map((p) => p.name)).toEqual(["Mine"]);
  });

  it("updates a product but 404s across programs", async () => {
    const { tenant } = await signInProgramOwner();
    const otherTenant = await seedTenant();
    const [mine] = await db
      .insert(products)
      .values({ tenantId: tenant.id, name: "Mine", sku: "M-1", price: "1.00" })
      .returning();
    const [foreign] = await db
      .insert(products)
      .values({ tenantId: otherTenant.id, name: "Theirs", sku: "T-1", price: "2.00" })
      .returning();

    const updated = await updateProduct(
      apiRequest("/api/products", { method: "PUT", body: { id: mine.id, name: "Renamed" } }),
    );
    expect(updated.status).toBe(200);
    expect((await jsonBody<{ product: Product }>(updated)).product.name).toBe("Renamed");

    const blocked = await updateProduct(
      apiRequest("/api/products", { method: "PUT", body: { id: foreign.id, name: "Hijacked" } }),
    );
    expect(blocked.status).toBe(404);
  });

  it("deletes a product", async () => {
    const { tenant } = await signInProgramOwner();
    const [product] = await db
      .insert(products)
      .values({ tenantId: tenant.id, name: "Mine", sku: "M-1", price: "1.00" })
      .returning();

    const res = await deleteProduct(
      apiRequest(`/api/products?id=${product.id}`, { method: "DELETE" }),
    );

    expect(res.status).toBe(200);
    const stored = await db.select().from(products).where(eq(products.id, product.id));
    expect(stored).toHaveLength(0);
  });

  it("requires an id", async () => {
    await signInProgramOwner();

    const res = await deleteProduct(apiRequest("/api/products", { method: "DELETE" }));

    expect(res.status).toBe(400);
    expect(await jsonBody(res)).toEqual({ error: "Product ID required" });
  });
});
