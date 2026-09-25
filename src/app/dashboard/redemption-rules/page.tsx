"use client";

import { useState } from "react";
import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  DialogHeader,
  DropdownMenu,
  EmptyState,
  FormLayout,
  HStack,
  Icon,
  NumberInput,
  ScrollableArea,
  Switch,
  Table,
  Text,
  TextInput,
  VStack,
  proportional,
} from "@astryxdesign/core";
import { DateTimeInput, type ISODateTimeString } from "@astryxdesign/core/DateTimeInput";
import { Percent, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import type { RuleGroupType } from "react-querybuilder";
import ConditionSentenceEditor from "@/components/ConditionSentenceEditor";
import {
  renderRedemptionRuleSentence,
  type AuthoringField,
} from "@/lib/ruleSentence";
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

const fields: AuthoringField[] = [
  { name: "orderAmount", label: "Order amount (PKR)", type: "number" },
  { name: "itemQuantity", label: "Item quantity", type: "number" },
  { name: "itemCount", label: "Item count", type: "number" },
  { name: "pointsBalance", label: "Points balance", type: "number" },
  { name: "productCategory", label: "Product category", type: "string" },
  { name: "productCategories", label: "Product categories", type: "string" },
  { name: "productId", label: "Product", type: "string" },
  { name: "productIds", label: "Products", type: "string" },
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
  activeFrom: null,
  activeUntil: null,
  perCustomerLimit: null,
  tenantUsageLimit: null,
};

function isoToInput(
  iso: string | null | undefined,
): ISODateTimeString | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` as ISODateTimeString;
}

export default function RedemptionRulesPage() {
  const fieldLabels = useMemo(
    () => Object.fromEntries(fields.map((f) => [f.name, f.label])),
    [],
  );
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
      activeFrom: rule.activeFrom,
      activeUntil: rule.activeUntil,
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
        <ScrollableArea label="" height={"50vh"}>
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
            <Text type="label" weight="bold">
              Redemption
            </Text>
            <Card>
              <FormLayout
                direction="horizontal"
                style={{
                  alignItems: "center",
                }}
              >
                <DropdownMenu
                  button={{
                    label:
                      form.redemptionMode === "fixed"
                        ? "redeem a fixed point cost"
                        : "redeem at a rate of",
                    variant: "ghost",
                    size: "sm",
                  }}
                  items={[
                    {
                      label: "redeem a fixed point cost",
                      onClick: () =>
                        setForm({
                          ...form,
                          redemptionMode: "fixed",
                          discountType: "fixed",
                        }),
                    },
                    {
                      label: "redeem at a rate of",
                      onClick: () =>
                        setForm({
                          ...form,
                          redemptionMode: "per_point",
                          discountType: "fixed",
                        }),
                    },
                  ]}
                />
                {form.redemptionMode === "fixed" ? (
                  <HStack gap={2} align="center">
                    <NumberInput
                      label="Points to redeem"
                      units={"pts"}
                      isLabelHidden
                      size="sm"
                      value={form.pointsCost}
                      onChange={(pointsCost) =>
                        setForm({ ...form, pointsCost })
                      }
                      min={1}
                      width={"14%"}
                      isIntegerOnly
                    />
                    <Text type="supporting">to get</Text>
                    <NumberInput
                      label="Discount value"
                      units={form.discountType === "percent" ? "%" : "Rs"}
                      isLabelHidden
                      size="sm"
                      value={form.discountValue}
                      onChange={(discountValue) =>
                        setForm({ ...form, discountValue })
                      }
                      min={0.01}
                      width={"10%"}
                    />
                    <DropdownMenu
                      button={{
                        label: form.discountType === "percent" ? "%" : "Rs",
                        variant: "ghost",
                        size: "sm",
                      }}
                      items={[
                        {
                          label: "Rs",
                          onClick: () =>
                            setForm({ ...form, discountType: "fixed" }),
                        },
                        {
                          label: "%",
                          onClick: () =>
                            setForm({ ...form, discountType: "percent" }),
                        },
                      ]}
                    />
                    <Text type="supporting">off an eligible order</Text>
                  </HStack>
                ) : (
                  <NumberInput
                    label="Value per point"
                    units={"Rs off per point"}
                    isLabelHidden
                    size="sm"
                    value={form.discountValue}
                    onChange={(discountValue) =>
                      setForm({ ...form, discountValue })
                    }
                    min={0.001}
                  />
                )}
              </FormLayout>
            </Card>
            {form.redemptionMode === "per_point" && (
              <Banner
                status="info"
                title="Customers redeem as many points as needed for the eligible order,
              limited by their balance. For example, PKR 0.50 means 100 points gives
              PKR 50.00 off."
              />
            )}
            <Text type="label" weight="bold">
              Usage
            </Text>
            <Card width={"fit-content"}>
              <VStack gap={2} align="end">
                <HStack gap={2} align="center">
                  <Text type="supporting">Priority</Text>
                  <NumberInput
                    label="Priority"
                    isLabelHidden
                    size="sm"
                    value={form.priority}
                    onChange={(priority) => setForm({ ...form, priority })}
                    isIntegerOnly
                    width={90}
                  />
                </HStack>
                <HStack>
                  <DropdownMenu
                    button={{
                      label:
                        form.perCustomerLimit == null
                          ? "use it any number of times"
                          : `use it up to ${form.perCustomerLimit} times`,
                      variant: "ghost",
                      size: "sm",
                    }}
                    items={[
                      {
                        label: "use it any number of times",
                        onClick: () =>
                          setForm({ ...form, perCustomerLimit: null }),
                      },
                      {
                        label: "set a per-customer limit",
                        onClick: () =>
                          setForm({
                            ...form,
                            perCustomerLimit: form.perCustomerLimit ?? 1,
                          }),
                      },
                    ]}
                  />
                  {form.perCustomerLimit != null && (
                    <NumberInput
                      label="Per-customer limit"
                      isLabelHidden
                      size="sm"
                      value={form.perCustomerLimit}
                      onChange={(perCustomerLimit) =>
                        setForm({ ...form, perCustomerLimit })
                      }
                      isIntegerOnly
                      min={1}
                      width={90}
                    />
                  )}
                </HStack>
                <HStack>
                  <DropdownMenu
                    button={{
                      label:
                        form.tenantUsageLimit == null
                          ? "unlimited redemptions in total"
                          : `at most ${form.tenantUsageLimit} redemptions in total`,
                      variant: "ghost",
                      size: "sm",
                    }}
                    items={[
                      {
                        label: "unlimited redemptions in total",
                        onClick: () =>
                          setForm({ ...form, tenantUsageLimit: null }),
                      },
                      {
                        label: "set a total limit",
                        onClick: () =>
                          setForm({
                            ...form,
                            tenantUsageLimit: form.tenantUsageLimit ?? 1,
                          }),
                      },
                    ]}
                  />

                  {form.tenantUsageLimit != null && (
                    <NumberInput
                      label="Tenant limit"
                      isLabelHidden
                      size="sm"
                      value={form.tenantUsageLimit}
                      onChange={(tenantUsageLimit) =>
                        setForm({ ...form, tenantUsageLimit })
                      }
                      isIntegerOnly
                      min={1}
                      width={90}
                    />
                  )}
                </HStack>
              </VStack>
            </Card>
            <Text type="label" weight="bold">
              Schedule
            </Text>
            <FormLayout>
              <DateTimeInput
                label="Active from"
                isOptional
                hasClear
                value={isoToInput(form.activeFrom)}
                onChange={(activeFrom) =>
                  setForm({ ...form, activeFrom: activeFrom ?? null })
                }
              />
              <DateTimeInput
                label="Active until"
                isOptional
                hasClear
                value={isoToInput(form.activeUntil)}
                onChange={(activeUntil) =>
                  setForm({ ...form, activeUntil: activeUntil ?? null })
                }
              />
            </FormLayout>
            <Text type="label" weight="bold">
              Conditions
            </Text>
            <Text type="supporting" color="secondary">
              Conditions are evaluated against the safe checkout facts. Product
              conditions apply the benefit once to the matching subtotal.
            </Text>
            <ConditionSentenceEditor
              conditions={form.conditions}
              onChange={(conditions) => setForm({ ...form, conditions })}
              fields={fields}
            />
            <Card padding={4}>
              <VStack gap={1} hAlign="stretch">
                <Text type="label" weight="bold">
                  Preview
                </Text>
                <Text type="body" color="secondary">
                  {renderRedemptionRuleSentence(form, fieldLabels)}
                </Text>
              </VStack>
            </Card>
          </FormLayout>
        </ScrollableArea>
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
