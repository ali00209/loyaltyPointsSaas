import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const result = await db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId))
    .orderBy(desc(products.createdAt));

  return NextResponse.json({ products: result });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { name, sku, price, category } = body;

  if (!name || !sku || !price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [product] = await db
    .insert(products)
    .values({
      tenantId,
      name,
      sku,
      price: String(price),
      category: category || "General",
    })
    .returning();

  return NextResponse.json({ product }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { id, name, sku, price, category, active } = body;

  if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  const [product] = await db
    .update(products)
    .set({
      ...(name !== undefined && { name }),
      ...(sku !== undefined && { sku }),
      ...(price !== undefined && { price: String(price) }),
      ...(category !== undefined && { category }),
      ...(active !== undefined && { active }),
    })
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
    .returning();

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

  await db.delete(products).where(and(eq(products.id, id), eq(products.tenantId, tenantId)));
  return NextResponse.json({ success: true });
}
