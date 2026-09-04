import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { apiKeys, customers, tenants, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export { normalizePakistaniMobile } from "@/lib/phone";

const JWT_SECRET = process.env.JWT_SECRET || "loyalty-points-secret-key-change-in-prod";

export const API_KEY_PREFIX = "loy_";

export type UserRole = "admin" | "owner";

interface TokenPayload {
  kind: "user" | "customer" | "portal";
  userId?: string;
  customerId?: string;
  tenantId?: string;
}

export function createPortalTenantToken(tenantId: string): string {
  return jwt.sign({ kind: "portal", tenantId }, JWT_SECRET, { expiresIn: "1d" });
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string | null;
  createdAt: Date;
  tenant: {
    id: string;
    name: string;
    slug?: string | null;
    brandingConfig: Record<string, unknown>;
    suspended: boolean;
  } | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createToken(userId: string): string {
  return jwt.sign({ kind: "user", userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function createCustomerToken(customerId: string, tenantId: string): string {
  return jwt.sign({ kind: "customer", customerId, tenantId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || payload.kind !== "user" || !payload.userId) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      tenantId: users.tenantId,
      createdAt: users.createdAt,
      tenantId_: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantBrandingConfig: tenants.brandingConfig,
      tenantSuspended: tenants.suspended,
    })
    .from(users)
    .leftJoin(tenants, eq(users.tenantId, tenants.id))
    .where(eq(users.id, payload.userId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    tenant: row.tenantId_ && row.tenantName
      ? {
          id: row.tenantId_,
          name: row.tenantName,
          slug: row.tenantSlug,
          brandingConfig: (row.tenantBrandingConfig as Record<string, unknown>) ?? {},
          suspended: row.tenantSuspended ?? false,
        }
      : null,
  };
}

export function isAdmin(user: CurrentUser | null): boolean {
  return user?.role === "admin";
}

export function isOwner(user: CurrentUser | null): boolean {
  return user?.role === "owner";
}

// Owner's tenant scoping helper. Returns 401/403 semantics via throw.
export function requireTenant(user: CurrentUser | null): string {
  if (!user) throw unauthorized();
  if (user.role !== "owner" || !user.tenantId) throw forbidden("Owner account required");
  if (user.tenant?.suspended) throw forbidden("Your account is suspended");
  return user.tenantId;
}

export function requireAdmin(user: CurrentUser | null): void {
  if (!user) throw unauthorized();
  if (user.role !== "admin") throw forbidden("Admin access required");
}

export interface CurrentCustomer {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  referralCode: string | null;
  currentBalance: number;
  isActive: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    brandingConfig: Record<string, unknown>;
    suspended: boolean;
  };
}

export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("customer_token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || payload.kind !== "customer" || !payload.customerId) return null;

  const [row] = await db
    .select({
      id: customers.id,
      tenantId: customers.tenantId,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      referralCode: customers.referralCode,
      currentBalance: customers.currentBalance,
      isActive: customers.isActive,
      tenantId_: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantBrandingConfig: tenants.brandingConfig,
      tenantSuspended: tenants.suspended,
    })
    .from(customers)
    .innerJoin(tenants, eq(customers.tenantId, tenants.id))
    .where(and(eq(customers.id, payload.customerId), eq(customers.tenantId, payload.tenantId ?? "")))
    .limit(1);

  if (!row || !row.tenantId_) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    referralCode: row.referralCode,
    currentBalance: row.currentBalance,
    isActive: row.isActive,
    tenant: {
      id: row.tenantId_,
      name: row.tenantName,
      slug: row.tenantSlug,
      brandingConfig: (row.tenantBrandingConfig as Record<string, unknown>) ?? {},
      suspended: row.tenantSuspended ?? false,
    },
  };
}

export async function getCustomerById(
  customerId: string,
  tenantId: string,
): Promise<CurrentCustomer | null> {
  const [row] = await db
    .select({
      id: customers.id,
      tenantId: customers.tenantId,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      referralCode: customers.referralCode,
      currentBalance: customers.currentBalance,
      isActive: customers.isActive,
      tenantId_: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantBrandingConfig: tenants.brandingConfig,
      tenantSuspended: tenants.suspended,
    })
    .from(customers)
    .innerJoin(tenants, eq(customers.tenantId, tenants.id))
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    referralCode: row.referralCode,
    currentBalance: row.currentBalance,
    isActive: row.isActive,
    tenant: {
      id: row.tenantId_,
      name: row.tenantName,
      slug: row.tenantSlug,
      brandingConfig: (row.tenantBrandingConfig as Record<string, unknown>) ?? {},
      suspended: row.tenantSuspended ?? false,
    },
  };
}

export function requireCustomer(customer: CurrentCustomer | null): CurrentCustomer {
  if (!customer) throw unauthorized();
  if (!customer.isActive) throw forbidden("Account is disabled");
  if (customer.tenant.suspended) throw forbidden("This loyalty program is suspended");
  return customer;
}

// ------------------------------ POS API keys -------------------------------

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}


export interface ApiKeyContext {
  tenantId: string;
  apiKeyId: string;
}

// Resolve a Bearer API key to its tenant, touching lastUsedAt.
export async function verifyApiKey(rawKey: string | null | undefined): Promise<ApiKeyContext | null> {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = hashApiKey(rawKey);
  const [row] = await db
    .select({ id: apiKeys.id, tenantId: apiKeys.tenantId })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);
  if (!row) return null;
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return { tenantId: row.tenantId, apiKeyId: row.id };
}

class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function unauthorized(): AuthError {
  return new AuthError("Unauthorized", 401);
}

export function forbidden(message = "Forbidden"): AuthError {
  return new AuthError(message, 403);
}

export { AuthError };
