import { db } from "@/db";
import { redemptionRewards } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { CreateRewardSchema, UpdateRewardSchema, parseBody } from "@/lib/validations";
import { and, desc, eq, SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { searchParams } = new URL(req.url);

  const condition: SQL[] = [];

  if (searchParams.size > 0) {
    if (searchParams.get("active") === "true") {
      condition.push(eq(redemptionRewards.active, true));
    }
  }

  const result = await db
    .select()
    .from(redemptionRewards)
    .where(and(eq(redemptionRewards.tenantId, tenantId), ...condition))
    .orderBy(desc(redemptionRewards.createdAt));

  return NextResponse.json({ rewards: result });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, CreateRewardSchema);
  if (parsed.error) return parsed.error;
  const { name, pointsCost, rewardType, inventoryLimit, description } = parsed.data;

  const [reward] = await db
    .insert(redemptionRewards)
    .values({
      tenantId,
      name,
      pointsCost,
      rewardType,
      inventoryLimit: inventoryLimit ?? null,
      details: description ? { description } : {},
    })
    .returning();

  return NextResponse.json({ reward }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const parsed = await parseBody(req, UpdateRewardSchema);
  if (parsed.error) return parsed.error;
  const { id, name, pointsCost, rewardType, inventoryLimit, description, active } = parsed.data;

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) setValues.name = name;
  if (rewardType !== undefined) setValues.rewardType = rewardType;
  if (pointsCost !== undefined) setValues.pointsCost = pointsCost;
  if (inventoryLimit !== undefined) setValues.inventoryLimit = inventoryLimit;
  if (description !== undefined) setValues.details = description ? { description } : {};
  if (active !== undefined) setValues.active = active;

  const [reward] = await db
    .update(redemptionRewards)
    .set(setValues)
    .where(
      and(
        eq(redemptionRewards.id, id),
        eq(redemptionRewards.tenantId, tenantId),
      ),
    )
    .returning();

  if (!reward)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ reward });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Reward ID required" }, { status: 400 });

  await db
    .delete(redemptionRewards)
    .where(
      and(
        eq(redemptionRewards.id, id),
        eq(redemptionRewards.tenantId, tenantId),
      ),
    );
  return NextResponse.json({ success: true });
}
