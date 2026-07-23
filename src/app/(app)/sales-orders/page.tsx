"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { addDocument } from "@/lib/firestore-crud";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { Product, SalesOrder, SalesOrderLine } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

const statusTone = {
  draft: "neutral",
  confirmed: "brand",
  fulfilled: "ok",
  cancelled: "danger",
} as const;

interface DraftLine {
  productId: string;
  quantity: string;
}

export default function SalesOrdersPage() {
  const { data: orders, loading } = useCompanyCollection<SalesOrder>("salesOrders");
  const { data: products } = useCompanyCollection<Product>("products", "updatedAt");
  const { profile } = useAuth();
  const { activeCompanyId } = useCompany();

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ productId: "", quantity: "" }]);

  function openCreate() {
    setCustomerName("");
    setNotes("");
    setLines([{ productId: "", quantity: "" }]);
    setModalOpen(true);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (!customerName.trim() || validLines.length === 0 || !activeCompanyId) {
      toast.error("Add a customer name and at least one product with a quantity.");
      return;
    }

    setSaving(true);
    try {
      const soLines: SalesOrderLine[] = validLines.map((l) => {
        const product = products.find((p) => p.id === l.productId)!;
        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: Number(l.quantity),
          sellingPrice: product.sellingPrice,
        };
      });

      await addDocument<Omit<SalesOrder, "id">>("salesOrders", {
        companyId: activeCompanyId,
        orderNumber: `SO-${Date.now().toString().slice(-6)}`,
        customerName: customerName.trim(),
        status: "confirmed",
        lines: soLines,
        notes,
        createdBy: profile?.name ?? "Unknown",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success("Sales order created");
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't create the sales order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sales orders"
        description="Orders placed by customers. Fulfilling one removes stock automatically."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New sales order
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="h-10 w-10" />}
            title="No sales orders yet"
            description="Create an order when a customer buys stock, then fulfill it to deduct inventory."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Create your first sales order
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Order number</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Items</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((so) => (
                  <tr key={so.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link href={`/sales-orders/${so.id}`} className="font-medium text-brand-700 hover:underline">
                        {so.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{so.customerName}</td>
                    <td className="px-5 py-3 text-slate-500">{so.lines.length} product(s)</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[so.status]}>{so.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{format(new Date(so.createdAt), "d MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New sales order" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Customer name" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Products ordered</p>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-[2]">
                    <Select value={line.productId} onChange={(e) => updateLine(index, { productId: e.target.value })}>
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {p.quantity} {p.unit} available
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
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
              + Add another product
            </button>
          </div>

          <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create sales order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
