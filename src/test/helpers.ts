import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { db, pool } from "@/db";
import { apiKeys, customers, tenants, users } from "@/db/schema";
import {
  createCustomerToken,
  createPortalTenantToken,
  createToken,
  generateApiKey,
  hashApiKey,
} from "@/lib/auth";
import {
  resetRequestContext,
  setRequestCookie,
  setRequestHeader,
} from "@/test/next-headers";

export const TEST_PASSWORD = "secret123";

let sequence = 0;
function unique(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Empty every table and clear the fake request scope. Call from beforeEach so
 * each test starts from a blank, migrated schema.
 */
export async function resetTestState(): Promise<void> {
  resetRequestContext();
  const { rows } = await pool.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public'",
  );
  if (rows.length === 0) return;
  const tables = rows.map((row) => `public."${row.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

// Same hash format bcryptjs produces in production (cost 12) but cheap enough
// to seed on every test; verifyPassword compares against either.
export function hashTestPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 4);
}

export async function seedTenant(
  overrides: Partial<typeof tenants.$inferInsert> = {},
): Promise<typeof tenants.$inferSelect> {
  const [row] = await db
    .insert(tenants)
    // Tests exercise approved programs by default; pass approvalStatus to
    // seed a tenant that is still awaiting review.
    .values({ name: "Acme Coffee", slug: unique("acme"), approvalStatus: "approved", ...overrides })
    .returning();
  return row;
}

export async function seedOwner(
  tenantId: string,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const [row] = await db
    .insert(users)
    .values({
      email: unique("owner") + "@example.com",
      name: "Olive Owner",
      passwordHash: await hashTestPassword(TEST_PASSWORD),
      role: "owner",
      tenantId,
      ...overrides,
    })
    .returning();
  return row;
}

export async function seedAdmin(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  const [row] = await db
    .insert(users)
    .values({
      email: unique("admin") + "@example.com",
      name: "Ada Admin",
      passwordHash: await hashTestPassword(TEST_PASSWORD),
      role: "admin",
      tenantId: null,
      ...overrides,
    })
    .returning();
  return row;
}

export async function seedCustomer(
  tenantId: string,
  overrides: Partial<typeof customers.$inferInsert> = {},
): Promise<typeof customers.$inferSelect> {
  const [row] = await db
    .insert(customers)
    .values({
      tenantId,
      name: "Cara Customer",
      email: unique("customer") + "@example.com",
      ...overrides,
    })
    .returning();
  return row;
}

/** Insert a POS API key and return the raw (unhashed) key for Bearer auth. */
export async function seedApiKey(tenantId: string): Promise<string> {
  const rawKey = generateApiKey();
  await db.insert(apiKeys).values({
    tenantId,
    name: "POS terminal",
    keyHash: hashApiKey(rawKey),
  });
  return rawKey;
}

// ── Request scope: cookies and headers read through the next/headers mock ──

export function signInOwner(userId: string): void {
  setRequestCookie("auth_token", createToken(userId));
}

export function signInCustomer(customerId: string, tenantId: string): void {
  setRequestCookie("customer_token", createCustomerToken(customerId, tenantId));
}

export function openPortalSession(tenantId: string): void {
  setRequestCookie("portal_tenant_token", createPortalTenantToken(tenantId));
}

export function useBearer(rawKey: string): void {
  setRequestHeader("authorization", `Bearer ${rawKey}`);
}

// ── Calling route handlers directly ─────────────────────────────────────────

// NextRequest has its own RequestInit flavour (e.g. no `null` signal), so the
// options are built against the constructor's parameter type.
type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function apiRequest(path: string, options: RequestOptions = {}): NextRequest {
  const { method = "GET", body, headers = {} } = options;
  const init: NextRequestInit & { duplex?: string } = {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.duplex = "half"; // Node's fetch refuses a body without duplex: half
  }
  return new NextRequest(`http://localhost${path}`, init);
}

/** Request carrying a pre-encoded body, for malformed-JSON cases. */
export function rawRequest(
  path: string,
  options: { method?: string; body: string; headers?: Record<string, string> },
): NextRequest {
  const init: NextRequestInit & { duplex: string } = {
    method: options.method ?? "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...options.headers,
    },
    body: options.body,
    duplex: "half",
  };
  return new NextRequest(`http://localhost${path}`, init);
}

/** Build the `params` argument dynamic route handlers receive. */
export function routeParams<T extends Record<string, string>>(params: T): {
  params: Promise<T>;
} {
  return { params: Promise.resolve(params) };
}

export async function jsonBody<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
