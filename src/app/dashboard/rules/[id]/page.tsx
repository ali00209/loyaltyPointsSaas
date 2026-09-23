"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Switch } from "@astryxdesign/core/Switch";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import AppLoading from "@/components/AppLoading";
import {
  useRules,
  useToggleRule,
  useDeleteRule,
} from "@/lib/query";
import { eventLabel, type EventType, type FormulaGroup, type RuleGroupType } from "@/lib/rules";
import type { EarningRule } from "@/types";

function eventTypeBadgeColor(
  t: string,
): "blue" | "green" | "yellow" | "purple" | "teal" | "orange" {
  const m: Record<string, "blue" | "green" | "yellow" | "purple" | "teal" | "orange"> = {
    purchase: "blue",
    visit: "teal",
    review: "purple",
    referral: "teal",
    newsletter_signup: "yellow",
    social_share: "orange",
    customer_signup: "green",
  };
  return m[t] || "blue";
}

function formatConditions(conditions: RuleGroupType): string {
  if (!conditions.rules || conditions.rules.length === 0) return "All events (no conditions)";
  const parts = conditions.rules.map((r) => {
    if ("combinator" in r) return `(${formatConditions(r)})`;
    const rule = r as { field: string; operator: string; value: unknown };
    return `${rule.field} ${rule.operator} ${JSON.stringify(rule.value)}`;
  });
  return parts.join(` ${conditions.combinator.toUpperCase()} `);
}

function FormulaGroupCard({ group, index }: { group: FormulaGroup; index: number }) {
  const formula = group.formula;
  const formulaSummary =
    formula.type === "flat"
      ? `${formula.flatAmount} pts (flat)`
      : `${formula.rate}% of ${formula.basis || "?"}`;

  return (
    <Card padding={4}>
      <VStack gap={3} hAlign="stretch">
        <HStack gap={2} vAlign="center">
          <Badge variant="blue" label={`Group ${index + 1}`} />
          <Text type="body" weight="bold">
            {formulaSummary}
          </Text>
        </HStack>
        <VStack gap={1} hAlign="stretch">
          <Text type="label" weight="bold">Conditions</Text>
          <Text type="body" color="secondary">
            {formatConditions(group.conditions)}
          </Text>
        </VStack>
        <HStack gap={4}>
          <VStack gap={0} hAlign="stretch">
            <Text type="label">Rounding</Text>
            <Text type="body" color="secondary">{formula.rounding}</Text>
          </VStack>
          {formula.minPoints != null && (
            <VStack gap={0} hAlign="stretch">
              <Text type="label">Min points</Text>
              <Text type="body" color="secondary">{formula.minPoints}</Text>
            </VStack>
          )}
          {formula.maxPoints != null && (
            <VStack gap={0} hAlign="stretch">
              <Text type="label">Max points</Text>
              <Text type="body" color="secondary">{formula.maxPoints}</Text>
            </VStack>
          )}
        </HStack>
      </VStack>
    </Card>
  );
}

export default function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const { data: rules = [], isLoading } = useRules();
  const toggleMutation = useToggleRule();
  const deleteMutation = useDeleteRule();

  const rule = useMemo(
    () => rules.find((r) => r.id === id) ?? null,
    [rules, id],
  );

  const handleDelete = (r: EarningRule) => {
    alert.show({
      title: "Delete rule?",
      description: `This will permanently delete "${r.name}". Points already earned are not affected.`,
      actionLabel: "Delete",
      onAction: async () => {
        try {
          await deleteMutation.mutateAsync(r.id);
          showToast({ type: "info", body: "Rule deleted" });
          alert.hide();
          router.push("/dashboard/rules");
        } catch {
          showToast({ type: "error", body: "Failed to delete rule" });
        }
      },
    });
  };

  if (isLoading) return <AppLoading label="Loading rule..." />;

  if (!rule) {
    return (
      <VStack gap={6} hAlign="stretch">
        <Button
          label="Back to rules"
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size="1em" />}
          onClick={() => router.push("/dashboard/rules")}
        />
        <Card padding={8}>
          <EmptyState
            title="Rule not found"
            description="This rule may have been deleted."
            icon={<Icon icon={ShieldCheck} size="lg" />}
            actions={
              <Button
                label="Back to rules"
                variant="primary"
                onClick={() => router.push("/dashboard/rules")}
              />
            }
          />
        </Card>
      </VStack>
    );
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <HStack gap={3} vAlign="center">
        <Button
          label="Back"
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size="1em" />}
          onClick={() => router.push("/dashboard/rules")}
        />
        <VStack gap={0} hAlign="stretch" style={{ flex: 1 }}>
          <Heading level={2}>{rule.name}</Heading>
          {rule.description && (
            <Text type="supporting" color="secondary">
              {rule.description}
            </Text>
          )}
        </VStack>
        <HStack gap={2}>
          <Button
            label="Edit"
            variant="primary"
            size="sm"
            icon={<Pencil size="1em" />}
            onClick={() => router.push(`/dashboard/rules/form?edit=${rule.id}`)}
          />
          <Button
            label="Delete"
            variant="destructive"
            size="sm"
            icon={<Trash2 size="1em" />}
            onClick={() => handleDelete(rule)}
          />
        </HStack>
      </HStack>

      <HStack gap={4} wrap="wrap">
        <Badge variant={eventTypeBadgeColor(rule.eventType)} label={eventLabel(rule.eventType)} />
        <Badge variant={rule.active ? "green" : "neutral"} label={rule.active ? "Active" : "Inactive"} />
        {rule.perItem && <Badge variant="purple" label="Per line item" />}
      </HStack>

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={3}>Configuration</Heading>
          <HStack gap={6} wrap="wrap">
            <VStack gap={0} hAlign="stretch">
              <Text type="label">Event type</Text>
              <Text type="body">{eventLabel(rule.eventType)}</Text>
            </VStack>
            <VStack gap={0} hAlign="stretch">
              <Text type="label">Evaluation</Text>
              <Text type="body">{rule.perItem ? "Per line item" : "Per order"}</Text>
            </VStack>
            <VStack gap={0} hAlign="stretch">
              <Text type="label">Points expiry</Text>
              <Text type="body">
                {rule.pointsExpireAfterDays
                  ? `${rule.pointsExpireAfterDays} days`
                  : "Never"}
              </Text>
            </VStack>
            {rule.activeFrom && (
              <VStack gap={0} hAlign="stretch">
                <Text type="label">Active from</Text>
                <Text type="body">
                  {new Date(rule.activeFrom).toLocaleDateString()}
                </Text>
              </VStack>
            )}
            {rule.activeUntil && (
              <VStack gap={0} hAlign="stretch">
                <Text type="label">Active until</Text>
                <Text type="body">
                  {new Date(rule.activeUntil).toLocaleDateString()}
                </Text>
              </VStack>
            )}
          </HStack>

          <HStack gap={3} vAlign="center">
            <Text type="label">Status</Text>
            <Switch
              label="Active"
              value={rule.active}
              changeAction={(v: boolean) =>
                toggleMutation.mutate({ id: rule.id, active: v })
              }
            />
          </HStack>
        </VStack>
      </Card>

      <VStack gap={3} hAlign="stretch">
        <Heading level={3}>
          Formula groups ({rule.formulaGroups?.length ?? 0})
        </Heading>
        {rule.formulaGroups && rule.formulaGroups.length > 0 ? (
          rule.formulaGroups.map((group, i) => (
            <FormulaGroupCard key={i} group={group} index={i} />
          ))
        ) : (
          <Card padding={6}>
            <EmptyState
              title="No formula groups"
              description="This rule has no formula groups configured."
              isCompact
            />
          </Card>
        )}
      </VStack>

      <HStack gap={4}>
        <VStack gap={0} hAlign="stretch">
          <Text type="label">Created</Text>
          <Text type="supporting" color="secondary">
            {new Date(rule.createdAt).toLocaleString()}
          </Text>
        </VStack>
        <VStack gap={0} hAlign="stretch">
          <Text type="label">Last updated</Text>
          <Text type="supporting" color="secondary">
            {new Date(rule.updatedAt).toLocaleString()}
          </Text>
        </VStack>
      </HStack>

      {alert.element}
    </VStack>
  );
}
