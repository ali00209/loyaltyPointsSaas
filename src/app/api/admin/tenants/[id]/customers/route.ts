import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers, tenants } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.tenantId, id))
    .orderBy(desc(customers.createdAt));

  return NextResponse.json({ customers: rows });
}
