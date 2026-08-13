"use client";

import { ShieldCheck } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Center } from "@astryxdesign/core/Center";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Switch } from "@astryxdesign/core/Switch";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useToast } from "@astryxdesign/core/Toast";
import AppHeader from "@/components/AppHeader";
import { useRules, useToggleRule } from "@/lib/query";
import type { AssignedRule, TriggerType } from "@/types";

const triggerTypeLabels: Record<string, string> = {
  flat_rate: "Flat Rate",
  per_product: "Per Product",
  price_range: "Price Range",
  bulk_quantity: "Bulk Quantity",
};

const triggerTypeBadge: Record<string, "blue" | "green" | "yellow" | "purple"> =
  {
    flat_rate: "blue",
    per_product: "green",
    price_range: "yellow",
    bulk_quantity: "purple",
  };

function formatCondition(rule: AssignedRule): string {
  const c = rule.conditions;
  if (rule.triggerType === "per_product")
    return c.productId ? rule.productName || "Specific product" : "Any product";
  if (rule.triggerType === "price_range") {
    const min = c.minPrice != null ? `$${c.minPrice}` : "$0";
    const max = c.maxPrice != null ? `$${c.maxPrice}` : "∞";
    return `${min} – ${max}`;
  }
  if (rule.triggerType === "bulk_quantity") return `≥ ${c.minQuantity} qty`;
  return "All orders";
}

function formatExpiry(rule: AssignedRule): string {
  if (!rule.pointsExpireAfterDays) return "Never";
  return `${rule.pointsExpireAfterDays} days`;
}

export default function RulesPage() {
  const { data: rules = [], isLoading } = useRules();
  const toggleRuleMutation = useToggleRule();
  const showToast = useToast();

  if (isLoading) {
    return (
      <Center axis="both" className="min-h-dvh">
        <Spinner size="lg" label="Loading rules..." />
      </Center>
    );
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Rules"
        description="Rules are created by the platform admin and assigned to your program"
        showButton={false}
        onClick={() => undefined}
        showSearch={false}
        showFilter={false}
      />

      <Banner
        status="info"
        title="Want a different rule? Contact the platform admin — rules are managed centrally and can be adjusted to match how you want to reward customers."
        container="card"
      />

      {rules.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No rules assigned yet"
            description="Your program has no earning rules yet. Ask the platform admin to assign rules to your business."
            icon={<Icon icon={ShieldCheck} size="lg" />}
          />
        </Card>
      ) : (
        <Table
          data={rules}
          idKey="assignmentId"
          hasHover
          textOverflow="truncate"
          columns={[
            {
              key: "name",
              header: "Rule",
              width: proportional(1.5),
              renderCell: (r: AssignedRule) => (
                <VStack gap={0} hAlign="stretch">
                  <Text type="body" weight="medium">
                    {r.name}
                  </Text>
                  {r.description && (
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {r.description}
                    </Text>
                  )}
                </VStack>
              ),
            },
            {
              key: "triggerType",
              header: "Type",
              renderCell: (r: AssignedRule) => (
                <Badge
                  variant={
                    triggerTypeBadge[r.triggerType as TriggerType] || "neutral"
                  }
                  label={triggerTypeLabels[r.triggerType] || r.triggerType}
                />
              ),
            },
            {
              key: "scope",
              header: "Condition",
              renderCell: (r: AssignedRule) => (
                <Text type="body" color="secondary">
                  {formatCondition(r)}
                </Text>
              ),
            },
            {
              key: "reward",
              header: "Reward",
              renderCell: (r: AssignedRule) => (
                <Text type="body" weight="medium" hasTabularNumbers>
                  {r.pointsFormula.pointsPerUnit} pts/unit
                </Text>
              ),
            },
            {
              key: "expiry",
              header: "Expiry",
              renderCell: (r: AssignedRule) => (
                <Text type="body" color="secondary">
                  {formatExpiry(r)}
                </Text>
              ),
            },
            {
              key: "active",
              header: "Status",
              renderCell: (r: AssignedRule) => (
                <Switch
                  label={`${r.name} status`}
                  isLabelHidden
                  value={r.assignmentActive}
                  changeAction={async (checked: boolean) => {
                    try {
                      await toggleRuleMutation.mutateAsync({
                        id: r.assignmentId,
                        active: checked,
                      });
                    } catch {
                      showToast({
                        type: "error",
                        body: "Failed to update rule status",
                      });
                    }
                  }}
                />
              ),
            },
          ]}
        />
      )}
    </VStack>
  );
}
