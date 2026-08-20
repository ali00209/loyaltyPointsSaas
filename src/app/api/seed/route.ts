import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  customers,
  earningRules,
  products,
  redemptionRewards,
  tenants,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { applyAdjust, applyEvent, applyRedeem } from "@/lib/points";
import { resetDemoData } from "@/lib/points";
import type { EventType, FormulaGroup, RuleGroupType, StructuredFormula } from "@/lib/rules";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "admin@loyaltyapp.com";
const DEMO_EMAIL = "demo@loyaltyapp.com";
const PORTAL_EMAIL = "sarah.m@email.com";
const PORTAL_PASSWORD = "customer123";

function code(): string {
  return Math.random().toString(36).slice(2, 10);
}

const ALL: RuleGroupType = { combinator: "and", rules: [] };
function rg(rules: RuleGroupType["rules"]): RuleGroupType {
  return { combinator: "and", rules };
}

function rate(basis: string, ratePct: number, opts?: Partial<StructuredFormula>): FormulaGroup {
  return {
    conditions: ALL,
    formula: { type: "rate", basis, rate: ratePct, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null, ...opts },
  };
}

function flat(amount: number, conditions: RuleGroupType = ALL): FormulaGroup {
  return {
    conditions,
    formula: { type: "flat", basis: "", rate: 0, flatAmount: amount, rounding: "floor", minPoints: null, maxPoints: null },
  };
}

export async function POST() {
  try {
    await resetDemoData();

    // --- Platform admin ---
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      name: "Platform Admin",
      passwordHash: await hashPassword("admin123"),
      role: "admin",
      tenantId: null,
    });

    // --- Demo tenant + owner ---
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: "Urban Coffee Co.",
        slug: "urban-coffee-co",
        brandingConfig: { brandColor: "#8c5a2b", logoUrl: null },
      })
      .returning();

    await db.insert(users).values({
      email: DEMO_EMAIL,
      name: "Alex Johnson",
      passwordHash: await hashPassword("demo123"),
      role: "owner",
      tenantId: tenant.id,
    });

    // --- Products ---
    const insertedProducts = await db
      .insert(products)
      .values(
        [
          { name: "Espresso", sku: "COF-001", price: "3.50", category: "Beverages" },
          { name: "Cappuccino", sku: "COF-002", price: "4.50", category: "Beverages" },
          { name: "Latte", sku: "COF-003", price: "5.00", category: "Beverages" },
          { name: "Croissant", sku: "BAK-001", price: "3.00", category: "Bakery" },
          { name: "Blueberry Muffin", sku: "BAK-002", price: "3.50", category: "Bakery" },
          { name: "Avocado Toast", sku: "FOD-001", price: "8.50", category: "Food" },
          { name: "Breakfast Burrito", sku: "FOD-002", price: "9.00", category: "Food" },
          { name: "Seasonal Blend Bag (250g)", sku: "RTL-001", price: "14.99", category: "Retail" },
          { name: "Ceramic Mug", sku: "RTL-002", price: "12.00", category: "Retail" },
          { name: "Cold Brew (Large)", sku: "COF-004", price: "5.50", category: "Beverages" },
        ].map((p) => ({ ...p, tenantId: tenant.id })),
      )
      .returning();

    // --- Rules ---
    type RuleInput = {
      name: string;
      description: string;
      eventType: EventType;
      perItem: boolean;
      formulaGroups: FormulaGroup[];
      pointsExpireAfterDays: number | null;
    };

    const ruleInputs: RuleInput[] = [
      {
        name: "Standard Spend Rewards",
        description: "Earn 1 point per $1 spent on any purchase",
        eventType: "purchase",
        perItem: false,
        formulaGroups: [rate("orderAmount", 100)],
        pointsExpireAfterDays: null,
      },
      {
        name: "Beverage Bonus",
        description: "Earn 2 points per beverage line item",
        eventType: "purchase",
        perItem: true,
        formulaGroups: [
          {
            conditions: rg([{ field: "productCategory", operator: "=", value: "Beverages" }]),
            formula: { type: "rate", basis: "quantity", rate: 200, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
          },
        ],
        pointsExpireAfterDays: null,
      },
      {
        name: "Bakery Loyalty",
        description: "Earn 2 points per bakery item",
        eventType: "purchase",
        perItem: true,
        formulaGroups: [
          {
            conditions: rg([{ field: "productCategory", operator: "=", value: "Bakery" }]),
            formula: { type: "rate", basis: "quantity", rate: 200, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
          },
        ],
        pointsExpireAfterDays: null,
      },
      {
        name: "Big Spender Bonus",
        description: "Orders $20-$50 earn 2 points per dollar",
        eventType: "purchase",
        perItem: false,
        formulaGroups: [
          {
            conditions: rg([
              { field: "orderAmount", operator: ">=", value: 20 },
              { field: "orderAmount", operator: "<=", value: 50 },
            ]),
            formula: { type: "rate", basis: "orderAmount", rate: 200, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
          },
        ],
        pointsExpireAfterDays: null,
      },
      {
        name: "Bulk Bean Reward",
        description: "Buy 3+ units and earn 5 points per unit",
        eventType: "purchase",
        perItem: false,
        formulaGroups: [
          {
            conditions: rg([{ field: "itemQuantity", operator: ">=", value: 3 }]),
            formula: { type: "rate", basis: "itemQuantity", rate: 500, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
          },
        ],
        pointsExpireAfterDays: 30,
      },
      {
        name: "High-Value Purchase Reward",
        description: "Earn 3 points per dollar on orders $50+",
        eventType: "purchase",
        perItem: false,
        formulaGroups: [
          {
            conditions: rg([{ field: "orderAmount", operator: ">=", value: 50 }]),
            formula: { type: "rate", basis: "orderAmount", rate: 300, flatAmount: 0, rounding: "floor", minPoints: null, maxPoints: null },
          },
        ],
        pointsExpireAfterDays: 180,
      },
      {
        name: "Signup Welcome Bonus",
        description: "New customers earn 50 points",
        eventType: "customer_signup",
        perItem: false,
        formulaGroups: [flat(50)],
        pointsExpireAfterDays: 30,
      },
      {
        name: "Review Bonus",
        description: "Leave a 4-5 star review and earn 25 points",
        eventType: "review",
        perItem: false,
        formulaGroups: [
          flat(25, rg([{ field: "rating", operator: ">=", value: 4 }])),
        ],
        pointsExpireAfterDays: null,
      },
      {
        name: "Newsletter Bonus",
        description: "Join the newsletter and earn 20 points",
        eventType: "newsletter_signup",
        perItem: false,
        formulaGroups: [flat(20)],
        pointsExpireAfterDays: null,
      },
      {
        name: "Referral Bonus",
        description: "Refer a friend and earn 100 points",
        eventType: "referral",
        perItem: false,
        formulaGroups: [flat(100)],
        pointsExpireAfterDays: 90,
      },
      {
        name: "Social Share Bonus",
        description: "Share on social and earn 10 points",
        eventType: "social_share",
        perItem: false,
        formulaGroups: [flat(10)],
        pointsExpireAfterDays: null,
      },
    ];

    const rules = [];
    for (const r of ruleInputs) {
      const [row] = await db
        .insert(earningRules)
        .values({ ...r, tenantId: tenant.id, active: true })
        .returning();
      rules.push(row);
    }

    // --- Customers ---
    const customerData = [
      { name: "Sarah Mitchell", email: PORTAL_EMAIL, phone: "+1-555-0101" },
      { name: "James Chen", email: "james.chen@email.com", phone: "+1-555-0102" },
      { name: "Maria Rodriguez", email: "maria.r@email.com", phone: "+1-555-0103" },
      { name: "David Kim", email: "david.k@email.com", phone: "+1-555-0104" },
      { name: "Emily Watson", email: "emily.w@email.com", phone: "+1-555-0105" },
      { name: "Robert Taylor", email: "robert.t@email.com", phone: "+1-555-0106" },
      { name: "Lisa Park", email: "lisa.p@email.com", phone: "+1-555-0107" },
    ];

    const insertedCustomers = [];
    for (let i = 0; i < customerData.length; i++) {
      const c = customerData[i];
      const [row] = await db
        .insert(customers)
        .values({
          tenantId: tenant.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          referralCode: code(),
          passwordHash:
            c.email === PORTAL_EMAIL ? await hashPassword(PORTAL_PASSWORD) : null,
          joinDate: new Date(Date.now() - (7 - i) * 86400000),
        })
        .returning();
      insertedCustomers.push(row);
    }

    // --- Rewards ---
    const rewards = await db
      .insert(redemptionRewards)
      .values(
        [
          { name: "Free Beverage", pointsCost: 500, inventoryLimit: 1000, details: { discountType: "fixed", amount: 5 } },
          { name: "10% Off Discount", pointsCost: 300, inventoryLimit: null, details: { discountType: "percent", percent: 10, description: "10% off your next purchase" } },
          { name: "$10 Store Credit", pointsCost: 1000, inventoryLimit: null, details: { discountType: "fixed", amount: 10, description: "$10 off your next purchase" } },
          { name: "$25 Gift Card", pointsCost: 2500, inventoryLimit: null, details: { discountType: "fixed", amount: 25, description: "$25 off your next purchase" } },
          { name: "Merchandise Item", pointsCost: 1000, inventoryLimit: 200, details: { discountType: "fixed", amount: 15, description: "Any merchandise item up to $15" } },
        ].map((r) => ({ tenantId: tenant.id, active: true, redeemedCount: 0, ...r })),
      )
      .returning();

    const [espresso, cappuccino, latte, croissant, muffin, avocado, burrito, beans, mug, coldBrew] =
      insertedProducts;

    const item = (product: (typeof insertedProducts)[number], quantity = 1, unitPrice?: string) => ({
      productId: product.id,
      quantity,
      unitPrice: unitPrice ?? product.price,
    });

    // --- Events ---
    const event = (customerId: string, eventType: Parameters<typeof applyEvent>[0]["eventType"], payload: Record<string, unknown>, eventKey?: string) =>
      applyEvent({ tenantId: tenant.id, customerId, eventType, payload, eventKey });

    // Sarah: signup, first purchase, reviews, newsletter
    await event(insertedCustomers[0].id, "customer_signup", {});
    await event(
      insertedCustomers[0].id,
      "purchase",
      {
        orderAmount: 8.0,
        orderNumber: "URB-1001",
        items: [item(latte), item(croissant)],
      },
      "purchase:URB-1001",
    );
    await event(
      insertedCustomers[0].id,
      "review",
      { purchaseId: "seed", productId: latte.id, rating: 5, text: "Best latte in town" },
      `review:${insertedCustomers[0].id}:${latte.id}`,
    );
    await event(
      insertedCustomers[0].id,
      "review",
      { purchaseId: "seed", productId: croissant.id, rating: 4, text: "Buttery and fresh" },
      `review:${insertedCustomers[0].id}:${croissant.id}`,
    );
    await event(insertedCustomers[0].id, "newsletter_signup", {});

    // Sarah refers Maria
    await event(
      insertedCustomers[0].id,
      "referral",
      { referredCustomerId: insertedCustomers[2].id },
      `referral:${insertedCustomers[0].id}:${insertedCustomers[2].id}`,
    );

    // James: bulk beans purchase
    await event(
      insertedCustomers[1].id,
      "purchase",
      {
        orderAmount: 34.98,
        orderNumber: "URB-1002",
        items: [item(beans, 2, "14.99"), item(latte)],
      },
      "purchase:URB-1002",
    );

    // Maria: second purchase
    await event(
      insertedCustomers[2].id,
      "purchase",
      {
        orderAmount: 8.5,
        orderNumber: "URB-1003",
        items: [item(latte), item(muffin)],
      },
      "purchase:URB-1003",
    );

    // David: high-value catering order
    await event(
      insertedCustomers[3].id,
      "purchase",
      {
        orderAmount: 65.0,
        orderNumber: "URB-1004",
        items: [item(avocado, 3, "8.5"), item(burrito, 4, "9.0")],
      },
      "purchase:URB-1004",
    );

    // Emily: newsletter + social share
    await event(insertedCustomers[4].id, "newsletter_signup", {});
    await event(insertedCustomers[4].id, "social_share", { platform: "instagram" });

    // Robert: small purchase
    await event(
      insertedCustomers[5].id,
      "purchase",
      {
        orderAmount: 12.5,
        orderNumber: "URB-1005",
        items: [item(coldBrew), item(croissant, 2)],
      },
      "purchase:URB-1005",
    );

    // Lisa: coffee beans + mug
    await event(
      insertedCustomers[6].id,
      "purchase",
      {
        orderAmount: 26.99,
        orderNumber: "URB-1006",
        items: [item(beans), item(mug)],
      },
      "purchase:URB-1006",
    );

    // --- Opening balances ---
    await Promise.all([
      applyAdjust({ tenantId: tenant.id, customerId: insertedCustomers[0].id, points: 400, description: "Opening balance" }),
      applyAdjust({ tenantId: tenant.id, customerId: insertedCustomers[1].id, points: 250, description: "Opening balance" }),
      applyAdjust({ tenantId: tenant.id, customerId: insertedCustomers[3].id, points: 1000, description: "Opening balance" }),
      applyAdjust({ tenantId: tenant.id, customerId: insertedCustomers[6].id, points: 500, description: "Opening balance" }),
    ]);

    // --- Redeem a few rewards ---
    const [freeBeverage, tenPercentOff, , , merch] = rewards;
    await applyRedeem({ tenantId: tenant.id, customerId: insertedCustomers[0].id, rewardId: freeBeverage.id, description: "Free beverage redemption" });
    await applyRedeem({ tenantId: tenant.id, customerId: insertedCustomers[1].id, rewardId: tenPercentOff.id, description: "10% off discount redemption" });
    await applyRedeem({ tenantId: tenant.id, customerId: insertedCustomers[3].id, rewardId: merch.id, description: "Merchandise redemption" });

    // Idempotency sanity
    const replay = await event(
      insertedCustomers[0].id,
      "purchase",
      {
        orderAmount: 8.0,
        orderNumber: "URB-1001",
        items: [item(latte), item(croissant)],
      },
      "purchase:URB-1001",
    );

    return NextResponse.json(
      {
        message: "Demo data seeded successfully",
        admin: ADMIN_EMAIL,
        owner: DEMO_EMAIL,
        portal: PORTAL_EMAIL,
        portalPassword: PORTAL_PASSWORD,
        portalSlug: tenant.slug,
        replayDeduplicated: replay.duplicate,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Failed to seed data" }, { status: 500 });
  }
}
