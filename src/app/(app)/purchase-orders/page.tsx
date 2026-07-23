"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Plus, ClipboardList, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { addDocument } from "@/lib/firestore-crud";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { RawMaterial, Supplier, PurchaseOrder, PurchaseOrderLine } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

const statusTone = {
  draft: "neutral",
  ordered: "brand",
  partially_received: "warn",
  received: "ok",
  cancelled: "danger",
} as const;

const statusLabel: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

interface DraftLine {
  rawMaterialId: string;
  quantityOrdered: string;
  costPerUnit: string;
}

export default function PurchaseOrdersPage() {
  const { data: orders, loading } = useCompanyCollection<PurchaseOrder>("purchaseOrders");
  const { data: suppliers } = useCompanyCollection<Supplier>("suppliers");
  const { data: rawMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { profile } = useAuth();
  const { activeCompanyId } = useCompany();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ rawMaterialId: "", quantityOrdered: "", costPerUnit: "" }]);

  function openCreate() {
    setSupplierId("");
    setNotes("");
    setLines([{ rawMaterialId: "", quantityOrdered: "", costPerUnit: "" }]);
    setModalOpen(true);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { rawMaterialId: "", quantityOrdered: "", costPerUnit: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMaterialPick(index: number, rawMaterialId: string) {
    const material = rawMaterials.find((m) => m.id === rawMaterialId);
    updateLine(index, { rawMaterialId, costPerUnit: material ? String(material.costPerUnit) : "" });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const supplier = suppliers.find((s) => s.id === supplierId);
    const validLines = lines.filter((l) => l.rawMaterialId && Number(l.quantityOrdered) > 0);
    if (!supplier || validLines.length === 0 || !activeCompanyId) {
      toast.error("Pick a supplier and at least one material with a quantity.");
      return;
    }

    setSaving(true);
    try {
      const poLines: PurchaseOrderLine[] = validLines.map((l) => {
        const material = rawMaterials.find((m) => m.id === l.rawMaterialId)!;
        return {
          rawMaterialId: material.id,
          rawMaterialName: material.name,
          sku: material.sku,
          quantityOrdered: Number(l.quantityOrdered),
          quantityReceived: 0,
          costPerUnit: Number(l.costPerUnit) || 0,
        };
      });

      await addDocument<Omit<PurchaseOrder, "id">>("purchaseOrders", {
        companyId: activeCompanyId,
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: "ordered",
        lines: poLines,
        notes,
        createdBy: profile?.name ?? "Unknown",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success("Purchase order created");
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create the purchase order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        description="Raw materials you've ordered from suppliers to keep production running."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New purchase order
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-10 w-10" />}
            title="No purchase orders yet"
            description="Create a purchase order when you order raw materials from a supplier, then receive them here as they arrive."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Create your first purchase order
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">PO number</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Materials</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/purchase-orders/${po.id}`} className="font-medium text-brand-700 hover:underline">
                        {po.poNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{po.supplierName}</td>
                    <td className="px-5 py-3 text-slate-500">{po.lines.length} material(s)</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[po.status]}>{statusLabel[po.status]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{format(new Date(po.createdAt), "d MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New purchase order" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select a supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Raw materials to order</p>
            {rawMaterials.length === 0 ? (
              <p className="text-xs text-danger-500">
                You don&apos;t have any raw materials yet. Add some on the Raw Materials page first.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-[2]">
                        <Select value={line.rawMaterialId} onChange={(e) => handleMaterialPick(index, e.target.value)}>
                          <option value="">Select material</option>
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
                          min="1"
                          placeholder="Qty"
                          value={line.quantityOrdered}
                          onChange={(e) => updateLine(index, { quantityOrdered: e.target.value })}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Cost"
                          value={line.costPerUnit}
                          onChange={(e) => updateLine(index, { costPerUnit: e.target.value })}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="h-fit rounded-md p-2 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addLine} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
                  + Add another material
                </button>
              </>
            )}
          </div>

          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create purchase order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
