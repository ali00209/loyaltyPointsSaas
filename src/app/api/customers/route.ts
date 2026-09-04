import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { normalizePakistaniMobile } from "@/lib/auth";
import { CreateCustomerSchema, UpdateCustomerSchema, parseBody } from "@/lib/validations";
import { eq, and, desc, ne } from "drizzle-orm";

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

  const parsed = await parseBody(req, CreateCustomerSchema);
  if (parsed.error) return parsed.error;
  const { name, email, phone } = parsed.data;
  const normalizedPhone = phone ? normalizePakistaniMobile(phone) ?? phone : null;
  if (normalizedPhone) {
    const [existingPhone] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, normalizedPhone)))
      .limit(1);
    if (existingPhone) {
      return NextResponse.json({ error: "Phone number already exists in this program" }, { status: 409 });
    }
  }

  const [customer] = await db
    .insert(customers)
    .values({
      tenantId,
      name,
      email: email || null,
      phone: normalizedPhone ?? "",
    })
    .returning();

  return NextResponse.json({ customer }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, UpdateCustomerSchema);
  if (parsed.error) return parsed.error;
  const { id, name, email, phone } = parsed.data;

  const setValues: Record<string, unknown> = {};
  if (name !== undefined) setValues.name = name;
  if (email !== undefined) setValues.email = email || null;
  if (phone !== undefined) {
    setValues.phone = phone ? normalizePakistaniMobile(phone) ?? phone : null;
  }
  if (typeof setValues.phone === "string") {
    const [existingPhone] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.phone, setValues.phone),
          ne(customers.id, id),
        ),
      )
      .limit(1);
    if (existingPhone) {
      return NextResponse.json({ error: "Phone number already exists in this program" }, { status: 409 });
    }
  }

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
