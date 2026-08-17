import { client } from "./client";
import type { EarningRule, EarningRuleInput } from "@/types";

export async function fetchAssignedRules(): Promise<EarningRule[]> {
  const { data } = await client.get<{ rules: EarningRule[] }>("/rules");
  return data.rules;
}

export async function toggleRuleAssignment(
  id: string,
  active: boolean,
): Promise<{ id: string; active: boolean }> {
  const { data } = await client.put<{ rule: { id: string; active: boolean } }>("/rules", {
    id,
    active,
  });
  return data.rule;
}

export async function createRule(input: EarningRuleInput): Promise<EarningRule> {
  const { data } = await client.post<{ rule: EarningRule }>("/rules", input);
  return data.rule;
}

export async function updateRule(
  id: string,
  input: Partial<EarningRuleInput>,
): Promise<EarningRule> {
  const { data } = await client.put<{ rule: EarningRule }>(`/rules/${id}`, input);
  return data.rule;
}

export async function deleteRule(id: string): Promise<void> {
  await client.delete(`/rules/${id}`);
}
