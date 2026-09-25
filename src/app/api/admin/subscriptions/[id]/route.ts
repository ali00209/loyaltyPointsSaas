import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { requireAdminUser } from "@/lib/api-guard";
import { approveSubscription, updateSubscriptionStatus } from "@/lib/billing";
import { parseBody } from "@/lib/validations";

const ActionSchema = z.object({
  action: z.enum(["approve", "cancel"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const parsed = await parseBody(req, ActionSchema);
  if (parsed.error) return parsed.error;
  const { action } = parsed.data;

  try {
    if (action === "approve") {
      await db.transaction(async (tx) => approveSubscription(tx, id));
    } else {
      await db.transaction(async (tx) =>
        updateSubscriptionStatus(tx, id, "canceled"),
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update subscription" },
      { status: 400 },
    );
  }
}