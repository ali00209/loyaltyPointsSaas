"use client";

import { Building2, ShieldCheck, Users, ArrowLeftRight, Star } from "lucide-react";
import { VStack } from "@astryxdesign/core/Layout";
import { Grid } from "@astryxdesign/core/Grid";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { HStack } from "@astryxdesign/core/Layout";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import AppLoading from "@/components/AppLoading";
import { useAdminOverview } from "@/lib/query";

const statTiles = [
  {
    icon: <Icon icon={Building2} size="lg" />,
    tint: "bg-(--color-background-blue) text-(--color-icon-blue)",
  },
  {
    icon: <Icon icon={ShieldCheck} size="lg" />,
    tint: "bg-(--color-background-yellow) text-(--color-icon-yellow)",
  },
  {
    icon: <Icon icon={Users} size="lg" />,
    tint: "bg-(--color-background-green) text-(--color-icon-green)",
  },
  {
    icon: <Icon icon={ArrowLeftRight} size="lg" />,
    tint: "bg-(--color-background-purple) text-(--color-icon-purple)",
  },
  {
    icon: <Icon icon={Star} size="lg" />,
    tint: "bg-(--color-background-red) text-(--color-icon-red)",
  },
];

export default function AdminOverviewPage() {
  const { data, isLoading } = useAdminOverview();

  if (isLoading) {
    return <AppLoading label="Loading overview..." />;
  }

  if (!data) {
    return <EmptyState title="Failed to load overview" isCompact />;
  }

  const stats = [
    { label: "Total Tenants", value: data.totalTenants.toLocaleString() },
    { label: "Active Tenants", value: data.activeTenants.toLocaleString() },
    { label: "Total Rules", value: data.totalRules.toLocaleString() },
    { label: "Total Customers", value: data.totalCustomers.toLocaleString() },
    {
      label: "Points in Circulation",
      value: data.pointsInCirculation.toLocaleString(),
    },
  ];

  return (
    <VStack gap={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>Overview</Heading>
        <Text type="body" color="secondary">
          Platform-wide summary of tenants, rules and loyalty activity
        </Text>
      </VStack>

      <Grid columns={{ minWidth: 220, repeat: "fit", max: 5 }} gap={4}>
        {stats.map((stat, i) => (
          <Card key={stat.label} padding={5}>
            <VStack gap={3} hAlign="stretch">
              <HStack
                width={40}
                height={40}
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
            </VStack>
          </Card>
        ))}
      </Grid>

      <Grid columns={{ minWidth: 260, repeat: "fit", max: 2 }} gap={4}>
        <Card padding={6}>
          <VStack gap={1} hAlign="stretch">
            <Text type="supporting" color="secondary">
              Total Transactions
            </Text>
            <Text type="body" size="xl" weight="bold" hasTabularNumbers>
              {data.totalTransactions.toLocaleString()}
            </Text>
          </VStack>
        </Card>
      </Grid>
    </VStack>
  );
}
