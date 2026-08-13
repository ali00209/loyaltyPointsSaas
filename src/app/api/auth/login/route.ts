import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { createToken, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    let tenant = null;
    if (user.tenantId) {
      const [row] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);
      if (!row) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }
      if (row.suspended) {
        return NextResponse.json(
          { error: "Your account has been suspended. Contact support." },
          { status: 403 },
        );
      }
      tenant = {
        id: row.id,
        name: row.name,
        brandingConfig: row.brandingConfig,
        suspended: row.suspended,
      };
    }

    const token = createToken(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        tenant,
      },
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
