import type { EventType } from "@/lib/rules";

export type AnalyticsWindow = "7d" | "30d" | "90d";

/** The segment filter. `all` aggregates every event type. */
export type AnalyticsSegment = "all" | EventType;

export interface FunnelStage {
  key: string;
  label: string;
  /** Distinct customers in this stage, within the window. */
  customers: number;
  /** Share of the first stage, as a percentage. */
  pctOfTop: number;
  /** Conversion from the previous stage, as a percentage. */
  stepPct: number | null;
}

export interface TrendPoint {
  /** Week start, ISO date (YYYY-MM-DD). */
  week: string;
  activeCustomers: number;
  pointsEarned: number;
  pointsRedeemed: number;
}

export interface CohortRow {
  /** Week start of the cohort, ISO date. */
  cohortWeek: string;
  label: string;
  size: number;
  /** Retention percentage by week-since-signup; null where not yet reached. */
  retention: (number | null)[];
}

export interface Kpi {
  key: string;
  label: string;
  value: string;
  /** Change vs. the immediately preceding window of equal length; null if undefined. */
  delta: number | null;
  higherIsBetter: boolean;
}

export interface AnalyticsData {
  window: AnalyticsWindow;
  segment: AnalyticsSegment;
  /** Distinct customers registered inside the window. */
  customers: number;
  /** Distinct customers with at least one event in the window. */
  activeCustomers: number;
  funnel: FunnelStage[];
  trend: TrendPoint[];
  cohorts: CohortRow[];
  kpis: Kpi[];
}
