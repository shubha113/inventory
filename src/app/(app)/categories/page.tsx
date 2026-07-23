"use client";

import { useState, FormEvent } from "react";
import { Plus, Tags, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import {
  addDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/firestore-crud";
import { useCompany } from "@/lib/company-context";
import { Category } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function CategoriesPage() {
  const { activeCompanyId } = useCompany();
  const {
    data: categories,
    loading,
    error,
  } = useCompanyCollection<Category>("categories");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setModalOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setName(category.name);
    setDescription(category.description ?? "");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !activeCompanyId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDocument<Category>("categories", editing.id, {
          name,
          description,
        });
        toast.success("Category updated");
      } else {
        await addDocument<Omit<Category, "id">>("categories", {
          companyId: activeCompanyId,
          name,
          description,
          createdAt: Date.now(),
        });
        toast.success("Category added");
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save the category. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteDocument("categories", deleting.id);
      toast.success("Category deleted");
      setDeleting(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Group products so they're easier to browse and report on."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
        }
      />

      <Card>
        {error ? (
          <div className="p-6 text-sm text-danger-500">
            Couldn't load categories: {error}
          </div>
        ) : loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<Tags className="h-10 w-10" />}
            title="No categories yet"
            description="Categories help you organize products like 'Electronics' or 'Stationery'."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Add your first category
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {cat.name}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {cat.description || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(cat)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Edit ${cat.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleting(cat)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          aria-label={`Delete ${cat.name}`}
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
        title={editing ? "Edit category" : "Add category"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Electronics"
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional notes about this category"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Add category"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete category"
        description={`Delete "${deleting?.name}"? Products already assigned to it will keep showing this category name until you edit them.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        loading={saving}
      />
    </div>
  );
}
