"use client";

import { useState } from "react";
import { Plus, ArrowLeftRight, Zap, RotateCcw, StarIcon } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
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
  useProducts,
  useCreateTransaction,
  usePostEvent,
  useRedemptionCheckoutHistory,
  usePreviewOwnerCheckout,
  useConfirmOwnerCheckout,
  useRefundOwnerCheckout,
} from "@/lib/query";
import { formatPKR } from "@/lib/money";
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
  CheckoutPreview,
  RedemptionCheckoutHistory,
  OwnerCheckoutInput,
} from "@/types";
import { TabList, Tab } from "@astryxdesign/core";

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

interface LedgerForm {
  customerId: string;
  transactionType: string;
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

interface RedemptionForm {
  checkoutId: string;
  customerId: string;
  orderAmount: number | null;
  items: LineItem[];
}

const defaultLedgerForm: LedgerForm = {
  customerId: "",
  transactionType: "adjust",
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

const defaultRedemptionForm: RedemptionForm = {
  checkoutId: "",
  customerId: "",
  orderAmount: null,
  items: [{ productId: "", quantity: null, unitPrice: null }],
};

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const createTransactionMutation = useCreateTransaction();
  const postEventMutation = usePostEvent();
  const { data: redemptionHistory = [] } = useRedemptionCheckoutHistory();
  const previewRedemptionMutation = usePreviewOwnerCheckout();
  const confirmRedemptionMutation = useConfirmOwnerCheckout();
  const refundRedemptionMutation = useRefundOwnerCheckout();
  const [showLedger, setShowLedger] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [showRedemption, setShowRedemption] = useState(false);
  const [refundTarget, setRefundTarget] =
    useState<RedemptionCheckoutHistory | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("transactions");
  const [ledger, setLedger] = useState<LedgerForm>(defaultLedgerForm);
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm);
  const [redemptionForm, setRedemptionForm] = useState<RedemptionForm>(
    defaultRedemptionForm,
  );
  const [redemptionPreview, setRedemptionPreview] =
    useState<CheckoutPreview | null>(null);
  const showToast = useToast();

  const openLedger = (type: string) => {
    setLedger({ ...defaultLedgerForm, transactionType: type });
    setShowLedger(true);
  };

  const openEvent = () => {
    setEventForm(defaultEventForm);
    setShowEvent(true);
  };

  const openRedemption = () => {
    setRedemptionForm({
      ...defaultRedemptionForm,
      checkoutId: `owner-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`,
      items: [{ ...defaultRedemptionForm.items[0] }],
    });
    setRedemptionPreview(null);
    setShowRedemption(true);
  };

  const updateRedemptionItem = (index: number, patch: Partial<LineItem>) => {
    setRedemptionForm((f) => ({
      ...f,
      items: f.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
    setRedemptionPreview(null);
  };

  const redemptionPayload = (): OwnerCheckoutInput => {
    if (!redemptionForm.customerId || redemptionForm.orderAmount == null) {
      throw new Error("Customer and order amount are required");
    }
    return {
      checkoutId: redemptionForm.checkoutId,
      customerEmail:
        customers.find((customer) => customer.id === redemptionForm.customerId)
          ?.email ?? undefined,
      customerPhone:
        customers.find((customer) => customer.id === redemptionForm.customerId)
          ?.phone ?? undefined,
      orderAmount: redemptionForm.orderAmount,
      items: redemptionForm.items
        .filter(
          (item) =>
            item.productId && item.quantity != null && item.unitPrice != null,
        )
        .map((item) => ({
          productId: item.productId!,
          quantity: item.quantity!,
          unitPrice: item.unitPrice!,
        })),
    };
  };

  const previewRedemption = async () => {
    try {
      const result =
        await previewRedemptionMutation.mutateAsync(redemptionPayload());
      setRedemptionPreview(result);
    } catch (err) {
      showToast({
        type: "error",
        body:
          err instanceof Error ? err.message : "Unable to preview redemption",
      });
    }
  };

  const confirmRedemption = async () => {
    try {
      const result =
        await confirmRedemptionMutation.mutateAsync(redemptionPayload());
      if (!result.matched) {
        showToast({
          type: "info",
          body: result.reason || "No redemption applied",
        });
        return;
      }
      showToast({
        type: "info",
        body: `Redemption confirmed: ${result.benefit?.ruleName || "discount"} applied`,
      });
      setShowRedemption(false);
      setRedemptionPreview(null);
    } catch (err) {
      showToast({
        type: "error",
        body:
          err instanceof Error ? err.message : "Unable to confirm redemption",
      });
    }
  };

  const refundRedemption = async () => {
    if (!refundTarget || !refundReason.trim()) return;
    try {
      await refundRedemptionMutation.mutateAsync({
        checkoutId: refundTarget.checkoutId,
        reason: refundReason.trim(),
      });
      showToast({
        type: "info",
        body: "Redemption refunded and points restored",
      });
      setRefundTarget(null);
      setRefundReason("");
    } catch (err) {
      showToast({
        type: "error",
        body:
          err instanceof Error ? err.message : "Unable to refund redemption",
      });
    }
  };

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
        transactionType: "adjust",
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
      t.redemptionRuleName ??
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
    Boolean(ledger.customerId) && ledger.points != null && ledger.points !== 0;

  if (isLoading) {
    return <AppLoading label="Loading transactions..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Transactions"
        description="Points activity, redemptions, and event-driven awards"
        showButton={false}
        onClick={() => openLedger("adjust")}
        search={search}
        setSearch={setSearch}
        showFilter={tab === "transactions"}
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
              label="Redeem at checkout"
              variant="secondary"
              icon={<RotateCcw size="1em" />}
              onClick={openRedemption}
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

      <TabList value={tab} onChange={setTab}>
        <Tab value="transactions" label="Transactions" />
        <Tab value="redemptions" label="Redemptions" />
      </TabList>

      {tab === "transactions" && (
        <Table
          data={filtered}
          idKey="id"
          hasHover
          emptyState={
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
          }
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
                ) : t.redemptionRuleName ? (
                  <VStack gap={0} hAlign="stretch">
                    <Text type="body" color="secondary" maxLines={1}>
                      {t.redemptionRuleName}
                    </Text>
                    <Text type="supporting" color="secondary">
                      Redemption rule
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
                  {t.orderAmount ? formatPKR(t.orderAmount) : "—"}
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

      {tab === "redemptions" && (
        <Table
          data={redemptionHistory}
          idKey="id"
          hasHover
          emptyState={
            <EmptyState
              title="No checkout redemptions"
              description="Confirmed checkout discounts will appear here."
              icon={<Icon icon={RotateCcw} size="lg" />}
              actions={
                <Button
                  label="Redeem at checkout"
                  variant="primary"
                  onClick={openRedemption}
                />
              }
            />
          }
          columns={[
            {
              key: "customer",
              header: "Customer",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <Text type="body" weight="medium">
                  {entry.customerName || "Unknown"}
                </Text>
              ),
            },
            {
              key: "checkout",
              header: "Checkout",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <Text type="code" color="secondary">
                  {entry.checkoutId}
                </Text>
              ),
            },
            {
              key: "rule",
              header: "Rule",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <VStack gap={0} hAlign="stretch">
                  <Text type="body">{entry.ruleName || "No match"}</Text>
                  <Text type="supporting" color="secondary">
                    {entry.status === "finalized"
                      ? "Confirmed"
                      : entry.status === "refunded"
                        ? "Refunded"
                        : entry.status}
                  </Text>
                  {entry.refundReason && (
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {entry.refundReason}
                    </Text>
                  )}
                </VStack>
              ),
            },
            {
              key: "amount",
              header: "Order",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <Text type="body" hasTabularNumbers>
                  {formatPKR(entry.orderAmount)}
                </Text>
              ),
            },
            {
              key: "discount",
              header: "Discount",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <Text type="body" hasTabularNumbers>
                  {formatPKR(entry.discountAmount)}
                </Text>
              ),
            },
            {
              key: "points",
              header: "Points",
              renderCell: (entry: RedemptionCheckoutHistory) => (
                <Text type="body" hasTabularNumbers>
                  {entry.pointsCost.toLocaleString()}
                </Text>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              renderCell: (entry: RedemptionCheckoutHistory) =>
                entry.status === "finalized" ? (
                  <Button
                    label="Refund"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setRefundTarget(entry);
                      setRefundReason("");
                    }}
                  />
                ) : (
                  <Text type="supporting" color="secondary">
                    —
                  </Text>
                ),
            },
          ]}
        />
      )}

      {/* Checkout redemption */}
      <Dialog
        isOpen={showRedemption}
        onOpenChange={(open) => {
          setShowRedemption(open);
          if (!open) setRedemptionPreview(null);
        }}
        purpose="form"
        width={640}
        maxHeight="full"
      >
        <DialogHeader
          title="Redeem at checkout"
          onOpenChange={setShowRedemption}
        />
        <VStack gap={3} hAlign="stretch">
          <Selector
            label="Customer"
            placeholder="Select a customer"
            isRequired
            options={customers.map((customer) => ({
              value: customer.id,
              label: `${customer.name} (${customer.currentBalance.toLocaleString()} pts)`,
            }))}
            value={redemptionForm.customerId}
            onChange={(value) => {
              setRedemptionForm({ ...redemptionForm, customerId: value });
              setRedemptionPreview(null);
            }}
          />
          <NumberInput
            label="Order amount (PKR)"
            placeholder="e.g. 2500.00"
            min={0}
            step={0.01}
            isRequired
            hasClear
            value={redemptionForm.orderAmount}
            onChange={(value) => {
              setRedemptionForm({ ...redemptionForm, orderAmount: value });
              setRedemptionPreview(null);
            }}
          />
          <Text type="label" weight="medium">
            Line items (optional)
          </Text>
          <VStack gap={2} hAlign="stretch">
            {redemptionForm.items.map((item, index) => (
              <HStack key={index} gap={2} vAlign="end">
                <Selector
                  label="Product"
                  placeholder="Select product"
                  isLabelHidden={index > 0}
                  options={products
                    .filter((product) => product.active)
                    .map((product) => ({
                      value: product.id,
                      label: `${product.name} · ${formatPKR(product.price)}`,
                    }))}
                  value={item.productId}
                  onChange={(value) => {
                    const product = products.find(
                      (candidate) => candidate.id === value,
                    );
                    updateRedemptionItem(index, {
                      productId: value,
                      unitPrice: product
                        ? Number(product.price)
                        : item.unitPrice,
                    });
                  }}
                  width="100%"
                />
                <NumberInput
                  label="Qty"
                  placeholder="Qty"
                  isLabelHidden={index > 0}
                  min={1}
                  isIntegerOnly
                  hasClear
                  value={item.quantity}
                  onChange={(value) =>
                    updateRedemptionItem(index, { quantity: value })
                  }
                  width={82}
                />
                <NumberInput
                  label="Unit price (PKR)"
                  placeholder="0.00"
                  isLabelHidden={index > 0}
                  min={0}
                  step={0.01}
                  hasClear
                  value={item.unitPrice}
                  onChange={(value) =>
                    updateRedemptionItem(index, { unitPrice: value })
                  }
                  width={120}
                />
                <Button
                  label="Remove"
                  variant="ghost"
                  size="sm"
                  isDisabled={redemptionForm.items.length === 1}
                  onClick={() => {
                    setRedemptionForm((form) => ({
                      ...form,
                      items: form.items.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }));
                    setRedemptionPreview(null);
                  }}
                />
              </HStack>
            ))}
          </VStack>
          <Button
            label="Add line item"
            variant="ghost"
            size="sm"
            icon={<Plus size="1em" />}
            onClick={() => {
              setRedemptionForm((form) => ({
                ...form,
                items: [
                  ...form.items,
                  { productId: "", quantity: null, unitPrice: null },
                ],
              }));
              setRedemptionPreview(null);
            }}
          />

          {redemptionPreview && (
            <VStack gap={2} hAlign="stretch">
              <Text type="body" weight="bold">
                {redemptionPreview.matched
                  ? `Selected rule: ${redemptionPreview.benefit?.ruleName || "Automatic rule"}`
                  : "No redemption applied"}
              </Text>
              {redemptionPreview.matched && redemptionPreview.benefit ? (
                <>
                  <Text type="supporting" color="secondary">
                    Discount:{" "}
                    {formatPKR(redemptionPreview.benefit.discountAmount)} ·
                    Eligible subtotal:{" "}
                    {formatPKR(redemptionPreview.benefit.eligibleSubtotal)}
                  </Text>
                  <Text type="supporting" color="secondary">
                    Points cost:{" "}
                    {redemptionPreview.benefit.pointsCost.toLocaleString()} ·
                    Remaining balance:{" "}
                    {redemptionPreview.remainingBalance?.toLocaleString()} pts
                  </Text>
                </>
              ) : (
                <Text type="supporting" color="secondary">
                  {redemptionPreview.reason ||
                    "No matching redemption rule is available."}
                </Text>
              )}
            </VStack>
          )}
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowRedemption(false)}
            width="100%"
          />
          {!redemptionPreview || !redemptionPreview.matched ? (
            <Button
              label="Preview redemption"
              variant="primary"
              isLoading={previewRedemptionMutation.isPending}
              isDisabled={
                !redemptionForm.customerId || redemptionForm.orderAmount == null
              }
              onClick={previewRedemption}
              width="100%"
            />
          ) : (
            <Button
              label="Confirm & apply"
              variant="primary"
              isLoading={confirmRedemptionMutation.isPending}
              onClick={confirmRedemption}
              width="100%"
            />
          )}
        </HStack>
      </Dialog>

      <Dialog
        isOpen={Boolean(refundTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTarget(null);
            setRefundReason("");
          }
        }}
        purpose="form"
        width={480}
      >
        <DialogHeader
          title="Refund redemption"
          onOpenChange={() => setRefundTarget(null)}
        />
        <VStack gap={3} hAlign="stretch">
          <Text type="body" color="secondary">
            This restores {refundTarget?.pointsCost.toLocaleString() || 0}{" "}
            points to {refundTarget?.customerName || "the customer"}.
          </Text>
          <TextArea
            label="Refund reason"
            placeholder="Why is this confirmed redemption being refunded?"
            isRequired
            value={refundReason}
            onChange={setRefundReason}
            rows={4}
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setRefundTarget(null)}
            width="100%"
          />
          <Button
            label="Confirm refund"
            variant="destructive"
            isLoading={refundRedemptionMutation.isPending}
            isDisabled={!refundReason.trim()}
            onClick={refundRedemption}
            width="100%"
          />
        </HStack>
      </Dialog>

      {/* Redeem / Adjust */}
      <Dialog
        isOpen={showLedger}
        onOpenChange={setShowLedger}
        purpose="form"
        width={520}
      >
        <DialogHeader title="Adjust Points" onOpenChange={setShowLedger} />
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
          <NumberInput
            label="Points Adjustment (signed)"
            placeholder="e.g. 50 or -50"
            isRequired
            hasClear
            value={ledger.points}
            onChange={(v) => setLedger({ ...ledger, points: v })}
          />
          <TextInput
            label="Description"
            placeholder="e.g. Refund correction"
            isOptional
            value={ledger.description}
            onChange={(v) => setLedger({ ...ledger, description: v })}
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowLedger(false)}
            width="100%"
          />
          <Button
            label="Submit"
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
                  label="Order Amount (PKR)"
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
                      label="Unit Price (PKR)"
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
