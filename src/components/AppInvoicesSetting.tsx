"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Table } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { ScrollableArea } from "@astryxdesign/core";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import AppLoading from "@/components/AppLoading";
import AppInvoicePrint from "@/components/AppInvoicePrint";
import { InvoiceStatusBadge } from "@/components/InvoiceStatusBadge";
import { useBillingInvoices } from "@/lib/query";
import { formatPKR } from "@/lib/money";
import type { Invoice } from "@/types";

function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  return (
    <VStack gap={4} hAlign="stretch">
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Heading level={3}>
          {invoice.invoiceNumber ?? "Draft invoice"}
        </Heading>
        <InvoiceStatusBadge status={invoice.effectiveStatus} />
      </HStack>
      {invoice.periodStart && invoice.periodEnd ? (
        <Text type="supporting" color="secondary">
          Billing period: {invoice.periodStart} – {invoice.periodEnd}
        </Text>
      ) : null}

      <VStack gap={2} hAlign="stretch">
        <Text type="label" weight="bold">
          Line items
        </Text>
        <Table
          data={invoice.lineItems}
          idKey="description"
          hasHover
          density="compact"
          columns={[
            {
              key: "description",
              header: "Description",
              renderCell: (item) => <Text type="body">{item.description}</Text>,
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
                  {formatPKR((Number(item.unitPrice) * item.quantity).toFixed(2))}
                </Text>
              ),
            },
          ]}
        />
      </VStack>

      <HStack hAlign="end">
        <VStack gap={1} hAlign="stretch" width={260}>
          <HStack hAlign="between">
            <Text type="supporting">Subtotal</Text>
            <Text type="body">{formatPKR(invoice.subtotal)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text type="supporting">Tax ({invoice.taxPercent}%)</Text>
            <Text type="body">{formatPKR(invoice.taxAmount)}</Text>
          </HStack>
          <HStack hAlign="between">
            <Text type="body" weight="bold">
              Total
            </Text>
            <Text type="body" weight="bold" hasTabularNumbers>
              {formatPKR(invoice.total)}
            </Text>
          </HStack>
          <HStack hAlign="between">
            <Text type="supporting">Paid</Text>
            <Text type="body" hasTabularNumbers>
              {formatPKR(invoice.paid)}
            </Text>
          </HStack>
          <HStack hAlign="between">
            <Text type="supporting">Outstanding</Text>
            <Text type="body" weight="medium" hasTabularNumbers>
              {formatPKR(invoice.outstanding)}
            </Text>
          </HStack>
        </VStack>
      </HStack>

      {invoice.payments.length > 0 && (
        <VStack gap={2} hAlign="stretch">
          <Text type="label" weight="bold">
            Payments
          </Text>
          {invoice.payments.map((p) => (
            <HStack key={p.id} gap={2} hAlign="between" wrap="wrap">
              <Text type="body">
                {formatPKR(p.amount)} via {p.method}
                {p.reference ? ` (${p.reference})` : ""}
              </Text>
              <Text type="supporting" color="secondary">
                {new Date(p.paidAt).toLocaleDateString()}
              </Text>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
}

export default function AppInvoicesSetting() {
  const { data: invoices = [], isLoading } = useBillingInvoices();
  const [selected, setSelected] = useState<Invoice | null>(null);

  if (isLoading) {
    return <AppLoading label="Loading invoices..." />;
  }

  return (
    <VStack gap={5} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={2}>Invoices</Heading>
        <Text type="supporting" color="secondary">
          Your monthly invoices from the platform. Pay offline and the admin
          records your payment.
        </Text>
      </VStack>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices appear here once a plan is active."
          isCompact
        />
      ) : (
        <Table
          data={invoices}
          idKey="id"
          hasHover
          columns={[
            {
              key: "number",
              header: "Invoice",
              renderCell: (inv) => (
                <Text type="body" weight="medium">
                  {inv.invoiceNumber ?? "Draft"}
                </Text>
              ),
            },
            {
              key: "period",
              header: "Period",
              renderCell: (inv) => (
                <Text type="supporting" color="secondary">
                  {inv.periodStart && inv.periodEnd
                    ? `${inv.periodStart} – ${inv.periodEnd}`
                    : "—"}
                </Text>
              ),
            },
            {
              key: "total",
              header: "Total",
              align: "end",
              renderCell: (inv) => (
                <Text type="body" hasTabularNumbers>
                  {formatPKR(inv.total)}
                </Text>
              ),
            },
            {
              key: "status",
              header: "Status",
              renderCell: (inv) => (
                <InvoiceStatusBadge status={inv.effectiveStatus} />
              ),
            },
            {
              key: "due",
              header: "Due",
              renderCell: (inv) => (
                <Text type="supporting" color="secondary">
                  {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
                </Text>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              renderCell: (inv) => (
                <Button
                  label="View"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected(inv)}
                />
              ),
            },
          ]}
        />
      )}

      <Dialog
        isOpen={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        purpose="form"
      >
        {selected && (
          <>
            <DialogHeader
              title="Invoice"
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
              <Card>
                <AppInvoicePrint>
                  <InvoiceDetail invoice={selected} />
                </AppInvoicePrint>
              </Card>
            </ScrollableArea>
          </>
        )}
      </Dialog>
    </VStack>
  );
}