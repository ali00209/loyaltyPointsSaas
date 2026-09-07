"use client";

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
import { useDashboard } from "@/lib/query";
import AppLoading from "@/components/AppLoading";
import * as stylex from "@stylexjs/stylex";
import { durationVars, easeVars } from "@astryxdesign/core";

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
