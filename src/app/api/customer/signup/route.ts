import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, tenants } from "@/db/schema";
import { createCustomerToken, hashPassword } from "@/lib/auth";
import { applyEvent } from "@/lib/points";
import { CustomerSignupSchema, parseBody } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, CustomerSignupSchema);
  if (parsed.error) return parsed.error;
  const { slug, name, email, password, ref } = parsed.data;

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

  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenant.id),
        eq(customers.email, email.toLowerCase().trim()),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const referrer = ref
    ? (
        await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenant.id),
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
        tenantId: tenant.id,
        name,
        email: email.toLowerCase().trim(),
        passwordHash: await hashPassword(password),
        referralCode,
      })
      .returning();

    const signup = await applyEvent(
      {
        tenantId: tenant.id,
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
          tenantId: tenant.id,
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

  const token = createCustomerToken(result.customer.id, tenant.id);
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
