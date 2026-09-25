"use client";

import { useMemo, useState } from "react";
import { Plus, Printer, Receipt, Trash2 } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Table } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Selector } from "@astryxdesign/core/Selector";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { ScrollableArea } from "@astryxdesign/core";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppInvoicePrint from "@/components/AppInvoicePrint";
import { InvoiceStatusBadge } from "@/components/InvoiceStatusBadge";
import {
  useAdminInvoices,
  useAdminTenants,
  useCreateAdminInvoice,
  useIssueInvoice,
  useRecordPayment,
  useUpdateAdminInvoiceDraft,
  useVoidInvoice,
} from "@/lib/query";
import { formatPKR } from "@/lib/money";
import type { Invoice, InvoiceLineItem } from "@/types";

interface LineEdit {
  description: string;
  quantity: number;
  unitPrice: string;
}

const emptyLine: LineEdit = { description: "", quantity: 1, unitPrice: "" };

function toLineItems(rows: LineEdit[]): InvoiceLineItem[] {
  return rows
    .filter((r) => r.description.trim() && Number(r.unitPrice) > 0)
    .map((r) => ({
      description: r.description.trim(),
      quantity: r.quantity,
      unitPrice: String(Number(r.unitPrice)),
    }));
}

function parseLineItems(items: InvoiceLineItem[]): LineEdit[] {
  return items.map((i) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));
}

export default function AdminInvoicesPage() {
  const toast = useToast();
  const { data: invoices = [], isLoading } = useAdminInvoices();
  const { data: tenants = [] } = useAdminTenants();
  const createInvoice = useCreateAdminInvoice();
  const updateInvoiceDraft = useUpdateAdminInvoiceDraft();
  const issueInvoice = useIssueInvoice();
  const voidInvoice = useVoidInvoice();
  const recordPayment = useRecordPayment();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [rows, setRows] = useState<LineEdit[]>([emptyLine]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("bank");
  const [payReference, setPayReference] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  const tenantOptions = useMemo(
    () => tenants.map((t) => ({ value: t.id, label: t.name })),
    [tenants],
  );

  const rowSubtotal = (r: LineEdit) =>
    (Number(r.unitPrice) || 0) * (r.quantity || 0);
  const editorSubtotal = rows.reduce((sum, r) => sum + rowSubtotal(r), 0);
  const editorTax = (editorSubtotal * taxPercent) / 100;

  if (isLoading) {
    return <AppLoading label="Loading invoices..." />;
  }

  const openCreate = () => {
    setEditing(null);
    setTenantId(tenantOptions[0]?.value ?? "");
    setRows([emptyLine]);
    setTaxPercent(0);
    setMemo("");
    setEditorOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setTenantId(inv.tenantId);
    setRows(parseLineItems(inv.lineItems));
    setTaxPercent(Number(inv.taxPercent));
    setMemo(inv.memo ?? "");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId) {
      toast({ type: "error", body: "Choose a merchant" });
      return;
    }
    const lineItems = toLineItems(rows);
    if (lineItems.length === 0) {
      toast({ type: "error", body: "Add at least one line item" });
      return;
    }
    const input = { tenantId, lineItems, taxPercent, memo: memo || null };
    setSaving(true);
    try {
      if (editing) {
        await updateInvoiceDraft.mutateAsync({ id: editing.id, input });
      } else {
        await createInvoice.mutateAsync(input);
      }
      toast({ type: "info", body: editing ? "Draft updated" : "Draft created" });
      setEditorOpen(false);
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to save invoice",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = async (inv: Invoice) => {
    try {
      await issueInvoice.mutateAsync(inv.id);
      toast({ type: "info", body: `Invoice ${inv.invoiceNumber ?? ""} issued` });
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to issue invoice",
      });
    }
  };

  const handleVoid = async (inv: Invoice) => {
    try {
      await voidInvoice.mutateAsync(inv.id);
      toast({ type: "info", body: "Invoice voided" });
      if (selected?.id === inv.id) setSelected(null);
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to void invoice",
      });
    }
  };

  const handleRecordPayment = async () => {
    if (!selected || !payAmount || payAmount <= 0) {
      toast({ type: "error", body: "Enter a positive payment amount" });
      return;
    }
    setPaySaving(true);
    try {
      await recordPayment.mutateAsync({
        invoiceId: selected.id,
        input: {
          amount: payAmount,
          method: payMethod,
          reference: payReference || null,
          note: null,
        },
      });
      toast({ type: "info", body: "Payment recorded" });
      setPayAmount(0);
      setPayReference("");
    } catch (err) {
      toast({
        type: "error",
        body: err instanceof Error ? err.message : "Failed to record payment",
      });
    } finally {
      setPaySaving(false);
    }
  };

  const isPaidOrVoided =
    selected?.effectiveStatus === "paid" || selected?.effectiveStatus === "voided";

  return (
    <VStack gap={6} hAlign="stretch">
      <HStack hAlign="between" vAlign="center">
        <VStack gap={1}>
          <Heading level={1}>Invoices</Heading>
          <Text type="body" color="secondary">
            Draft and issue invoices to merchants, record offline payments
          </Text>
        </VStack>
        <Button
          label="New invoice"
          variant="primary"
          icon={<Plus size="1em" />}
          onClick={openCreate}
        />
      </HStack>

      <Table
        data={invoices}
        idKey="id"
        hasHover
        emptyState={
          <EmptyState
            title="No invoices yet"
            description="Invoices appear here once subscriptions bill or you create one."
            icon={<Receipt size="1em" />}
            actions={
              <Button label="New invoice" variant="primary" onClick={openCreate} />
            }
          />
        }
        columns={[
          {
            key: "tenantName",
            header: "Merchant",
            renderCell: (inv: Invoice) => (
              <Text type="body" weight="medium">
                {inv.tenantName ?? inv.tenantId.slice(0, 8)}
              </Text>
            ),
          },
          {
            key: "number",
            header: "Invoice",
            renderCell: (inv: Invoice) => (
              <Text type="body">{inv.invoiceNumber ?? "Draft"}</Text>
            ),
          },
          {
            key: "total",
            header: "Total",
            align: "end",
            renderCell: (inv: Invoice) => (
              <Text type="body" hasTabularNumbers>
                {formatPKR(inv.total)}
              </Text>
            ),
          },
          {
            key: "status",
            header: "Status",
            renderCell: (inv: Invoice) => (
              <InvoiceStatusBadge status={inv.effectiveStatus} />
            ),
          },
          {
            key: "due",
            header: "Due",
            renderCell: (inv: Invoice) => (
              <Text type="supporting" color="secondary">
                {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            renderCell: (inv: Invoice) => (
              <Button
                label="Manage"
                size="sm"
                variant="secondary"
                onClick={() => setSelected(inv)}
              />
            ),
          },
        ]}
      />

      {/* Create / edit draft dialog */}
      <Dialog
        isOpen={editorOpen}
        onOpenChange={setEditorOpen}
        purpose="form"
        width={560}
      >
        <DialogHeader
          title={editing ? "Edit Draft" : "New Invoice"}
          onOpenChange={() => setEditorOpen(false)}
        />
        <ScrollableArea label="" height={"60vh"}>
          <VStack gap={4} hAlign="stretch">
            <Selector
              label="Merchant"
              value={tenantId}
              options={tenantOptions}
              onChange={setTenantId}
            />
            <VStack gap={2} hAlign="stretch">
              <Text type="label" weight="bold">
                Line items
              </Text>
              {rows.map((row, i) => (
                <HStack key={i} gap={2} vAlign="end">
                  <TextInput
                    label="Description"
                    isLabelHidden={i !== 0}
                    value={row.description}
                    onChange={(v) =>
                      setRows(
                        rows.map((r, j) =>
                          j === i ? { ...r, description: v } : r,
                        ),
                      )
                    }
                    width="100%"
                  />
                  <NumberInput
                    label="Qty"
                    isLabelHidden={i !== 0}
                    value={row.quantity}
                    onChange={(v) =>
                      setRows(
                        rows.map((r, j) =>
                          j === i ? { ...r, quantity: v ?? 0 } : r,
                        ),
                      )
                    }
                    min={1}
                    width={72}
                  />
                  <NumberInput
                    label="Unit price"
                    isLabelHidden={i !== 0}
                    value={Number(row.unitPrice)}
                    onChange={(v) =>
                      setRows(
                        rows.map((r, j) =>
                          j === i ? { ...r, unitPrice: String(v ?? 0) } : r,
                        ),
                      )
                    }
                    min={0}
                    width={130}
                  />
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size="1em" />}
                    isDisabled={rows.length === 1}
                    onClick={() =>
                      setRows(rows.filter((_, j) => j !== i))
                    }
                  />
                </HStack>
              ))}
              <Button
                label="Add line"
                size="sm"
                variant="secondary"
                onClick={() => setRows([...rows, emptyLine])}
              />
            </VStack>
            <HStack gap={3}>
              <NumberInput
                label="Tax %"
                value={taxPercent}
                onChange={setTaxPercent}
                min={0}
                isOptional
              />
              <TextInput
                label="Memo"
                value={memo}
                onChange={setMemo}
                placeholder="Optional note on the invoice"
                isOptional
              />
            </HStack>
            <HStack hAlign="end">
              <VStack gap={0} hAlign="stretch" width={260}>
                <HStack hAlign="between">
                  <Text type="supporting">Subtotal</Text>
                  <Text type="body">{formatPKR(editorSubtotal)}</Text>
                </HStack>
                <HStack hAlign="between">
                  <Text type="supporting">Tax ({taxPercent}%)</Text>
                  <Text type="body">{formatPKR(editorTax)}</Text>
                </HStack>
                <HStack hAlign="between">
                  <Text type="body" weight="bold">
                    Total
                  </Text>
                  <Text type="body" weight="bold" hasTabularNumbers>
                    {formatPKR(editorSubtotal + editorTax)}
                  </Text>
                </HStack>
              </VStack>
            </HStack>
          </VStack>
        </ScrollableArea>
        <HStack gap={3} paddingBlockStart={4}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setEditorOpen(false)}
            width="100%"
          />
          <Button
            label={editing ? "Save" : "Create draft"}
            variant="primary"
            isLoading={saving}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        isOpen={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        purpose="form"
        width={560}
      >
        {selected && (
          <>
            <DialogHeader
              title={selected.invoiceNumber ?? "Draft invoice"}
              onOpenChange={() => setSelected(null)}
              endContent={
                <Button
                  label="Print"
                  variant="secondary"
                  size="sm"
                  icon={<Printer size="1em" />}
                  onClick={() => window.print()}
                />
              }
            />
            <ScrollableArea label="" height={"60vh"}>
              <VStack gap={4} hAlign="stretch">
                <AppInvoicePrint>
                  <HStack gap={3} vAlign="center" wrap="wrap">
                  <Text type="body" weight="medium">
                    {selected.tenantName ?? selected.tenantId}
                  </Text>
                  <InvoiceStatusBadge status={selected.effectiveStatus} />
                  {selected.memo && (
                    <Text type="supporting" color="secondary">
                      {selected.memo}
                    </Text>
                  )}
                </HStack>

                <Table
                  data={selected.lineItems}
                  idKey="description"
                  hasHover
                  density="compact"
                  columns={[
                    {
                      key: "description",
                      header: "Description",
                      renderCell: (item) => (
                        <Text type="body">{item.description}</Text>
                      ),
                    },
                    {
                      key: "quantity",
                      header: "Qty",
                      align: "end",
                      renderCell: (item) => (
                        <Text type="body">{item.quantity.toLocaleString()}</Text>
                      ),
                    },
                    {
                      key: "amount",
                      header: "Amount",
                      align: "end",
                      renderCell: (item) => (
                        <Text type="body" hasTabularNumbers>
                          {formatPKR(
                            (Number(item.unitPrice) * item.quantity).toFixed(2),
                          )}
                        </Text>
                      ),
                    },
                  ]}
                />

                <HStack hAlign="end">
                  <VStack gap={0} hAlign="stretch" width={260}>
                    <HStack hAlign="between">
                      <Text type="supporting">Subtotal</Text>
                      <Text type="body">{formatPKR(selected.subtotal)}</Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text type="supporting">Tax</Text>
                      <Text type="body">{formatPKR(selected.taxAmount)}</Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text type="body" weight="bold">
                        Total
                      </Text>
                      <Text type="body" weight="bold" hasTabularNumbers>
                        {formatPKR(selected.total)}
                      </Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text type="supporting">Paid</Text>
                      <Text type="body">{formatPKR(selected.paid)}</Text>
                    </HStack>
                    <HStack hAlign="between">
                      <Text type="supporting">Outstanding</Text>
                      <Text type="body" weight="medium" hasTabularNumbers>
                        {formatPKR(selected.outstanding)}
                      </Text>
                    </HStack>
                    {selected.issuedAt && (
                      <Text type="supporting" color="secondary">
                        Issued {new Date(selected.issuedAt).toLocaleDateString()}
                        {selected.dueAt
                          ? ` · due ${new Date(selected.dueAt).toLocaleDateString()}`
                          : ""}
                      </Text>
                    )}
                  </VStack>
                </HStack>

                {selected.payments.length > 0 && (
                  <VStack gap={2} hAlign="stretch">
                    <Text type="label" weight="bold">
                      Payments
                    </Text>
                    {selected.payments.map((p) => (
                      <HStack key={p.id} gap={2} hAlign="between" wrap="wrap">
                        <Text type="body">
                          {formatPKR(p.amount)} · {p.method}
                          {p.reference ? ` (${p.reference})` : ""}
                        </Text>
                        <Text type="supporting" color="secondary">
                          {new Date(p.paidAt).toLocaleDateString()}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                )}
                </AppInvoicePrint>

                {!isPaidOrVoided && selected.status !== "draft" && (
                  <Card padding={4}>
                    <VStack gap={3} hAlign="stretch">
                      <Text type="label" weight="bold">
                        Record payment
                      </Text>
                      <HStack gap={2} vAlign="end">
                        <NumberInput
                          label="Amount"
                          value={payAmount}
                          onChange={setPayAmount}
                          min={0}
                        />
                        <Selector
                          label="Method"
                          value={payMethod}
                          options={[
                            { value: "bank", label: "Bank transfer" },
                            { value: "cash", label: "Cash" },
                            { value: "check", label: "Check" },
                            { value: "jazzcash", label: "JazzCash" },
                            { value: "easypaisa", label: "EasyPaisa" },
                          ]}
                          onChange={setPayMethod}
                        />
                        <TextInput
                          label="Reference"
                          value={payReference}
                          onChange={setPayReference}
                          placeholder="Optional"
                          isOptional
                        />
                      </HStack>
                      <Button
                        label="Record payment"
                        variant="primary"
                        isLoading={paySaving}
                        onClick={handleRecordPayment}
                      />
                    </VStack>
                  </Card>
                )}

                <HStack gap={3}>
                  {selected.status === "draft" && (
                    <>
                      <Button
                        label="Edit draft"
                        variant="secondary"
                        width="100%"
                        onClick={() => {
                          setSelected(null);
                          openEdit(selected);
                        }}
                      />
                      <Button
                        label="Issue"
                        variant="primary"
                        width="100%"
                        onClick={() => handleIssue(selected)}
                      />
                      <Button
                        label="Void"
                        variant="destructive"
                        width="100%"
                        onClick={() => handleVoid(selected)}
                      />
                    </>
                  )}
                </HStack>
              </VStack>
            </ScrollableArea>
          </>
        )}
      </Dialog>
    </VStack>
  );
}