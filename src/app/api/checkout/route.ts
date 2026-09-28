import { NextRequest, NextResponse } from "next/server";
import { requireCheckoutTenant } from "@/lib/api-guard";
import { reserveCheckout } from "@/lib/redemption";
import { getAppSettings } from "@/lib/settings";
import { CheckoutSchema, parseBody } from "@/lib/validations";
import { PointsError } from "@/lib/points";

export async function POST(req: NextRequest) {
  const guard = await requireCheckoutTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, CheckoutSchema);
  if (parsed.error) return parsed.error;
  try {
    // The owner-initiated confirm/preview endpoints are unaffected: they are an
    // explicit action, not auto-apply. Only this POS-facing entry point is gated.
    const { autoApplyRedemptions } = await getAppSettings(guard.tenantId);
    if (!autoApplyRedemptions) {
      return NextResponse.json(
        {
          error:
            "Automatic redemption is disabled for this program. Handle point discounts outside the loyalty API.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(await reserveCheckout({
      tenantId: guard.tenantId,
      ...parsed.data,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof PointsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Checkout reservation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
