"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { fulfillSalesOrder } from "@/lib/sales-order-actions";
import { useAuth } from "@/lib/auth-context";
import { SalesOrder } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const statusTone = {
  draft: "neutral",
  confirmed: "brand",
  fulfilled: "ok",
  cancelled: "danger",
} as const;

export default function SalesOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [so, setSo] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "salesOrders", params.id), (snap) => {
      setSo(snap.exists() ? ({ id: snap.id, ...snap.data() } as SalesOrder) : null);
      setLoading(false);
    });
    return unsub;
  }, [params.id]);

  async function handleFulfill() {
    setSaving(true);
    try {
      await fulfillSalesOrder({ salesOrderId: params.id, createdBy: profile?.name ?? "Unknown" });
      toast.success("Order fulfilled — stock updated");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fulfill the order.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  if (!so) return <div className="p-6 text-sm text-slate-400">Sales order not found.</div>;

  const total = so.lines.reduce((sum, l) => sum + l.quantity * l.sellingPrice, 0);

  return (
    <div>
      <button
        onClick={() => router.push("/sales-orders")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sales orders
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{so.orderNumber}</h1>
            <Badge tone={statusTone[so.status]}>{so.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {so.customerName} · Created {format(new Date(so.createdAt), "d MMM yyyy")}
          </p>
        </div>
        {so.status === "confirmed" && (
          <Button onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 className="h-4 w-4" /> Fulfill order
          </Button>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {so.lines.map((line) => (
                <tr key={line.productId} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{line.productName}</p>
                    <p className="text-xs text-slate-400">SKU: {line.sku}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{line.quantity}</td>
                  <td className="px-5 py-3 text-slate-600">₹{line.sellingPrice.toFixed(2)}</td>
                  <td className="px-5 py-3 text-slate-600">₹{(line.quantity * line.sellingPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-5 py-3 text-right font-medium text-slate-700">
                  Total
                </td>
                <td className="px-5 py-3 font-semibold text-slate-900">₹{total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {so.notes && (
        <Card className="mt-4 p-5">
          <p className="text-sm font-medium text-slate-700">Notes</p>
          <p className="mt-1 text-sm text-slate-500">{so.notes}</p>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Fulfill order"
        description="This will deduct the ordered quantities from stock and record it in stock movements. This can't be undone."
        confirmLabel="Fulfill order"
        onConfirm={handleFulfill}
        onCancel={() => setConfirmOpen(false)}
        loading={saving}
      />
    </div>
  );
}
