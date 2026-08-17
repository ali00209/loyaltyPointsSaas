"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text, Heading } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Badge } from "@astryxdesign/core/Badge";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Switch } from "@astryxdesign/core/Switch";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Banner } from "@astryxdesign/core/Banner";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import {
  useAdminTenant,
  useAdminTenantCustomers,
  useAdminTenantTransactions,
  useUpdateTenant,
} from "@/lib/query";
import { eventLabel } from "@/lib/rules";
import type { Customer, Transaction } from "@/types";

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: tenant, isLoading: tenantLoading } = useAdminTenant(id);
  const { data: customers = [], isLoading: customersLoading } =
    useAdminTenantCustomers(id);
  const { data: transactions = [], isLoading: txLoading } =
    useAdminTenantTransactions(id);
  const updateMutation = useUpdateTenant();
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", brandColor: "", logoUrl: "" });
  const showToast = useToast();

  if (tenantLoading || !tenant) {
    return <AppLoading label="Loading tenant..." />;
  }

  const openEdit = () => {
    setForm({
      name: tenant.name,
      brandColor: tenant.brandingConfig?.brandColor || "",
      logoUrl: tenant.brandingConfig?.logoUrl || "",
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: tenant.id,
        input: {
          name: form.name,
          brandingConfig: {
            brandColor: form.brandColor || null,
            logoUrl: form.logoUrl || null,
          },
        },
      });
      showToast({ type: "info", body: "Tenant updated" });
      setShowEdit(false);
    } catch {
      showToast({ type: "error", body: "Failed to update tenant" });
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async (suspended: boolean) => {
    try {
      await updateMutation.mutateAsync({ id: tenant.id, input: { suspended } });
      showToast({
        type: "info",
        body: suspended ? "Tenant suspended" : "Tenant re-activated",
      });
    } catch {
      showToast({ type: "error", body: "Failed to update tenant status" });
    }
  };

  return (
    <VStack gap={6} hAlign="stretch">
      <HStack hAlign="between" vAlign="start">
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            <Heading level={1}>{tenant.name}</Heading>
            {tenant.suspended ? (
              <Badge variant="red" label="Suspended" />
            ) : (
              <Badge variant="green" label="Active" />
            )}
          </HStack>
          <Text type="body" color="secondary">
            Owner: {tenant.ownerName || "—"} · {tenant.ownerEmail || "—"}
          </Text>
        </VStack>
        <HStack gap={2}>
          <Switch
            label="Suspend tenant"
            value={tenant.suspended}
            changeAction={handleSuspend}
          />
          <Button label="Edit" variant="secondary" onClick={openEdit} />
        </HStack>
      </HStack>

      {tenant.suspended && (
        <Banner
          status="error"
          title="This tenant is suspended. Its owner cannot sign in and its loyalty program is inactive."
          container="card"
        />
      )}

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <HStack hAlign="between">
            <Heading level={2}>Earning Rules</Heading>
          </HStack>
          {tenant.assignedRules.length === 0 ? (
            <EmptyState
              title="No rules yet"
              description="This tenant hasn't created any earning rules"
              isCompact
            />
          ) : (
            <VStack gap={2} hAlign="stretch">
              {tenant.assignedRules.map((r) => (
                <HStack key={r.id} hAlign="between">
                  <Text type="body" weight="medium">
                    {r.name}
                  </Text>
                  <HStack gap={2}>
                    <Text type="supporting" color="secondary">
                      {eventLabel(r.eventType)} · {r.formulaText}
                    </Text>
                    {r.active ? (
                      <Badge variant="green" label="Active" />
                    ) : (
                      <Badge variant="neutral" label="Off" />
                    )}
                  </HStack>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={2}>Customers ({customers.length})</Heading>
          {customersLoading || customers.length === 0 ? (
            <EmptyState title="No customers yet" isCompact />
          ) : (
            <Table
              data={customers}
              idKey="id"
              hasHover
              density="compact"
              textOverflow="truncate"
              columns={[
                {
                  key: "name",
                  header: "Customer",
                  renderCell: (c: Customer) => (
                    <Text type="body" weight="medium">
                      {c.name}
                    </Text>
                  ),
                },
                {
                  key: "email",
                  header: "Email",
                  renderCell: (c: Customer) => (
                    <Text type="body" color="secondary" maxLines={1}>
                      {c.email || "—"}
                    </Text>
                  ),
                },
                {
                  key: "balance",
                  header: "Balance",
                  align: "end",
                  width: pixel(110),
                  renderCell: (c: Customer) => (
                    <Text type="body" hasTabularNumbers>
                      {c.currentBalance.toLocaleString()}
                    </Text>
                  ),
                },
                {
                  key: "lifetime",
                  header: "Lifetime",
                  align: "end",
                  width: pixel(110),
                  renderCell: (c: Customer) => (
                    <Text type="body" color="secondary" hasTabularNumbers>
                      {c.totalPointsEarned.toLocaleString()}
                    </Text>
                  ),
                },
              ]}
            />
          )}
        </VStack>
      </Card>

      <Card padding={6}>
        <VStack gap={4} hAlign="stretch">
          <Heading level={2}>
            Recent Transactions ({transactions.length})
          </Heading>
          {txLoading || transactions.length === 0 ? (
            <EmptyState title="No transactions yet" isCompact />
          ) : (
            <Table
              data={transactions.slice(0, 20)}
              idKey="id"
              hasHover
              density="compact"
              textOverflow="truncate"
              columns={[
                {
                  key: "customer",
                  header: "Customer",
                  renderCell: (t: Transaction) => (
                    <Text type="body" weight="medium" maxLines={1}>
                      {t.customerName || "Unknown"}
                    </Text>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  renderCell: (t: Transaction) => (
                    <Badge
                      variant={
                        t.transactionType === "earn"
                          ? "green"
                          : t.transactionType === "redeem"
                            ? "red"
                            : "blue"
                      }
                      label={t.transactionType}
                    />
                  ),
                },
                {
                  key: "points",
                  header: "Points",
                  renderCell: (t: Transaction) => (
                    <Text type="body" hasTabularNumbers>
                      {t.points > 0 ? "+" : ""}
                      {t.points}
                    </Text>
                  ),
                },
                {
                  key: "description",
                  header: "Description",
                  renderCell: (t: Transaction) => (
                    <Text type="body" color="secondary" maxLines={1}>
                      {t.description || "—"}
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
        </VStack>
      </Card>

      <Dialog
        isOpen={showEdit}
        onOpenChange={setShowEdit}
        purpose="form"
        width={440}
      >
        <DialogHeader title="Edit Tenant" onOpenChange={setShowEdit} />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Business Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <TextInput
            label="Brand Color (hex)"
            placeholder="e.g. #C47F17"
            value={form.brandColor}
            onChange={(v) => setForm({ ...form, brandColor: v })}
            isOptional
          />
          <TextInput
            label="Logo URL"
            placeholder="https://..."
            value={form.logoUrl}
            onChange={(v) => setForm({ ...form, logoUrl: v })}
            isOptional
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowEdit(false)}
            width="100%"
          />
          <Button
            label="Save"
            variant="primary"
            isLoading={saving}
            isDisabled={!form.name}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
