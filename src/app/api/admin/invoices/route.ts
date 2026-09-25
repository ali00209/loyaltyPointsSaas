import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { invoiceTotals, serializeInvoice } from "@/lib/billing";
import { CreateInvoiceSchema, parseBody } from "@/lib/validations";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const [rows, paymentRows] = await Promise.all([
    db
      .select({ invoice: invoices, tenant: tenants })
      .from(invoices)
      .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
      .orderBy(desc(invoices.createdAt)),
    db
      .select()
      .from(payments)
      .orderBy(payments.paidAt),
  ]);

  const paymentByInvoice = new Map<string, (typeof paymentRows)[number][]>();
  for (const p of paymentRows) {
    const list = paymentByInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    paymentByInvoice.set(p.invoiceId, list);
  }

  return NextResponse.json({
    invoices: rows.map(({ invoice, tenant }) => ({
      ...serializeInvoice(invoice, paymentByInvoice.get(invoice.id) ?? []),
      tenantName: tenant.name,
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const parsed = await parseBody(req, CreateInvoiceSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const lineItems = body.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice.toFixed(2),
  }));
  const totals = invoiceTotals(lineItems, body.taxPercent ?? 0);

  const [invoice] = await db
    .insert(invoices)
    .values({
      tenantId: body.tenantId,
      status: "draft",
      lineItems,
      ...totals,
      taxPercent: (body.taxPercent ?? 0).toFixed(2),
      memo: body.memo ?? null,
    })
    .returning();

  return NextResponse.json({
    invoice: serializeInvoice(invoice, []),
  }, { status: 201 });
}