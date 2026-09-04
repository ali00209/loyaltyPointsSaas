import { db } from "@/db";
import { customers, tenants } from "@/db/schema";
import {
  AuthError,
  getCurrentCustomer,
  getCurrentUser,
  getCustomerById,
  normalizePakistaniMobile,
  verifyToken,
  requireAdmin,
  requireCustomer,
  requireTenant,
  verifyApiKey,
} from "@/lib/auth";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

export async function requireApiKeyTenant(): Promise<
  { tenantId: string } | { error: NextResponse }
> {
  const authorization = (await headers()).get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const apiKey = await verifyApiKey(authorization.slice(7).trim());
  if (!apiKey) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { tenantId: apiKey.tenantId };
}

export async function requirePortalTenant(): Promise<
  { tenantId: string } | { error: NextResponse }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get("portal_tenant_token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || payload.kind !== "portal" || !payload.tenantId) {
    return requireApiKeyTenant();
  }
  const [tenant] = await db
    .select({ id: tenants.id, suspended: tenants.suspended })
    .from(tenants)
    .where(eq(tenants.id, payload.tenantId))
    .limit(1);
  if (!tenant) {
    return {
      error: NextResponse.json({ error: "Program not found" }, { status: 404 }),
    };
  }
  if (tenant.suspended) {
    return {
      error: NextResponse.json({ error: "This loyalty program is suspended" }, { status: 403 }),
    };
  }
  return { tenantId: tenant.id };
}

export async function requireCheckoutTenant(): Promise<
  { tenantId: string } | { error: NextResponse }
> {
  const authorization = (await headers()).get("authorization");
  if (authorization) return requireApiKeyTenant();
  return requireOwnerTenant();
}

export async function requireCustomerPortalTenant(
  slug: string,
): Promise<{ tenant: typeof tenants.$inferSelect } | { error: NextResponse }> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug.trim().toLowerCase()))
    .limit(1);

  if (!tenant) {
    return {
      error: NextResponse.json({ error: "Program not found" }, { status: 404 }),
    };
  }
  if (tenant.suspended) {
    return {
      error: NextResponse.json(
        { error: "This loyalty program is suspended" },
        { status: 403 },
      ),
    };
  }

  const authorization = (await headers()).get("authorization");
  if (authorization) {
    if (!authorization.startsWith("Bearer ")) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    const apiKey = await verifyApiKey(authorization.slice(7).trim());
    if (!apiKey || apiKey.tenantId !== tenant.id) {
      return {
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
  }

  return { tenant };
}

export async function requireOwnerTenant(): Promise<
  { tenantId: string } | { error: NextResponse }
> {
  const user = await getCurrentUser();
  try {
    return { tenantId: requireTenant(user) };
  } catch (err) {
    const e = err as AuthError;
    return {
      error: NextResponse.json({ error: e.message }, { status: e.status }),
    };
  }
}

export async function requireAdminUser(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  try {
    requireAdmin(user);
    return {
      user: user as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
    };
  } catch (err) {
    const e = err as AuthError;
    return {
      error: NextResponse.json({ error: e.message }, { status: e.status }),
    };
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
    return {
      error: NextResponse.json({ error: e.message }, { status: e.status }),
    };
  }
}

export async function requireCustomerAccess(
  searchParams: URLSearchParams,
): Promise<
  | { customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomer>>> }
  | { error: NextResponse }
> {
  const authorization = (await headers()).get("authorization");
  if (!authorization) return requireCustomerSession();
  if (!authorization.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const apiKey = await verifyApiKey(authorization.slice(7).trim());
  if (!apiKey) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = searchParams.get("customerEmail")?.trim().toLowerCase() || null;
  const phoneInput = searchParams.get("customerPhone")?.trim() || null;
  const phone = phoneInput ? normalizePakistaniMobile(phoneInput) : null;

  if (!email && !phoneInput) {
    return {
      error: NextResponse.json(
        { error: "customerEmail or customerPhone is required" },
        { status: 400 },
      ),
    };
  }
  if (phoneInput && !phone) {
    return {
      error: NextResponse.json(
        { error: "Invalid Pakistani mobile number" },
        { status: 400 },
      ),
    };
  }

  const candidates = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, apiKey.tenantId));
  const emailMatches = email
    ? candidates.filter((candidate) => candidate.email?.toLowerCase() === email)
    : [];
  const phoneMatches = phone
    ? candidates.filter(
        (candidate) =>
          normalizePakistaniMobile(candidate.phone ?? "") === phone,
      )
    : [];

  if (emailMatches.length > 1 || phoneMatches.length > 1) {
    return {
      error: NextResponse.json(
        { error: "Customer lookup is ambiguous" },
        { status: 409 },
      ),
    };
  }
  const emailCustomer = emailMatches[0];
  const phoneCustomer = phoneMatches[0];
  if ((email && !emailCustomer) || (phone && !phoneCustomer)) {
    return {
      error: NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      ),
    };
  }
  if (emailCustomer && phoneCustomer && emailCustomer.id !== phoneCustomer.id) {
    return {
      error: NextResponse.json(
        {
          error: "customerEmail and customerPhone identify different customers",
        },
        { status: 409 },
      ),
    };
  }
  const customer = emailCustomer ?? phoneCustomer;
  if (!customer) {
    return {
      error: NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      ),
    };
  }

  try {
    return {
      customer: requireCustomer(
        await getCustomerById(customer.id, apiKey.tenantId),
      ),
    };
  } catch (err) {
    const e = err as AuthError;
    return {
      error: NextResponse.json({ error: e.message }, { status: e.status }),
    };
  }
}

/**
 * Resolve a multi-principal session: owner cookie, customer cookie, or POS API
 * key. Returns an error response when no principal is authenticated.
 */
export async function resolveEventPrincipal(): Promise<
  | {
      principal: {
        kind: "owner" | "customer" | "apiKey";
        tenantId: string;
        customerId?: string;
      };
    }
  | { error: NextResponse }
> {
  const user = await getCurrentUser();
  if (user?.role === "owner" && user.tenantId) {
    if (user.tenant?.suspended) {
      return {
        error: NextResponse.json(
          { error: "Your account is suspended" },
          { status: 403 },
        ),
      };
    }
    return { principal: { kind: "owner", tenantId: user.tenantId } };
  }

  const customer = await getCurrentCustomer();
  if (customer) {
    try {
      requireCustomer(customer);
    } catch (err) {
      const e = err as AuthError;
      return {
        error: NextResponse.json({ error: e.message }, { status: e.status }),
      };
    }
    return {
      principal: {
        kind: "customer",
        tenantId: customer.tenantId,
        customerId: customer.id,
      },
    };
  }

  const bearer = await readBearerToken();
  const apiKey = await verifyApiKey(bearer);
  if (apiKey) {
    return { principal: { kind: "apiKey", tenantId: apiKey.tenantId } };
  }

  return {
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

async function readBearerToken(): Promise<string | null> {
  const header = (await headers()).get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}
