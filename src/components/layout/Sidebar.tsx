"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Layers,
  Factory,
  Tags,
  Truck,
  ArrowLeftRight,
  BarChart3,
  Settings,
  Boxes,
  Building2,
  ClipboardCheck,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/raw-materials", label: "Raw materials", icon: Layers },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/stock-movements", label: "Stock movements", icon: ArrowLeftRight },
  // Hidden for now, kept here (not deleted) in case they're needed again later:
  // { href: "/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  // { href: "/sales-orders", label: "Sales orders", icon: ShoppingCart },
  { href: "/material-requests", label: "Raise material request", icon: ClipboardCheck },
  { href: "/material-dispatch", label: "Material dispatch", icon: PackageCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Boxes className="h-5 w-5" />
        </div>
        <span className="text-base font-semibold text-slate-900">StockFlow</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4 text-xs text-slate-400">
        StockFlow Inventory · v0.1
      </div>
    </div>
  );
}