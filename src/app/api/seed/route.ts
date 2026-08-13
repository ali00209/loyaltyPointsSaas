import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  customers,
  customerRuleBalances,
  earningRules,
  pointTransactions,
  products,
  redemptionRewards,
  tenantEarningRules,
  tenants,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { basisForTrigger, type RuleConditions } from "@/lib/rules";
import { resetDemoData } from "@/lib/points";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "admin@loyaltyapp.com";
const DEMO_EMAIL = "demo@loyaltyapp.com";

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

    // --- Admin-authored earning rules (no multiplier / bonus) ---
    const ruleInputs = [
      {
        name: "Standard Spend Rewards",
        description: "Earn 1 point for every $1 spent on any purchase",
        triggerType: "flat_rate" as const,
        productId: null,
        minPrice: null,
        maxPrice: null,
        minQuantity: null,
        pointsPerUnit: 1,
        pointsExpireAfterDays: null,
      },
      {
        name: "Premium Coffee Bonus",
        description: "Earn 3 points per specialty coffee purchased",
        triggerType: "per_product" as const,
        productId: "LATTE_PLACEHOLDER",
        minPrice: null,
        maxPrice: null,
        minQuantity: null,
        pointsPerUnit: 3,
        pointsExpireAfterDays: 90,
      },
      {
        name: "Big Spender Bonus",
        description: "Orders $20-$50 earn 2 points per dollar",
        triggerType: "price_range" as const,
        productId: null,
        minPrice: 20,
        maxPrice: 50,
        minQuantity: null,
        pointsPerUnit: 2,
        pointsExpireAfterDays: null,
      },
      {
        name: "Bulk Coffee Bean Reward",
        description: "Buy 3+ bags of beans and earn 5 points per bag",
        triggerType: "bulk_quantity" as const,
        productId: null,
        minPrice: null,
        maxPrice: null,
        minQuantity: 3,
        pointsPerUnit: 5,
        pointsExpireAfterDays: 30,
      },
      {
        name: "Bakery Loyalty",
        description: "Earn 2 points per bakery item",
        triggerType: "per_product" as const,
        productId: "CROISSANT_PLACEHOLDER",
        minPrice: null,
        maxPrice: null,
        minQuantity: null,
        pointsPerUnit: 2,
        pointsExpireAfterDays: null,
      },
      {
        name: "High-Value Purchase Reward",
        description: "Earn 3 points per dollar on orders $50+",
        triggerType: "price_range" as const,
        productId: null,
        minPrice: 50,
        maxPrice: 500,
        minQuantity: null,
        pointsPerUnit: 3,
        pointsExpireAfterDays: 180,
      },
    ];

    const rules = [];
    for (const r of ruleInputs) {
      const conditions: RuleConditions = {
        productId: r.productId,
        minPrice: r.minPrice,
        maxPrice: r.maxPrice,
        minQuantity: r.minQuantity,
      };
      const [row] = await db
        .insert(earningRules)
        .values({
          name: r.name,
          description: r.description,
          triggerType: r.triggerType,
          conditions,
          pointsFormula: { basis: basisForTrigger(r.triggerType), pointsPerUnit: r.pointsPerUnit },
          pointsExpireAfterDays: r.pointsExpireAfterDays,
          active: true,
        })
        .returning();
      rules.push(row);
    }

    // --- Assign all rules to the demo tenant ---
    await db.insert(tenantEarningRules).values(
      rules.map((r) => ({ tenantId: tenant.id, ruleId: r.id, active: true })),
    );

    // --- Products (referenced by per_product rules) ---
    const productData = [
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
    ];

    const insertedProducts = await db
      .insert(products)
      .values(productData.map((p) => ({ ...p, tenantId: tenant.id })))
      .returning();

    // Point per_product rules at real product ids.
    const latteRule = rules.find((r) => r.conditions.productId === "LATTE_PLACEHOLDER");
    const croissantRule = rules.find((r) => r.conditions.productId === "CROISSANT_PLACEHOLDER");
    if (latteRule) {
      await db
        .update(earningRules)
        .set({ conditions: { ...latteRule.conditions, productId: insertedProducts[2].id } })
        .where(eq(earningRules.id, latteRule.id));
    }
    if (croissantRule) {
      await db
        .update(earningRules)
        .set({ conditions: { ...croissantRule.conditions, productId: insertedProducts[3].id } })
        .where(eq(earningRules.id, croissantRule.id));
    }

    // --- Customers (no tiers) ---
    const customerData = [
      { name: "Sarah Mitchell", email: "sarah.m@email.com", phone: "+1-555-0101", balance: 1250, earned: 2800 },
      { name: "James Chen", email: "james.chen@email.com", phone: "+1-555-0102", balance: 5430, earned: 8900 },
      { name: "Maria Rodriguez", email: "maria.r@email.com", phone: "+1-555-0103", balance: 320, earned: 650 },
      { name: "David Kim", email: "david.k@email.com", phone: "+1-555-0104", balance: 12500, earned: 15200 },
      { name: "Emily Watson", email: "emily.w@email.com", phone: "+1-555-0105", balance: 890, earned: 1450 },
      { name: "Robert Taylor", email: "robert.t@email.com", phone: "+1-555-0106", balance: 2100, earned: 3600 },
      { name: "Lisa Park", email: "lisa.p@email.com", phone: "+1-555-0107", balance: 6700, earned: 11000 },
      { name: "Michael Brown", email: "michael.b@email.com", phone: "+1-555-0108", balance: 450, earned: 750 },
      { name: "Jennifer Davis", email: "jennifer.d@email.com", phone: "+1-555-0109", balance: 3200, earned: 5100 },
      { name: "William Lee", email: "william.l@email.com", phone: "+1-555-0110", balance: 1800, earned: 2900 },
      { name: "Amanda Foster", email: "amanda.f@email.com", phone: "+1-555-0111", balance: 150, earned: 150 },
      { name: "Chris Martinez", email: "chris.m@email.com", phone: "+1-555-0112", balance: 7800, earned: 12400 },
    ];

    const insertedCustomers = await db
      .insert(customers)
      .values(
        customerData.map((c) => ({
          tenantId: tenant.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          currentBalance: c.balance,
          totalPointsEarned: c.earned,
        })),
      )
      .returning();

    // --- Rewards ---
    const rewardData = [
      { name: "Free Beverage", pointsCost: 500, rewardType: "physical_item" as const, inventoryLimit: 1000, redeemedCount: 1 },
      { name: "Merchandise Item", pointsCost: 1000, rewardType: "physical_item" as const, inventoryLimit: 200, redeemedCount: 1 },
      { name: "$25 Gift Card", pointsCost: 2500, rewardType: "gift_card" as const, inventoryLimit: null, redeemedCount: 1 },
      { name: "10% Off Discount", pointsCost: 300, rewardType: "discount" as const, inventoryLimit: null, redeemedCount: 0 },
      { name: "$10 Store Credit", pointsCost: 1000, rewardType: "store_credit" as const, inventoryLimit: null, redeemedCount: 0 },
    ];

    const rewards = await db
      .insert(redemptionRewards)
      .values(rewardData.map((r) => ({ tenantId: tenant.id, ...r })))
      .returning();

    // --- Transactions ---
    const now = new Date();
    const earnRuleId = rules[0].id; // Standard Spend Rewards
    const premiumRuleId = latteRule!.id;
    const bigSpenderRuleId = rules[2].id;
    const bulkRuleId = rules[3].id;
    const bakeryRuleId = croissantRule!.id;
    const highValueRuleId = rules[5].id;
    const freeBeverageId = rewards[0].id;
    const merchId = rewards[1].id;
    const giftCardId = rewards[2].id;

    const txData = [
      { customerId: insertedCustomers[0].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 45, description: "Morning coffee & pastry", orderAmount: "12.50", itemQuantity: null, daysAgo: 0 },
      { customerId: insertedCustomers[1].id, ruleId: bigSpenderRuleId, rewardId: null, type: "earn" as const, points: 85, description: "Weekly coffee bean purchase", orderAmount: "29.99", itemQuantity: null, daysAgo: 0 },
      { customerId: insertedCustomers[3].id, ruleId: highValueRuleId, rewardId: null, type: "earn" as const, points: 350, description: "Bulk retail order", orderAmount: "65.00", itemQuantity: null, daysAgo: 1 },
      { customerId: insertedCustomers[1].id, ruleId: null, rewardId: freeBeverageId, type: "redeem" as const, points: -500, description: "Free beverage redemption", orderAmount: null, itemQuantity: null, daysAgo: 1 },
      { customerId: insertedCustomers[4].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 22, description: "Lunch order", orderAmount: "22.00", itemQuantity: null, daysAgo: 2 },
      { customerId: insertedCustomers[6].id, ruleId: bulkRuleId, rewardId: null, type: "earn" as const, points: 55, description: "3 bags seasonal blend", orderAmount: "44.97", itemQuantity: 3, daysAgo: 2 },
      { customerId: insertedCustomers[2].id, ruleId: premiumRuleId, rewardId: null, type: "earn" as const, points: 5, description: "Latte purchase", orderAmount: "5.00", itemQuantity: null, daysAgo: 3 },
      { customerId: insertedCustomers[8].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 35, description: "Breakfast combo", orderAmount: "17.50", itemQuantity: null, daysAgo: 3 },
      { customerId: insertedCustomers[5].id, ruleId: null, rewardId: merchId, type: "redeem" as const, points: -1000, description: "Merchandise redemption", orderAmount: null, itemQuantity: null, daysAgo: 4 },
      { customerId: insertedCustomers[9].id, ruleId: bakeryRuleId, rewardId: null, type: "earn" as const, points: 8, description: "2x Croissant", orderAmount: "6.00", itemQuantity: 2, daysAgo: 4 },
      { customerId: insertedCustomers[11].id, ruleId: highValueRuleId, rewardId: null, type: "earn" as const, points: 200, description: "Catering order", orderAmount: "85.00", itemQuantity: null, daysAgo: 5 },
      { customerId: insertedCustomers[0].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 15, description: "Afternoon snack", orderAmount: "7.50", itemQuantity: null, daysAgo: 5 },
      { customerId: insertedCustomers[7].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 9, description: "Espresso to go", orderAmount: "3.50", itemQuantity: null, daysAgo: 6 },
      { customerId: insertedCustomers[3].id, ruleId: null, rewardId: giftCardId, type: "redeem" as const, points: -2500, description: "Gift card redemption", orderAmount: null, itemQuantity: null, daysAgo: 6 },
      { customerId: insertedCustomers[10].id, ruleId: earnRuleId, rewardId: null, type: "earn" as const, points: 12, description: "First visit coffee", orderAmount: "4.50", itemQuantity: null, daysAgo: 7 },
    ];

    await db.insert(pointTransactions).values(
      txData.map((t) => ({
        tenantId: tenant.id,
        customerId: t.customerId,
        transactionType: t.type,
        points: t.points,
        description: t.description,
        orderAmount: t.orderAmount,
        itemQuantity: t.itemQuantity ?? null,
        ruleId: t.ruleId,
        rewardId: t.rewardId,
        metadata: {},
        createdAt: new Date(now.getTime() - t.daysAgo * 86400000),
      })),
    );

    // --- Buckets: one non-expiring bucket per customer equal to their balance ---
    await db.insert(customerRuleBalances).values(
      insertedCustomers.map((c) => ({
        tenantId: tenant.id,
        customerId: c.id,
        ruleId: null,
        remainingPoints: c.currentBalance,
        expiresAt: null,
      })),
    );

    return NextResponse.json(
      {
        message: "Demo data seeded successfully",
        admin: ADMIN_EMAIL,
        owner: DEMO_EMAIL,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Failed to seed data" }, { status: 500 });
  }
}
