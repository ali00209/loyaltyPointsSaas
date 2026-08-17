"use client";

import { useState } from "react";
import { Plus, Minus, ArrowLeftRight, Gift, Zap } from "lucide-react";
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
import { Table, proportional } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useTransactions,
  useCustomers,
  useRewards,
  useProducts,
  useCreateTransaction,
  usePostEvent,
} from "@/lib/query";
import {
  EVENT_CATALOG,
  eventLabel,
  EVENT_TYPES,
  type EventType,
} from "@/lib/rules";
import type {
  Customer,
  PostEventInput,
  Transaction,
  TransactionInput,
  TransactionType,
} from "@/types";

const OWNER_POSTABLE_EVENTS = EVENT_TYPES.filter(
  (e) => e !== "referral" && e !== "customer_signup",
);

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
  { value: "redeem", label: "Redeem — Use Points" },
  { value: "adjust", label: "Adjust — Manual Correction" },
];

interface LedgerForm {
  customerId: string;
  transactionType: string;
  rewardId: string;
  points: number | null;
  description: string;
}

interface LineItem {
  productId: string;
  quantity: number | null;
  unitPrice: number | null;
}

interface EventForm {
  customerId: string;
  eventType: EventType;
  orderAmount: number | null;
  orderNumber: string;
  items: LineItem[];
  purchaseId: string;
  productId: string;
  rating: number | null;
  platform: string;
}

const defaultLedgerForm: LedgerForm = {
  customerId: "",
  transactionType: "redeem",
  rewardId: "",
  points: null,
  description: "",
};

const defaultEventForm: EventForm = {
  customerId: "",
  eventType: "purchase",
  orderAmount: null,
  orderNumber: "",
  items: [{ productId: "", quantity: null, unitPrice: null }],
  purchaseId: "",
  productId: "",
  rating: null,
  platform: "",
};

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: customers = [] } = useCustomers();
  const { data: rewards = [] } = useRewards();
  const { data: products = [] } = useProducts();
  const createTransactionMutation = useCreateTransaction();
  const postEventMutation = usePostEvent();
  const [showLedger, setShowLedger] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [ledger, setLedger] = useState<LedgerForm>(defaultLedgerForm);
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm);
  const showToast = useToast();

  const openLedger = (type: string) => {
    setLedger({ ...defaultLedgerForm, transactionType: type });
    setShowLedger(true);
  };

  const openEvent = () => {
    setEventForm(defaultEventForm);
    setShowEvent(true);
  };

  const selectedReward = rewards.find((r) => r.id === ledger.rewardId);
  const eventEntry = EVENT_CATALOG[eventForm.eventType];

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setEventForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));
  };

  const handleLedgerSave = async () => {
    setSaving(true);
    try {
      const payload: TransactionInput = {
        customerId: ledger.customerId,
        transactionType: ledger.transactionType as TransactionType,
        rewardId: ledger.rewardId || null,
        points:
          ledger.transactionType === "adjust"
            ? (ledger.points ?? 0)
            : undefined,
        description: ledger.description || null,
      };
      await createTransactionMutation.mutateAsync(payload);
      showToast({ type: "info", body: "Transaction recorded" });
      setShowLedger(false);
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

  const buildPayload = (): Record<string, unknown> => {
    const f = eventForm;
    switch (f.eventType) {
      case "purchase":
        return {
          orderAmount: f.orderAmount,
          ...(f.orderNumber ? { orderNumber: f.orderNumber } : {}),
          items: f.items
            .filter(
              (it) =>
                it.productId && it.quantity != null && it.unitPrice != null,
            )
            .map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
            })),
        };
      case "review":
        return {
          purchaseId: f.purchaseId,
          productId: f.productId,
          rating: f.rating,
        };
      case "social_share":
        return f.platform ? { platform: f.platform } : {};
      default:
        return {};
    }
  };

  const handleEventSave = async () => {
    setSaving(true);
    try {
      const input: PostEventInput = {
        eventType: eventForm.eventType,
        payload: buildPayload(),
        customerId: eventForm.customerId,
      };
      const result = await postEventMutation.mutateAsync(input);
      if (result.duplicate) {
        showToast({
          type: "info",
          body: "Already recorded — no points awarded",
        });
      } else if (result.awards.length > 0) {
        showToast({
          type: "info",
          body: `Awarded +${result.totalAwarded} pts (${result.awards.map((a) => a.ruleName).join(", ")})`,
        });
      } else {
        showToast({ type: "info", body: "No matching rules — 0 pts awarded" });
      }
      setShowEvent(false);
    } catch (err) {
      showToast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to record event",
      });
    } finally {
      setSaving(false);
    }
  };

  const eventCanSave = (): boolean => {
    const f = eventForm;
    if (!f.customerId) return false;
    switch (f.eventType) {
      case "purchase":
        return (
          f.orderAmount != null &&
          f.items.some(
            (it) => it.productId && it.quantity != null && it.unitPrice != null,
          )
        );
      case "review":
        return Boolean(
          f.purchaseId &&
          f.productId &&
          f.rating != null &&
          f.rating >= 1 &&
          f.rating <= 5,
        );
      default:
        return true;
    }
  };

  const filtered = transactions.filter((t) => {
    const matchType = filterType === "all" || t.transactionType === filterType;
    const source =
      t.ruleName ??
      (typeof t.metadata?.eventType === "string"
        ? eventLabel(t.metadata.eventType)
        : "") ??
      t.rewardName ??
      "";
    const matchSearch =
      (t.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase()) ||
      source.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const canSaveLedger =
    Boolean(ledger.customerId) &&
    (ledger.transactionType !== "redeem" || Boolean(ledger.rewardId));

  if (isLoading) {
    return <AppLoading label="Loading transactions..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Transactions"
        description="Points activity, redemptions, and event-driven awards"
        showButton={false}
        onClick={() => openLedger("redeem")}
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
              onClick={() => openLedger("adjust")}
            />
            <Button
              label="Redeem Points"
              variant="secondary"
              icon={<Minus size="1em" />}
              onClick={() => openLedger("redeem")}
            />
            <Button
              label="Record Event"
              variant="primary"
              icon={<Zap size="1em" />}
              onClick={openEvent}
            />
          </HStack>
        }
      />

      <Banner
        status="info"
        title="Points are earned through events, not manual awards. Record a purchase, review, or engagement event and the platform awards points for every matching rule."
        container="card"
      />

      {filtered.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No transactions found"
            description={
              search || filterType !== "all"
                ? "Try different filters"
                : "Record an event to start earning points"
            }
            icon={<Icon icon={ArrowLeftRight} size="lg" />}
            actions={
              !search && filterType === "all" ? (
                <Button
                  label="Record Your First Event"
                  variant="primary"
                  onClick={openEvent}
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
                ) : typeof t.metadata?.eventType === "string" ? (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="body" color="secondary" maxLines={1}>
                      {eventLabel(t.metadata.eventType)}
                    </Text>
                    <Text type="supporting" color="secondary">
                      Event
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

      {/* Redeem / Adjust */}
      <Dialog
        isOpen={showLedger}
        onOpenChange={setShowLedger}
        purpose="form"
        width={520}
      >
        <DialogHeader
          title={
            ledger.transactionType === "redeem"
              ? "Redeem Points"
              : "Adjust Points"
          }
          onOpenChange={setShowLedger}
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
            value={ledger.customerId}
            onChange={(v) => setLedger({ ...ledger, customerId: v })}
          />
          <Selector
            label="Transaction Type"
            options={TXN_TYPES}
            value={ledger.transactionType}
            onChange={(v) => setLedger({ ...ledger, transactionType: v })}
          />
          {ledger.transactionType === "redeem" && (
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
              value={ledger.rewardId}
              onChange={(v) => setLedger({ ...ledger, rewardId: v })}
            />
          )}
          {ledger.transactionType === "adjust" && (
            <NumberInput
              label="Points Adjustment (signed)"
              placeholder="e.g. 50 or -50"
              isRequired
              hasClear
              value={ledger.points}
              onChange={(v) => setLedger({ ...ledger, points: v })}
            />
          )}
          <TextInput
            label="Description"
            placeholder="e.g. Refund correction"
            isOptional
            value={ledger.description}
            onChange={(v) => setLedger({ ...ledger, description: v })}
          />
          {ledger.transactionType === "redeem" && selectedReward && (
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
            onClick={() => setShowLedger(false)}
            width="100%"
          />
          <Button
            label={
              ledger.transactionType === "redeem" ? "Redeem Points" : "Submit"
            }
            variant="primary"
            isLoading={saving}
            isDisabled={!canSaveLedger}
            onClick={handleLedgerSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {/* Record Event */}
      <Dialog
        isOpen={showEvent}
        onOpenChange={setShowEvent}
        purpose="form"
        width={600}
        maxHeight={"full"}
      >
        <DialogHeader title="Record Event" onOpenChange={setShowEvent} />
        <VStack gap={3} hAlign="stretch">
          <Selector
            label="Customer"
            placeholder="Select a customer"
            isRequired
            options={customers.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.currentBalance.toLocaleString()} pts)`,
            }))}
            value={eventForm.customerId}
            onChange={(v) => setEventForm({ ...eventForm, customerId: v })}
          />
          <Selector
            label="Event Type"
            options={OWNER_POSTABLE_EVENTS.map((e) => ({
              value: e,
              label: EVENT_CATALOG[e].label,
            }))}
            value={eventForm.eventType}
            onChange={(v) =>
              setEventForm({ ...eventForm, eventType: v as EventType })
            }
          />
          <Text type="supporting" color="secondary">
            {eventEntry.description}
          </Text>

          {eventForm.eventType === "purchase" && (
            <>
              <HStack gap={3}>
                <NumberInput
                  label="Order Amount"
                  placeholder="e.g. 25.50"
                  min={0}
                  step={0.01}
                  isRequired
                  hasClear
                  width="100%"
                  value={eventForm.orderAmount}
                  onChange={(v) =>
                    setEventForm({ ...eventForm, orderAmount: v })
                  }
                />
                <TextInput
                  label="Order Number (optional)"
                  placeholder="e.g. ORD-1042"
                  isOptional
                  width="100%"
                  value={eventForm.orderNumber}
                  onChange={(v) =>
                    setEventForm({ ...eventForm, orderNumber: v })
                  }
                />
              </HStack>
              <Text type="label" weight="medium">
                Line Items
              </Text>
              <VStack gap={2} hAlign="stretch">
                {eventForm.items.map((it, i) => (
                  <HStack key={i} gap={2} vAlign="end">
                    <Selector
                      label="Product"
                      placeholder="Select product"
                      isLabelHidden={i > 0}
                      isRequired={i === 0}
                      width="100%"
                      options={products.map((p) => ({
                        value: p.id,
                        label: p.name,
                      }))}
                      value={it.productId}
                      onChange={(v) => updateItem(i, { productId: v })}
                    />
                    <NumberInput
                      label="Qty"
                      placeholder="Qty"
                      isLabelHidden={i > 0}
                      isRequired={i === 0}
                      min={1}
                      isIntegerOnly
                      hasClear
                      width={90}
                      value={it.quantity}
                      onChange={(v) => updateItem(i, { quantity: v })}
                    />
                    <NumberInput
                      label="Unit Price"
                      placeholder="0.00"
                      isLabelHidden={i > 0}
                      isRequired={i === 0}
                      min={0}
                      step={0.01}
                      hasClear
                      width={110}
                      value={it.unitPrice}
                      onChange={(v) => updateItem(i, { unitPrice: v })}
                    />
                    <Button
                      label="X"
                      variant="ghost"
                      size="sm"
                      isDisabled={eventForm.items.length === 1}
                      onClick={() =>
                        setEventForm((f) => ({
                          ...f,
                          items: f.items.filter((_, idx) => idx !== i),
                        }))
                      }
                    />
                  </HStack>
                ))}
              </VStack>
              <Button
                label="Add Line Item"
                variant="ghost"
                size="sm"
                icon={<Plus size="1em" />}
                onClick={() =>
                  setEventForm((f) => ({
                    ...f,
                    items: [
                      ...f.items,
                      { productId: "", quantity: null, unitPrice: null },
                    ],
                  }))
                }
              />
            </>
          )}

          {eventForm.eventType === "review" && (
            <>
              <TextInput
                label="Purchase ID"
                placeholder="The event id of the purchase to review"
                isRequired
                value={eventForm.purchaseId}
                onChange={(v) => setEventForm({ ...eventForm, purchaseId: v })}
              />
              <TextInput
                label="Product ID"
                placeholder="The product being reviewed"
                isRequired
                value={eventForm.productId}
                onChange={(v) => setEventForm({ ...eventForm, productId: v })}
              />
              <NumberInput
                label="Rating (1–5)"
                min={1}
                max={5}
                isIntegerOnly
                isRequired
                hasClear
                value={eventForm.rating}
                onChange={(v) => setEventForm({ ...eventForm, rating: v })}
              />
            </>
          )}

          {eventForm.eventType === "social_share" && (
            <TextInput
              label="Platform"
              placeholder="e.g. instagram"
              isOptional
              value={eventForm.platform}
              onChange={(v) => setEventForm({ ...eventForm, platform: v })}
            />
          )}

          {eventForm.eventType === "newsletter_signup" && (
            <Banner
              status="info"
              title="No payload needed. Recording this event awards points for any matching newsletter rule."
              container="card"
            />
          )}

          <Banner
            status="info"
            title="Points are calculated automatically: the event is matched against all active assigned rules and each matching rule awards points."
            container="card"
            icon={<Icon icon={Zap} size="sm" />}
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowEvent(false)}
            width="100%"
          />
          <Button
            label="Record Event"
            variant="primary"
            isLoading={saving}
            isDisabled={!eventCanSave()}
            onClick={handleEventSave}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
