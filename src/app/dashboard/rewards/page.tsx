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
import { Table, proportional } from "@astryxdesign/core/Table";
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
import type { RedemptionReward, RewardInput, DiscountDetails } from "@/types";

function discountLabel(details: DiscountDetails): string {
  if (details.discountType === "percent" && details.percent != null) {
    return `${details.percent}% off`;
  }
  if (details.discountType === "fixed" && details.amount != null) {
    return `$${details.amount} off`;
  }
  return "Discount";
}

interface RewardForm {
  name: string;
  pointsCost: number | null;
  discountType: "fixed" | "percent";
  discountValue: number | null;
  inventoryLimit: number | null;
  description: string;
}

const defaultForm: RewardForm = {
  name: "",
  pointsCost: null,
  discountType: "fixed",
  discountValue: null,
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
    const d = (r.details ?? {}) as DiscountDetails;
    setEditing(r);
    setForm({
      name: r.name,
      pointsCost: r.pointsCost,
      discountType: d.discountType ?? "fixed",
      discountValue: d.amount ?? d.percent ?? null,
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
        discountType: form.discountType,
        discountValue: form.discountValue ?? undefined,
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
        description="Create discount rewards customers can redeem with their points"
        showButton={true}
        onClick={openCreate}
        showSearch={false}
        showFilter={false}
      />

      {rewards.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No rewards defined"
            description="Create discount rewards your customers can redeem points for"
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
                  <Text type="supporting" color="secondary" maxLines={1}>
                    {discountLabel((r.details ?? {}) as DiscountDetails)}
                    {r.details?.description
                      ? ` · ${String(r.details.description)}`
                      : ""}
                  </Text>
                </VStack>
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
                    variant="primary"
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
            placeholder="e.g. 10% Off Discount"
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
              label="Discount Type"
              options={[
                { value: "fixed", label: "Fixed Amount ($)" },
                { value: "percent", label: "Percentage (%)" },
              ]}
              value={form.discountType}
              onChange={(v) => setForm({ ...form, discountType: v as "fixed" | "percent" })}
            />
          </HStack>
          <NumberInput
            label={form.discountType === "fixed" ? "Discount Amount ($)" : "Discount Percentage (%)"}
            value={form.discountValue}
            onChange={(v) => setForm({ ...form, discountValue: v })}
            min={1}
            isOptional
          />
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
