"use client";

import { useState } from "react";
import { Plus, Ticket } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Table } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Switch } from "@astryxdesign/core/Switch";
import { Selector } from "@astryxdesign/core/Selector";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import {
  useAdminPlans,
  useAdminSubscriptions,
  useCreatePlan,
  useDeletePlan,
  useSubscriptionAction,
  useUpdatePlan,
} from "@/lib/query";
import { formatPKR } from "@/lib/money";
import type { BillingCycle, Plan, PlanInput, Subscription } from "@/types";

const defaultPlanForm: PlanInput = {
  name: "",
  price: 0,
  billingCycle: "monthly",
  taxPercent: 0,
  active: true,
};

export default function AdminPlansPage() {
  const toast = useToast();
  const { data: plans = [], isLoading } = useAdminPlans();
  const { data: subscriptions = [] } = useAdminSubscriptions();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const subscriptionAction = useSubscriptionAction();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanInput>(defaultPlanForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultPlanForm);
    setOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      price: Number(plan.price),
      billingCycle: plan.billingCycle,
      taxPercent: Number(plan.taxPercent),
      active: plan.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price || form.price <= 0) {
      toast({ type: "error", body: "Name and a positive price are required" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updatePlan.mutateAsync({ id: editing.id, input: form });
      } else {
        await createPlan.mutateAsync(form);
      }
      toast({ type: "info", body: editing ? "Plan updated" : "Plan created" });
      setOpen(false);
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to save plan",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (plan: Plan, active: boolean) => {
    updatePlan.mutate({
      id: plan.id,
      input: {
        name: plan.name,
        price: Number(plan.price),
        billingCycle: plan.billingCycle,
        taxPercent: Number(plan.taxPercent),
        active,
      },
    });
  };

  const handleDelete = (plan: Plan) => {
    deletePlan.mutate(plan.id, {
      onSuccess: () => toast({ type: "info", body: "Plan deleted" }),
      onError: (err) =>
        toast({
          type: "error",
          body: err instanceof Error ? err.message : "Failed to delete plan",
        }),
    });
  };

  const handleSubscription = (id: string, action: "approve" | "cancel") => {
    subscriptionAction.mutate(
      { id, action },
      {
        onSuccess: () =>
          toast({
            type: "info",
            body:
              action === "approve"
                ? "Subscription approved. First invoice issued."
                : "Subscription canceled",
          }),
        onError: (err) =>
          toast({
            type: "error",
            body:
              err instanceof Error ? err.message : "Failed to update subscription",
          }),
      },
    );
  };

  if (isLoading) {
    return <AppLoading label="Loading plans..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <HStack hAlign="between" vAlign="center">
        <VStack gap={1}>
          <Heading level={1}>Plans & Subscriptions</Heading>
          <Text type="body" color="secondary">
            Plan templates you charge merchants, and their subscription requests
          </Text>
        </VStack>
        <Button
          label="New plan"
          variant="primary"
          icon={<Plus size="1em" />}
          onClick={openCreate}
        />
      </HStack>

      <Table
        data={plans}
        idKey="id"
        hasHover
        emptyState={
          <EmptyState
            title="No plans yet"
            description="Create a plan to start charging merchants."
            icon={<Ticket size="1em" />}
            actions={
              <Button label="Create plan" variant="primary" onClick={openCreate} />
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Plan",
            renderCell: (p: Plan) => (
              <Text type="body" weight="medium">
                {p.name}
              </Text>
            ),
          },
          {
            key: "price",
            header: "Price",
            align: "end",
            renderCell: (p: Plan) => (
              <Text type="body" hasTabularNumbers>
                {formatPKR(p.price)}
              </Text>
            ),
          },
          {
            key: "cycle",
            header: "Cycle",
            renderCell: (p: Plan) => (
              <Text type="supporting" color="secondary">
                {p.billingCycle}
              </Text>
            ),
          },
          {
            key: "tax",
            header: "Tax",
            renderCell: (p: Plan) => (
              <Text type="supporting" color="secondary">
                {Number(p.taxPercent) > 0 ? `${p.taxPercent}%` : "—"}
              </Text>
            ),
          },
          {
            key: "active",
            header: "Active",
            renderCell: (p: Plan) => (
              <Switch
                label={`${p.name} active`}
                isLabelHidden
                value={p.active}
                changeAction={(v) => handleToggle(p, v)}
              />
            ),
          },
          {
            key: "actions",
            header: "Actions",
            renderCell: (p: Plan) => (
              <HStack gap={1}>
                <Button
                  label="Edit"
                  size="sm"
                  variant="primary"
                  onClick={() => openEdit(p)}
                />
                <Button
                  label="Delete"
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(p)}
                />
              </HStack>
            ),
          },
        ]}
      />

      <VStack gap={3} hAlign="stretch">
        <Heading level={2}>Subscription requests</Heading>
        {subscriptions.length === 0 ? (
          <Card padding={5}>
            <EmptyState
              title="No subscriptions yet"
              description="When a merchant picks a plan it appears here for approval."
              isCompact
            />
          </Card>
        ) : (
          <Table
            data={subscriptions}
            idKey="id"
            hasHover
            columns={[
              {
                key: "tenantName",
                header: "Merchant",
                renderCell: (s: Subscription) => (
                  <Text type="body" weight="medium">
                    {s.tenantName}
                  </Text>
                ),
              },
              {
                key: "planName",
                header: "Plan",
                renderCell: (s: Subscription) => (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="body">{s.planName}</Text>
                    <Text type="supporting" color="secondary">
                      {formatPKR(s.planPrice)} / {s.billingCycle}
                    </Text>
                  </VStack>
                ),
              },
              {
                key: "status",
                header: "Status",
                renderCell: (s: Subscription) => (
                  <Badge
                    variant={
                      s.status === "active"
                        ? "green"
                        : s.status === "pending"
                          ? "yellow"
                          : "neutral"
                    }
                    label={s.status}
                  />
                ),
              },
              {
                key: "nextBilling",
                header: "Next billing",
                renderCell: (s: Subscription) => (
                  <Text type="supporting" color="secondary">
                    {s.nextBillingAt
                      ? new Date(s.nextBillingAt).toLocaleDateString()
                      : "—"}
                  </Text>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                renderCell: (s: Subscription) => (
                  <HStack gap={1}>
                    {s.status !== "canceled" && (
                      <Button
                        label={s.status === "pending" ? "Approve" : "Active"}
                        size="sm"
                        variant="primary"
                        isDisabled={s.status === "active"}
                        onClick={() => handleSubscription(s.id, "approve")}
                      />
                    )}
                    {(s.status === "pending" || s.status === "active") && (
                      <Button
                        label="Cancel"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleSubscription(s.id, "cancel")}
                      />
                    )}
                  </HStack>
                ),
              },
            ]}
          />
        )}
      </VStack>

      <Dialog
        isOpen={open}
        onOpenChange={setOpen}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title={editing ? "Edit Plan" : "New Plan"}
          onOpenChange={setOpen}
        />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Plan name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <NumberInput
            label="Price (PKR)"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v ?? 0 })}
            min={0.01}
            isRequired
          />
          <Selector
            label="Billing cycle"
            value={form.billingCycle as string}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            onChange={(v) =>
              setForm({ ...form, billingCycle: v as BillingCycle })
            }
          />
          <NumberInput
            label="Tax % (0 if none)"
            value={form.taxPercent ?? 0}
            onChange={(v) => setForm({ ...form, taxPercent: v ?? 0 })}
            min={0}
            isOptional
          />
        </VStack>
        <HStack gap={3} paddingBlockStart={4}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setOpen(false)}
            width="100%"
          />
          <Button
            label={editing ? "Save" : "Create"}
            variant="primary"
            isLoading={saving}
            isDisabled={!form.name.trim() || !form.price}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}