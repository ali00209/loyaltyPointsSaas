"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Switch } from "@astryxdesign/core/Switch";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useRewards,
  useCreateReward,
  useUpdateReward,
  useDeleteReward,
} from "@/lib/query";
import type { RedemptionReward, RewardInput, RewardType } from "@/types";

const rewardTypeLabels: Record<string, string> = {
  discount: "Discount",
  gift_card: "Gift Card",
  physical_item: "Physical Item",
  store_credit: "Store Credit",
};

const rewardTypeBadge: Record<string, "blue" | "green" | "yellow" | "purple"> =
  {
    discount: "blue",
    gift_card: "yellow",
    physical_item: "purple",
    store_credit: "green",
  };

const REWARD_TYPES: Array<{ value: string; label: string }> = [
  { value: "discount", label: "Discount" },
  { value: "gift_card", label: "Gift Card" },
  { value: "physical_item", label: "Physical Item" },
  { value: "store_credit", label: "Store Credit" },
];

interface RewardForm {
  name: string;
  pointsCost: number | null;
  rewardType: string;
  inventoryLimit: number | null;
  description: string;
}

const defaultForm: RewardForm = {
  name: "",
  pointsCost: null,
  rewardType: "discount",
  inventoryLimit: null,
  description: "",
};

export default function RewardsPage() {
  const { data: rewards = [], isLoading } = useRewards();
  const createMutation = useCreateReward();
  const updateMutation = useUpdateReward();
  const deleteMutation = useDeleteReward();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RedemptionReward | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<RewardForm>(defaultForm);
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (r: RedemptionReward) => {
    setEditing(r);
    setForm({
      name: r.name,
      pointsCost: r.pointsCost,
      rewardType: r.rewardType,
      inventoryLimit: r.inventoryLimit,
      description: (r.details?.description as string | undefined) || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: RewardInput = {
        name: form.name,
        pointsCost: form.pointsCost ?? 0,
        rewardType: form.rewardType as RewardType,
        inventoryLimit: form.inventoryLimit,
        description: form.description || undefined,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        showToast({ type: "info", body: "Reward updated" });
      } else {
        await createMutation.mutateAsync(payload);
        showToast({ type: "info", body: "Reward created" });
      }
      setShowForm(false);
    } catch {
      showToast({ type: "error", body: "Failed to save reward" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: RedemptionReward) => {
    alert.show({
      title: "Delete reward?",
      description: `"${r.name}" will be permanently deleted. This action cannot be undone.`,
      actionLabel: "Delete",
      isActionLoading: deletingId === r.id,
      onAction: async () => {
        setDeletingId(r.id);
        try {
          await deleteMutation.mutateAsync(r.id);
          showToast({ type: "info", body: "Reward deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete reward" });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  if (isLoading) {
    return <AppLoading label="Loading rewards..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Rewards"
        description="Create rewards customers can redeem with their points"
        showButton={true}
        onClick={openCreate}
        showSearch={false}
        showFilter={false}
      />

      {rewards.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No rewards defined"
            description="Create rewards your customers can redeem points for"
            icon={<Icon icon={Gift} size="lg" />}
            actions={
              <Button
                label="Create Your First Reward"
                variant="primary"
                onClick={openCreate}
              />
            }
          />
        </Card>
      ) : (
        <Table
          data={rewards}
          idKey="id"
          hasHover
          textOverflow="truncate"
          columns={[
            {
              key: "name",
              header: "Reward",
              width: proportional(1.7),
              renderCell: (r: RedemptionReward) => (
                <VStack gap={0} hAlign="stretch">
                  <Text type="body" weight="medium">
                    {r.name}
                  </Text>
                  {r.details?.description ? (
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {String(r.details.description)}
                    </Text>
                  ) : null}
                </VStack>
              ),
            },
            {
              key: "rewardType",
              header: "Type",
              renderCell: (r: RedemptionReward) => (
                <Badge
                  variant={rewardTypeBadge[r.rewardType] || "neutral"}
                  label={rewardTypeLabels[r.rewardType] || r.rewardType}
                />
              ),
            },
            {
              key: "pointsCost",
              header: "Cost",
              renderCell: (r: RedemptionReward) => (
                <Text type="body" weight="medium" hasTabularNumbers>
                  {r.pointsCost.toLocaleString()} pts
                </Text>
              ),
            },
            {
              key: "inventory",
              header: "Inventory",
              renderCell: (r: RedemptionReward) => (
                <Text type="body" color="secondary" hasTabularNumbers>
                  {r.inventoryLimit == null
                    ? "Unlimited"
                    : `${r.redeemedCount} of ${r.inventoryLimit} redeemed`}
                </Text>
              ),
            },
            {
              key: "active",
              header: "Status",
              renderCell: (r: RedemptionReward) => (
                <Switch
                  label={`${r.name} status`}
                  isLabelHidden
                  value={r.active}
                  changeAction={async (checked: boolean) => {
                    try {
                      await updateMutation.mutateAsync({
                        id: r.id,
                        input: { active: checked },
                      });
                    } catch {
                      showToast({
                        type: "error",
                        body: "Failed to update reward status",
                      });
                    }
                  }}
                />
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "center",
              renderCell: (r: RedemptionReward) => (
                <HStack gap={1} hAlign="center">
                  <Button
                    label="Edit"
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(r)}
                  />
                  <Button
                    label="Delete"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(r)}
                  />
                </HStack>
              ),
            },
          ]}
        />
      )}

      <Dialog
        isOpen={showForm}
        onOpenChange={setShowForm}
        purpose="form"
        width={520}
      >
        <DialogHeader
          title={editing ? "Edit Reward" : "New Reward"}
          onOpenChange={setShowForm}
        />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Reward Name"
            placeholder="e.g. Free Large Latte"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <HStack gap={3}>
            <NumberInput
              label="Points Cost"
              value={form.pointsCost}
              onChange={(v) => setForm({ ...form, pointsCost: v })}
              min={1}
              isIntegerOnly
              isRequired
            />
            <Selector
              label="Reward Type"
              options={REWARD_TYPES}
              value={form.rewardType}
              onChange={(v) => setForm({ ...form, rewardType: v })}
            />
          </HStack>
          <NumberInput
            label="Inventory Limit (optional — empty = unlimited)"
            value={form.inventoryLimit}
            onChange={(v) => setForm({ ...form, inventoryLimit: v })}
            min={1}
            isIntegerOnly
            isOptional
            hasClear
          />
          <TextInput
            label="Description"
            placeholder="Brief description..."
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            isOptional
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowForm(false)}
            width="100%"
          />
          <Button
            label={editing ? "Update" : "Create"}
            variant="primary"
            isLoading={saving}
            isDisabled={!form.name || form.pointsCost == null}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {alert.element}
    </VStack>
  );
}
