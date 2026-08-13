export type RewardType = "discount" | "gift_card" | "physical_item" | "store_credit";

export interface RedemptionReward extends Record<string, unknown> {
  id: string;
  tenantId: string;
  name: string;
  pointsCost: number;
  rewardType: RewardType;
  inventoryLimit: number | null;
  redeemedCount: number;
  details: Record<string, unknown>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RewardInput {
  name: string;
  pointsCost?: number;
  rewardType?: RewardType;
  inventoryLimit?: number | null;
  description?: string;
  active?: boolean;
}
