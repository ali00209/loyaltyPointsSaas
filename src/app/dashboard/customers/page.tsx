"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from "@/lib/query";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "" });
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateCustomerMutation.mutateAsync({
          id: editing.id,
          input: form,
        });
        showToast({ type: "info", body: "Customer updated" });
      } else {
        await createCustomerMutation.mutateAsync(form);
        showToast({ type: "info", body: "Customer created" });
      }
      setShowForm(false);
    } catch {
      showToast({ type: "error", body: "Failed to save customer" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (c: Customer) => {
    alert.show({
      title: "Delete customer?",
      description: `"${c.name}" will be permanently deleted, along with their transaction history. This action cannot be undone.`,
      actionLabel: "Delete",
      onAction: async () => {
        try {
          await deleteCustomerMutation.mutateAsync(c.id);
          showToast({ type: "info", body: "Customer deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete customer" });
        }
      },
    });
  };

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search);
    return matchSearch;
  });

  if (isLoading) {
    return <AppLoading label="Loading customers..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Customers"
        description={`${customers.length} total customers`}
        showButton={true}
        onClick={openCreate}
        search={search}
        setSearch={setSearch}
        showFilter={false}
      />

      <Table
        data={filtered}
        idKey="id"
        hasHover
        textOverflow="truncate"
        emptyState={
          <EmptyState
            title="No customers found"
            description={
              search ? "Try different filters" : "Add your first customer"
            }
            icon={<Icon icon={Users} size="lg" />}
            actions={
              !search ? (
                <Button
                  label="Add Your First Customer"
                  variant="primary"
                  onClick={openCreate}
                />
              ) : undefined
            }
          />
        }
        columns={[
          {
            key: "name",
            header: "Customer",
            renderCell: (c: Customer) => (
              <HStack gap={2} vAlign="center">
                <Avatar name={c.name} size="sm" />
                <Text type="body" weight="medium">
                  {c.name}
                </Text>
              </HStack>
            ),
          },
          {
            key: "contact",
            header: "Contact",
            renderCell: (c: Customer) => (
              <VStack gap={0} hAlign="stretch">
                {c.email && (
                  <Text type="body" color="secondary" maxLines={1}>
                    {c.email}
                  </Text>
                )}
                {c.phone && (
                  <Text type="supporting" color="secondary" maxLines={1}>
                    {c.phone}
                  </Text>
                )}
                {!c.email && !c.phone && (
                  <Text type="supporting" color="disabled">
                    No contact info
                  </Text>
                )}
              </VStack>
            ),
          },
          {
            key: "totalPoints",
            header: "Balance",
            renderCell: (c: Customer) => (
              <Text type="body" weight="medium" hasTabularNumbers>
                {c.currentBalance.toLocaleString()}
              </Text>
            ),
          },
          {
            key: "lifetimePoints",
            header: "Lifetime",
            renderCell: (c: Customer) => (
              <Text type="body" color="secondary" hasTabularNumbers>
                {c.totalPointsEarned.toLocaleString()}
              </Text>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            align: "center",
            renderCell: (c: Customer) => (
              <HStack gap={1} hAlign="center">
                <Button
                  label="Edit"
                  variant="primary"
                  size="sm"
                  onClick={() => openEdit(c)}
                />
                <Button
                  label="Delete"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(c)}
                />
              </HStack>
            ),
          },
        ]}
      />

      <Dialog
        isOpen={showForm}
        onOpenChange={setShowForm}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title={editing ? "Edit Customer" : "New Customer"}
          onOpenChange={setShowForm}
        />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Name"
            placeholder="Customer name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <TextInput
            label="Email"
            type="email"
            placeholder="customer@email.com"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            isOptional
          />
          <TextInput
            label="Phone"
            placeholder="+1-555-0100"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
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
            label={editing ? "Update" : "Create"}
            variant="primary"
            isLoading={saving}
            isDisabled={!form.name}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {alert.element}
    </VStack>
  );
}
