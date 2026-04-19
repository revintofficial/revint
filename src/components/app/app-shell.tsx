"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Star,
  GitBranch,
  Search,
  CheckSquare,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Zap,
  Command as CommandIcon,
} from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { CommandPalette } from "@/components/app/command-palette";
import { UsageBadge } from "@/components/app/usage-badge";
import { UpgradeBanner } from "@/components/app/upgrade-banner";
import { CopilotDrawer } from "@/components/app/copilot-drawer";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/app/dashboard", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Find",
    items: [{ href: "/app/discovery", label: "Discover", icon: Search }],
  },
  {
    label: "Work",
    items: [
      { href: "/app/leads", label: "Leads", icon: Users },
      { href: "/app/pipeline", label: "Pipeline", icon: GitBranch },
      { href: "/app/watchlist", label: "Shortlist", icon: Star },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/app/todos", label: "Tasks", icon: CheckSquare },
      { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
];

const ALL_LINKS = NAV_GROUPS.flatMap((g) => g.items);

export interface AppShellProps {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  };
  role: "OWNER" | "ADMIN" | "MEMBER";
  usage: {
    plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
    planName: string;
    leadsUsed: number;
    leadsLimit: number;
    aiUsed: number;
    aiLimit: number;
  } | null;
  children: React.ReactNode;
}

export function AppShell({ user, workspace, role, usage, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close on route change. The lint rule `react-hooks/set-state-in-effect`
  // discourages this pattern, but reacting to a route change is exactly the
  // sync-with-external-system case the rule allows. We pass the close handler
  // as an explicit dep to satisfy exhaustive-deps.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    closeSidebar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentPageName =
    ALL_LINKS.find((l) =>
      l.href === "/app/dashboard"
        ? pathname === "/app/dashboard"
        : pathname.startsWith(l.href)
    )?.label || "Lead Engine";

  return (
    <div className="flex h-screen overflow-hidden relative bg-black">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-white focus:text-black focus:outline-none"
      >
        Skip to main content
      </a>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={ALL_LINKS}
      />

      {/* P1.2 - AI sales co-pilot floating drawer */}
      <CopilotDrawer />

      {/* Mobile top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden safe-pt"
        style={{
          background: "rgba(28, 28, 30, 0.85)",
          backdropFilter: "saturate(180%) blur(30px)",
          WebkitBackdropFilter: "saturate(180%) blur(30px)",
          borderBottom: "0.5px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
          style={{ color: "rgba(235, 235, 245, 0.7)" }}
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/app/dashboard" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(10, 132, 255, 0.12)",
              border: "0.5px solid rgba(10, 132, 255, 0.2)",
            }}
          >
            <Zap className="w-4 h-4 text-[#0A84FF]" />
          </div>
          <h1 className="text-base font-semibold tracking-tight text-white">
            Lead Engine
          </h1>
        </Link>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative z-50 md:z-10 h-full transition-transform duration-300 ease-in-out ${
          collapsed ? "md:w-[80px]" : "md:w-[260px]"
        } ${sidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full w-[260px] md:translate-x-0"}`}
        aria-label="Primary navigation"
      >
        <div className="h-full p-3">
          <div
            className="h-full flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: "rgba(20, 20, 22, 0.85)",
              backdropFilter: "saturate(180%) blur(30px)",
              WebkitBackdropFilter: "saturate(180%) blur(30px)",
              border: "0.5px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {/* Logo */}
            <div
              className="px-4 pt-5 pb-4"
              style={{ borderBottom: "0.5px solid rgba(255, 255, 255, 0.06)" }}
            >
              <div className={`flex items-center ${collapsed ? "md:justify-center" : "gap-2.5"}`}>
                <Link
                  href="/app/dashboard"
                  className="relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
                  style={{
                    background: "rgba(10, 132, 255, 0.12)",
                    border: "0.5px solid rgba(10, 132, 255, 0.2)",
                  }}
                  aria-label="Lead Engine home"
                >
                  <Zap className="w-4.5 h-4.5 text-[#0A84FF]" />
                </Link>
                <div className={`flex-1 min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                  <h1 className="text-[15px] font-semibold truncate text-white tracking-tight">
                    Lead Engine
                  </h1>
                  <p
                    className="text-[11px] truncate"
                    style={{ color: "rgba(235, 235, 245, 0.5)" }}
                  >
                    {workspace.name}
                  </p>
                </div>
                <button
                  onClick={closeSidebar}
                  className="rounded-lg p-1 hover:bg-white/10 md:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
                  style={{ color: "rgba(235, 235, 245, 0.7)" }}
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search / command palette trigger */}
              <button
                onClick={() => setPaletteOpen(true)}
                className={`mt-4 flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF] ${
                  collapsed ? "md:justify-center" : ""
                }`}
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "0.5px solid rgba(255, 255, 255, 0.06)",
                }}
                aria-label="Open command palette"
              >
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(235, 235, 245, 0.5)" }} />
                <span
                  className={`flex-1 text-[12.5px] ${collapsed ? "md:hidden" : ""}`}
                  style={{ color: "rgba(235, 235, 245, 0.5)" }}
                >
                  Search…
                </span>
                <kbd
                  className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${collapsed ? "md:hidden" : ""}`}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(235, 235, 245, 0.5)",
                  }}
                >
                  <CommandIcon className="w-2.5 h-2.5" />K
                </kbd>
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide" aria-label="Main">
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-3 last:mb-0">
                  <p
                    className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${collapsed ? "md:hidden" : ""}`}
                    style={{ color: "rgba(235, 235, 245, 0.35)" }}
                  >
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((link) => {
                      const isActive = pathname.startsWith(link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={isActive ? "page" : undefined}
                          className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF] ${
                            collapsed ? "md:justify-center md:px-2" : ""
                          }`}
                          style={isActive ? { background: "rgba(10, 132, 255, 0.13)" } : {}}
                        >
                          <link.icon
                            className="w-4 h-4 shrink-0 transition-colors"
                            style={{
                              color: isActive ? "#0A84FF" : "rgba(235, 235, 245, 0.65)",
                              strokeWidth: 2,
                            }}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-[13.5px] flex-1 truncate ${collapsed ? "md:hidden" : ""}`}
                            style={{
                              color: isActive ? "#FFFFFF" : "rgba(235, 235, 245, 0.75)",
                              fontWeight: isActive ? 600 : 450,
                            }}
                          >
                            {link.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer: usage + user menu */}
            <div
              className="px-3 py-3 space-y-2"
              style={{ borderTop: "0.5px solid rgba(255, 255, 255, 0.06)" }}
            >
              {usage && !collapsed && (
                <UsageBadge usage={usage} />
              )}

              <UserMenu user={user} workspace={workspace} role={role} collapsed={collapsed} />

              <button
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
                style={{ color: "rgba(235, 235, 245, 0.45)" }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <PanelLeft className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5 shrink-0" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header
          className="mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-xl overflow-hidden hidden md:block"
          style={{
            background: "rgba(20, 20, 22, 0.85)",
            backdropFilter: "saturate(180%) blur(30px)",
            WebkitBackdropFilter: "saturate(180%) blur(30px)",
            border: "0.5px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div className="h-12 flex items-center px-4">
            <div className="flex-1">
              <h2
                className="text-[14px] font-semibold tracking-tight truncate text-white"
                style={{ letterSpacing: "-0.005em" }}
              >
                {currentPageName}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0A84FF]"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "0.5px solid rgba(255, 255, 255, 0.08)",
                  color: "rgba(235, 235, 245, 0.6)",
                }}
                aria-label="Open command palette"
              >
                <span>Quick search</span>
                <kbd className="flex items-center gap-0.5 text-[10px]">
                  <CommandIcon className="w-2.5 h-2.5" />K
                </kbd>
              </button>
            </div>
          </div>
        </header>

        {usage && (usage.leadsUsed / usage.leadsLimit > 0.8 || usage.aiUsed / usage.aiLimit > 0.8) && (
          <div className="mx-4 sm:mx-4 mt-3">
            <UpgradeBanner usage={usage} />
          </div>
        )}

        <main
          id="main-content"
          className="flex-1 overflow-y-auto pt-[calc(env(safe-area-inset-top)+56px)] md:pt-0 safe-pb"
        >
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
