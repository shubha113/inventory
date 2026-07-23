"use client";

import { useMemo, useState } from "react";
import { PackageCheck, PackageOpen, Truck } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { useAuth } from "@/lib/auth-context";
import { MaterialRequest } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { dispatchMaterialRequest } from "@/lib/material-request-actions";

type Tab = "ready" | "dispatched";

export default function MaterialDispatchPage() {
  const { data: requests, loading } = useCompanyCollection<MaterialRequest>("materialRequests", "updatedAt");
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("ready");
  const [busyId, setBusyId] = useState<string | null>(null);

  const ready = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);
  const dispatched = useMemo(() => requests.filter((r) => r.status === "dispatched"), [requests]);
  const visible = tab === "ready" ? ready : dispatched;

  async function handleDispatch(request: MaterialRequest) {
    if (!profile) return;
    setBusyId(request.id);
    try {
      await dispatchMaterialRequest({ requestId: request.id, dispatchedBy: profile.name });
      toast.success(`${request.requestNumber} dispatched — stock updated`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Couldn't dispatch this request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Material dispatch"
        description="Approved material requests waiting to leave stock, and a record of everything already sent out."
      />

      <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setTab("ready")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "ready" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <PackageOpen className="h-4 w-4" /> Ready for dispatch ({ready.length})
        </button>
        <button
          onClick={() => setTab("dispatched")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "dispatched" ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:text-slate-800"
          )}
        >
          <PackageCheck className="h-4 w-4" /> Dispatched ({dispatched.length})
        </button>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Truck className="h-10 w-10" />}
            title={tab === "ready" ? "Nothing waiting to be dispatched" : "Nothing dispatched yet"}
            description={
              tab === "ready"
                ? "Approved material requests will show up here, ready to be sent out of stock."
                : "Once you dispatch a request, it'll show up here with a timestamp."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Request</th>
                  <th className="px-5 py-3 font-medium">Materials</th>
                  <th className="px-5 py-3 font-medium">Requested by</th>
                  <th className="px-5 py-3 font-medium">{tab === "ready" ? "Approved" : "Dispatched"}</th>
                  {tab === "ready" && <th className="px-5 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.requestNumber}</p>
                      <p className="text-xs text-slate-400">{r.purpose}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <ul className="space-y-0.5">
                        {r.lines.map((l) => (
                          <li key={l.rawMaterialId}>
                            {l.quantityRequested} {l.unit} · {l.rawMaterialName}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.requestedByName}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {tab === "ready"
                        ? format(new Date(r.updatedAt), "d MMM yyyy")
                        : r.dispatchedAt
                          ? format(new Date(r.dispatchedAt), "d MMM yyyy")
                          : "—"}
                    </td>
                    {tab === "ready" && (
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" loading={busyId === r.id} onClick={() => handleDispatch(r)}>
                          <Truck className="h-3.5 w-3.5" /> Mark dispatched
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}