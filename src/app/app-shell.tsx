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
  Calendar,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/discovery", label: "Discover", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/watchlist", label: "Shortlist", icon: Star },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/todos", label: "Tasks", icon: CheckSquare },
];

function DateDisplay() {
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }));
  }, []);
  return (
    <span className="text-xs font-medium" style={{ color: "rgba(235, 235, 245, 0.7)" }}>
      {date}
    </span>
  );
}

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

  const currentPageName =
    NAV_LINKS.find((link) =>
      link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
    )?.label || "Lead Engine";

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Background layer */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-black" />
      </div>

      {/* Mobile top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden"
        style={{
          background: "rgba(28, 28, 30, 0.85)",
          backdropFilter: "saturate(180%) blur(30px)",
          WebkitBackdropFilter: "saturate(180%) blur(30px)",
          borderBottom: "0.5px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-lg p-1.5 hover:bg-white/5 transition-colors"
          style={{ color: "rgba(235, 235, 245, 0.6)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 md:z-10 h-full transition-transform duration-300 ease-in-out ${
          collapsed ? "md:w-[80px]" : "md:w-72"
        } ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full w-72 md:translate-x-0"}`}
      >
        <div className="h-full p-3">
          <div
            className="h-full flex flex-col overflow-hidden rounded-2xl"
            style={{
              background: "rgba(28, 28, 30, 0.75)",
              backdropFilter: "saturate(180%) blur(30px)",
              WebkitBackdropFilter: "saturate(180%) blur(30px)",
              border: "0.5px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {/* Logo area */}
            <div className="px-5 pt-6 pb-5" style={{ borderBottom: "0.5px solid rgba(255, 255, 255, 0.05)" }}>
              <div className={`flex items-center ${collapsed ? "md:justify-center" : "gap-3"}`}>
                <div
                  className="relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
                  style={{
                    background: "rgba(10, 132, 255, 0.12)",
                    border: "0.5px solid rgba(10, 132, 255, 0.2)",
                  }}
                >
                  <Zap className="w-5 h-5 text-[#0A84FF]" />
                </div>
                <div className={`flex-1 min-w-0 ${collapsed ? "md:hidden" : ""}`}>
                  <h1 className="text-lg font-semibold truncate text-white" style={{ letterSpacing: "-0.01em" }}>
                    Lead Engine
                  </h1>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(235, 235, 245, 0.5)" }}>
                    Sales Automation
                  </p>
                </div>
                <button
                  onClick={closeSidebar}
                  className="rounded-lg p-1 hover:bg-white/10 transition-colors md:hidden"
                  style={{ color: "rgba(235, 235, 245, 0.6)" }}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
              {NAV_LINKS.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                      collapsed ? "md:justify-center md:px-2" : ""
                    }`}
                    style={isActive ? { background: "rgba(10, 132, 255, 0.15)" } : {}}
                  >
                    <div
                      className="relative flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                      style={isActive ? { background: "rgba(10, 132, 255, 0.2)" } : {}}
                    >
                      <link.icon
                        className="w-4 h-4 transition-colors"
                        style={{
                          color: isActive ? "#0A84FF" : "rgba(235, 235, 245, 0.6)",
                          strokeWidth: 2,
                        }}
                      />
                    </div>
                    <span
                      className={`text-sm transition-colors flex-1 ${collapsed ? "md:hidden" : ""}`}
                      style={{
                        color: isActive ? "#FFFFFF" : "rgba(235, 235, 245, 0.7)",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Collapse toggle */}
            <div className="hidden md:block px-4 py-4" style={{ borderTop: "0.5px solid rgba(255, 255, 255, 0.05)" }}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs hover:bg-white/5 transition-colors w-full ${
                  collapsed ? "justify-center" : ""
                }`}
                style={{ color: "rgba(235, 235, 245, 0.4)" }}
              >
                {collapsed ? (
                  <PanelLeft className="w-4 h-4 shrink-0" />
                ) : (
                  <>
                    <PanelLeftClose className="w-4 h-4 shrink-0" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Glass Header */}
        <header
          className="mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-xl overflow-hidden relative hidden md:block"
          style={{
            background: "rgba(28, 28, 30, 0.75)",
            backdropFilter: "saturate(180%) blur(30px)",
            WebkitBackdropFilter: "saturate(180%) blur(30px)",
            border: "0.5px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div className="h-14 sm:h-16 flex items-center px-4 sm:px-5">
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-semibold tracking-tight truncate text-white" style={{ letterSpacing: "-0.01em" }}>
                {currentPageName}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "0.5px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Calendar className="w-3.5 h-3.5" style={{ color: "rgba(235, 235, 245, 0.6)" }} />
                <DateDisplay />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pt-14 md:pt-3">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
