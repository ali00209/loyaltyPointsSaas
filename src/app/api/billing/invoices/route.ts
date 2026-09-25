import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { serializeInvoice } from "@/lib/billing";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const [rows, paymentRows] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(eq(invoices.tenantId, tenantId))
      .orderBy(desc(invoices.createdAt)),
    db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(payments.paidAt),
  ]);

  const paymentByInvoice = new Map<string, (typeof paymentRows)[number][]>();
  for (const p of paymentRows) {
    const list = paymentByInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    paymentByInvoice.set(p.invoiceId, list);
  }

  return NextResponse.json({
    invoices: rows.map((row) =>
      serializeInvoice(row, paymentByInvoice.get(row.id) ?? []),
    ),
  });
}