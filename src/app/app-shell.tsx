"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Bookmark,
  GitBranch,
  Search,
  CheckSquare,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  MapPin,
  Zap,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/pipeline", label: "Sales Pipeline", icon: GitBranch },
  { href: "/discovery", label: "Discovery", icon: Search },
  { href: "/todos", label: "Todos", icon: CheckSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl px-4 py-3 md:hidden border-b border-white/5">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          aria-label="Menüyü aç"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base font-semibold text-white tracking-tight">Lead Engine</h1>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col shrink-0 overflow-y-auto transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:translate-x-0 bg-slate-900/95 backdrop-blur-2xl text-slate-100 border-r border-white/5 ${
          collapsed ? "md:w-[68px]" : "md:w-64"
        } ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64"}`}
      >
        {/* Logo area */}
        <div className={`flex items-center justify-between p-4 border-b border-white/5 ${collapsed ? "md:justify-center md:px-2" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "md:gap-0" : ""}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shrink-0">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <div className={`${collapsed ? "md:hidden" : ""}`}>
              <h1 className="text-base font-semibold tracking-tight">Lead Engine</h1>
              <p className="text-[11px] text-slate-400">Phone Repair Sales</p>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-all md:hidden"
            aria-label="Menüyü kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  collapsed ? "md:justify-center md:px-2" : ""
                } ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-indigo-400 to-violet-400" />
                )}
                <link.icon className="w-[18px] h-[18px] shrink-0" />
                <span className={`${collapsed ? "md:hidden" : ""}`}>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className={`hidden md:flex p-3 border-t border-white/5 ${collapsed ? "justify-center" : ""}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all w-full"
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4 shrink-0 mx-auto" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" />
                <span>Daralt</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t border-white/5 ${collapsed ? "md:hidden" : ""}`}>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>Greenwich, London</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
    </div>
  );
}
