import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, tenantId))
    .orderBy(desc(customers.createdAt));

  return NextResponse.json({ customers: result });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { name, email, phone } = body;

  if (!name) {
    return NextResponse.json({ error: "Customer name required" }, { status: 400 });
  }

  const [customer] = await db
    .insert(customers)
    .values({
      tenantId,
      name,
      email: email || null,
      phone: phone || null,
    })
    .returning();

  return NextResponse.json({ customer }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { id, name, email, phone } = body;

  if (!id) return NextResponse.json({ error: "Customer ID required" }, { status: 400 });

  const setValues: Record<string, unknown> = {};
  if (name !== undefined) setValues.name = name;
  if (email !== undefined) setValues.email = email || null;
  if (phone !== undefined) setValues.phone = phone || null;

  const [customer] = await db
    .update(customers)
    .set(setValues)
    .where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)))
    .returning();

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Customer ID required" }, { status: 400 });

  await db.delete(customers).where(and(eq(customers.id, id), eq(customers.tenantId, tenantId)));
  return NextResponse.json({ success: true });
}
