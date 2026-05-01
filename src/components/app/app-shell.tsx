"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  GitBranch,
  Search,
  CheckSquare,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Bell,
  MoreHorizontal,
  Command as CommandIcon,
} from "lucide-react";
import { UserMenu } from "@/components/app/user-menu";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { CommandPalette } from "@/components/app/command-palette";
import { UsageBadge } from "@/components/app/usage-badge";
import { UpgradeBanner } from "@/components/app/upgrade-banner";
import { CopilotDrawer } from "@/components/app/copilot-drawer";
import {
  BottomTabBar,
  type BottomTabItem,
} from "@/components/ui/bottom-tab-bar";
import { AppBarIconButton } from "@/components/ui/app-bar";
import { NotificationsSheet } from "@/components/app/notifications-sheet";

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
      { href: "/app/deals", label: "Deals", icon: GitBranch },
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

// 5-tab bottom navigation for phone (≤640px). Apple HIG / NN/g recommend
// 3–5 visible primary destinations; everything else lives under "More".
const PHONE_TABS: BottomTabItem[] = [
  { href: "/app/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/app/leads", label: "Leads", icon: Users },
  { href: "/app/discovery", label: "Discover", icon: Search },
  { href: "/app/deals", label: "Deals", icon: GitBranch },
  { href: "/app/more", label: "More", icon: MoreHorizontal, match: "/app/more" },
];

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
  // On tablet (md..lg) we collapse the sidebar to icons-only by default to
  // give the master/detail layouts more horizontal room. Persist the user
  // toggle in localStorage so it sticks across reloads.
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("leadac.sidebar.collapsed");
    if (stored === "1") setCollapsed(true);
    else if (stored === "0") setCollapsed(false);
    else if (typeof window !== "undefined") {
      // Default: collapsed on tablet, expanded on desktop
      setCollapsed(window.matchMedia("(max-width: 1023px)").matches);
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("leadac.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close on route change. The lint rule `react-hooks/set-state-in-effect`
  // discourages this pattern, but reacting to a route change is exactly the
  // sync-with-external-system case the rule allows.
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
        : pathname.startsWith(l.href),
    )?.label || "Leadac AI";

  // Hide the bottom tab bar on detail screens that own the bottom (the
  // /app/leads/[id] page renders its own sticky action bar there).
  const hideTabBarOnDetail = /^\/app\/leads\/[^/]+$/.test(pathname);

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: "var(--leadac-bg)",
        backgroundImage:
          "linear-gradient(180deg, hsl(var(--leadac-h) var(--leadac-ns) 5% / 0.58) 0%, hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.72) 100%), url(/background.jpeg)",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
      }}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-3 focus:py-2 focus:rounded-md focus:bg-white focus:text-black focus:outline-none"
      >
        Skip to main content
      </a>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        navItems={ALL_LINKS}
      />

      <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} />

      <CopilotDrawer />

      {/* Phone top bar (visible <md) — replaces hamburger sidebar trigger.
          Sidebar still available via a "Workspace" sheet from the left, but
          primary nav lives in the bottom tab bar. */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-1 px-2 md:hidden safe-pt"
        style={{
          background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.85)",
          backdropFilter: "saturate(180%) blur(30px)",
          WebkitBackdropFilter: "saturate(180%) blur(30px)",
          borderBottom: "0.5px solid hsl(0 0% 100% / 0.08)",
          minHeight: "var(--app-bar-height)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
          style={{ color: "var(--leadac-text-1)" }}
          aria-label="Open workspace menu"
        >
          <Menu className="w-5 h-5" strokeWidth={2.25} />
        </button>
        <Link
          href="/app/dashboard"
          className="flex items-center gap-2 flex-1 min-w-0 px-2 touch-target"
          aria-label="Leadac AI home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="w-7 h-7 object-contain shrink-0"
          />
          <h1
            className="font-semibold tracking-tight text-white truncate"
            style={{
              fontSize: "var(--text-title-3)",
              letterSpacing: "-0.01em",
            }}
          >
            {currentPageName}
          </h1>
        </Link>
        <AppBarIconButton
          icon={Bell}
          label="Notifications"
          onClick={() => setNotifOpen(true)}
        />
        <AppBarIconButton
          icon={Search}
          label="Search"
          onClick={() => setPaletteOpen(true)}
        />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — phone (off-canvas), tablet (collapsed icons), desktop (full) */}
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
              background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.85)",
              backdropFilter: "saturate(180%) blur(30px)",
              WebkitBackdropFilter: "saturate(180%) blur(30px)",
              border: "0.5px solid hsl(0 0% 100% / 0.08)",
            }}
          >
            <div
              className="px-4 pt-5 pb-4"
              style={{ borderBottom: "0.5px solid hsl(0 0% 100% / 0.06)" }}
            >
              <div
                className={`flex items-center ${collapsed ? "md:justify-center" : "gap-2.5"}`}
              >
                <Link
                  href="/app/dashboard"
                  className="relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                  aria-label="Leadac AI home"
                >
                  <Image
                    src="/logo.png"
                    alt=""
                    width={36}
                    height={36}
                    priority
                    className="w-9 h-9 object-contain"
                  />
                </Link>
                <div className={`flex-1 min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                  <h1 className="text-[15px] font-semibold truncate text-white tracking-tight">
                    Leadac AI
                  </h1>
                  <WorkspaceSwitcher
                    current={workspace}
                    role={role}
                    collapsed={collapsed}
                  />
                </div>
                <button
                  onClick={closeSidebar}
                  className="touch-target rounded-lg hover:bg-white/10 md:hidden focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                  style={{ color: "var(--leadac-text-2)" }}
                  aria-label="Close navigation menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setPaletteOpen(true)}
                className={`mt-4 flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-(--leadac-500) ${
                  collapsed ? "md:justify-center" : ""
                }`}
                style={{
                  background: "hsl(0 0% 100% / 0.04)",
                  border: "0.5px solid hsl(0 0% 100% / 0.06)",
                  minHeight: "36px",
                }}
                aria-label="Open command palette"
              >
                <Search
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--leadac-text-3)" }}
                />
                <span
                  className={`flex-1 text-[12.5px] ${collapsed ? "md:hidden" : ""}`}
                  style={{ color: "var(--leadac-text-3)" }}
                >
                  Search…
                </span>
                <kbd
                  className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${collapsed ? "md:hidden" : ""}`}
                  style={{
                    background: "hsl(0 0% 100% / 0.05)",
                    color: "var(--leadac-text-3)",
                  }}
                >
                  <CommandIcon className="w-2.5 h-2.5" />K
                </kbd>
              </button>
            </div>

            <nav
              className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide"
              aria-label="Main"
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className="mb-3 last:mb-0">
                  <p
                    className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${collapsed ? "md:hidden" : ""}`}
                    style={{ color: "var(--leadac-muted)" }}
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
                          title={collapsed ? link.label : undefined}
                          className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-(--leadac-500) ${
                            isActive ? "leadac-sidebar-active" : ""
                          } ${collapsed ? "md:justify-center md:px-2" : ""}`}
                          style={{ minHeight: "40px" }}
                        >
                          <link.icon
                            className="w-4 h-4 shrink-0 transition-colors"
                            style={{
                              color: isActive
                                ? "var(--leadac-300)"
                                : "var(--leadac-text-2)",
                              strokeWidth: 2,
                            }}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-[13.5px] flex-1 truncate ${collapsed ? "md:hidden" : ""}`}
                            style={{
                              color: isActive
                                ? "var(--leadac-text-1)"
                                : "var(--leadac-text-2)",
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

            <div
              className="px-3 py-3 space-y-2"
              style={{ borderTop: "0.5px solid hsl(0 0% 100% / 0.06)" }}
            >
              {usage && !collapsed && <UsageBadge usage={usage} />}

              <UserMenu
                user={user}
                workspace={workspace}
                role={role}
                collapsed={collapsed}
              />

              <button
                onClick={toggleCollapse}
                className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/5 w-full focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                style={{ color: "var(--leadac-muted)" }}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.85)",
            backdropFilter: "saturate(180%) blur(30px)",
            WebkitBackdropFilter: "saturate(180%) blur(30px)",
            border: "0.5px solid hsl(0 0% 100% / 0.08)",
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
                onClick={() => setNotifOpen(true)}
                className="touch-target rounded-md text-[12px] focus-visible:outline-2 focus-visible:outline-(--leadac-500) hover:bg-white/5"
                style={{ color: "var(--leadac-text-2)" }}
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPaletteOpen(true)}
                className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-md text-[12px] focus-visible:outline-2 focus-visible:outline-(--leadac-500)"
                style={{
                  background: "hsl(0 0% 100% / 0.05)",
                  border: "0.5px solid hsl(0 0% 100% / 0.08)",
                  color: "var(--leadac-text-2)",
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

        {usage &&
          (usage.leadsUsed / usage.leadsLimit > 0.8 ||
            usage.aiUsed / usage.aiLimit > 0.8) && (
            <div className="mx-4 sm:mx-4 mt-3">
              <UpgradeBanner usage={usage} />
            </div>
          )}

        <main
          id="main-content"
          className="flex-1 overflow-y-auto pt-[calc(env(safe-area-inset-top)+56px)] md:pt-0 pb-tabbar"
        >
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Phone bottom tab bar (always rendered <md, hidden via CSS otherwise) */}
      {!hideTabBarOnDetail && <BottomTabBar items={PHONE_TABS} />}
    </div>
  );
}
