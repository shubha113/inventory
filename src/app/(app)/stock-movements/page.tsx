"use client";

import { useMemo, useState, FormEvent } from "react";
import { Plus, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { recordStockMovement } from "@/lib/inventory-actions";
import { useAuth } from "@/lib/auth-context";
import { Product, RawMaterial, StockMovement, MovementType, MovementReason, ItemType } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

const reasonsByType: Record<MovementType, { value: MovementReason; label: string }[]> = {
  in: [
    { value: "purchase", label: "Purchase received" },
    { value: "return", label: "Customer return" },
    { value: "correction", label: "Count correction" },
  ],
  out: [
    { value: "sale", label: "Sale" },
    { value: "damaged", label: "Damaged / lost" },
    { value: "correction", label: "Count correction" },
  ],
  adjustment: [{ value: "correction", label: "Count correction" }],
};

export default function StockMovementsPage() {
  const { data: movements, loading } = useCompanyCollection<StockMovement>("stockMovements");
  const { data: products } = useCompanyCollection<Product>("products", "updatedAt");
  const { data: rawMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itemType, setItemType] = useState<ItemType>("rawMaterial");
  const [type, setType] = useState<MovementType>("in");
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState<MovementReason>("purchase");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const items = itemType === "product" ? products : rawMaterials;
  const selectedItem = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);

  function openCreate(defaultType: MovementType) {
    setType(defaultType);
    setReason(reasonsByType[defaultType][0].value);
    setItemType("rawMaterial");
    setItemId("");
    setQuantity("");
    setNote("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!itemId || !quantity) return;
    setSaving(true);
    try {
      await recordStockMovement({
        itemType,
        itemId,
        type,
        reason,
        quantity: Number(quantity),
        note,
        createdBy: profile?.name ?? "Unknown",
      });
      toast.success("Stock movement recorded");
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record the movement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Stock movements"
        description="Every stock in, stock out, or correction — for both raw materials and finished products — and why it happened."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => openCreate("out")}>
              <ArrowUpCircle className="h-4 w-4" /> Stock out
            </Button>
            <Button onClick={() => openCreate("in")}>
              <ArrowDownCircle className="h-4 w-4" /> Stock in
            </Button>
          </div>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="h-10 w-10" />}
            title="No stock movements yet"
            description="Record a stock-in when you receive raw materials, or a stock-out when finished goods leave — this is your audit trail."
            action={
              <Button onClick={() => openCreate("in")}>
                <Plus className="h-4 w-4" /> Record first movement
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Kind</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Reason</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">Balance after</th>
                  <th className="px-5 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-500">{format(new Date(m.createdAt), "d MMM yyyy, h:mm a")}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{m.itemName}</p>
                      <p className="text-xs text-slate-400">SKU: {m.sku}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={m.itemType === "product" ? "brand" : "neutral"}>
                        {m.itemType === "product" ? "Finished product" : "Raw material"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {m.type === "in" ? (
                        <Badge tone="ok">Stock in</Badge>
                      ) : m.type === "out" ? (
                        <Badge tone="danger">Stock out</Badge>
                      ) : (
                        <Badge tone="neutral">Adjustment</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-500">{m.reason}</td>
                    <td className="px-5 py-3 text-slate-700">
                      {m.type === "out" ? "-" : "+"}
                      {m.quantity}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{m.quantityAfter}</td>
                    <td className="px-5 py-3 text-slate-500">{m.createdBy}</td>
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
        title={type === "in" ? "Record stock in" : "Record stock out"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setType("in");
                setReason(reasonsByType.in[0].value);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${type === "in" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Stock in
            </button>
            <button
              type="button"
              onClick={() => {
                setType("out");
                setReason(reasonsByType.out[0].value);
              }}
              className={`flex-1 rounded-md py-1.5 transition-colors ${type === "out" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Stock out
            </button>
          </div>

          <Select
            label="What kind of item?"
            value={itemType}
            onChange={(e) => {
              setItemType(e.target.value as ItemType);
              setItemId("");
            }}
          >
            <option value="rawMaterial">Raw material</option>
            <option value="product">Finished product</option>
          </Select>

          <Select label="Item" required value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Select {itemType === "product" ? "a product" : "a raw material"}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.sku}) — {i.quantity} {i.unit} on hand
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value as MovementReason)}>
              {reasonsByType[type].map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Input
              label="Quantity"
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {selectedItem && type === "out" && Number(quantity) > selectedItem.quantity && (
            <p className="flex items-center gap-1.5 text-xs text-danger-500">
              <RefreshCcw className="h-3.5 w-3.5" /> Only {selectedItem.quantity} {selectedItem.unit} available.
            </p>
          )}

          <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional context" />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Record movement
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
