"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Filter,
  Globe2,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Radio,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/realtime", label: "Realtime", icon: Radio },
  { href: "/admin/sessions", label: "Sessions", icon: Users },
  { href: "/admin/geography", label: "Geography", icon: Globe2 },
  { href: "/admin/devices", label: "Devices", icon: Monitor },
  { href: "/admin/pages", label: "Pages", icon: BarChart3 },
  { href: "/admin/funnels", label: "Funnels", icon: Filter },
  { href: "/admin/sources", label: "Sources", icon: ListOrdered },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
];

export function AdminNav() {
  const pathname = usePathname() || "";
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--leadac-border)] bg-[var(--leadac-surface)] min-h-screen sticky top-0">
      <div className="p-5 border-b border-[var(--leadac-border)]">
        <div className="text-xs uppercase tracking-wider text-[var(--leadac-text-3)]">
          LeadAC
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--leadac-500)]" />
          <span className="text-sm font-semibold text-[var(--leadac-text-1)]">
            Admin · Analytics
          </span>
        </div>
      </div>
      <nav className="p-3 flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-[var(--leadac-hover)] text-[var(--leadac-text-1)]"
                  : "text-[var(--leadac-text-2)] hover:bg-[var(--leadac-hover)] hover:text-[var(--leadac-text-1)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
