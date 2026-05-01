"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky action bar — pinned to the bottom of the viewport with safe-area
 * padding. Use on detail screens (lead detail, deal detail, onboarding step)
 * for the primary CTA so users don't have to scroll to confirm.
 *
 * Apple HIG: keep the bar small (max 80–100px content height) and make the
 * primary CTA visually distinct from secondary actions.
 *
 * On phone, sits above the bottom tab bar (offsets `--tab-bar-height`).
 * On tablet/desktop, sits flush to the viewport edge.
 *
 * Optional `sentinel` ref prop returns an element you can place at the foot
 * of your scrollable content so you can `scrollIntoView` on errors etc.
 */
export interface StickyActionBarProps {
  children: React.ReactNode;
  /** When true, content includes a tab bar offset on phone. */
  aboveTabBar?: boolean;
  className?: string;
  /** Top divider visible. Default true. */
  divider?: boolean;
}

export function StickyActionBar({
  children,
  aboveTabBar = true,
  className,
  divider = true,
}: StickyActionBarProps) {
  return (
    <div
      role="toolbar"
      className={cn(
        "fixed left-0 right-0 z-40 safe-pb",
        "px-4 py-3",
        className,
      )}
      style={{
        bottom: aboveTabBar
          ? "var(--tab-bar-height-offset, 0px)"
          : "0px",
        background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.92)",
        backdropFilter: "saturate(180%) blur(30px)",
        WebkitBackdropFilter: "saturate(180%) blur(30px)",
        borderTop: divider ? "0.5px solid hsl(0 0% 100% / 0.08)" : "none",
      }}
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto">{children}</div>
    </div>
  );
}

/**
 * Padding helper to pair with `StickyActionBar`. Add this as the last child
 * of your page content to ensure the bar doesn't cover anything.
 */
export function StickyActionBarSpacer({
  height = 76,
}: {
  height?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: `${height}px`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    />
  );
}
