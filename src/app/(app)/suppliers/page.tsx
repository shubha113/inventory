"use client";

import { useState, FormEvent } from "react";
import { Plus, Truck, Pencil, Trash2, Mail, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { addDocument, updateDocument, deleteDocument } from "@/lib/firestore-crud";
import { useCompany } from "@/lib/company-context";
import { Supplier } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const emptyForm = { name: "", contactName: "", email: "", phone: "", address: "", notes: "" };

export default function SuppliersPage() {
  const { activeCompanyId } = useCompany();
  const { data: suppliers, loading } = useCompanyCollection<Supplier>("suppliers");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !activeCompanyId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDocument<Supplier>("suppliers", editing.id, form);
        toast.success("Supplier updated");
      } else {
        await addDocument<Omit<Supplier, "id">>("suppliers", {
          ...form,
          companyId: activeCompanyId,
          createdAt: Date.now(),
        });
        toast.success("Supplier added");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the supplier. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDocument("suppliers", deleting.id);
      toast.success("Supplier deleted");
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the supplier.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Vendors you buy stock from."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add supplier
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-10 w-10" />}
            title="No suppliers yet"
            description="Add the vendors you purchase inventory from so you can track purchase orders by supplier."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add your first supplier
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Reach</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-medium text-slate-900">{s.name}</td>
                    <td className="px-5 py-3 text-slate-500">{s.contactName || "—"}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <div className="flex flex-col gap-0.5">
                        {s.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-300" /> {s.email}
                          </span>
                        )}
                        {s.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-300" /> {s.phone}
                          </span>
                        )}
                        {!s.email && !s.phone && "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(s)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          aria-label={`Delete ${s.name}`}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit supplier" : "Add supplier"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Company name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Contact person" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Textarea label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete supplier"
        description={`Delete "${deleting?.name}"? This won't remove products already linked to them.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={saving}
      />
    </div>
  );
}
