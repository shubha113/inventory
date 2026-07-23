"use client";

import { useState, FormEvent } from "react";
import { Plus, ClipboardCheck, Trash2, Check, X, Ban } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyCollection } from "@/lib/hooks/useCompanyCollection";
import { addDocument, updateDocument } from "@/lib/firestore-crud";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { RawMaterial, MaterialRequest, MaterialRequestLine, MaterialRequestPriority } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const statusTone = {
  pending: "warn",
  approved: "brand",
  rejected: "danger",
  dispatched: "ok",
  cancelled: "neutral",
} as const;

const statusLabel: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved — ready for dispatch",
  rejected: "Rejected",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
};

const priorityTone = {
  low: "neutral",
  normal: "brand",
  urgent: "danger",
} as const;

interface DraftLine {
  rawMaterialId: string;
  quantityRequested: string;
}

export default function MaterialRequestsPage() {
  const { data: requests, loading } = useCompanyCollection<MaterialRequest>("materialRequests", "updatedAt");
  const { data: rawMaterials } = useCompanyCollection<RawMaterial>("rawMaterials", "updatedAt");
  const { profile } = useAuth();
  const { activeCompanyId, activeCompany } = useCompany();
  const isAdmin = activeCompany?.role === "admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [priority, setPriority] = useState<MaterialRequestPriority>("normal");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ rawMaterialId: "", quantityRequested: "" }]);

  const [cancelling, setCancelling] = useState<MaterialRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() {
    setPurpose("");
    setPriority("normal");
    setNeededBy("");
    setNotes("");
    setLines([{ rawMaterialId: "", quantityRequested: "" }]);
    setModalOpen(true);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { rawMaterialId: "", quantityRequested: "" }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.rawMaterialId && Number(l.quantityRequested) > 0);
    if (!activeCompanyId || !profile || validLines.length === 0 || !purpose.trim()) {
      toast.error("Add a purpose and at least one material with a quantity.");
      return;
    }

    setSaving(true);
    try {
      const requestLines: MaterialRequestLine[] = validLines.map((l) => {
        const material = rawMaterials.find((m) => m.id === l.rawMaterialId)!;
        return {
          rawMaterialId: material.id,
          rawMaterialName: material.name,
          sku: material.sku,
          unit: material.unit,
          quantityRequested: Number(l.quantityRequested),
        };
      });

      await addDocument<Omit<MaterialRequest, "id">>("materialRequests", {
        companyId: activeCompanyId,
        requestNumber: `MR-${Date.now().toString().slice(-6)}`,
        lines: requestLines,
        purpose,
        neededBy: neededBy ? new Date(neededBy).getTime() : undefined,
        priority,
        status: "pending",
        notes,
        requestedBy: profile.uid,
        requestedByName: profile.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      toast.success("Material request raised");
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't raise the request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(request: MaterialRequest, status: "approved" | "rejected") {
    setBusyId(request.id);
    try {
      await updateDocument<MaterialRequest>("materialRequests", request.id, {
        status,
        reviewedBy: profile?.name ?? "Unknown",
      });
      toast.success(status === "approved" ? "Request approved" : "Request rejected");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the request.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel() {
    if (!cancelling) return;
    setBusyId(cancelling.id);
    try {
      await updateDocument<MaterialRequest>("materialRequests", cancelling.id, { status: "cancelled" });
      toast.success("Request cancelled");
      setCancelling(null);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't cancel the request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Raise material request"
        description="Ask for raw materials to be pulled from stock — for production, repairs, or anything that isn't a sale. An admin approves it, then it moves to Material Dispatch."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New request
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-10 w-10" />}
            title="No material requests yet"
            description="Raise a request whenever you need raw materials pulled from stock for something other than a sale."
            action={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> Raise your first request
              </Button>
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
                  <th className="px-5 py-3 font-medium">Priority</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{r.requestNumber}</p>
                      <p className="text-xs text-slate-400">{r.purpose}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{r.lines.length} material(s)</td>
                    <td className="px-5 py-3 text-slate-600">{r.requestedByName}</td>
                    <td className="px-5 py-3">
                      <Badge tone={priorityTone[r.priority]}>
                        <span className="capitalize">{r.priority}</span>
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {r.status === "pending" && isAdmin && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busyId === r.id}
                              onClick={() => handleReview(r, "approved")}
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={busyId === r.id}
                              onClick={() => handleReview(r, "rejected")}
                            >
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {r.status === "pending" && r.requestedBy === profile?.uid && (
                          <button
                            onClick={() => setCancelling(r)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                            aria-label="Cancel request"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New material request" maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Purpose"
            required
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Production run for 50x Indoor Camera"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as MaterialRequestPriority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </Select>
            <Input
              label="Needed by (optional)"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Raw materials needed</p>
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
                        <Select
                          value={line.rawMaterialId}
                          onChange={(e) => updateLine(index, { rawMaterialId: e.target.value })}
                        >
                          <option value="">Select material</option>
                          {rawMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.sku}) — {m.quantity} {m.unit} in stock
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={line.quantityRequested}
                          onChange={(e) => updateLine(index, { quantityRequested: e.target.value })}
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
                <button
                  type="button"
                  onClick={addLine}
                  className="mt-2 text-sm font-medium text-brand-700 hover:underline"
                >
                  + Add another material
                </button>
              </>
            )}
          </div>

          <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Raise request
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel request"
        description={`Cancel ${cancelling?.requestNumber}? This can't be undone.`}
        confirmLabel="Cancel request"
        onConfirm={handleCancel}
        onCancel={() => setCancelling(null)}
        loading={busyId === cancelling?.id}
      />
    </div>
  );
}