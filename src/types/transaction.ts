export type TransactionType = "earn" | "redeem" | "adjust" | "expire";

export interface Transaction extends Record<string, unknown> {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string | null;
  transactionType: TransactionType;
  points: number;
  ruleId: string | null;
  ruleName: string | null;
  rewardId: string | null;
  rewardName: string | null;
  redemptionRuleId?: string | null;
  redemptionRuleName?: string | null;
  eventId: string | null;
  description: string | null;
  orderAmount: string | null;
  itemQuantity: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TransactionInput {
  customerId: string;
  transactionType: TransactionType;
  ruleId?: string | null;
  rewardId?: string | null;
  points?: number;
  description?: string | null;
  orderAmount?: string | number | null;
  itemQuantity?: number | null;
  productId?: string | null;
  metadata?: Record<string, unknown>;
}
