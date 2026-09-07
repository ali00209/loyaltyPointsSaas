import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireCheckoutTenant } from "@/lib/api-guard";
import { BulkProductsSchema, parseBody } from "@/lib/validations";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const guard = await requireCheckoutTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, BulkProductsSchema);
  if (parsed.error) return parsed.error;
  const items = parsed.data.products;

  const skus = items.map((p) => p.sku.trim());
  const existing = await db
    .select({ sku: products.sku })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), inArray(products.sku, skus)));

  const existingSkus = new Set(existing.map((p) => p.sku));
  const newItems = items
    .filter((p) => !existingSkus.has(p.sku.trim()))
    .map((p) => ({
      tenantId,
      name: p.name.trim(),
      sku: p.sku.trim(),
      price: String(p.price),
      category: p.category?.trim() || "General",
    }));

  const inserted = newItems.length ? await db.insert(products).values(newItems).returning() : [];

  return NextResponse.json(
    {
      created: inserted.length,
      skipped: items.length - inserted.length,
      products: inserted,
    },
    { status: 201 },
  );
}