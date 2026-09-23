"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Pencil, Trash2 } from "lucide-react";
import { VStack, HStack, Stack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Switch } from "@astryxdesign/core/Switch";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";
import { useToast } from "@astryxdesign/core/Toast";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { proportional, Table } from "@astryxdesign/core";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import { useRules, useDeleteRule, useToggleRule } from "@/lib/query";
import type { EarningRule } from "@/types";

export default function RulesPage() {
  const router = useRouter();
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const { data: rules = [], isLoading } = useRules();
  const deleteMutation = useDeleteRule();
  const toggleMutation = useToggleRule();

  const [togglingId, setTogglingId] = useState<string | null>(null);

  if (isLoading) {
    return <AppLoading label="Loading rules..." />;
  }

  const handleDelete = (rule: EarningRule) => {
    alert.show({
      title: "Delete rule?",
      description: `This will permanently delete "${rule.name}". Points already earned are not affected.`,
      actionLabel: "Delete",
      onAction: async () => {
        try {
          await deleteMutation.mutateAsync(rule.id);
          showToast({ type: "info", body: "Rule deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete rule" });
        }
      },
    });
  };

  const handleToggle = (item: EarningRule, active: boolean) => {
    setTogglingId(item.id);
    toggleMutation.mutate(
      { id: item.id, active },
      { onSettled: () => setTogglingId(null) },
    );
  };

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Rules"
        description="Create and manage earning rules for your loyalty program"
        showButton={true}
        onClick={() => router.push("/dashboard/rules/form")}
        showSearch={false}
        showFilter={false}
      />

      <Banner
        status="info"
        title="Rules are evaluated in order. The highest-value matching rule wins for each event."
        container="card"
      />

      <Table
        data={rules}
        emptyState={
          <EmptyState
            title="No rules yet"
            description="Create your first earning rule to start awarding points automatically."
            icon={<Icon icon={ShieldCheck} size="lg" />}
            actions={
              <Button
                label="Create rule"
                variant="primary"
                onClick={() => router.push("/dashboard/rules/form")}
              />
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Name",
            renderCell: (item) => (
              <VStack gap={0} hAlign="stretch">
                <Link
                  href={`/dashboard/rules/${item.id}`}
                  className="text-accent font-medium hover:underline"
                >
                  {item.name}
                </Link>
                {item.formulaText && (
                  <Text type="supporting" color="secondary">
                    {item.formulaText}
                  </Text>
                )}
              </VStack>
            ),
          },
          {
            key: "description",
            header: "Description",
            width: proportional(2),
            renderCell: (item) =>
              item.description ? (
                <Text type="supporting" color="secondary">
                  {item.description}
                </Text>
              ) : (
                <Text type="supporting" color="secondary">
                  —
                </Text>
              ),
          },
          {
            key: "pointsExpireAfterDays",
            header: "Expiry",
            renderCell: (item) => (
              <Text type="supporting" color="secondary">
                {item.pointsExpireAfterDays
                  ? `${item.pointsExpireAfterDays} days`
                  : "never"}
              </Text>
            ),
          },
          {
            key: "active",
            header: "Active",
            renderCell: (item) => (
              <Switch
                label="Active"
                isLabelHidden
                value={item.active}
                onChange={(v) => handleToggle(item, v)}
                isLoading={togglingId === item.id}
                isDisabled={togglingId === item.id}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "start",
            renderCell: (item) => (
              <HStack gap={1}>
                <Button
                  label="Edit"
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    router.push(`/dashboard/rules/form?edit=${item.id}`)
                  }
                />
                <Button
                  label="Delete"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(item)}
                />
              </HStack>
            ),
          },
        ]}
      />

      {alert.element}
    </VStack>
  );
}
