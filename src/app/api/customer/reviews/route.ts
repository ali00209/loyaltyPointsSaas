import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { events } from "@/db/schema";
import { requireCustomerAccess } from "@/lib/api-guard";
import { applyEvent, PointsError } from "@/lib/points";
import { validateEventPayload } from "@/lib/rules";
import { ReviewSchema, parseBody } from "@/lib/validations";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const guard = await requireCustomerAccess(new URL(req.url).searchParams);
  if ("error" in guard) return guard.error;
  const { customer } = guard;

  const parsed = await parseBody(req, ReviewSchema);
  if (parsed.error) return parsed.error;
  const { purchaseId, productId, rating, text } = parsed.data;

  const payload = { purchaseId, productId, rating, text: text ?? "" };
  try {
    validateEventPayload("review", payload);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const [purchase] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, purchaseId),
        eq(events.customerId, customer.id),
        eq(events.tenantId, customer.tenantId),
        eq(events.eventType, "purchase"),
      ),
    )
    .limit(1);

  if (!purchase) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  const items = Array.isArray(purchase.payload.items) ? (purchase.payload.items as Record<string, unknown>[]) : [];
  if (!items.some((it) => String(it.productId) === String(productId))) {
    return NextResponse.json({ error: "You can only review items you purchased" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.customerId, customer.id),
        eq(events.tenantId, customer.tenantId),
        eq(events.eventType, "review"),
        eq(events.eventKey, `review:${customer.id}:${productId}`),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(events)
      .set({ payload })
      .where(eq(events.id, existing.id))
      .returning({ id: events.id });
    return NextResponse.json({ updated: true, pointsAwarded: 0, eventId: updated.id });
  }

  try {
    const result = await applyEvent({
      tenantId: customer.tenantId,
      customerId: customer.id,
      eventType: "review",
      payload,
    });
    return NextResponse.json({ updated: false, pointsAwarded: result.totalAwarded, eventId: result.eventId }, { status: 201 });
  } catch (err) {
    if (err instanceof PointsError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Review error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
