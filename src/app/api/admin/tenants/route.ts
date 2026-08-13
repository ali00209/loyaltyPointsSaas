import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, redemptionRewards, tenants, users } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { createToken, hashPassword } from "@/lib/auth";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const customerCounts = db
    .select({
      tenantId: customers.tenantId,
      count: sql<number>`count(*)::int`.as("customer_count"),
    })
    .from(customers)
    .groupBy(customers.tenantId)
    .as("customer_counts");

  const rewardCounts = db
    .select({
      tenantId: redemptionRewards.tenantId,
      count: sql<number>`count(*)::int`.as("reward_count"),
    })
    .from(redemptionRewards)
    .groupBy(redemptionRewards.tenantId)
    .as("reward_counts");

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      brandingConfig: tenants.brandingConfig,
      suspended: tenants.suspended,
      createdAt: tenants.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
      customerCount: sql<number>`coalesce(${customerCounts.count}, 0)::int`,
      rewardCount: sql<number>`coalesce(${rewardCounts.count}, 0)::int`,
    })
    .from(tenants)
    .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, "owner")))
    .leftJoin(customerCounts, eq(customerCounts.tenantId, tenants.id))
    .leftJoin(rewardCounts, eq(rewardCounts.tenantId, tenants.id))
    .orderBy(desc(tenants.createdAt));

  return NextResponse.json({ tenants: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const body = await req.json();
  const { name, ownerName, ownerEmail, ownerPassword, brandingConfig } = body;

  if (!name || !ownerName || !ownerEmail || !ownerPassword) {
    return NextResponse.json({ error: "Tenant name and owner details are required" }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Owner email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(ownerPassword);

  const tenant = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(tenants)
      .values({ name, brandingConfig: brandingConfig || {} })
      .returning();
    const [owner] = await tx
      .insert(users)
      .values({
        email: ownerEmail,
        name: ownerName,
        passwordHash,
        role: "owner",
        tenantId: row.id,
      })
      .returning();
    return { ...row, owner };
  });

  return NextResponse.json(
    {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        brandingConfig: tenant.brandingConfig,
        suspended: tenant.suspended,
        createdAt: tenant.createdAt,
        ownerName: tenant.owner.name,
        ownerEmail: tenant.owner.email,
      },
    },
    { status: 201 },
  );
}
