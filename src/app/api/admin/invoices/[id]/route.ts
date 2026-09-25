import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { invoiceTotals, serializeInvoice } from "@/lib/billing";
import { UpdateInvoiceDraftSchema, parseBody } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const [row] = await db
    .select({ invoice: invoices, tenant: tenants })
    .from(invoices)
    .innerJoin(tenants, eq(tenants.id, invoices.tenantId))
    .where(eq(invoices.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(payments.paidAt);

  return NextResponse.json({
    invoice: {
      ...serializeInvoice(row.invoice, paymentRows),
      tenantName: row.tenant.name,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const parsed = await parseBody(req, UpdateInvoiceDraftSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const [existing] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited" },
      { status: 400 },
    );
  }

  const lineItems = body.lineItems.map((item) => ({
    description: item.description,
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice.toFixed(2),
  }));
  const totals = invoiceTotals(lineItems, body.taxPercent ?? 0);

  const [invoice] = await db
    .update(invoices)
    .set({
      lineItems,
      ...totals,
      taxPercent: (body.taxPercent ?? 0).toFixed(2),
      memo: body.memo ?? null,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id))
    .returning();

  return NextResponse.json({ invoice: serializeInvoice(invoice, []) });
}