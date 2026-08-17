import { NextResponse } from "next/server";
import { db } from "@/db";
import { events, products } from "@/db/schema";
import { requireCustomerSession } from "@/lib/api-guard";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function GET() {
  const guard = await requireCustomerSession();
  if ("error" in guard) return guard.error;
  const { customer } = guard;

  const [purchases, reviews, catalog] = await Promise.all([
    db
      .select()
      .from(events)
      .where(
        and(
          eq(events.customerId, customer.id),
          eq(events.tenantId, customer.tenantId),
          eq(events.eventType, "purchase"),
        ),
      )
      .orderBy(desc(events.occurredAt))
      .limit(50),
    db
      .select()
      .from(events)
      .where(
        and(
          eq(events.customerId, customer.id),
          eq(events.tenantId, customer.tenantId),
          eq(events.eventType, "review"),
        ),
      ),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.tenantId, customer.tenantId)),
  ]);

  const reviewsByProduct = new Map(reviews.map((r) => [String(r.payload.productId), r]));
  const productNames = new Map(catalog.map((p) => [p.id, p.name]));

  const result = purchases.map((purchase) => {
    const items = Array.isArray(purchase.payload.items)
      ? (purchase.payload.items as Record<string, unknown>[]).map((it) => {
          const productId = String(it.productId ?? "");
          return {
            productId,
            productName: productNames.get(productId) ?? productId,
            quantity: Number(it.quantity ?? 0),
            unitPrice: Number(it.unitPrice ?? 0),
            reviewed: reviewsByProduct.has(productId),
            review: reviewsByProduct.has(productId)
              ? {
                  rating: Number(reviewsByProduct.get(productId)!.payload.rating),
                  text: String(reviewsByProduct.get(productId)!.payload.text ?? ""),
                }
              : null,
          };
        })
      : [];

    return {
      eventId: purchase.id,
      orderNumber: purchase.payload.orderNumber ?? null,
      orderAmount: Number(purchase.payload.orderAmount ?? 0),
      items,
      occurredAt: purchase.occurredAt,
    };
  });

  return NextResponse.json({ purchases: result });
}
