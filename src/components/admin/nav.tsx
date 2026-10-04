"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Filter,
  Globe2,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Radio,
  ScrollText,
  Users,
  Aperture,
  BookOpen,
  ClipboardCheck,
  Fingerprint,
  FlaskConical,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Star,
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
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
];

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

// Grouped by when you need the screen, in the order the work flows:
// daily work first, then what the verdicts feed, then settings and records.
const CONTROL_NAV: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Günlük iş",
    items: [
      { href: "/admin/control", label: "Genel Bakış", icon: LayoutDashboard },
      { href: "/admin/control/reviews", label: "İnceleme", icon: ClipboardCheck },
      { href: "/admin/control/trace", label: "Vaka izi", icon: Fingerprint },
      { href: "/admin/control/deneme", label: "Deneme", icon: FlaskConical },
    ],
  },
  {
    title: "Ölçüm",
    items: [
      { href: "/admin/control/golden", label: "Referans vakalar", icon: Star },
      { href: "/admin/control/uyum", label: "Uyum", icon: Scale },
    ],
  },
  {
    title: "Ayar ve kayıt",
    items: [
      { href: "/admin/control/calibration", label: "Yayın", icon: SlidersHorizontal },
      { href: "/admin/control/mercekler", label: "Mercekler", icon: Aperture },
      { href: "/admin/control/audit", label: "Denetim", icon: ShieldCheck },
      { href: "/admin/control/rehber", label: "Nasıl çalışır", icon: BookOpen },
    ],
  },
];

export function AdminNav({ showMarketing = true }: { showMarketing?: boolean }) {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--revint-border)] bg-[var(--revint-surface)] min-h-screen sticky top-0">
      <div className="p-5 border-b border-[var(--revint-border)]">
        <div className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
          Revint
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--revint-500)]" />
          <span className="text-sm font-semibold text-[var(--revint-text-1)]">
            {showMarketing ? "Admin · Analytics" : "Admin · Kontrol odası"}
          </span>
        </div>
      </div>
      <nav aria-label="Admin navigation" className="p-3 flex flex-col gap-1">
        {showMarketing && NAV.map((item) => {
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
                  ? "bg-[var(--revint-hover)] text-[var(--revint-text-1)]"
                  : "text-[var(--revint-text-2)] hover:bg-[var(--revint-hover)] hover:text-[var(--revint-text-1)]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {CONTROL_NAV.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <div className="px-3 pt-4 pb-1 text-xs uppercase tracking-wider text-[var(--revint-text-3)]">
              {showMarketing ? `Kontrol · ${group.title}` : group.title}
            </div>
            {group.items.map((item) => {
              const active = item.href === "/admin/control" ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              const href = workspaceId ? `${item.href}?workspaceId=${encodeURIComponent(workspaceId)}` : item.href;
              return <Link key={item.href} href={href} aria-current={active ? "page" : undefined} className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active ? "bg-[var(--revint-hover)] text-[var(--revint-text-1)]" : "text-[var(--revint-text-2)] hover:bg-[var(--revint-hover)] hover:text-[var(--revint-text-1)]",
              )}><Icon className="h-4 w-4" />{item.label}</Link>;
            })}
          </div>
        ))}
        {!showMarketing && (
          <Link href="/admin" className="mt-4 px-3 py-2 text-xs text-[var(--revint-text-3)] hover:text-[var(--revint-text-1)]">
            Pazarlama analitiği
          </Link>
        )}
      </nav>
    </aside>
  );
}
