import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, tenants } from "@/db/schema";
import { createCustomerToken, verifyPassword } from "@/lib/auth";
import { CustomerLoginSchema, parseBody } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, CustomerLoginSchema);
  if (parsed.error) return parsed.error;
  const { slug, email, password } = parsed.data;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug.toLowerCase()))
    .limit(1);

  if (!tenant) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }
  if (tenant.suspended) {
    return NextResponse.json({ error: "This loyalty program is suspended" }, { status: 403 });
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenant.id),
        eq(customers.email, email.toLowerCase().trim()),
      ),
    )
    .limit(1);

  if (!customer || !customer.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!customer.isActive) {
    return NextResponse.json({ error: "This account is disabled" }, { status: 403 });
  }

  const token = createCustomerToken(customer.id, tenant.id);
  const response = NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      referralCode: customer.referralCode,
      currentBalance: customer.currentBalance,
    },
  });
  response.cookies.set("customer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
