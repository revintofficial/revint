/**
 * AppChrome — reusable shell that reproduces the Leadac AI app UI
 * (sidebar + workspace header + content area) for pure-Remotion feature
 * scenes that don't have a captured plate.
 *
 * Matches the real `AppShell` layout: left sidebar with nav groups
 * (Overview, Discover, Leads, Deals, Tasks, Campaigns, Settings),
 * workspace badge, usage pill, and a content area on the right.
 *
 * Pass `activeRoute` to highlight one of the nav items. Pass `children`
 * to render the scene-specific content. Pass `title` to set the page
 * header (e.g. "Dashboard", "Pipeline", "Campaigns").
 */
import React from "react";
import { COLORS, TYPE } from "../theme/tokens";

export type AppRoute =
  | "dashboard"
  | "discover"
  | "leads"
  | "deals"
  | "todos"
  | "campaigns"
  | "settings";

interface NavItem {
  id: AppRoute;
  label: string;
  group: "OVERVIEW" | "WORK";
  glyph: string;
}

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", group: "OVERVIEW", glyph: "▤" },
  { id: "discover", label: "Discover", group: "WORK", glyph: "◎" },
  { id: "leads", label: "Leads", group: "WORK", glyph: "☰" },
  { id: "deals", label: "Pipeline", group: "WORK", glyph: "◫" },
  { id: "todos", label: "Tasks", group: "WORK", glyph: "✓" },
  { id: "campaigns", label: "Campaigns", group: "WORK", glyph: "✉" },
  { id: "settings", label: "Settings", group: "WORK", glyph: "⚙" },
];

export interface AppChromeProps {
  activeRoute: AppRoute;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** Right-side header content, e.g. action buttons. */
  headerRight?: React.ReactNode;
  /** Override usage value (0..1). */
  usagePct?: number;
  /** Workspace name shown in the sidebar. */
  workspace?: string;
}

export const AppChrome: React.FC<AppChromeProps> = ({
  activeRoute,
  title,
  subtitle,
  children,
  headerRight,
  usagePct = 0.38,
  workspace = "Mert's Workspace",
}) => {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: COLORS.bg,
        display: "flex",
        fontFamily: TYPE.family,
        color: COLORS.text,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 280,
          borderRight: `1px solid ${COLORS.border}`,
          background: "rgba(12,12,16,0.6)",
          padding: "28px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Workspace badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `0.5px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: COLORS.primaryGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: TYPE.weight.bold,
              color: "#0A0A0F",
              fontSize: 16,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 14, fontWeight: TYPE.weight.semibold }}>{workspace}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: "0.04em" }}>
              Pro Solo
            </div>
          </div>
        </div>

        {/* Nav */}
        {(["OVERVIEW", "WORK"] as const).map((group) => (
          <div key={group} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: TYPE.tracking.eyebrow,
                color: COLORS.textDim,
                textTransform: "uppercase",
                fontWeight: TYPE.weight.semibold,
                padding: "0 8px 4px",
              }}
            >
              {group}
            </div>
            {NAV.filter((n) => n.group === group).map((n) => {
              const active = n.id === activeRoute;
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: active ? "rgba(94,106,210,0.18)" : "transparent",
                    color: active ? COLORS.text : COLORS.textMuted,
                    fontSize: 14,
                    fontWeight: active ? TYPE.weight.semibold : TYPE.weight.medium,
                    border: active
                      ? `0.5px solid rgba(94,106,210,0.45)`
                      : "0.5px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 16, opacity: 0.85 }}>{n.glyph}</span>
                  {n.label}
                </div>
              );
            })}
          </div>
        ))}

        {/* Usage pill */}
        <div
          style={{
            marginTop: "auto",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `0.5px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 11,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: TYPE.tracking.eyebrow,
              marginBottom: 8,
            }}
          >
            <span>Leads this month</span>
            <span style={{ color: COLORS.text }}>{Math.round(usagePct * 300)}/300</span>
          </div>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${usagePct * 100}%`,
                height: "100%",
                background: COLORS.primaryGradient,
              }}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Page header */}
        <header
          style={{
            padding: "26px 40px",
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: TYPE.tracking.eyebrow,
                color: COLORS.textDim,
                textTransform: "uppercase",
                fontWeight: TYPE.weight.semibold,
                marginBottom: 6,
              }}
            >
              {workspace}
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: TYPE.weight.semibold,
                letterSpacing: TYPE.tracking.subhead,
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 15,
                  color: COLORS.textMuted,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </header>

        {/* Page body */}
        <div style={{ flex: 1, padding: 40, overflow: "hidden", position: "relative" }}>
          {children}
        </div>
      </main>
    </div>
  );
};
