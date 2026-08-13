"use client";

import { useState } from "react";
import { Plus, Minus, ArrowLeftRight, Gift } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Banner } from "@astryxdesign/core/Banner";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useTransactions,
  useCustomers,
  useRules,
  useRewards,
  useCreateTransaction,
} from "@/lib/query";
import type { Transaction, TransactionInput, TransactionType } from "@/types";

const txTypeBadge: Record<string, "green" | "red" | "blue" | "neutral"> = {
  earn: "green",
  redeem: "red",
  adjust: "blue",
  expire: "neutral",
};

const txTypeLabels: Record<string, string> = {
  earn: "Earn",
  redeem: "Redeem",
  adjust: "Adjust",
  expire: "Expired",
};

const TX_FILTERS = ["all", "earn", "redeem", "adjust"];

const TXN_TYPES = [
  { value: "earn", label: "Earn — Award Points" },
  { value: "redeem", label: "Redeem — Use Points" },
  { value: "adjust", label: "Adjust — Manual Correction" },
];

interface TransactionForm {
  customerId: string;
  transactionType: string;
  ruleId: string;
  rewardId: string;
  points: number | null;
  description: string;
  orderAmount: number | null;
  itemQuantity: number | null;
}

const defaultForm: TransactionForm = {
  customerId: "",
  transactionType: "earn",
  ruleId: "",
  rewardId: "",
  points: null,
  description: "",
  orderAmount: null,
  itemQuantity: null,
};

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: customers = [] } = useCustomers();
  const { data: rules = [] } = useRules();
  const { data: rewards = [] } = useRewards();
  const createTransactionMutation = useCreateTransaction();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<TransactionForm>(defaultForm);
  const showToast = useToast();

  const openCreate = (type: string) => {
    setForm({ ...defaultForm, transactionType: type });
    setShowForm(true);
  };

  const selectedReward = rewards.find((r) => r.id === form.rewardId);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: TransactionInput = {
        customerId: form.customerId,
        transactionType: form.transactionType as TransactionType,
        ruleId: form.ruleId || null,
        rewardId: form.rewardId || null,
        points:
          form.transactionType === "adjust" ? (form.points ?? 0) : undefined,
        description: form.description || null,
        orderAmount: form.orderAmount != null ? String(form.orderAmount) : null,
        itemQuantity: form.itemQuantity ?? null,
      };

      await createTransactionMutation.mutateAsync(payload);

      showToast({ type: "info", body: "Transaction recorded" });
      setShowForm(false);
    } catch (err) {
      showToast({
        type: "error",
        body:
          err instanceof Error ? err.message : "Failed to record transaction",
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const matchType = filterType === "all" || t.transactionType === filterType;
    const matchSearch =
      (t.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.ruleName || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.rewardName || "").toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const canSave =
    Boolean(form.customerId) &&
    (form.transactionType !== "earn" || Boolean(form.ruleId)) &&
    (form.transactionType !== "redeem" || Boolean(form.rewardId));

  if (isLoading) {
    return <AppLoading label="Loading transactions..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Transactions"
        description="Record and track all point activity"
        showButton={false}
        onClick={() => openCreate("redeem")}
        search={search}
        setSearch={setSearch}
        showFilter={true}
        filterOptions={TX_FILTERS}
        filterValue={filterType}
        setFilterValue={setFilterType}
        customButton={
          <HStack gap={2} hAlign="end">
            <Button
              label="Adjust"
              variant="ghost"
              icon={<Plus size="1em" />}
              onClick={() => openCreate("adjust")}
            />
            <Button
              label="Redeem Points"
              variant="secondary"
              icon={<Minus size="1em" />}
              onClick={() => openCreate("redeem")}
            />
            <Button
              label="Award Points"
              variant="primary"
              icon={<Plus size="1em" />}
              onClick={() => openCreate("earn")}
            />
          </HStack>
        }
      />

      {filtered.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No transactions found"
            description={
              search || filterType !== "all"
                ? "Try different filters"
                : "Record your first point transaction"
            }
            icon={<Icon icon={ArrowLeftRight} size="lg" />}
            actions={
              !search && filterType === "all" ? (
                <Button
                  label="Record Your First Transaction"
                  variant="primary"
                  onClick={() => openCreate("earn")}
                />
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Table
          data={filtered}
          idKey="id"
          hasHover
          columns={[
            {
              key: "customer",
              header: "Customer",
              width: proportional(2),
              renderCell: (t: Transaction) => (
                <HStack gap={2} vAlign="center">
                  <Avatar name={t.customerName || "?"} size="sm" />
                  <Text type="body" weight="medium">
                    {t.customerName || "Unknown"}
                  </Text>
                </HStack>
              ),
            },
            {
              key: "transactionType",
              header: "Type",
              renderCell: (t: Transaction) => (
                <Badge
                  variant={txTypeBadge[t.transactionType] || "neutral"}
                  label={txTypeLabels[t.transactionType] || t.transactionType}
                />
              ),
            },
            {
              key: "source",
              header: "Source",
              renderCell: (t: Transaction) =>
                t.ruleName ? (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="body" color="secondary" maxLines={1}>
                      {t.ruleName}
                    </Text>
                    <Text type="supporting" color="secondary">
                      Rule
                    </Text>
                  </VStack>
                ) : t.rewardName ? (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="body" color="secondary" maxLines={1}>
                      {t.rewardName}
                    </Text>
                    <Text type="supporting" color="secondary">
                      Reward
                    </Text>
                  </VStack>
                ) : (
                  <Text type="body" color="secondary" maxLines={1}>
                    —{t.transactionType === "expire" ? " (expired)" : ""}
                  </Text>
                ),
            },
            {
              key: "points",
              header: "Points",
              renderCell: (t: Transaction) => (
                <Text
                  type="body"
                  weight="medium"
                  hasTabularNumbers
                  color={t.points > 0 ? "primary" : "accent"}
                >
                  {t.points > 0 ? "+" : ""}
                  {t.points}
                </Text>
              ),
            },
            {
              key: "description",
              header: "Description",
              width: proportional(2),
              renderCell: (t: Transaction) => (
                <Text type="body" color="secondary" maxLines={1}>
                  {t.description || "—"}
                </Text>
              ),
            },
            {
              key: "orderAmount",
              header: "Amount",
              renderCell: (t: Transaction) => (
                <Text type="body" color="secondary" hasTabularNumbers>
                  {t.orderAmount
                    ? `$${parseFloat(t.orderAmount).toFixed(2)}`
                    : "—"}
                </Text>
              ),
            },
            {
              key: "createdAt",
              header: "Date",
              renderCell: (t: Transaction) => (
                <Text type="body" color="secondary">
                  {new Date(t.createdAt).toLocaleDateString()}
                </Text>
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
          title={
            form.transactionType === "earn"
              ? "Award Points"
              : form.transactionType === "redeem"
                ? "Redeem Points"
                : "Adjust Points"
          }
          onOpenChange={setShowForm}
        />
        <VStack gap={3} hAlign="stretch">
          <Selector
            label="Customer"
            placeholder="Select a customer"
            isRequired
            options={customers.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.currentBalance.toLocaleString()} pts)`,
            }))}
            value={form.customerId}
            onChange={(v) => setForm({ ...form, customerId: v })}
          />
          <Selector
            label="Transaction Type"
            options={TXN_TYPES}
            value={form.transactionType}
            onChange={(v) => setForm({ ...form, transactionType: v })}
          />

          {form.transactionType === "earn" && (
            <>
              <Selector
                label="Earning Rule"
                placeholder="Select a rule"
                isRequired
                options={rules
                  .filter((r) => r.assignmentActive)
                  .map((r) => ({
                    value: r.id,
                    label: r.name,
                  }))}
                value={form.ruleId}
                onChange={(v) => setForm({ ...form, ruleId: v })}
              />
              <HStack gap={3}>
                <NumberInput
                  label="Order Amount ($)"
                  placeholder="e.g. 25.50"
                  min={0}
                  step={0.01}
                  isOptional
                  hasClear
                  width="100%"
                  value={form.orderAmount}
                  onChange={(v) => setForm({ ...form, orderAmount: v })}
                />
                <NumberInput
                  label="Item Quantity"
                  placeholder="e.g. 3"
                  min={0}
                  isIntegerOnly
                  isOptional
                  hasClear
                  width="100%"
                  value={form.itemQuantity}
                  onChange={(v) => setForm({ ...form, itemQuantity: v })}
                />
              </HStack>
            </>
          )}

          {form.transactionType === "redeem" && (
            <Selector
              label="Reward"
              placeholder="Select a reward"
              isRequired
              options={rewards
                .filter((r) => r.active)
                .map((r) => ({
                  value: r.id,
                  label: `${r.name} (${r.pointsCost.toLocaleString()} pts)`,
                }))}
              value={form.rewardId}
              onChange={(v) => setForm({ ...form, rewardId: v })}
            />
          )}

          {form.transactionType === "adjust" && (
            <NumberInput
              label="Points Adjustment (signed)"
              placeholder="e.g. 50 or -50"
              isRequired
              hasClear
              value={form.points}
              onChange={(v) => setForm({ ...form, points: v })}
            />
          )}

          <TextInput
            label="Description"
            placeholder="e.g. Morning coffee purchase"
            isOptional
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />

          {form.transactionType === "earn" && form.ruleId && (
            <Banner
              status="info"
              title="Points are calculated automatically from the rule based on the order amount and/or item quantity provided."
              container="card"
            />
          )}

          {form.transactionType === "redeem" && selectedReward && (
            <Banner
              status="info"
              title={`This will deduct ${selectedReward.pointsCost.toLocaleString()} points and redeem "${selectedReward.name}".`}
              container="card"
              icon={<Icon icon={Gift} size="sm" />}
            />
          )}
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowForm(false)}
            width="100%"
          />
          <Button
            label={
              form.transactionType === "earn"
                ? "Award Points"
                : form.transactionType === "redeem"
                  ? "Redeem Points"
                  : "Submit"
            }
            variant="primary"
            isLoading={saving}
            isDisabled={!canSave}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
