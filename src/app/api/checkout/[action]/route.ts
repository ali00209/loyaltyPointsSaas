import { NextRequest, NextResponse } from "next/server";
import { requireCheckoutTenant } from "@/lib/api-guard";
import {
  finalizeCheckout,
  refundCheckout,
  releaseCheckout,
} from "@/lib/redemption";
import { CheckoutTransitionSchema, parseBody } from "@/lib/validations";
import { PointsError } from "@/lib/points";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const guard = await requireCheckoutTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, CheckoutTransitionSchema);
  if (parsed.error) return parsed.error;
  const { action } = await context.params;
  const transition = {
    finalize: finalizeCheckout,
    finalise: finalizeCheckout,
    release: releaseCheckout,
    cancel: releaseCheckout,
    refund: refundCheckout,
  }[action];
  if (!transition) return NextResponse.json({ error: "Unknown checkout action" }, { status: 404 });
  try {
    return NextResponse.json(
      action === "refund"
        ? await refundCheckout(guard.tenantId, parsed.data, parsed.data.reason)
        : await transition(guard.tenantId, parsed.data),
    );
  } catch (error) {
    if (error instanceof PointsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Checkout transition error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
