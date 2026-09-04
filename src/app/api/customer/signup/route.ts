import { db } from "@/db";
import { customers } from "@/db/schema";
import { requirePortalTenant } from "@/lib/api-guard";
import {
  createCustomerToken,
  hashPassword,
  normalizePakistaniMobile,
} from "@/lib/auth";
import { applyEvent } from "@/lib/points";
import { CustomerSignupSchema, parseBody } from "@/lib/validations";
import { and, eq, or, SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, CustomerSignupSchema);
  if (parsed.error) return parsed.error;
  const { name, email, phone, password, ref } = parsed.data;
  const tenantGuard = await requirePortalTenant();
  if ("error" in tenantGuard) return tenantGuard.error;
  const { tenantId } = tenantGuard;
  const normalizedPhone = phone ? normalizePakistaniMobile(phone) : null;
  if (phone && !normalizedPhone) {
    return NextResponse.json(
      { error: "Invalid Pakistani mobile number" },
      { status: 400 },
    );
  }
  let condition: SQL[] = [];

  if (email?.trim()) {
    condition.push(eq(customers.email, email.toLowerCase().trim()));
  }

  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        or(...condition, eq(customers.phone, normalizedPhone!)),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with this email or phone num already exists" },
      { status: 409 },
    );
  }
  // if (normalizedPhone) {
  //   const [existingPhone] = await db
  //     .select({ id: customers.id })
  //     .from(customers)
  //     .where(
  //       and(
  //         eq(customers.tenantId, tenant.id),
  //         eq(customers.phone, normalizedPhone),
  //       ),
  //     )
  //     .limit(1);
  //   if (existingPhone) {
  //     return NextResponse.json(
  //       { error: "An account with this phone already exists" },
  //       { status: 409 },
  //     );
  //   }
  // }

  const referrer = ref
    ? (
        await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              eq(customers.referralCode, ref),
            ),
          )
          .limit(1)
      )[0]
    : undefined;

  const referralCode = Math.random().toString(36).slice(2, 10);

  const result = await db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        tenantId,
        name,
        email: email && email?.toLowerCase().trim(),
        phone: normalizedPhone!,
        passwordHash: await hashPassword(password),
        referralCode,
      })
      .returning();

    const signup = await applyEvent(
      {
        tenantId,
        customerId: customer.id,
        eventType: "customer_signup",
        payload: {},
      },
      tx,
    );

    let referralEarned = 0;
    if (referrer && referrer.id !== customer.id) {
      const refResult = await applyEvent(
        {
          tenantId,
          customerId: referrer.id,
          eventType: "referral",
          payload: { referredCustomerId: customer.id },
        },
        tx,
      );
      referralEarned = refResult.totalAwarded;
    }

    return { customer, signup, referralEarned };
  });

  const token = createCustomerToken(result.customer.id, tenantId);
  const response = NextResponse.json(
    {
      customer: {
        id: result.customer.id,
        name: result.customer.name,
        email: result.customer.email,
        referralCode: result.customer.referralCode,
      },
      signupPointsAwarded: result.signup.totalAwarded,
      referralPointsAwarded: result.referralEarned,
    },
    { status: 201 },
  );
  response.cookies.set("customer_token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
