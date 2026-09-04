import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireOwnerTenant } from "@/lib/api-guard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const user = await getCurrentUser();
  const slug = user?.tenant?.slug ?? "";

  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const portalUrl = `${proto}://${host}/p/${slug}`;

  const qrDataUrl = await QRCode.toDataURL(portalUrl, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({
    tenantId,
    tenantName: user?.tenant?.name ?? "",
    portalUrl,
    qrDataUrl,
  });
}
