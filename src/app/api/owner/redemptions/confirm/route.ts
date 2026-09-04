import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireOwnerTenant } from "@/lib/api-guard";
import { confirmCheckout } from "@/lib/redemption";
import { OwnerCheckoutSchema, parseBody } from "@/lib/validations";
import { PointsError } from "@/lib/points";

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, OwnerCheckoutSchema);
  if (parsed.error) return parsed.error;
  try {
    const checkoutId = parsed.data.checkoutId ?? `owner-${randomUUID()}`;
    return NextResponse.json(
      await confirmCheckout({
        tenantId: guard.tenantId,
        ...parsed.data,
        checkoutId,
      }),
    );
  } catch (error) {
    if (error instanceof PointsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Owner redemption confirmation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
