import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { createToken, hashPassword } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { RegisterSchema, parseBody } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, RegisterSchema);
    if (parsed.error) return parsed.error;
    const { email, password, name, businessName } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: businessName || "My Business",
          slug: slugify(businessName || "My Business"),
        })
        .returning();
      return tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "owner",
          tenantId: tenant.id,
        })
        .returning();
    });

    const token = createToken(user.id);
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenant: { id: user.tenantId, name: businessName || "My Business", brandingConfig: {}, suspended: false },
        },
      },
      { status: 201 },
    );
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
