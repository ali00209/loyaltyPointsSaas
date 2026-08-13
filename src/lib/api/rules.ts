import { client } from "./client";
import type { AssignedRule } from "@/types";

export async function fetchAssignedRules(): Promise<AssignedRule[]> {
  const { data } = await client.get<{ rules: AssignedRule[] }>("/rules");
  return data.rules;
}

export async function toggleRuleAssignment(
  id: string,
  active: boolean,
): Promise<{ id: string; active: boolean }> {
  const { data } = await client.put<{ assignment: { id: string; active: boolean } }>("/rules", {
    id,
    active,
  });
  return data.assignment;
}
