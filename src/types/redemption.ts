import type { RuleGroupType } from "@/lib/rules";

export type RedemptionDiscountType = "fixed" | "percent";
export type RedemptionMode = "fixed" | "per_point";
export type RedemptionCheckoutStatus =
  | "reserved"
  | "finalized"
  | "released"
  | "refunded";

export interface RedemptionRule extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  redemptionMode: RedemptionMode;
  discountType: RedemptionDiscountType;
  discountValue: string | number;
  pointsCost: number;
  priority: number;
  conditions: RuleGroupType;
  active: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  perCustomerLimit: number | null;
  tenantUsageLimit: number | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RedemptionRuleInput {
  name: string;
  description?: string | null;
  redemptionMode: RedemptionMode;
  discountType: RedemptionDiscountType;
  discountValue: number;
  pointsCost: number;
  priority?: number;
  conditions?: RuleGroupType;
  active?: boolean;
  activeFrom?: string | null;
  activeUntil?: string | null;
  perCustomerLimit?: number | null;
  tenantUsageLimit?: number | null;
}

export interface CheckoutItem {
  productId?: string;
  sku?: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}

export interface OwnerCheckoutInput {
  checkoutId?: string;
  orderId?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderAmount: number;
  items?: CheckoutItem[];
}

export interface OwnerRefundInput {
  checkoutId?: string;
  orderId?: string;
  reason: string;
}

export interface CheckoutBenefit {
  ruleId: string;
  ruleName?: string;
  discountType: RedemptionDiscountType;
  discountValue: number;
  discountAmount: number;
  eligibleSubtotal: number;
  pointsCost: number;
}

export interface CheckoutResult {
  checkoutId: string;
  orderId: string | null;
  status: RedemptionCheckoutStatus;
  matched: boolean;
  benefit: CheckoutBenefit | null;
  idempotent?: boolean;
  reason?: string | null;
  remainingBalance?: number;
}

export interface CheckoutPreview extends CheckoutResult {
  customerId: string;
  customerName: string;
  customerBalance: number;
}

export interface RedemptionCheckoutHistory extends Record<string, unknown> {
  id: string;
  checkoutId: string;
  orderId: string | null;
  customerId: string;
  customerName: string | null;
  ruleId: string | null;
  ruleName: string | null;
  pointsCost: number;
  orderAmount: string;
  eligibleSubtotal: string;
  discountAmount: string;
  status: RedemptionCheckoutStatus;
  refundReason: string | null;
  createdAt: string;
  updatedAt: string;
}
