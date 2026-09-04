"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import { useAdminTenants, useCreateTenant } from "@/lib/query";
import type { AdminTenant } from "@/types";
import { useRouter } from "next/navigation";

export default function AdminTenantsPage() {
  const router = useRouter();
  const { data: tenants = [], isLoading } = useAdminTenants();
  const createMutation = useCreateTenant();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    brandColor: "",
  });
  const showToast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      await createMutation.mutateAsync({
        name: form.name,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
        brandingConfig: {
          brandColor: form.brandColor || null,
        },
      });
      showToast({ type: "info", body: "Tenant created" });
      setShowForm(false);
      setForm({
        name: "",
        ownerName: "",
        ownerEmail: "",
        ownerPassword: "",
        brandColor: "",
      });
    } catch {
      showToast({ type: "error", body: "Failed to create tenant" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <AppLoading label="Loading tenants..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Tenants"
        description="Manage businesses on the platform"
        showButton={true}
        onClick={() => setShowForm(true)}
        showSearch={false}
        showFilter={false}
      />

      <Table
        data={tenants}
        idKey="id"
        hasHover
        emptyState={
          <EmptyState
            title="No tenants yet"
            description="Create your first tenant to get started"
            icon={<Icon icon={Building2} size="lg" />}
            actions={
              <Button
                label="Create Tenant"
                variant="primary"
                onClick={() => setShowForm(true)}
              />
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Tenant",
            renderCell: (t: AdminTenant) => (
              <Text type="body" weight="medium">
                {t.name}
              </Text>
            ),
          },
          {
            key: "owner",
            header: "Owner",
            renderCell: (t: AdminTenant) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={t.ownerName || "?"} size="sm" />
                <VStack gap={0} hAlign="stretch">
                  <Text type="body" maxLines={1}>
                    {t.ownerName || "—"}
                  </Text>
                  {t.ownerEmail && (
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {t.ownerEmail}
                    </Text>
                  )}
                </VStack>
              </HStack>
            ),
          },
          {
            key: "customers",
            header: "Customers",
            renderCell: (t: AdminTenant) => (
              <Text type="body" hasTabularNumbers>
                {t.customerCount}
              </Text>
            ),
          },
          {
            key: "rewards",
            header: "Redemption Rules",
            renderCell: (t: AdminTenant) => (
              <Text type="body" hasTabularNumbers>
                {t.rewardCount}
              </Text>
            ),
          },
          {
            key: "status",
            header: "Status",
            renderCell: (t: AdminTenant) =>
              t.suspended ? (
                <Badge variant="red" label="Suspended" />
              ) : (
                <Badge variant="green" label="Active" />
              ),
          },
          {
            key: "actions",
            header: "Actions",
            renderCell: (t: AdminTenant) => (
              <Button
                label="Manage"
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/admin/tenants/${t.id}`)}
              />
            ),
          },
        ]}
      />

      <Dialog
        isOpen={showForm}
        onOpenChange={setShowForm}
        purpose="form"
        width={480}
      >
        <DialogHeader title="Create Tenant" onOpenChange={setShowForm} />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Business Name"
            placeholder="e.g. Acme Coffee"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <TextInput
            label="Owner Name"
            placeholder="Owner's full name"
            value={form.ownerName}
            onChange={(v) => setForm({ ...form, ownerName: v })}
            isRequired
          />
          <TextInput
            label="Owner Email"
            type="email"
            placeholder="owner@acme.com"
            value={form.ownerEmail}
            onChange={(v) => setForm({ ...form, ownerEmail: v })}
            isRequired
          />
          <TextInput
            label="Owner Password"
            type="password"
            placeholder="At least 6 characters"
            value={form.ownerPassword}
            onChange={(v) => setForm({ ...form, ownerPassword: v })}
            isRequired
          />
          <TextInput
            label="Brand Color (hex, optional)"
            placeholder="e.g. #C47F17"
            value={form.brandColor}
            onChange={(v) => setForm({ ...form, brandColor: v })}
            isOptional
          />
        </VStack>
        <HStack gap={3} style={{ marginTop: 20 }}>
          <Button
            label="Cancel"
            variant="secondary"
            onClick={() => setShowForm(false)}
            width="100%"
          />
          <Button
            label="Create"
            variant="primary"
            isLoading={saving}
            isDisabled={
              !form.name ||
              !form.ownerName ||
              !form.ownerEmail ||
              form.ownerPassword.length < 6
            }
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>
    </VStack>
  );
}
