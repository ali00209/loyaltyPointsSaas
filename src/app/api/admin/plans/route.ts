import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { requireAdminUser } from "@/lib/api-guard";
import { CreatePlanSchema, parseBody } from "@/lib/validations";

export async function GET() {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const rows = await db
    .select()
    .from(plans)
    .orderBy(desc(plans.createdAt));

  return NextResponse.json({ plans: rows });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminUser();
  if ("error" in guard) return guard.error;

  const parsed = await parseBody(req, CreatePlanSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;

  const [plan] = await db
    .insert(plans)
    .values({
      name: body.name,
      price: body.price.toFixed(2),
      billingCycle: body.billingCycle,
      taxPercent: body.taxPercent.toFixed(2),
      active: body.active ?? true,
    })
    .returning();

  return NextResponse.json({ plan }, { status: 201 });
}