import { NextRequest, NextResponse } from "next/server";
import { requireOwnerTenant } from "@/lib/api-guard";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import { UpdateAppSettingsSchema, parseBody } from "@/lib/validations";

export async function GET() {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;

  return NextResponse.json({ settings: await getAppSettings(guard.tenantId) });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;

  const parsed = await parseBody(req, UpdateAppSettingsSchema);
  if (parsed.error) return parsed.error;

  try {
    const settings = await updateAppSettings(guard.tenantId, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("App settings update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
