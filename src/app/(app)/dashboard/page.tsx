"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Package, Layers, AlertTriangle, Wallet, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { Product, RawMaterial, StockMovement, getStockHealth } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard, Card, EmptyState } from "@/components/ui/Card";
import { StockHealthBadge } from "@/components/StockHealthBadge";
import { Badge } from "@/components/ui/Badge";

export default function DashboardPage() {
  const { data: products, loading: loadingProducts } = useCompanyCollection<Product>("products", "updatedAt");
  const { data: rawMaterials, loading: loadingMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { data: movements, loading: loadingMovements } = useCompanyCollection<StockMovement>("stockMovements");

  const stats = useMemo(() => {
    const finishedValue = products.reduce((sum, p) => sum + p.quantity * p.sellingPrice, 0);
    const materialValue = rawMaterials.reduce((sum, m) => sum + m.quantity * m.costPerUnit, 0);
    const lowStockCount =
      products.filter((p) => getStockHealth(p) === "low_stock").length +
      rawMaterials.filter((m) => getStockHealth(m) === "low_stock").length;
    const outOfStockCount =
      products.filter((p) => getStockHealth(p) === "out_of_stock").length +
      rawMaterials.filter((m) => getStockHealth(m) === "out_of_stock").length;
    return { finishedValue, materialValue, lowStockCount, outOfStockCount };
  }, [products, rawMaterials]);

  const attentionNeeded = useMemo(() => {
    const productItems = products
      .filter((p) => getStockHealth(p) !== "in_stock")
      .map((p) => ({ kind: "Product" as const, id: p.id, name: p.name, quantity: p.quantity, reorderLevel: p.reorderLevel, unit: p.unit }));
    const materialItems = rawMaterials
      .filter((m) => getStockHealth(m) !== "in_stock")
      .map((m) => ({ kind: "Raw material" as const, id: m.id, name: m.name, quantity: m.quantity, reorderLevel: m.reorderLevel, unit: m.unit }));
    return [...productItems, ...materialItems].sort((a, b) => a.quantity - b.quantity).slice(0, 6);
  }, [products, rawMaterials]);

  const recentMovements = movements.slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" description="A snapshot of your inventory right now." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Finished goods value" value={`₹${stats.finishedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} icon={<Package className="h-5 w-5" />} tone="brand" />
        <StatCard label="Raw material value" value={`₹${stats.materialValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} icon={<Layers className="h-5 w-5" />} tone="brand" />
        <StatCard label="Low stock items" value={String(stats.lowStockCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="warn" />
        <StatCard label="Out of stock" value={String(stats.outOfStockCount)} icon={<Wallet className="h-5 w-5" />} tone="danger" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <Link href="/products" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              View products <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loadingProducts || loadingMaterials ? (
            <div className="p-6 text-sm text-slate-400">Loading…</div>
          ) : attentionNeeded.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="All good here"
              description="No products or raw materials are currently low or out of stock."
            />
          ) : (
            <ul className="divide-y divide-slate-50">
              {attentionNeeded.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.kind} · {item.quantity} {item.unit} left · reorder at {item.reorderLevel}
                    </p>
                  </div>
                  <StockHealthBadge item={item} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent stock activity</h2>
            <Link href="/stock-movements" className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loadingMovements ? (
            <div className="p-6 text-sm text-slate-400">Loading…</div>
          ) : recentMovements.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No activity yet"
              description="Stock in/out movements will show up here."
            />
          ) : (
            <ul className="divide-y divide-slate-50">
              {recentMovements.map((m) => (
                <li key={m.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.itemName}</p>
                    <p className="text-xs text-slate-400">
                      {format(new Date(m.createdAt), "d MMM, h:mm a")} · {m.createdBy}
                    </p>
                  </div>
                  <Badge tone={m.type === "in" ? "ok" : m.type === "out" ? "danger" : "neutral"}>
                    {m.type === "in" ? `+${m.quantity}` : m.type === "out" ? `-${m.quantity}` : m.quantity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
