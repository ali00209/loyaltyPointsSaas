"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { VStack, HStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { Table, pixel, proportional } from "@astryxdesign/core/Table";
import { Switch } from "@astryxdesign/core/Switch";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { useImperativeAlertDialog } from "@astryxdesign/core/AlertDialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { useToast } from "@astryxdesign/core/Toast";
import AppLoading from "@/components/AppLoading";
import AppHeader from "@/components/AppHeader";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/lib/query";
import type { Product, ProductInput } from "@/types";

const CATEGORIES = [
  "General",
  "Beverages",
  "Food",
  "Bakery",
  "Retail",
  "Electronics",
  "Clothing",
  "Other",
];

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    price: null as number | null,
    category: "General",
  });
  const showToast = useToast();
  const alert = useImperativeAlertDialog();

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", sku: "", price: null, category: "General" });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      price: parseFloat(p.price),
      category: p.category,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ProductInput = { ...form, price: String(form.price) };
      if (editing) {
        await updateProductMutation.mutateAsync({ id: editing.id, input: payload });
        showToast({ type: "info", body: "Product updated" });
      } else {
        await createProductMutation.mutateAsync(payload);
        showToast({ type: "info", body: "Product created" });
      }
      setShowForm(false);
    } catch {
      showToast({ type: "error", body: "Failed to save product" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (p: Product) => {
    alert.show({
      title: "Delete product?",
      description: `"${p.name}" will be permanently deleted. This action cannot be undone.`,
      actionLabel: "Delete",
      isActionLoading: deletingId === p.id,
      onAction: async () => {
        setDeletingId(p.id);
        try {
          await deleteProductMutation.mutateAsync(p.id);
          showToast({ type: "info", body: "Product deleted" });
          alert.hide();
        } catch {
          showToast({ type: "error", body: "Failed to delete product" });
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  const handleToggle = (p: Product) => ({
    changeAction: async (checked: boolean) => {
      try {
        await updateProductMutation.mutateAsync({
          id: p.id,
          input: { active: checked },
        });
      } catch {
        showToast({ type: "error", body: "Failed to update product status" });
      }
    },
  });

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  if (isLoading) {
    return <AppLoading label="Loading products..." />;
  }

  return (
    <VStack gap={6} hAlign="stretch">
      <AppHeader
        heading="Products"
        description="Manage your product catalog for loyalty rules"
        showButton={true}
        onClick={openCreate}
        search={search}
        setSearch={setSearch}
      />

      {filtered.length === 0 ? (
        <Card padding={8}>
          <EmptyState
            title="No products found"
            description={
              search
                ? "Try a different search term"
                : "Add your first product to get started"
            }
            icon={<Icon icon={Package} size="lg" />}
            actions={
              !search ? (
                <Button
                  label="Add Your First Product"
                  variant="primary"
                  onClick={openCreate}
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
          density="balanced"
          textOverflow="truncate"
          columns={[
            {
              key: "name",
              header: "Product",
              width: proportional(2),
              renderCell: (p: Product) => (
                <Text type="body" weight="medium">
                  {p.name}
                </Text>
              ),
            },
            {
              key: "sku",
              header: "SKU",
              width: proportional(1),
              renderCell: (p: Product) => (
                <Text type="code" color="secondary">
                  {p.sku}
                </Text>
              ),
            },
            {
              key: "price",
              header: "Price",
              align: "end",
              width: pixel(100),
              renderCell: (p: Product) => (
                <Text type="body" weight="medium" hasTabularNumbers>
                  ${parseFloat(p.price).toFixed(2)}
                </Text>
              ),
            },
            {
              key: "category",
              header: "Category",
              width: pixel(140),
              renderCell: (p: Product) => (
                <Badge variant="neutral" label={p.category} />
              ),
            },
            {
              key: "status",
              header: "Status",
              width: pixel(110),
              renderCell: (p: Product) => (
                <Switch
                  label={`${p.name} status`}
                  isLabelHidden
                  value={p.active}
                  changeAction={handleToggle(p).changeAction}
                />
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "end",
              width: pixel(150),
              renderCell: (p: Product) => (
                <HStack gap={1} hAlign="end">
                  <Button
                    label="Edit"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(p)}
                  />
                  <Button
                    label="Delete"
                    variant="ghost"
                    size="sm"
                    className="text-(--color-text-red)"
                    onClick={() => handleDelete(p)}
                  />
                </HStack>
              ),
            },
          ]}
        />
      )}

      <Dialog
        isOpen={showForm}
        onOpenChange={setShowForm}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title={editing ? "Edit Product" : "New Product"}
          onOpenChange={setShowForm}
        />
        <VStack gap={3} hAlign="stretch">
          <TextInput
            label="Name"
            placeholder="Product name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            isRequired
          />
          <TextInput
            label="SKU"
            placeholder="PRD-001"
            value={form.sku}
            onChange={(v) => setForm({ ...form, sku: v })}
            isRequired
          />
          <NumberInput
            label="Price ($)"
            placeholder="0.00"
            value={form.price}
            onChange={(v) => setForm({ ...form, price: v })}
            min={0}
            step={0.01}
            isRequired
          />
          <Selector
            label="Category"
            options={CATEGORIES}
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
          />
        </VStack>
        <HStack gap={3}>
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
            isDisabled={!form.name || !form.sku || form.price === null}
            onClick={handleSave}
            width="100%"
          />
        </HStack>
      </Dialog>

      {alert.element}
    </VStack>
  );
}
