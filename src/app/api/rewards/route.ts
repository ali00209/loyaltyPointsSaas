import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { redemptionRewards } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { eq, and, desc } from "drizzle-orm";

const REWARD_TYPES = ["discount", "gift_card", "physical_item", "store_credit"];

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const result = await db
    .select()
    .from(redemptionRewards)
    .where(eq(redemptionRewards.tenantId, tenantId))
    .orderBy(desc(redemptionRewards.createdAt));

  return NextResponse.json({ rewards: result });
}

export async function POST(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { name, pointsCost, rewardType, inventoryLimit, description } = body;

  if (!name) {
    return NextResponse.json({ error: "Reward name required" }, { status: 400 });
  }
  const cost = Number(pointsCost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return NextResponse.json({ error: "Points cost must be greater than 0" }, { status: 400 });
  }
  if (!REWARD_TYPES.includes(rewardType)) {
    return NextResponse.json({ error: "Invalid reward type" }, { status: 400 });
  }

  const [reward] = await db
    .insert(redemptionRewards)
    .values({
      tenantId,
      name,
      pointsCost: cost,
      rewardType,
      inventoryLimit:
        inventoryLimit == null || inventoryLimit === "" ? null : Math.floor(Number(inventoryLimit)),
      details: description ? { description } : {},
    })
    .returning();

  return NextResponse.json({ reward }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { id, name, pointsCost, rewardType, inventoryLimit, description, active } = body;

  if (!id) return NextResponse.json({ error: "Reward ID required" }, { status: 400 });

  const setValues: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) setValues.name = name;
  if (rewardType !== undefined) {
    if (!REWARD_TYPES.includes(rewardType)) {
      return NextResponse.json({ error: "Invalid reward type" }, { status: 400 });
    }
    setValues.rewardType = rewardType;
  }
  if (pointsCost !== undefined) {
    const cost = Number(pointsCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      return NextResponse.json({ error: "Points cost must be greater than 0" }, { status: 400 });
    }
    setValues.pointsCost = cost;
  }
  if (inventoryLimit !== undefined) {
    setValues.inventoryLimit =
      inventoryLimit == null || inventoryLimit === "" ? null : Math.floor(Number(inventoryLimit));
  }
  if (description !== undefined) {
    setValues.details = description ? { description } : {};
  }
  if (active !== undefined) setValues.active = active;

  const [reward] = await db
    .update(redemptionRewards)
    .set(setValues)
    .where(and(eq(redemptionRewards.id, id), eq(redemptionRewards.tenantId, tenantId)))
    .returning();

  if (!reward) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ reward });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Reward ID required" }, { status: 400 });

  await db
    .delete(redemptionRewards)
    .where(and(eq(redemptionRewards.id, id), eq(redemptionRewards.tenantId, tenantId)));
  return NextResponse.json({ success: true });
}
