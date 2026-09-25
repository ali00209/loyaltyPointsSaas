import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;

  const rows = await db
    .select()
    .from(plans)
    .where(eq(plans.active, true))
    .orderBy(plans.billingCycle);

  return NextResponse.json({ plans: rows });
}