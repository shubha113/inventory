"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, Check, Settings2 } from "lucide-react";
import { useCompany } from "@/lib/company-context";

// Lets the user see which company they're currently looking at, and
// switch to any other company they belong to, from anywhere in the app.
export function CompanySwitcher() {
  const { companies, activeCompany, setActiveCompanyId, loading } = useCompany();
  const [open, setOpen] = useState(false);

  if (loading && companies.length === 0) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />;
  }

  if (companies.length === 0) {
    // No company yet — nudge them straight to creating one.
    return (
      <Link
        href="/companies"
        className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-700"
      >
        <Building2 className="h-4 w-4" /> Create a company
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Building2 className="h-4 w-4 text-slate-400" />
        <span className="max-w-[10rem] truncate">{activeCompany?.companyName ?? "Select company"}</span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Your companies
            </p>
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCompanyId(c.companyId);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span className="truncate">{c.companyName}</span>
                {c.companyId === activeCompany?.companyId && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            ))}
            <div className="mt-1 border-t border-slate-100 pt-1">
              <Link
                href="/companies"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4" /> Manage companies
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
