import { NextResponse } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, events, pointTransactions } from "@/db/schema";
import { requireOwnerTenant } from "@/lib/api-guard";
import { EVENT_TYPES, type EventType } from "@/lib/rules";
import type {
  AnalyticsData,
  AnalyticsSegment,
  AnalyticsWindow,
  CohortRow,
  FunnelStage,
  Kpi,
  TrendPoint,
} from "@/types/analytics";

const WINDOW_DAYS: Record<AnalyticsWindow, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const SEGMENTS: AnalyticsSegment[] = ["all", ...EVENT_TYPES];

// How many weekly cohorts to show, newest last.
const MAX_COHORTS = 8;
// How many weeks of forward retention to show per cohort.
const MAX_WEEKS = 8;

const WINDOW_SET = new Set<string>(Object.keys(WINDOW_DAYS));
const SEGMENT_SET = new Set<string>(SEGMENTS);

function parseWindow(raw: string | null): AnalyticsWindow {
  return raw && WINDOW_SET.has(raw) ? (raw as AnalyticsWindow) : "30d";
}

function parseSegment(raw: string | null): AnalyticsSegment {
  return raw && SEGMENT_SET.has(raw) ? (raw as AnalyticsSegment) : "all";
}

/** ISO date (YYYY-MM-DD) of the Monday starting the week containing `d`. */
function weekStart(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (out.getUTCDay() + 6) % 7; // Mon = 0
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weeksBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pct(n: number, d: number): number {
  return d > 0 ? (n / d) * 100 : 0;
}

function ratio(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export async function GET(request: Request) {
  const guard = await requireOwnerTenant();
  if ("error" in guard) return guard.error;
  const tenantId = guard.tenantId;

  const url = new URL(request.url);
  const window = parseWindow(url.searchParams.get("window"));
  const segment = parseSegment(url.searchParams.get("segment"));

  const days = WINDOW_DAYS[window];
  const segmentFilter = segment === "all" ? null : segment;

  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  // The comparison window is the same length immediately before this one.
  const priorSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  // Per-customer event/earn/redeem counts inside the current window.
  const rows = await db
    .select({
      customerId: customers.id,
      joinDate: customers.joinDate,
      eventCount: sql<number>`count(distinct ${events.id})::int`,
      purchases: sql<number>`count(distinct ${events.id}) filter (where ${events.eventType} = 'purchase')::int`,
      earned: sql<number>`coalesce(sum(${pointTransactions.points}) filter (where ${pointTransactions.transactionType} = 'earn'), 0)::int`,
      redeemed: sql<number>`coalesce(sum(abs(${pointTransactions.points})) filter (where ${pointTransactions.transactionType} = 'redeem'), 0)::int`,
      redeemCount: sql<number>`count(distinct ${pointTransactions.id}) filter (where ${pointTransactions.transactionType} = 'redeem')::int`,
    })
    .from(customers)
    .leftJoin(
      events,
      and(
        eq(events.customerId, customers.id),
        gte(events.occurredAt, since),
        segmentFilter
          ? eq(events.eventType, segmentFilter as EventType)
          : sql`true`,
      ),
    )
    .leftJoin(
      pointTransactions,
      and(
        eq(pointTransactions.customerId, customers.id),
        gte(pointTransactions.createdAt, since),
      ),
    )
    .where(eq(customers.tenantId, tenantId))
    .groupBy(customers.id, customers.joinDate);

  const active = rows.filter((r) => r.eventCount > 0);
  const purchased = active.filter((r) => r.purchases > 0);
  const repeat = purchased.filter((r) => r.purchases > 1);
  const earnedPoints = active.filter((r) => r.earned > 0);
  const redeemed = active.filter((r) => r.redeemCount > 0);

  const stageDefs: { key: string; label: string; count: number }[] = [
    { key: "registered", label: "Registered", count: rows.length },
    { key: "active", label: "Active", count: active.length },
    { key: "purchase", label: "Made a purchase", count: purchased.length },
    { key: "repeat", label: "Repeat purchase", count: repeat.length },
    { key: "redeem", label: "Redeemed points", count: redeemed.length },
  ];

  const top = stageDefs[0].count;
  const funnel: FunnelStage[] = stageDefs.map((s, i) => ({
    key: s.key,
    label: s.label,
    customers: s.count,
    pctOfTop: pct(s.count, top),
    stepPct: i === 0 ? null : pct(s.count, stageDefs[i - 1].count),
  }));

  // --- Weekly trend -------------------------------------------------------
  // Counts are recomputed per week from the same source rows, so the trend and
  // the funnel can never disagree.
  const eventRows = await db
    .select({
      customerId: events.customerId,
      occurredAt: events.occurredAt,
      eventType: events.eventType,
    })
    .from(events)
    .where(
      and(
        eq(events.tenantId, tenantId),
        gte(events.occurredAt, since),
        segmentFilter ? eq(events.eventType, segmentFilter as EventType) : sql`true`,
      ),
    );

  const txRows = await db
    .select({
      customerId: pointTransactions.customerId,
      createdAt: pointTransactions.createdAt,
      transactionType: pointTransactions.transactionType,
      points: pointTransactions.points,
    })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.tenantId, tenantId),
        gte(pointTransactions.createdAt, since),
      ),
    );

  const currentWeek = weekStart(now);
  const weekCount = Math.max(1, Math.floor(days / 7));
  const weekBuckets = Array.from({ length: weekCount }, (_, i) => {
    const start = new Date(
      currentWeek.getTime() - (weekCount - 1 - i) * 7 * 24 * 60 * 60 * 1000,
    );
    return { start, active: new Set<string>(), earned: 0, redeemed: 0 };
  });
  const bucketFor = (d: Date) => {
    const w = weekStart(d).getTime();
    return weekBuckets.find((b) => b.start.getTime() === w);
  };

  for (const e of eventRows) {
    bucketFor(new Date(e.occurredAt))?.active.add(e.customerId);
  }
  for (const t of txRows) {
    const bucket = bucketFor(new Date(t.createdAt));
    if (!bucket) continue;
    if (t.transactionType === "earn") bucket.earned += t.points;
    if (t.transactionType === "redeem") bucket.redeemed += Math.abs(t.points);
  }

  const trend: TrendPoint[] = weekBuckets.map((b) => ({
    week: isoDate(b.start),
    activeCustomers: b.active.size,
    pointsEarned: b.earned,
    pointsRedeemed: b.redeemed,
  }));

  // --- Cohorts -----------------------------------------------------------
  // One cohort per signup week, oldest first. Retention = share of the cohort
  // with at least one event in that week-since-signup.
  const cohortMap = new Map<string, { size: number; weeks: Set<string>[] }>();
  for (const r of rows) {
    const cw = weekStart(new Date(r.joinDate));
    const key = isoDate(cw);
    let entry = cohortMap.get(key);
    if (!entry) {
      entry = {
        size: 0,
        weeks: Array.from({ length: MAX_WEEKS }, () => new Set<string>()),
      };
      cohortMap.set(key, entry);
    }
    entry.size += 1;
    // A customer is "retained" in week 0 by definition of having signed up.
    entry.weeks[0].add(r.customerId);
  }
  for (const e of eventRows) {
    for (const [key, entry] of cohortMap) {
      const offset = weeksBetween(new Date(key), weekStart(new Date(e.occurredAt)));
      if (offset >= 0 && offset < MAX_WEEKS) {
        entry.weeks[offset].add(e.customerId);
      }
    }
  }

  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-MAX_COHORTS)
    .map(([key, entry]) => {
      const start = new Date(key);
      const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
      return {
        cohortWeek: key,
        label: `${fmtShort(start)} – ${fmtShort(end)}`,
        size: entry.size,
        retention: entry.weeks.map((set) =>
          set.size > 0 ? Math.round((set.size / entry.size) * 100) : null,
        ),
      };
    });

  // --- KPIs --------------------------------------------------------------
  // Compared against the preceding window of equal length.
  const priorRows = await db
    .select({
      customerId: customers.id,
      eventCount: sql<number>`count(distinct ${events.id})::int`,
      purchases: sql<number>`count(distinct ${events.id}) filter (where ${events.eventType} = 'purchase')::int`,
      earned: sql<number>`coalesce(sum(${pointTransactions.points}) filter (where ${pointTransactions.transactionType} = 'earn'), 0)::int`,
      redeemCount: sql<number>`count(distinct ${pointTransactions.id}) filter (where ${pointTransactions.transactionType} = 'redeem')::int`,
    })
    .from(customers)
    .leftJoin(
      events,
      and(
        eq(events.customerId, customers.id),
        gte(events.occurredAt, priorSince),
        sql`${events.occurredAt} < ${since}`,
        segmentFilter ? eq(events.eventType, segmentFilter as EventType) : sql`true`,
      ),
    )
    .leftJoin(
      pointTransactions,
      and(
        eq(pointTransactions.customerId, customers.id),
        gte(pointTransactions.createdAt, priorSince),
        sql`${pointTransactions.createdAt} < ${since}`,
      ),
    )
    .where(eq(customers.tenantId, tenantId))
    .groupBy(customers.id);

  const priorActive = priorRows.filter((r) => r.eventCount > 0);
  const priorRegistered = priorRows.length;
  const priorEarned = priorActive.reduce((s, r) => s + r.earned, 0);
  const priorRedeem = priorActive.filter((r) => r.redeemCount > 0).length;
  const priorPurchased = priorActive.filter((r) => r.purchases > 0).length;

  const totalEarned = active.reduce((s, r) => s + r.earned, 0);
  const kpis: Kpi[] = [
    {
      key: "activation",
      label: "Activation rate",
      value: `${pct(active.length, rows.length).toFixed(1)}%`,
      delta: ratio(pct(active.length, rows.length), pct(priorActive.length, priorRegistered)),
      higherIsBetter: true,
    },
    {
      key: "purchase",
      label: "Active → purchase",
      value: `${pct(purchased.length, active.length).toFixed(1)}%`,
      delta: ratio(
        pct(purchased.length, active.length),
        pct(priorPurchased, priorActive.length),
      ),
      higherIsBetter: true,
    },
    {
      key: "points",
      label: "Points per active customer",
      value: active.length
        ? Math.round(totalEarned / active.length).toLocaleString()
        : "0",
      delta: ratio(
        active.length ? totalEarned / active.length : 0,
        priorActive.length ? priorEarned / priorActive.length : 0,
      ),
      higherIsBetter: true,
    },
    {
      key: "redeem",
      label: "Redemption rate",
      value: `${pct(redeemed.length, active.length).toFixed(1)}%`,
      delta: ratio(
        pct(redeemed.length, active.length),
        pct(priorRedeem, priorActive.length),
      ),
      higherIsBetter: true,
    },
  ];

  const body: AnalyticsData = {
    window,
    segment,
    customers: rows.length,
    activeCustomers: active.length,
    funnel,
    trend,
    cohorts,
    kpis,
  };
  return NextResponse.json(body);
}
