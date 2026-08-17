import { client } from "./client";
import type { ApiKeyInfo, ApiKeyRegenerateResult } from "@/types";

export async function fetchApiKey(): Promise<ApiKeyInfo> {
  const { data } = await client.get<{ apiKey: ApiKeyInfo }>("/settings/api-key");
  return data.apiKey;
}

export async function regenerateApiKey(name?: string): Promise<ApiKeyRegenerateResult> {
  const { data } = await client.post<{ apiKey: ApiKeyRegenerateResult }>(
    "/settings/api-key",
    name ? { name } : {},
  );
  return data.apiKey;
}
