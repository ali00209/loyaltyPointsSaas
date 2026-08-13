import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { earningRules, products, tenantEarningRules } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { eq, and, desc, inArray } from "drizzle-orm";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const [assignments, productRows] = await Promise.all([
    db
      .select({
        assignmentId: tenantEarningRules.id,
        assignmentActive: tenantEarningRules.active,
        ruleId: tenantEarningRules.ruleId,
        createdAt: tenantEarningRules.createdAt,
      })
      .from(tenantEarningRules)
      .where(eq(tenantEarningRules.tenantId, tenantId))
      .orderBy(desc(tenantEarningRules.createdAt)),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.tenantId, tenantId)),
  ]);

  if (assignments.length === 0) {
    return NextResponse.json({ rules: [] });
  }

  const ruleRows = await db
    .select()
    .from(earningRules)
    .where(inArray(earningRules.id, assignments.map((a) => a.ruleId)));

  const productNames = new Map(productRows.map((p) => [p.id, p.name]));

  const rules = assignments.flatMap((a) => {
    const rule = ruleRows.find((r) => r.id === a.ruleId);
    if (!rule) return [];
    return [
      {
        ...rule,
        assignmentId: a.assignmentId,
        assignmentActive: a.assignmentActive,
        assignedAt: a.createdAt,
        productName: rule.conditions?.productId
          ? productNames.get(rule.conditions.productId) ?? null
          : null,
      },
    ];
  });

  return NextResponse.json({ rules });
}

export async function PUT(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const body = await req.json();
  const { id, active } = body;

  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ error: "Rule id and active are required" }, { status: 400 });
  }

  const [assignment] = await db
    .update(tenantEarningRules)
    .set({ active })
    .where(and(eq(tenantEarningRules.id, id), eq(tenantEarningRules.tenantId, tenantId)))
    .returning();

  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  return NextResponse.json({ assignment });
}
