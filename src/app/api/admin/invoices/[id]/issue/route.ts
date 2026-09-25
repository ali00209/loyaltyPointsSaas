import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdminUser } from "@/lib/api-guard";
import { issueInvoice } from "@/lib/billing";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  try {
    await db.transaction(async (tx) => issueInvoice(tx, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to issue invoice" },
      { status: 400 },
    );
  }
}