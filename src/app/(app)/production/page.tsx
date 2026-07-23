"use client";

import { useMemo, useState } from "react";
import { Factory, Hammer, AlertTriangle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { limit } from "firebase/firestore";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { manufactureProduct } from "@/lib/manufacture-actions";
import { useAuth } from "@/lib/auth-context";
import { Product, RawMaterial, ProductionRun, calculateMaterialsNeeded } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

export default function ProductionPage() {
  const { data: products, loading: loadingProducts } = useCompanyCollection<Product>("products", "updatedAt");
  const { data: rawMaterials, loading: loadingMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { data: runs, loading: loadingRuns } = useCompanyCollection<ProductionRun>(
    "productionRuns",
    "createdAt",
    [limit(20)]
  );
  const { profile } = useAuth();

  const [productId, setProductId] = useState("");
  const [quantityToBuild, setQuantityToBuild] = useState("1");
  const [building, setBuilding] = useState(false);

  const rawMaterialsById = useMemo(() => new Map(rawMaterials.map((m) => [m.id, m])), [rawMaterials]);
  const selectedProduct = products.find((p) => p.id === productId);

  const preview = useMemo(() => {
    if (!selectedProduct || !selectedProduct.bom?.length) return [];
    const qty = Number(quantityToBuild) || 0;
    return calculateMaterialsNeeded(selectedProduct.bom, qty, rawMaterialsById);
  }, [selectedProduct, quantityToBuild, rawMaterialsById]);

  const canBuild = selectedProduct && selectedProduct.bom?.length > 0 && Number(quantityToBuild) > 0 && !preview.some((p) => p.isShort);

  async function handleBuild() {
    if (!selectedProduct) return;
    setBuilding(true);
    try {
      await manufactureProduct({
        productId: selectedProduct.id,
        quantityToBuild: Number(quantityToBuild),
        createdBy: profile?.name ?? "Unknown",
      });
      toast.success(`Built ${quantityToBuild} × ${selectedProduct.name}`);
      setQuantityToBuild("1");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't complete the build.");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Production"
        description="Build finished devices by consuming raw materials according to each product's Bill of Materials."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Hammer className="h-4 w-4 text-brand-600" /> Start a build
          </h2>

          {loadingProducts ? (
            <p className="text-sm text-slate-400">Loading products…</p>
          ) : (
            <div className="space-y-4">
              <Select label="Product to build" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>

              <Input
                label="Quantity to build"
                type="number"
                min="1"
                value={quantityToBuild}
                onChange={(e) => setQuantityToBuild(e.target.value)}
              />

              {selectedProduct && (!selectedProduct.bom || selectedProduct.bom.length === 0) && (
                <p className="flex items-start gap-1.5 text-xs text-warn-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This product has no Bill of Materials yet. Add one by editing it on the Products page.
                </p>
              )}

              <Button onClick={handleBuild} disabled={!canBuild} loading={building} className="w-full">
                <Factory className="h-4 w-4" /> Build {quantityToBuild || ""} unit(s)
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Materials required for this build</h2>
          {!selectedProduct ? (
            <p className="text-sm text-slate-400">Select a product to see what it needs.</p>
          ) : loadingMaterials ? (
            <p className="text-sm text-slate-400">Loading raw materials…</p>
          ) : preview.length === 0 ? (
            <p className="text-sm text-slate-400">No Bill of Materials set up for this product yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4 font-medium">Raw material</th>
                    <th className="py-2 pr-4 font-medium">Needed</th>
                    <th className="py-2 pr-4 font-medium">Available</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((line) => (
                    <tr key={line.rawMaterialId} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{line.rawMaterialName}</td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {line.needed} {line.unit}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600">
                        {line.available} {line.unit}
                      </td>
                      <td className="py-2.5">
                        {line.isShort ? (
                          <Badge tone="danger">Short by {line.needed - line.available}</Badge>
                        ) : (
                          <Badge tone="ok">Enough in stock</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recent production runs</h2>
        </div>
        {loadingRuns ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={<Factory className="h-10 w-10" />}
            title="No builds yet"
            description="Completed builds will show up here with what was consumed to make them."
          />
        ) : (
          <ul className="divide-y divide-slate-50">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-ok-500" />
                    Built {run.quantityBuilt} × {run.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {format(new Date(run.createdAt), "d MMM yyyy, h:mm a")} · {run.createdBy} · used{" "}
                    {run.materialsConsumed.map((m) => `${m.quantity} ${m.unit} ${m.rawMaterialName}`).join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
