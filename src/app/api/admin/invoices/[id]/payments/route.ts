import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sum } from "drizzle-orm";
import { db } from "@/db";
import { invoices, payments } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { RecordPaymentSchema, parseBody } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.paidAt));

  return NextResponse.json({ payments: rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;
  const parsed = await parseBody(req, RecordPaymentSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "issued") {
    return NextResponse.json(
      { error: "Payments can only be recorded against issued invoices" },
      { status: 400 },
    );
  }

  const alreadyPaid = await db
    .select({ total: sum(payments.amount) })
    .from(payments)
    .where(eq(payments.invoiceId, id));
  const paid = Number(alreadyPaid[0]?.total ?? 0);
  if (paid + body.amount > Number(invoice.total) + 0.001) {
    return NextResponse.json(
      { error: `Payment exceeds balance of ${invoice.total}` },
      { status: 400 },
    );
  }

  const [payment] = await db
    .insert(payments)
    .values({
      tenantId: invoice.tenantId,
      invoiceId: id,
      amount: body.amount.toFixed(2),
      method: body.method,
      reference: body.reference ?? null,
      note: body.note ?? null,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    })
    .returning();

  return NextResponse.json({ payment }, { status: 201 });
}