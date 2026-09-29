"use client";

import { useState } from "react";
import {
  Users,
  Star,
  TrendingUp,
  CheckCircle,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Center } from "@astryxdesign/core/Center";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Selector } from "@astryxdesign/core/Selector";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { useDashboard, useAnalytics } from "@/lib/query";
import AppLoading from "@/components/AppLoading";
import { EVENT_TYPES, EVENT_CATALOG } from "@/lib/rules";
import type { AnalyticsSegment, AnalyticsWindow } from "@/types/analytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

const statTiles = [
  {
    icon: <Icon icon={Users} size="lg" />,
    tint: "bg-(--color-background-blue) text-(--color-icon-blue)",
  },
  {
    icon: <Icon icon={Star} size="lg" />,
    tint: "bg-(--color-background-yellow) text-(--color-icon-yellow)",
  },
  {
    icon: <Icon icon={TrendingUp} size="lg" />,
    tint: "bg-(--color-background-green) text-(--color-icon-green)",
  },
  {
    icon: <Icon icon={CheckCircle} size="lg" />,
    tint: "bg-(--color-background-purple) text-(--color-icon-purple)",
  },
];

const WINDOW_OPTIONS: { value: AnalyticsWindow; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const SEGMENT_OPTIONS: { value: AnalyticsSegment; label: string }[] = [
  { value: "all", label: "All events" },
  ...EVENT_TYPES.map((t) => ({ value: t, label: EVENT_CATALOG[t].label })),
];

const AXIS_TICK = { fontSize: 12, fill: "var(--color-text-secondary, #4E606F)" };
const GRID_STROKE = "var(--color-border, rgba(5, 54, 89, 0.1))";

function shortWeek(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return <AppLoading label="Loading dashboard..." />;
  }

  if (!data) {
    return (
      <Center axis="both" className="min-h-dvh">
        <EmptyState title="Failed to load dashboard data" isCompact />
      </Center>
    );
  }

  const stats = [
    {
      label: "Total Customers",
      value: data.stats.totalCustomers.toLocaleString(),
    },
    {
      label: "Lifetime Earned",
      value: data.stats.totalEarned.toLocaleString(),
    },
    {
      label: "Points Redeemed",
      value: data.stats.totalRedeemed.toLocaleString(),
    },
    {
      label: "Automatic Discounts",
      value: data.stats.totalRewards.toLocaleString(),
    },
  ];

  return (
    <VStack gap={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Dashboard</Heading>
        <Text type="body" color="secondary">
          Overview of your loyalty program performance
        </Text>
      </VStack>

      {/* KPI stats */}
      <Grid columns={{ minWidth: 240, repeat: "fit", max: 4 }} gap={4}>
        {stats.map((stat, i) => (
          <Card key={stat.label} padding={5}>
            <HStack gap={3}>
              <HStack
                width={44}
                height={44}
                hAlign="center"
                vAlign="center"
                className={`rounded-lg ${statTiles[i].tint}`}
              >
                {statTiles[i].icon}
              </HStack>
              <VStack gap={0}>
                <Text type="supporting" color="secondary">
                  {stat.label}
                </Text>
                <Text type="body" size="2xl" weight="bold" hasTabularNumbers>
                  {stat.value}
                </Text>
              </VStack>
            </HStack>
          </Card>
        ))}
      </Grid>

      <AnalyticsCharts />

      <Grid columns={{ minWidth: 420, repeat: "fill" }} gap={6}>
        {/* Recent Transactions */}
        <Card padding={6}>
          <VStack gap={4} hAlign="stretch">
            <Heading level={2}>Recent Transactions</Heading>
            {data.recentTransactions.length === 0 ? (
              <EmptyState
                title="No transactions yet"
                icon={<Icon icon={ArrowLeftRight} size="lg" />}
                isCompact
              />
            ) : (
              <List hasDividers density="compact">
                {data.recentTransactions.map((tx) => (
                  <ListItem
                    key={tx.id}
                    label={tx.customerName || "Unknown"}
                    description={tx.description || undefined}
                    startContent={
                      <HStack
                        width={32}
                        height={32}
                        hAlign="center"
                        vAlign="center"
                        className={`rounded-full ${
                          tx.transactionType === "earn"
                            ? "bg-(--color-background-green) text-(--color-icon-green)"
                            : tx.transactionType === "redeem"
                              ? "bg-(--color-background-red) text-(--color-icon-red)"
                              : "bg-(--color-background-gray) text-(--color-icon-gray)"
                        }`}
                      >
                        <Text type="body" weight="bold">
                          {tx.transactionType === "earn"
                            ? "+"
                            : tx.transactionType === "redeem"
                              ? "−"
                              : "~"}
                        </Text>
                      </HStack>
                    }
                    endContent={
                      <VStack gap={0} hAlign="end">
                        <Text
                          type="body"
                          weight="bold"
                          hasTabularNumbers
                          className={
                            tx.points > 0
                              ? "text-(--color-icon-green)"
                              : "text-(--color-icon-red)"
                          }
                        >
                          {tx.points > 0 ? "+" : ""}
                          {tx.points} pts
                        </Text>
                        <Text type="supporting" color="secondary">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </Text>
                      </VStack>
                    }
                  />
                ))}
              </List>
            )}
          </VStack>
        </Card>

        <VStack gap={6} hAlign="stretch">
          {/* Top Customers */}
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={2}>Top Customers</Heading>
              {data.topCustomers.length === 0 ? (
                <EmptyState
                  title="No customers yet"
                  icon={<Icon icon={Users} size="lg" />}
                  isCompact
                />
              ) : (
                <List hasDividers density="compact">
                  {data.topCustomers.map((c, i) => (
                    <ListItem
                      key={c.id}
                      label={c.name}
                      description={`${c.totalPointsEarned.toLocaleString()} lifetime pts`}
                      startContent={
                        <HStack
                          width={32}
                          height={32}
                          hAlign="center"
                          vAlign="center"
                          className="rounded-full bg-(--color-accent-muted) text-accent"
                        >
                          <Text type="body" weight="bold">
                            {i + 1}
                          </Text>
                        </HStack>
                      }
                      endContent={
                        <Text type="body" weight="bold" hasTabularNumbers>
                          {c.currentBalance.toLocaleString()}
                        </Text>
                      }
                    />
                  ))}
                </List>
              )}
            </VStack>
          </Card>

          {/* Top Redemption Rules */}
          <Card padding={6}>
            <VStack gap={4} hAlign="stretch">
              <Heading level={2}>Top Redemption Rules</Heading>
              {data.topRewards.length === 0 ? (
                <EmptyState
                  title="No automatic discounts yet"
                  icon={<Icon icon={ShieldCheck} size="lg" />}
                  isCompact
                />
              ) : (
                <List hasDividers density="compact">
                  {data.topRewards.map((r) => (
                    <ListItem
                      key={r.id}
                      label={r.name}
                      startContent={
                        <HStack
                          width={32}
                          height={32}
                          hAlign="center"
                          vAlign="center"
                          className="rounded-full bg-(--color-background-purple) text-(--color-icon-purple)"
                        >
                          <Icon icon={ShieldCheck} size="sm" />
                        </HStack>
                      }
                      endContent={
                        <Text type="body" weight="bold" hasTabularNumbers>
                          {r.redeemedCount.toLocaleString()} redeemed
                        </Text>
                      }
                    />
                  ))}
                </List>
              )}
            </VStack>
          </Card>
        </VStack>
      </Grid>
    </VStack>
  );
}

// Charts fed by the analytics endpoint, so the numbers match the filters
// rather than being a second, independent set of fixtures.
function AnalyticsCharts() {
  const [window, setWindow] = useState<AnalyticsWindow>("30d");
  const [segment, setSegment] = useState<AnalyticsSegment>("all");
  const { data, isLoading } = useAnalytics(window, segment);

  const segmentLabel =
    segment === "all" ? "All events" : EVENT_CATALOG[segment].label;

  if (isLoading || !data) {
    return (
      <Grid columns={{ minWidth: 420, repeat: "fill" }} gap={6}>
        <Card padding={6}>
          <EmptyState title="Loading analytics..." isCompact />
        </Card>
        <Card padding={6}>
          <EmptyState title="Loading analytics..." isCompact />
        </Card>
      </Grid>
    );
  }

  const hasTrend = data.trend.some(
    (t) => t.activeCustomers > 0 || t.pointsEarned > 0 || t.pointsRedeemed > 0,
  );

  return (
    <VStack gap={4} hAlign="stretch">
      <HStack gap={2} vAlign="center" wrap="wrap">
        <SegmentedControl
          label="Window"
          value={window}
          onChange={(v) => setWindow(v as AnalyticsWindow)}
        >
          {WINDOW_OPTIONS.map((o) => (
            <SegmentedControlItem key={o.value} label={o.label} value={o.value} />
          ))}
        </SegmentedControl>
        <Selector
          label="Event type"
          isLabelHidden
          options={SEGMENT_OPTIONS}
          value={segment}
          onChange={(v) => setSegment(v as AnalyticsSegment)}
        />
      </HStack>

      <Grid columns={{ minWidth: 420, repeat: "fill" }} gap={6}>
        {/* Points earned vs redeemed over time */}
        <Card padding={6}>
          <VStack gap={4} hAlign="stretch">
            <VStack gap={0}>
              <Heading level={2}>Points flow</Heading>
              <Text type="supporting" color="secondary">
                Earned vs. redeemed per week · {segmentLabel}
              </Text>
            </VStack>
            {!hasTrend ? (
              <EmptyState
                title="No activity in this window"
                isCompact
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.trend}
                  margin={{ top: 5, right: 12, left: 0, bottom: 5 }}
                >
                  <CartesianGrid horizontal vertical={false} stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="week"
                    tickFormatter={shortWeek}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    cursor={{ fill: GRID_STROKE }}
                    labelFormatter={(v) => `Week of ${shortWeek(String(v))}`}
                    contentStyle={{
                      background: "var(--color-surface, #fff)",
                      border: `1px solid ${GRID_STROKE}`,
                      borderRadius: 8,
                      color: "var(--color-text-primary, #1c2b33)",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="pointsEarned"
                    name="Earned"
                    fill="var(--color-data-categorical-green, #0B991F)"
                    radius={4}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="pointsRedeemed"
                    name="Redeemed"
                    fill="var(--color-data-categorical-orange, #EB6E00)"
                    radius={4}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </VStack>
        </Card>

        {/* Active customers per week */}
        <Card padding={6}>
          <VStack gap={4} hAlign="stretch">
            <VStack gap={0}>
              <Heading level={2}>Active customers</Heading>
              <Text type="supporting" color="secondary">
                Customers with at least one event per week
              </Text>
            </VStack>
            {!hasTrend ? (
              <EmptyState title="No activity in this window" isCompact />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={data.trend}
                  margin={{ top: 5, right: 12, left: 0, bottom: 5 }}
                >
                  <CartesianGrid horizontal vertical={false} stroke={GRID_STROKE} />
                  <XAxis
                    dataKey="week"
                    tickFormatter={shortWeek}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: GRID_STROKE }}
                    labelFormatter={(v) => `Week of ${shortWeek(String(v))}`}
                    contentStyle={{
                      background: "var(--color-surface, #fff)",
                      border: `1px solid ${GRID_STROKE}`,
                      borderRadius: 8,
                      color: "var(--color-text-primary, #1c2b33)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="activeCustomers"
                    name="Active customers"
                    stroke="var(--color-data-categorical-blue, #0171E3)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </VStack>
        </Card>
      </Grid>

      {/* Funnel — customers at each stage */}
      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <VStack gap={0}>
            <Heading level={2}>Engagement funnel</Heading>
            <Text type="supporting" color="secondary">
              Distinct customers at each stage · {segmentLabel} · {window}
            </Text>
          </VStack>
          {data.funnel[0]?.customers === 0 ? (
            <EmptyState title="No customers in this window" isCompact />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.funnel}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                barCategoryGap={10}
              >
                <CartesianGrid horizontal={false} vertical stroke={GRID_STROKE} />
                <XAxis
                  type="number"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={130}
                />
                <Tooltip
                  cursor={{ fill: GRID_STROKE }}
                  contentStyle={{
                    background: "var(--color-surface, #fff)",
                    border: `1px solid ${GRID_STROKE}`,
                    borderRadius: 8,
                    color: "var(--color-text-primary, #1c2b33)",
                  }}
                  formatter={(v, _n, item) => {
                    const stage = item?.payload as
                      | { stepPct?: number | null }
                      | undefined;
                    const step =
                      stage && stage.stepPct != null
                        ? ` (${Number(stage.stepPct).toFixed(0)}% of previous)`
                        : "";
                    return [
                      `${Number(v ?? 0).toLocaleString()}${step}`,
                      "Customers",
                    ];
                  }}
                />
                <Bar
                  dataKey="customers"
                  fill="var(--color-data-categorical-blue, #0171E3)"
                  radius={4}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
