export interface DiscountDetails {
  discountType: "fixed" | "percent";
  amount?: number;
  percent?: number;
}

export interface RedemptionReward extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  pointsCost: number;
  inventoryLimit: number | null;
  redeemedCount: number;
  details: DiscountDetails & Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RewardInput {
  name: string;
  pointsCost?: number;
  discountType?: "fixed" | "percent";
  discountValue?: number;
  inventoryLimit?: number | null;
  description?: string;
  active?: boolean;
}
