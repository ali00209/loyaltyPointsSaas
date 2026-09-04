import { db } from "@/db";
import { customers } from "@/db/schema";
import { requirePortalTenant } from "@/lib/api-guard";
import {
  createCustomerToken,
  normalizePakistaniMobile,
  verifyPassword,
} from "@/lib/auth";
import { CustomerLoginSchema, parseBody } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, CustomerLoginSchema);
  if (parsed.error) return parsed.error;
  const { email, phone, password } = parsed.data;
  const tenantGuard = await requirePortalTenant();
  if ("error" in tenantGuard) return tenantGuard.error;
  const { tenantId } = tenantGuard;

  const candidates = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId));
  const normalizedPhone = phone ? normalizePakistaniMobile(phone) : null;
  const customer = candidates.find((candidate) =>
    email
      ? candidate.email?.toLowerCase() === email.toLowerCase().trim()
      : normalizedPhone !== null &&
        normalizePakistaniMobile(candidate.phone ?? "") === normalizedPhone,
  );

  if (!customer || !customer.passwordHash) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, customer.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }
  if (!customer.isActive) {
    return NextResponse.json(
      { error: "This account is disabled" },
      { status: 403 },
    );
  }

  const token = createCustomerToken(customer.id, tenantId);
  const response = NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
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
