import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "loyalty-points-secret-key-change-in-prod";

export type UserRole = "admin" | "owner";

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
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

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
