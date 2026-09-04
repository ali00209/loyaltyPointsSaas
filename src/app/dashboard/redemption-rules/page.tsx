"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogHeader,
  EmptyState,
  FormLayout,
  HStack,
  Icon,
  NumberInput,
  Selector,
  Switch,
  Table,
  Text,
  TextInput,
  VStack,
  proportional,
} from "@astryxdesign/core";
import { Percent, ShieldCheck } from "lucide-react";
import QueryBuilder from "react-querybuilder";
import type { Field, RuleGroupType } from "react-querybuilder";
import { AppQueryBuilderElements } from "@/components/AppQueryBuilder";
import AppHeader from "@/components/AppHeader";
import AppLoading from "@/components/AppLoading";
import { useToast } from "@astryxdesign/core/Toast";
import {
  useCreateRedemptionRule,
  useDeleteRedemptionRule,
  useRedemptionRules,
  useUpdateRedemptionRule,
} from "@/lib/query";
import type { RedemptionRule, RedemptionRuleInput } from "@/types";
import { formatPKR } from "@/lib/money";

const fields: Field[] = [
  { name: "orderAmount", label: "Order amount (PKR)", type: "number" },
  { name: "itemQuantity", label: "Item quantity", type: "number" },
  { name: "itemCount", label: "Item count", type: "number" },
  { name: "pointsBalance", label: "Points balance", type: "number" },
  { name: "productCategory", label: "Product category", type: "text" },
  { name: "productCategories", label: "Product categories", type: "text" },
  { name: "productId", label: "Product", type: "text" },
  { name: "productIds", label: "Products", type: "text" },
  { name: "quantity", label: "Line quantity", type: "number" },
];

type Form = Omit<RedemptionRuleInput, "conditions"> & {
  conditions: RuleGroupType;
};
const emptyConditions: RuleGroupType = { combinator: "and", rules: [] };
const defaultForm: Form = {
  name: "",
  description: "",
  redemptionMode: "fixed",
  discountType: "fixed",
  discountValue: 5,
  pointsCost: 100,
  priority: 0,
  conditions: emptyConditions,
  active: true,
  perCustomerLimit: null,
  tenantUsageLimit: null,
};

export default function RedemptionRulesPage() {
  const { data: rules = [], isLoading } = useRedemptionRules();
  const create = useCreateRedemptionRule();
  const update = useUpdateRedemptionRule();
  const remove = useDeleteRedemptionRule();
  const [form, setForm] = useState<Form>(defaultForm);
  const [editing, setEditing] = useState<RedemptionRule | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const openCreate = () => {
    setEditing(null);
    setForm({ ...defaultForm, conditions: emptyConditions });
    setOpen(true);
  };
  const openEdit = (rule: RedemptionRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      redemptionMode: rule.redemptionMode,
      discountType: rule.discountType,
      discountValue: Number(rule.discountValue),
      pointsCost: rule.pointsCost,
      priority: rule.priority,
      conditions: rule.conditions,
      active: rule.active,
      perCustomerLimit: rule.perCustomerLimit,
      tenantUsageLimit: rule.tenantUsageLimit,
    });
    setOpen(true);
  };
  const save = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: form });
      else await create.mutateAsync(form);
      setOpen(false);
      toast({
        type: "info",
        body: editing ? "Redemption rule updated" : "Redemption rule created",
      });
    } catch {
      toast({ type: "error", body: "Unable to save redemption rule" });
    }
  };

  if (isLoading) return <AppLoading label="Loading redemption rules..." />;
  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Redemption Rules"
        description="Automatically apply one points-funded discount at checkout"
        showButton
        onClick={openCreate}
        showSearch={false}
        showFilter={false}
      />
      <Table
        data={rules}
        idKey="id"
        hasHover
        emptyState={
          <EmptyState
            title="No redemption rules"
            description="Create a fixed or percentage discount for merchant checkout callbacks."
            icon={<Icon icon={ShieldCheck} size="lg" />}
            actions={
              <Button
                label="Create your first rule"
                variant="primary"
                onClick={openCreate}
              />
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Rule",
            width: proportional(1.6),
            renderCell: (rule: RedemptionRule) => (
              <VStack gap={0} hAlign="stretch">
                <Text type="body" weight="medium">
                  {rule.name}
                </Text>
                <Text type="supporting" color="secondary">
                  {rule.discountType === "percent"
                    ? `${rule.discountValue}% off`
                    : rule.redemptionMode === "per_point"
                      ? `${formatPKR(rule.discountValue)} per point`
                      : `${formatPKR(rule.discountValue)} off`}
                </Text>
              </VStack>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            renderCell: (rule: RedemptionRule) => (
              <Text type="body">{rule.priority}</Text>
            ),
          },
          {
            key: "cost",
            header: "Points",
            renderCell: (rule: RedemptionRule) => (
              <Text type="body">{rule.pointsCost.toLocaleString()}</Text>
            ),
          },
          {
            key: "usage",
            header: "Usage",
            renderCell: (rule: RedemptionRule) => (
              <Text type="body">{rule.usageCount.toLocaleString()}</Text>
            ),
          },
          {
            key: "status",
            header: "Status",
            renderCell: (rule: RedemptionRule) => (
              <Switch
                label={`${rule.name} status`}
                isLabelHidden
                value={rule.active}
                changeAction={(active) =>
                  update.mutate({ id: rule.id, input: { active } })
                }
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            renderCell: (rule: RedemptionRule) => (
              <HStack gap={1}>
                <Button
                  label="Edit"
                  size="sm"
                  variant="primary"
                  onClick={() => openEdit(rule)}
                />
                <Button
                  label="Delete"
                  size="sm"
                  variant="destructive"
                  onClick={() => remove.mutate(rule.id)}
                />
              </HStack>
            ),
          },
        ]}
      />
      <Dialog isOpen={open} onOpenChange={setOpen} purpose="form" width={"40%"}>
        <DialogHeader
          title={editing ? "Edit Redemption Rule" : "New Redemption Rule"}
          onOpenChange={setOpen}
        />
        <FormLayout>
          <TextInput
            label="Rule name"
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            isRequired
          />
          <TextInput
            label="Description"
            value={form.description ?? ""}
            onChange={(description) => setForm({ ...form, description })}
            isOptional
          />
          <FormLayout direction="horizontal">
            <Selector
              label="Redemption"
              options={[
                { value: "fixed", label: "Fixed points" },
                { value: "per_point", label: "Per-point conversion" },
              ]}
              value={form.redemptionMode}
              onChange={(redemptionMode) =>
                setForm({
                  ...form,
                  redemptionMode: redemptionMode as Form["redemptionMode"],
                  discountType: "fixed",
                })
              }
            />
            <Selector
              label="Discount"
              options={
                form.redemptionMode === "per_point"
                  ? [{ value: "fixed", label: "Fixed PKR per point" }]
                  : [
                      { value: "fixed", label: "Fixed amount" },
                      { value: "percent", label: "Percentage" },
                    ]
              }
              value={form.discountType}
              onChange={(discountType) =>
                setForm({
                  ...form,
                  discountType: discountType as Form["discountType"],
                })
              }
            />
          </FormLayout>
          <FormLayout direction="horizontal">
            <NumberInput
              label={form.discountType === "percent" ? "Percent" : "Amount"}
              value={form.discountValue}
              onChange={(discountValue) =>
                setForm({ ...form, discountValue: discountValue ?? 0 })
              }
              min={0.01}
            />
            {form.redemptionMode === "fixed" && (
              <NumberInput
                label="Points cost"
                value={form.pointsCost}
                onChange={(pointsCost) =>
                  setForm({ ...form, pointsCost: pointsCost ?? 0 })
                }
                min={1}
                isIntegerOnly
              />
            )}
          </FormLayout>
          {form.redemptionMode === "per_point" && (
            <Text type="supporting" color="secondary">
              The customer redeems as many points as needed for the eligible
              order, limited by their balance. For example, PKR 0.50 means 100
              points gives PKR 50.00 off.
            </Text>
          )}
          <FormLayout direction="horizontal">
            <NumberInput
              label="Priority"
              value={form.priority}
              onChange={(priority) =>
                setForm({ ...form, priority: priority ?? 0 })
              }
              isIntegerOnly
            />
            <NumberInput
              label="Per-customer limit"
              value={form.perCustomerLimit}
              onChange={(perCustomerLimit) =>
                setForm({ ...form, perCustomerLimit })
              }
              isOptional
              hasClear
              isIntegerOnly
              min={1}
            />
            <NumberInput
              label="Tenant limit"
              value={form.tenantUsageLimit}
              onChange={(tenantUsageLimit) =>
                setForm({ ...form, tenantUsageLimit })
              }
              isOptional
              hasClear
              isIntegerOnly
              min={1}
            />
          </FormLayout>
          <Text type="supporting" color="secondary">
            Conditions are evaluated against the safe checkout facts. Product
            conditions apply the benefit once to the matching subtotal.
          </Text>
          <QueryBuilder
            query={form.conditions}
            onQueryChange={(conditions) => setForm({ ...form, conditions })}
            fields={fields}
            controlElements={AppQueryBuilderElements}
          />
        </FormLayout>
        <HStack gap={3} style={{ marginTop: 16 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setOpen(false)}
            width="100%"
          />
          <Button
            label={editing ? "Update" : "Create"}
            variant="primary"
            onClick={save}
            isLoading={create.isPending || update.isPending}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
