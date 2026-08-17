import { NextResponse } from "next/server";
import { requireCustomerSession } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireCustomerSession();
  if ("error" in guard) return guard.error;
  const { customer } = guard;

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      referralCode: customer.referralCode,
      currentBalance: customer.currentBalance,
      tenant: {
        id: customer.tenant.id,
        name: customer.tenant.name,
        slug: customer.tenant.slug,
        brandingConfig: customer.tenant.brandingConfig,
      },
    },
  });
}
