import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const [existing] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (existing.status === "voided") {
    return NextResponse.json({ error: "Invoice is already voided" }, { status: 400 });
  }

  const [invoice] = await db
    .update(invoices)
    .set({ status: "voided", updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();

  return NextResponse.json({ invoice });
}