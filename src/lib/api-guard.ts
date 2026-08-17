import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  AuthError,
  getCurrentCustomer,
  getCurrentUser,
  requireAdmin,
  requireCustomer,
  requireTenant,
  verifyApiKey,
} from "@/lib/auth";

export async function requireOwnerTenant(): Promise<
  | { tenantId: string }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  try {
    return { tenantId: requireTenant(user) };
  } catch (err) {
    const e = err as AuthError;
    return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
  }
}

export async function requireAdminUser(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  try {
    requireAdmin(user);
    return { user: user as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> };
  } catch (err) {
    const e = err as AuthError;
    return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
  }
}

export async function requireCustomerSession(): Promise<
  | { customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomer>>> }
  | { error: NextResponse }
> {
  const customer = await getCurrentCustomer();
  try {
    const active = requireCustomer(customer);
    return { customer: active };
  } catch (err) {
    const e = err as AuthError;
    return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
  }
}

/**
 * Resolve a multi-principal session: owner cookie, customer cookie, or POS API
 * key. Returns an error response when no principal is authenticated.
 */
export async function resolveEventPrincipal(): Promise<
  | { principal: { kind: "owner" | "customer" | "apiKey"; tenantId: string; customerId?: string } }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (user?.role === "owner" && user.tenantId) {
    if (user.tenant?.suspended) {
      return { error: NextResponse.json({ error: "Your account is suspended" }, { status: 403 }) };
    }
    return { principal: { kind: "owner", tenantId: user.tenantId } };
  }

  const customer = await getCurrentCustomer();
  if (customer) {
    try {
      requireCustomer(customer);
    } catch (err) {
      const e = err as AuthError;
      return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
    }
    return {
      principal: { kind: "customer", tenantId: customer.tenantId, customerId: customer.id },
    };
  }

  const bearer = await readBearerToken();
  const apiKey = await verifyApiKey(bearer);
  if (apiKey) {
    return { principal: { kind: "apiKey", tenantId: apiKey.tenantId } };
  }

  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}

async function readBearerToken(): Promise<string | null> {
  const header = (await headers()).get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}
