"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
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
  useAdminRules,
  useAdminTenants,
  useCreateAdminRule,
  useUpdateAdminRule,
  useDeleteAdminRule,
  useAssignRule,
} from "@/lib/query";
import type { EarningRule, EarningRuleInput, TriggerType } from "@/types";

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

const TRIGGER_TYPES = [
  { value: "flat_rate", label: "Flat Rate" },
  { value: "per_product", label: "Per Product" },
  { value: "price_range", label: "Price Range" },
  { value: "bulk_quantity", label: "Bulk Quantity" },
];

interface RuleForm {
  name: string;
  description: string;
  triggerType: string;
  pointsPerUnit: number | null;
  productId: string;
  minPrice: number | null;
  maxPrice: number | null;
  minQuantity: number | null;
  pointsExpireAfterDays: number | null;
  active: boolean;
}

const defaultForm: RuleForm = {
  name: "",
  description: "",
  triggerType: "flat_rate",
  pointsPerUnit: null,
  productId: "",
  minPrice: null,
  maxPrice: null,
  minQuantity: null,
  pointsExpireAfterDays: null,
  active: true,
};

export default function AdminRulesPage() {
  const { data: rules = [], isLoading } = useAdminRules();
  const { data: tenants = [] } = useAdminTenants();
  const createMutation = useCreateAdminRule();
  const updateMutation = useUpdateAdminRule();
  const deleteMutation = useDeleteAdminRule();
  const assignMutation = useAssignRule();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EarningRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigningRule, setAssigningRule] = useState<EarningRule | null>(null);
  const [assignTenantId, setAssignTenantId] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleForm>(defaultForm);
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const openEdit = (r: EarningRule) => {
    setEditing(r);
    setForm({
      name: r.name,
      description: r.description || "",
      triggerType: r.triggerType,
      pointsPerUnit: r.pointsFormula.pointsPerUnit,
      productId: r.conditions.productId || "",
      minPrice: r.conditions.minPrice ?? null,
      maxPrice: r.conditions.maxPrice ?? null,
      minQuantity: r.conditions.minQuantity ?? null,
      pointsExpireAfterDays: r.pointsExpireAfterDays,
      active: r.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: EarningRuleInput = {
        name: form.name,
        description: form.description || undefined,
        triggerType: form.triggerType as TriggerType,
        pointsPerUnit: form.pointsPerUnit ?? 0,
        productId: form.productId || null,
        minPrice: form.minPrice,
        maxPrice: form.maxPrice,
        minQuantity: form.minQuantity,
        pointsExpireAfterDays: form.pointsExpireAfterDays,
        active: form.active,
      };
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        showToast({ type: "info", body: "Rule updated" });
      } else {
        await createMutation.mutateAsync(payload);
        showToast({ type: "info", body: "Rule created" });
      }
      setShowForm(false);
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to save rule",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: EarningRule) => {
    alert.show({
      title: "Delete rule?",
      description: `"${r.name}" will be removed from all tenants. This cannot be undone.`,
      actionLabel: "Delete",
      isActionLoading: deletingId === r.id,
      onAction: async () => {
        setDeletingId(r.id);
        try {
          await deleteMutation.mutateAsync(r.id);
          showToast({ type: "info", body: "Rule deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete rule" });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleAssign = async () => {
    if (!assigningRule || !assignTenantId) return;
    setSaving(true);
    try {
      await assignMutation.mutateAsync({
        ruleId: assigningRule.id,
        tenantId: assignTenantId,
      });
      showToast({ type: "info", body: "Rule assigned" });
      setAssigningRule(null);
      setAssignTenantId("");
    } catch {
      showToast({ type: "error", body: "Failed to assign rule" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <AppLoading label="Loading rules..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Rules"
        description="Author earning rules and assign them to tenants"
        showButton={true}
        onClick={openCreate}
        showSearch={false}
        showFilter={false}
      />

      {rules.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No rules yet"
            description="Create earning rules and assign them to tenants"
            icon={<Icon icon={ShieldCheck} size="lg" />}
            actions={
              <Button
                label="Create Your First Rule"
                variant="primary"
                onClick={openCreate}
              />
            }
          />
        </Card>
      ) : (
        <Table
          data={rules}
          idKey="id"
          hasHover
          textOverflow="truncate"
          columns={[
            {
              key: "name",
              header: "Rule",
              renderCell: (r: EarningRule) => (
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
              renderCell: (r: EarningRule) => (
                <Badge
                  variant={triggerTypeBadge[r.triggerType] || "neutral"}
                  label={triggerTypeLabels[r.triggerType] || r.triggerType}
                />
              ),
            },
            {
              key: "reward",
              header: "Reward",
              renderCell: (r: EarningRule) => (
                <Text type="body" weight="medium" hasTabularNumbers>
                  {r.pointsFormula.pointsPerUnit} pts/unit
                </Text>
              ),
            },
            {
              key: "expiry",
              header: "Expiry",
              renderCell: (r: EarningRule) => (
                <Text type="body" color="secondary">
                  {r.pointsExpireAfterDays
                    ? `${r.pointsExpireAfterDays} days`
                    : "Never"}
                </Text>
              ),
            },
            {
              key: "assignedCount",
              header: "Assigned",
              renderCell: (r: EarningRule) => (
                <Text type="body" hasTabularNumbers>
                  {r.assignedCount ?? 0}
                </Text>
              ),
            },
            {
              key: "active",
              header: "Status",
              renderCell: (r: EarningRule) => (
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
                        body: "Failed to update rule status",
                      });
                    }
                  }}
                />
              ),
            },
            {
              key: "actions",
              header: "Actions",
              width: proportional(2),
              align: "center",
              renderCell: (r: EarningRule) => (
                <HStack gap={1} hAlign="center">
                  <Button
                    label="Assign"
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setAssigningRule(r);
                      setAssignTenantId("");
                    }}
                  />
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

      {/* Create / Edit rule */}
      <Dialog
        isOpen={showForm}
        onOpenChange={setShowForm}
        purpose="form"
        width={520}
      >
        <DialogHeader
          title={editing ? "Edit Rule" : "New Rule"}
          onOpenChange={setShowForm}
        />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Rule Name"
            placeholder="e.g. $1 = 10 points"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <TextInput
            label="Description"
            placeholder="What does this rule reward?"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            isOptional
          />
          <Selector
            label="Trigger Type"
            options={TRIGGER_TYPES}
            value={form.triggerType}
            onChange={(v) => setForm({ ...form, triggerType: v })}
          />

          {form.triggerType === "per_product" && (
            <TextInput
              label="Product ID (optional — leave empty for any product)"
              placeholder="Leave empty for any product"
              value={form.productId}
              onChange={(v) => setForm({ ...form, productId: v })}
              isOptional
            />
          )}

          {form.triggerType === "price_range" && (
            <HStack gap={3}>
              <NumberInput
                label="Min Price ($)"
                min={0}
                step={0.01}
                isOptional
                hasClear
                width="100%"
                value={form.minPrice}
                onChange={(v) => setForm({ ...form, minPrice: v })}
              />
              <NumberInput
                label="Max Price ($)"
                min={0}
                step={0.01}
                isOptional
                hasClear
                width="100%"
                value={form.maxPrice}
                onChange={(v) => setForm({ ...form, maxPrice: v })}
              />
            </HStack>
          )}

          {form.triggerType === "bulk_quantity" && (
            <NumberInput
              label="Minimum Quantity"
              min={1}
              isIntegerOnly
              isRequired
              value={form.minQuantity}
              onChange={(v) => setForm({ ...form, minQuantity: v })}
            />
          )}

          <HStack gap={3}>
            <NumberInput
              label="Points per Unit"
              min={0.01}
              step={0.01}
              isRequired
              width="100%"
              value={form.pointsPerUnit}
              onChange={(v) => setForm({ ...form, pointsPerUnit: v })}
            />
            <NumberInput
              label="Expire After (days)"
              min={1}
              isIntegerOnly
              isOptional
              hasClear
              width="100%"
              value={form.pointsExpireAfterDays}
              onChange={(v) => setForm({ ...form, pointsExpireAfterDays: v })}
            />
          </HStack>
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
            isDisabled={
              !form.name ||
              form.pointsPerUnit == null ||
              (form.triggerType === "bulk_quantity" && form.minQuantity == null)
            }
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {/* Assign rule */}
      <Dialog
        isOpen={Boolean(assigningRule)}
        onOpenChange={(open) => {
          if (!open) setAssigningRule(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title={`Assign "${assigningRule?.name || ""}"`}
          onOpenChange={() => setAssigningRule(null)}
        />
        <VStack gap={3} hAlign="stretch">
          <Selector
            label="Tenant"
            placeholder="Select a tenant"
            isRequired
            options={tenants
              .filter((t) => !t.suspended)
              .map((t) => ({ value: t.id, label: t.name }))}
            value={assignTenantId}
            onChange={setAssignTenantId}
          />
          {assigningRule && (
            <Text type="supporting" color="secondary">
              Tenants see this rule as read-only and can only turn it on or off.
            </Text>
          )}
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setAssigningRule(null)}
            width="100%"
          />
          <Button
            label="Assign"
            variant="primary"
            isLoading={saving}
            isDisabled={!assignTenantId}
            onClick={handleAssign}
            width="100%"
          />
        </HStack>
      </Dialog>

      {alert.element}
    </VStack>
  );
}
