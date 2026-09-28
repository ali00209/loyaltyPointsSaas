import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantSettings } from "@/db/schema";
import {
  DEFAULT_SETTINGS,
  SETTING_DEFS,
  type AppSettings,
  type SettingKey,
} from "@/lib/settings-defs";

export {
  DEFAULT_SETTINGS,
  SETTING_DEFS,
  SETTING_KEYS,
  type AppSettings,
  type SettingKey,
} from "@/lib/settings-defs";

// Read path. Callers inside a write transaction pass `tx` so the lookup joins
// that transaction; everything else uses the pool-backed `db`.
type Executor = Pick<typeof db, "select" | "insert">;

export async function getAppSettings(
  tenantId: string,
  executor: Executor = db,
): Promise<AppSettings> {
  const rows = await executor
    .select({ key: tenantSettings.key, value: tenantSettings.value })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId));

  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(row.key in SETTING_DEFS)) continue; // key retired from the registry
    settings[row.key as SettingKey] = row.value === true;
  }
  return settings;
}

export async function updateAppSettings(
  tenantId: string,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in SETTING_DEFS)) throw new Error(`Unknown setting key: ${key}`);
    if (typeof value !== "boolean") {
      throw new Error(`Setting ${key} must be a boolean`);
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    await db
      .insert(tenantSettings)
      .values({ tenantId, key, value })
      .onConflictDoUpdate({
        target: [tenantSettings.tenantId, tenantSettings.key],
        set: { value, updatedAt: new Date() },
      });
  }

  return getAppSettings(tenantId);
}
