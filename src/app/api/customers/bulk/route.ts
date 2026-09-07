import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireCheckoutTenant } from "@/lib/api-guard";
import { normalizePakistaniMobile } from "@/lib/auth";
import { BulkCustomersSchema, parseBody } from "@/lib/validations";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const guard = await requireCheckoutTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, BulkCustomersSchema);
  if (parsed.error) return parsed.error;
  const items = parsed.data.customers;

  const existing = await db
    .select({ id: customers.id, email: customers.email, phone: customers.phone })
    .from(customers)
    .where(eq(customers.tenantId, tenantId));

  const existingEmails = new Set(
    existing.map((c) => c.email?.trim().toLowerCase()).filter(Boolean),
  );
  const existingPhones = new Set(
    existing.map((c) => c.phone?.trim()).filter(Boolean),
  );

  const newItems = [];
  const skipped = [];

  for (const c of items) {
    const email = c.email?.trim().toLowerCase() || null;
    const rawPhone = c.phone?.trim() || null;
    const phone = rawPhone ? normalizePakistaniMobile(rawPhone) ?? rawPhone : null;
    const key = phone || email;

    if (key && (existingPhones.has(key) || existingEmails.has(key))) {
      skipped.push({ name: c.name, email, phone });
      continue;
    }

    if (phone) existingPhones.add(phone);
    if (email) existingEmails.add(email);

    newItems.push({
      tenantId,
      name: c.name.trim(),
      email,
      phone: phone ?? "",
    });
  }

  const inserted = newItems.length
    ? await db.insert(customers).values(newItems).returning()
    : [];

  return NextResponse.json(
    {
      created: inserted.length,
      skipped: skipped.length,
      customers: inserted,
      skippedItems: skipped,
    },
    { status: 201 },
  );
}