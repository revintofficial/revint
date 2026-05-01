"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Bottom tab bar — fixed bottom, glass background, safe-area aware.
 *
 * NN/g research: bottom tab bar with 3–5 destinations beats hamburger menus
 * on discoverability and engagement (Spotify, Instagram, all major B2B apps
 * have moved to it). iOS HIG and Material 3 both default to bottom tabs for
 * primary navigation.
 *
 * Renders only at phone widths (< 768px). At tablet+ widths the sidebar
 * takes over — return null to keep the DOM clean.
 *
 * Each tab is a 44pt minimum tap target with both icon and label, matching
 * Apple HIG (icons alone hurt comprehension).
 */
export interface BottomTabItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Show a numeric badge or dot. */
  badge?: number | boolean;
  /** Treat any path under `match` as active. Defaults to `href`. */
  match?: string;
}

export interface BottomTabBarProps {
  items: BottomTabItem[];
  className?: string;
}

export function BottomTabBar({ items, className }: BottomTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden safe-pb",
        className,
      )}
      style={{
        background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.85)",
        backdropFilter: "saturate(180%) blur(30px)",
        WebkitBackdropFilter: "saturate(180%) blur(30px)",
        borderTop: "0.5px solid hsl(0 0% 100% / 0.08)",
      }}
    >
      <ul
        role="list"
        className="flex items-stretch justify-around"
        style={{ minHeight: "var(--tab-bar-height)" }}
      >
        {items.map((item) => {
          const matchPath = item.match ?? item.href;
          const isActive =
            matchPath === "/app/dashboard"
              ? pathname === "/app/dashboard"
              : pathname.startsWith(matchPath);

          return (
            <li key={item.href} className="flex-1 flex">
              <Link
                href={item.href}
                onClick={() => {
                  if (!isActive) triggerHaptic("light");
                }}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className="flex flex-col items-center justify-center gap-1 w-full px-1 py-1.5 focus-visible:outline-2 focus-visible:outline-(--leadac-500) focus-visible:-outline-offset-4 rounded-lg active:bg-white/5 transition-colors"
                style={{
                  minHeight: "var(--touch-target-min)",
                  color: isActive
                    ? "var(--leadac-300)"
                    : "var(--leadac-text-2)",
                }}
              >
                <span className="relative">
                  <item.icon
                    className="w-[22px] h-[22px]"
                    strokeWidth={isActive ? 2.25 : 2}
                  />
                  {item.badge ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2 rounded-full text-[10px] font-semibold flex items-center justify-center"
                      style={{
                        minWidth: "16px",
                        height: "16px",
                        padding:
                          typeof item.badge === "number" && item.badge > 9
                            ? "0 4px"
                            : "0",
                        background: "var(--leadac-error)",
                        color: "white",
                        border:
                          "1.5px solid hsl(var(--leadac-h) var(--leadac-ns) 8%)",
                      }}
                    >
                      {typeof item.badge === "number"
                        ? item.badge > 99
                          ? "99+"
                          : item.badge
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span
                  className="text-[10.5px] tracking-tight leading-none truncate max-w-full"
                  style={{
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
