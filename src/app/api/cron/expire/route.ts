import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { expireDuePoints } from "@/lib/points";

// POST /api/cron/expire
// Sweeps expired point buckets across all tenants. Call from an external
// scheduler (e.g. Vercel cron). Optionally guarded by CRON_SECRET when set.
export async function POST() {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const requestHeaders = await headers();
    if (requestHeaders.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const expired = await expireDuePoints();
    return NextResponse.json({ expiredBuckets: expired });
  } catch (error) {
    console.error("Expiry sweep error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
