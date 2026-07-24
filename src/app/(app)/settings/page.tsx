"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserProfile } from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/users", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setUsers(data.users);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleRoleChange(user: UserProfile, role: string) {
    try {
      const res = await fetch(`/api/auth/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? "Couldn't update that person's role.");
      toast.success(`${user.name} is now ${role}`);
      await loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update that person's role.");
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Your account and team access." />

      <Card className="mb-6 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
            {profile?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900">{profile?.name}</p>
            <p className="text-sm text-slate-500">{profile?.email}</p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium capitalize text-brand-700">
            <ShieldCheck className="h-3.5 w-3.5" /> {profile?.role}
          </span>
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Team members</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Anyone who signs up joins your workspace. Admins can manage products, orders, and other people&apos;s access; staff can use everything except changing roles.
          </p>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.uid} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 font-medium text-slate-900">
                        <User className="h-4 w-4 text-slate-300" /> {u.name}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <div className="w-36">
                        <Select
                          value={u.role}
                          disabled={profile?.role !== "admin" || u.uid === profile?.uid}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                        >
                          <option value="admin">Admin</option>
                          <option value="staff">Staff</option>
                        </Select>
                      </div>
                    </td>
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
