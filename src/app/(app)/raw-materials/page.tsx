"use client";

import { useMemo, useState, FormEvent } from "react";
import { Plus, Layers, Pencil, Trash2, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { addDocument, updateDocument, deleteDocument } from "@/lib/firestore-crud";
import { useCompany } from "@/lib/company-context";
import { Category, Supplier, RawMaterial } from "@/types";
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
  supplierId: "",
  costPerUnit: "",
  quantity: "",
  reorderLevel: "",
  unit: "pcs",
};

export default function RawMaterialsPage() {
  const { activeCompanyId } = useCompany();
  const { data: materials, loading } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { data: categories } = useCompanyCollection<Category>("categories");
  const { data: suppliers } = useCompanyCollection<Supplier>("suppliers");

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [deleting, setDeleting] = useState<RawMaterial | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(
    () =>
      materials.filter(
        (m) =>
          !search ||
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.sku.toLowerCase().includes(search.toLowerCase())
      ),
    [materials, search]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(m: RawMaterial) {
    setEditing(m);
    setForm({
      sku: m.sku,
      name: m.name,
      description: m.description ?? "",
      categoryId: m.categoryId ?? "",
      supplierId: m.supplierId ?? "",
      costPerUnit: String(m.costPerUnit),
      quantity: String(m.quantity),
      reorderLevel: String(m.reorderLevel),
      unit: m.unit,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim() || !activeCompanyId) return;
    setSaving(true);
    try {
      const category = categories.find((c) => c.id === form.categoryId);
      const supplier = suppliers.find((s) => s.id === form.supplierId);

      const payload = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description,
        categoryId: form.categoryId || undefined,
        categoryName: category?.name,
        supplierId: form.supplierId || undefined,
        supplierName: supplier?.name,
        costPerUnit: Number(form.costPerUnit) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        unit: form.unit || "pcs",
        updatedAt: Date.now(),
      };

      if (editing) {
        // Quantity is intentionally NOT editable here — change it via a
        // Purchase Order receipt or a manual Stock Movement instead, so the
        // history log always matches reality.
        await updateDocument<RawMaterial>("rawMaterials", editing.id, payload);
        toast.success("Raw material updated");
      } else {
        await addDocument<Omit<RawMaterial, "id">>("rawMaterials", {
          ...payload,
          companyId: activeCompanyId,
          quantity: Number(form.quantity) || 0,
          createdAt: Date.now(),
        });
        toast.success("Raw material added");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the raw material. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDocument("rawMaterials", deleting.id);
      toast.success("Raw material deleted");
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the raw material.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Raw materials"
        description="Components and parts you buy in to build finished devices — sensors, PCBs, casings, cables..."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add raw material
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-600"
        />
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-10 w-10" />}
            title={materials.length === 0 ? "No raw materials yet" : "No materials match your search"}
            description="Add the components you buy in — like a camera sensor or a PCB — so you can build a Bill of Materials for each device."
            action={
              materials.length === 0 && (
                <Button onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add your first raw material
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Qty on hand</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Cost/unit</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-400">SKU: {m.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{m.categoryName || "—"}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {m.quantity} {m.unit}
                    </td>
                    <td className="px-5 py-3">
                      <StockHealthBadge item={m} />
                    </td>
                    <td className="px-5 py-3 text-slate-500">₹{m.costPerUnit.toFixed(2)}</td>
                    <td className="px-5 py-3 text-slate-500">{m.supplierName || "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${m.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(m)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          aria-label={`Delete ${m.name}`}
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
        title={editing ? "Edit raw material" : "Add raw material"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="SKU" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="RM-0001" />
            <Input label="Material name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="1080p CMOS sensor" />
          </div>

          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Supplier" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Cost per unit" type="number" step="0.01" min="0" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
            <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pcs" />
            <Input label="Reorder level" type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>

          {editing ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Qty on hand</label>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                {editing.quantity} {editing.unit} — change this from Purchase Orders or Stock Movements
              </div>
            </div>
          ) : (
            <Input label="Opening quantity" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add raw material"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete raw material"
        description={`Delete "${deleting?.name}"? Any product recipes (BOMs) that reference it will show a missing material until you edit them.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={saving}
      />
    </div>
  );
}
