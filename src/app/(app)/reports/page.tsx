"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { Product, RawMaterial, StockMovement } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function ReportsPage() {
  const { data: products } = useCompanyCollection<Product>("products", "updatedAt");
  const { data: rawMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { data: movements } = useCompanyCollection<StockMovement>("stockMovements");

  const materialValueByCategory = useMemo(() => {
    const map = new Map<string, number>();
    rawMaterials.forEach((m) => {
      const key = m.categoryName || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + m.quantity * m.costPerUnit);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [rawMaterials]);

  const finishedValueByCategory = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const key = p.categoryName || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + p.quantity * p.sellingPrice);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [products]);

  const movementTrend = useMemo(() => {
    const days: { date: string; in: number; out: number }[] = [];
    const cutoff = subDays(new Date(), 13);
    for (let i = 13; i >= 0; i--) {
      const day = subDays(new Date(), i);
      days.push({ date: format(day, "d MMM"), in: 0, out: 0 });
    }
    movements
      .filter((m) => isAfter(new Date(m.createdAt), cutoff))
      .forEach((m) => {
        const label = format(new Date(m.createdAt), "d MMM");
        const entry = days.find((d) => d.date === label);
        if (!entry) return;
        if (m.type === "in") entry.in += m.quantity;
        if (m.type === "out") entry.out += m.quantity;
      });
    return days;
  }, [movements]);

  const topMaterialsByValue = useMemo(
    () => [...rawMaterials].sort((a, b) => b.quantity * b.costPerUnit - a.quantity * a.costPerUnit).slice(0, 8),
    [rawMaterials]
  );

  function exportCsv() {
    const productHeader = ["Type", "SKU", "Name", "Category", "Quantity", "Unit", "Unit Value", "Total Value"];
    const productRows = products.map((p) => [
      "Finished product",
      p.sku,
      p.name,
      p.categoryName || "",
      p.quantity,
      p.unit,
      p.sellingPrice,
      (p.quantity * p.sellingPrice).toFixed(2),
    ]);
    const materialRows = rawMaterials.map((m) => [
      "Raw material",
      m.sku,
      m.name,
      m.categoryName || "",
      m.quantity,
      m.unit,
      m.costPerUnit,
      (m.quantity * m.costPerUnit).toFixed(2),
    ]);
    const csv = [productHeader, ...productRows, ...materialRows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Understand stock value across raw materials and finished devices, plus movement trends."
        action={
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export everything (CSV)
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Raw material value by category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={materialValueByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Finished goods value by category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={finishedValueByCategory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
              <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              <Bar dataKey="value" fill="#115e59" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Stock movement — last 14 days (all items)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={movementTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="in" stroke="#059669" strokeWidth={2} name="Stock in" dot={false} />
            <Line type="monotone" dataKey="out" stroke="#e11d48" strokeWidth={2} name="Stock out" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Top raw materials by stock value</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Material</th>
                <th className="px-5 py-3 font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Cost/unit</th>
                <th className="px-5 py-3 font-medium">Stock value</th>
              </tr>
            </thead>
            <tbody>
              {topMaterialsByValue.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {m.quantity} {m.unit}
                  </td>
                  <td className="px-5 py-3 text-slate-500">₹{m.costPerUnit.toFixed(2)}</td>
                  <td className="px-5 py-3 text-slate-700">₹{(m.quantity * m.costPerUnit).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
