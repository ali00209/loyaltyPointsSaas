import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { generateDueInvoices } from "@/lib/billing";

// POST /api/cron/billing
// Issues invoices for active subscriptions past their billing boundary. Call
// from an external scheduler. Optionally guarded by CRON_SECRET when set.
export async function POST() {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const requestHeaders = await headers();
    if (requestHeaders.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const generated = await generateDueInvoices();
    return NextResponse.json({ generatedInvoices: generated });
  } catch (error) {
    console.error("Billing sweep error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}