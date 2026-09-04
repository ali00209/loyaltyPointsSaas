import { NextRequest, NextResponse } from "next/server";
import { requireOwnerTenant } from "@/lib/api-guard";
import { refundCheckout } from "@/lib/redemption";
import { OwnerRefundSchema, parseBody } from "@/lib/validations";
import { PointsError } from "@/lib/points";

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const parsed = await parseBody(req, OwnerRefundSchema);
  if (parsed.error) return parsed.error;
  try {
    const { reason, ...identifier } = parsed.data;
    return NextResponse.json(
      await refundCheckout(guard.tenantId, identifier, reason),
    );
  } catch (error) {
    if (error instanceof PointsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Owner redemption refund error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
