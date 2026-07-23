"use client";

import { useEffect, useState, FormEvent } from "react";
import toast from "react-hot-toast";
import { Building2, Plus, Check, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { CompanyMember, CompanyRole } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function CompaniesPage() {
  const { profile } = useAuth();
  const { companies, activeCompanyId, setActiveCompanyId, createCompany, deleteCompany, loading } = useCompany();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [manageFor, setManageFor] = useState<CompanyMember | null>(null);
  const [deleting, setDeleting] = useState<CompanyMember | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createCompany(newName.trim());
      toast.success(`"${newName.trim()}" created — it's now your active company.`);
      setNewName("");
      setCreateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the company.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteCompany() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteCompany(deleting.companyId);
      toast.success(`"${deleting.companyName}" deleted`);
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the company.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Every company you're part of. Switch the active one to see its products, stock, and orders — or add a brand-new company without needing a separate account."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New company
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="No companies yet"
            description="Create your first company to start tracking its inventory."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Create your first company
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Your role</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <Building2 className="h-4 w-4 text-slate-300" /> {c.companyName}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={c.role === "admin" ? "brand" : "neutral"}>
                        <span className="capitalize">{c.role}</span>
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        {c.companyId === activeCompanyId ? (
                          <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-700">
                            <Check className="h-3.5 w-3.5" /> Active
                          </span>
                        ) : (
                          <Button variant="secondary" onClick={() => setActiveCompanyId(c.companyId)}>
                            Switch to this
                          </Button>
                        )}
                        {c.role === "admin" && (
                          <Button variant="secondary" onClick={() => setManageFor(c)}>
                            <UserPlus className="h-4 w-4" /> Members
                          </Button>
                        )}
                        {c.role === "admin" && (
                          <Button variant="danger" onClick={() => setDeleting(c)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New company">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Company name"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Acme Manufacturing Pvt Ltd"
          />
          <p className="text-xs text-slate-500">
            You'll be the admin of this company. Its products, stock, suppliers, and orders are completely
            separate from your other companies.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create company
            </Button>
          </div>
        </form>
      </Modal>

      {manageFor && profile && (
        <MembersModal
          company={manageFor}
          currentUid={profile.uid}
          onClose={() => setManageFor(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete company"
        description={`Delete "${deleting?.companyName}"? All members will immediately lose access, and this can't be undone.`}
        confirmLabel="Delete company"
        onConfirm={handleDeleteCompany}
        onCancel={() => setDeleting(null)}
        loading={deleteBusy}
      />
    </div>
  );
}

function MembersModal({
  company,
  currentUid,
  onClose,
}: {
  company: CompanyMember;
  currentUid: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("staff");
  const [inviting, setInviting] = useState(false);

  const [removing, setRemoving] = useState<CompanyMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "companyMembers"), where("companyId", "==", company.companyId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMembers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CompanyMember)));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [company.companyId]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/companies/${company.companyId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Couldn't add that person.");
      toast.success("Member added");
      setInviteEmail("");
      setInviteRole("staff");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that person.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: CompanyMember, role: CompanyRole) {
    try {
      await updateDoc(doc(db, "companyMembers", member.id), { role });
      toast.success(`${member.name} is now ${role} on ${company.companyName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that person's role.");
    }
  }

  async function handleRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await deleteDoc(doc(db, "companyMembers", removing.id));
      toast.success(`Removed ${removing.name} from ${company.companyName}`);
      setRemoving(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that person.");
    } finally {
      setRemoveBusy(false);
    }
  }

  const lastAdminStanding = members.filter((m) => m.role === "admin").length <= 1;

  return (
    <Modal open onClose={onClose} title={`Members of ${company.companyName}`} maxWidth="max-w-xl">
      <div className="space-y-5">
        <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Add by email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
            />
          </div>
          <div className="w-full sm:w-32">
            <Select label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as CompanyRole)}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <Button type="submit" loading={inviting}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        </form>
        <p className="-mt-3 text-xs text-slate-400">
          They need a StockFlow account already (any email they used to sign up with works).
        </p>

        {loading ? (
          <div className="py-6 text-sm text-slate-400">Loading members…</div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-400">{m.email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="w-28">
                        <Select
                          value={m.role}
                          disabled={m.uid === currentUid && lastAdminStanding}
                          onChange={(e) => handleRoleChange(m, e.target.value as CompanyRole)}
                        >
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                        </Select>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setRemoving(m)}
                        disabled={m.uid === currentUid && lastAdminStanding}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500 disabled:opacity-30"
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5" /> A company always needs at least one admin, so the last admin
          can't demote or remove themselves.
        </p>
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove member"
        description={`Remove ${removing?.name} from ${company.companyName}? They'll lose access to this company's data immediately.`}
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
        loading={removeBusy}
      />
    </Modal>
  );
}