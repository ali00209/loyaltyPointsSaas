import { NextResponse } from "next/server";
import { AuthError, getCurrentUser, requireAdmin, requireTenant } from "@/lib/auth";

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
