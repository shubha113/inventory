"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, PackageCheck } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { receivePurchaseOrderLine } from "@/lib/purchase-order-actions";
import { useAuth } from "@/lib/auth-context";
import { PurchaseOrder } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

const statusTone = {
  draft: "neutral",
  ordered: "brand",
  partially_received: "warn",
  received: "ok",
  cancelled: "danger",
} as const;

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, string>>({});
  const [savingMaterialId, setSavingMaterialId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "purchaseOrders", params.id), (snap) => {
      setPo(snap.exists() ? ({ id: snap.id, ...snap.data() } as PurchaseOrder) : null);
      setLoading(false);
    });
    return unsub;
  }, [params.id]);

  async function handleReceive(rawMaterialId: string, remaining: number) {
    const value = Number(receiveInputs[rawMaterialId] ?? remaining);
    if (!value || value <= 0) return;
    setSavingMaterialId(rawMaterialId);
    try {
      await receivePurchaseOrderLine({
        purchaseOrderId: params.id,
        rawMaterialId,
        receiveQty: Math.min(value, remaining),
        createdBy: profile?.name ?? "Unknown",
      });
      toast.success("Stock received and inventory updated");
      setReceiveInputs((prev) => ({ ...prev, [rawMaterialId]: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't receive stock.");
    } finally {
      setSavingMaterialId(null);
    }
  }

  if (loading) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  if (!po) return <div className="p-6 text-sm text-slate-400">Purchase order not found.</div>;

  return (
    <div>
      <button
        onClick={() => router.push("/purchase-orders")}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to purchase orders
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{po.poNumber}</h1>
            <Badge tone={statusTone[po.status]}>{po.status.replace("_", " ")}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {po.supplierName} · Created {format(new Date(po.createdAt), "d MMM yyyy")}
          </p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Raw material</th>
                <th className="px-5 py-3 font-medium">Ordered</th>
                <th className="px-5 py-3 font-medium">Received</th>
                <th className="px-5 py-3 font-medium">Remaining</th>
                <th className="px-5 py-3 font-medium">Cost/unit</th>
                <th className="px-5 py-3 font-medium text-right">Receive stock</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => {
                const remaining = line.quantityOrdered - line.quantityReceived;
                return (
                  <tr key={line.rawMaterialId} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{line.rawMaterialName}</p>
                      <p className="text-xs text-slate-400">SKU: {line.sku}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{line.quantityOrdered}</td>
                    <td className="px-5 py-3 text-slate-600">{line.quantityReceived}</td>
                    <td className="px-5 py-3 text-slate-600">{remaining}</td>
                    <td className="px-5 py-3 text-slate-600">₹{line.costPerUnit.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      {remaining > 0 ? (
                        <div className="flex justify-end gap-2">
                          <div className="w-24">
                            <Input
                              type="number"
                              min="1"
                              max={remaining}
                              placeholder={String(remaining)}
                              value={receiveInputs[line.rawMaterialId] ?? ""}
                              onChange={(e) =>
                                setReceiveInputs((prev) => ({ ...prev, [line.rawMaterialId]: e.target.value }))
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleReceive(line.rawMaterialId, remaining)}
                            loading={savingMaterialId === line.rawMaterialId}
                          >
                            <PackageCheck className="h-4 w-4" /> Receive
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <Badge tone="ok">Fully received</Badge>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {po.notes && (
        <Card className="mt-4 p-5">
          <p className="text-sm font-medium text-slate-700">Notes</p>
          <p className="mt-1 text-sm text-slate-500">{po.notes}</p>
        </Card>
      )}
    </div>
  );
}
