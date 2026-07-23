"use client";

import { useMemo, useState, FormEvent } from "react";
import { Plus, Package, Pencil, Trash2, Search, Info, X } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import {
  addDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/firestore-crud";
import { useCompany } from "@/lib/company-context";
import { Category, Product, RawMaterial, BOMLine } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StockHealthBadge } from "@/components/StockHealthBadge";

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  sellingPrice: "",
  quantity: "",
  reorderLevel: "",
  unit: "pcs",
  imageUrl: "",
};

interface DraftBOMLine {
  rawMaterialId: string;
  quantityRequired: string;
}

export default function ProductsPage() {
  const { activeCompanyId } = useCompany();
  const {
    data: products,
    loading,
    error,
  } = useCompanyCollection<Product>("products", "updatedAt");
  const { data: categories } = useCompanyCollection<Category>("categories");
  const { data: rawMaterials } =
    useCompanyCollection<RawMaterial>("rawMaterials");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [bomLines, setBomLines] = useState<DraftBOMLine[]>([]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !categoryFilter || p.categoryId === categoryFilter;
      const matchesHealth =
        !healthFilter ||
        (healthFilter === "low" &&
          p.quantity > 0 &&
          p.quantity <= p.reorderLevel) ||
        (healthFilter === "out" && p.quantity <= 0) ||
        (healthFilter === "ok" && p.quantity > p.reorderLevel);
      return matchesSearch && matchesCategory && matchesHealth;
    });
  }, [products, search, categoryFilter, healthFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setBomLines([]);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      sku: p.sku,
      name: p.name,
      description: p.description ?? "",
      categoryId: p.categoryId ?? "",
      sellingPrice: String(p.sellingPrice),
      quantity: String(p.quantity),
      reorderLevel: String(p.reorderLevel),
      unit: p.unit,
      imageUrl: p.imageUrl ?? "",
    });
    setBomLines(
      (p.bom ?? []).map((line) => ({
        rawMaterialId: line.rawMaterialId,
        quantityRequired: String(line.quantityRequired),
      })),
    );
    setModalOpen(true);
  }

  function addBomLine() {
    setBomLines((prev) => [
      ...prev,
      { rawMaterialId: "", quantityRequired: "" },
    ]);
  }

  function updateBomLine(index: number, patch: Partial<DraftBOMLine>) {
    setBomLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  function removeBomLine(index: number) {
    setBomLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim() || !activeCompanyId) return;
    setSaving(true);
    try {
      const category = categories.find((c) => c.id === form.categoryId);

      const bom: BOMLine[] = bomLines
        .filter((l) => l.rawMaterialId && Number(l.quantityRequired) > 0)
        .map((l) => {
          const material = rawMaterials.find((m) => m.id === l.rawMaterialId)!;
          return {
            rawMaterialId: material.id,
            rawMaterialName: material.name,
            sku: material.sku,
            unit: material.unit,
            quantityRequired: Number(l.quantityRequired),
          };
        });

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description,
        categoryId: form.categoryId || undefined,
        categoryName: category?.name,
        sellingPrice: Number(form.sellingPrice) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unit: form.unit || "pcs",
        imageUrl: form.imageUrl,
        bom,
        updatedAt: Date.now(),
      };

      if (editing) {
        // Quantity is intentionally NOT editable here — it only changes
        // through Production (building units) or Stock Movements, so the
        // history log always matches reality.
        await updateDocument<Product>("products", editing.id, payload);
        toast.success("Product updated");
      } else {
        await addDocument<Omit<Product, "id">>("products", {
          ...payload,
          companyId: activeCompanyId,
          quantity: Number(form.quantity) || 0,
          createdAt: Date.now(),
        });
        toast.success("Product added");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the product. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDocument("products", deleting.id);
      toast.success("Product deleted");
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="The finished devices you build and sell, and the recipe (Bill of Materials) each one needs."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-600"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600"
        >
          <option value="">All stock levels</option>
          <option value="ok">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
      </div>

      <Card>
        {error ? (
          <div className="p-6 text-sm text-danger-500">
            Couldn't load categories: {error}
          </div>
        ) : loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title={
              products.length === 0
                ? "No products yet"
                : "No products match your filters"
            }
            description={
              products.length === 0
                ? "Add your first device to start tracking finished-goods stock and its Bill of Materials."
                : "Try a different search term or clear the filters."
            }
            action={
              products.length === 0 && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add your first product
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Qty on hand</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">BOM</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-400">SKU: {p.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {p.categoryName || "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {p.quantity} {p.unit}
                    </td>
                    <td className="px-5 py-3">
                      <StockHealthBadge item={p} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {p.bom?.length
                        ? `${p.bom.length} material(s)`
                        : "Not set"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      ₹{p.sellingPrice.toFixed(2)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(p)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit product" : "Add product"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SKU"
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="CAM-1080-BLK"
            />
            <Input
              label="Product name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="1080p Indoor Security Camera"
            />
          </div>

          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="pcs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Selling price"
              type="number"
              step="0.01"
              min="0"
              value={form.sellingPrice}
              onChange={(e) =>
                setForm({ ...form, sellingPrice: e.target.value })
              }
            />
            {editing ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Qty on hand
                </label>
                <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  <Info className="h-4 w-4 shrink-0" />
                  {editing.quantity} {editing.unit} — change via Production
                </div>
              </div>
            ) : (
              <Input
                label="Opening quantity"
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            )}
          </div>

          <Input
            label="Reorder level"
            type="number"
            min="0"
            value={form.reorderLevel}
            onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
            placeholder="e.g. 10"
          />

          <Input
            label="Image URL"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://…"
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                Bill of Materials
              </p>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              What raw materials — and how much of each — does it take to build
              ONE unit of this product? This is what the Production page uses to
              check stock and consume materials automatically.
            </p>

            {rawMaterials.length === 0 ? (
              <p className="text-xs text-danger-500">
                You don&apos;t have any raw materials yet. Add some on the Raw
                Materials page first.
              </p>
            ) : (
              <div className="space-y-2">
                {bomLines.map((line, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-[2]">
                      <Select
                        value={line.rawMaterialId}
                        onChange={(e) =>
                          updateBomLine(index, {
                            rawMaterialId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select raw material</option>
                        {rawMaterials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.sku})
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Qty needed"
                        value={line.quantityRequired}
                        onChange={(e) =>
                          updateBomLine(index, {
                            quantityRequired: e.target.value,
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBomLine(index)}
                      className="h-fit rounded-md p-2 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                      aria-label="Remove material"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBomLine}
                  className="mt-1 text-sm font-medium text-brand-700 hover:underline"
                >
                  + Add material to recipe
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete product"
        description={`Delete "${deleting?.name}"? This can't be undone, and its stock movement history will no longer show a linked product.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={saving}
      />
    </div>
  );
}
