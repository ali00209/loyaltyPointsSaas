import { NextRequest, NextResponse } from "next/server";
import { requireCheckoutTenant } from "@/lib/api-guard";
import { previewCheckout } from "@/lib/redemption";
import { OwnerCheckoutSchema, parseBody } from "@/lib/validations";
import { PointsError } from "@/lib/points";

export async function POST(req: NextRequest) {
  const guard = await requireCheckoutTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, OwnerCheckoutSchema);
  if (parsed.error) return parsed.error;
  try {
    return NextResponse.json(await previewCheckout({
      tenantId: guard.tenantId,
      ...parsed.data,
    }));
  } catch (error) {
    if (error instanceof PointsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Checkout preview error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
