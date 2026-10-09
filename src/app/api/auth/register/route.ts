import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
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

    const { user, tenant } = await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: businessName || "My Business",
          slug: slugify(businessName || "My Business"),
          // Inert until an admin reviews the registration: the owner cannot
          // sign in and no loyalty program activity is possible before then.
          approvalStatus: "pending",
        })
        .returning();
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "owner",
          tenantId: tenant.id,
        })
        .returning();
      return { user, tenant };
    });

    // No session is issued: sign-in stays blocked until the tenant is
    // approved, so there is nothing a cookie could unlock yet.
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            brandingConfig: tenant.brandingConfig,
            suspended: tenant.suspended,
            approvalStatus: tenant.approvalStatus,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
