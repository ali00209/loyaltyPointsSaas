import { client } from "./client";
import type { AnalyticsData, AnalyticsSegment, AnalyticsWindow } from "@/types/analytics";

export async function fetchAnalytics(
  window: AnalyticsWindow,
  segment: AnalyticsSegment,
): Promise<AnalyticsData> {
  const { data } = await client.get<AnalyticsData>("/analytics", {
    params: { window, segment },
  });
  return data;
}
