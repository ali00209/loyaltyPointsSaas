import { client } from "./client";
import type { RedemptionReward, RewardInput } from "@/types";

export async function fetchRewards(): Promise<RedemptionReward[]> {
  const { data } = await client.get<{ rewards: RedemptionReward[] }>("/rewards");
  return data.rewards;
}

export async function createReward(input: RewardInput): Promise<RedemptionReward> {
  const { data } = await client.post<{ reward: RedemptionReward }>("/rewards", input);
  return data.reward;
}

export async function updateReward(
  id: string,
  input: Partial<RewardInput>,
): Promise<RedemptionReward> {
  const { data } = await client.put<{ reward: RedemptionReward }>("/rewards", { id, ...input });
  return data.reward;
}

export async function deleteReward(id: string): Promise<void> {
  await client.delete("/rewards", { params: { id } });
}
