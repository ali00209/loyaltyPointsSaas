import { client } from "./client";
import type { ApiKeyInfo, ApiKeyRegenerateResult } from "@/types";
import type { AppSettings } from "@/lib/settings-defs";

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

export async function fetchAppSettings(): Promise<AppSettings> {
  const { data } = await client.get<{ settings: AppSettings }>("/settings/app");
  return data.settings;
}

export async function saveAppSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const { data } = await client.patch<{ settings: AppSettings }>(
    "/settings/app",
    patch,
  );
  return data.settings;
}
