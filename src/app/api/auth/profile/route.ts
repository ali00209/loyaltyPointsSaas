import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required").min(6, "Password must be at least 6 characters"),
});

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();

  // Password change
  if (body.currentPassword && body.newPassword) {
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }

    const [fullUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!fullUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await verifyPassword(parsed.data.currentPassword, fullUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true, message: "Password updated" });
  }

  // Profile update
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  const { name, email } = parsed.data;

  if (email !== user.email) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(users)
    .set({ name, email })
    .where(eq(users.id, user.id))
    .returning({ id: users.id, name: users.name, email: users.email });

  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: user.role,
      tenantId: user.tenantId,
      tenant: user.tenant,
    },
  });
}
