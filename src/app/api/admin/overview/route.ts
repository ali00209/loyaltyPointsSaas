import { NextResponse } from "next/server";
import { db } from "@/db";
import { customers, earningRules, pointTransactions, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { sql } from "drizzle-orm";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const [tenantStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${tenants.suspended} = false)::int`,
    })
    .from(tenants);

  const [ruleStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(earningRules);

  const [customerStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalPoints: sql<number>`coalesce(sum(${customers.currentBalance}), 0)::int`,
    })
    .from(customers);

  const [txStats] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(pointTransactions);

  return NextResponse.json({
    overview: {
      totalTenants: tenantStats.total,
      activeTenants: tenantStats.active,
      totalRules: ruleStats.count,
      totalCustomers: customerStats.count,
      totalTransactions: txStats.count,
      pointsInCirculation: customerStats.totalPoints,
    },
  });
}
