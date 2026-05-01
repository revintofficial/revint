"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Mobile/tablet top app bar — fixed top, glass background, safe-area aware.
 *
 * Apple HIG mapping:
 *   - 56px content height (44pt min touch target for back button + title)
 *   - Title is centered visually but left-aligned when there's a back button
 *   - Trailing slot for 1–2 actions (more than that → put in overflow menu)
 *
 * Use this on every authed page that has a meaningful title or back action.
 * Hidden on desktop (≥1024px) — the existing desktop header takes over there.
 */
export interface AppBarProps {
  title?: React.ReactNode;
  /** Show the iOS back chevron. If `backHref` is set, links there; else `router.back()`. */
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  /** Slot for action buttons on the trailing edge. */
  actions?: React.ReactNode;
  /** Slot for an icon button on the leading edge (replaces back). */
  leading?: React.ReactNode;
  /** Drop the glass background — useful for tinted hero pages. */
  transparent?: boolean;
  className?: string;
}

export function AppBar({
  title,
  showBack,
  backHref,
  backLabel = "Back",
  actions,
  leading,
  transparent,
  className,
}: AppBarProps) {
  const router = useRouter();

  const handleBack = () => {
    triggerHaptic("light");
    if (backHref) return; // Link handles it
    router.back();
  };

  return (
    <header
      role="banner"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 lg:hidden safe-pt",
        className,
      )}
      style={{
        background: transparent
          ? "transparent"
          : "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.85)",
        backdropFilter: transparent ? undefined : "saturate(180%) blur(30px)",
        WebkitBackdropFilter: transparent
          ? undefined
          : "saturate(180%) blur(30px)",
        borderBottom: transparent
          ? "none"
          : "0.5px solid hsl(0 0% 100% / 0.08)",
      }}
    >
      <div
        className="flex items-center gap-1 px-2"
        style={{ minHeight: "var(--app-bar-height)" }}
      >
        <div className="flex items-center gap-1 shrink-0">
          {leading ?? null}
          {showBack && !leading && (
            backHref ? (
              <Link
                href={backHref}
                onClick={() => triggerHaptic("light")}
                aria-label={backLabel}
                className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) -ml-1"
                style={{ color: "var(--leadac-text-1)" }}
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
              </Link>
            ) : (
              <button
                onClick={handleBack}
                aria-label={backLabel}
                className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) -ml-1"
                style={{ color: "var(--leadac-text-1)" }}
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2.25} />
              </button>
            )
          )}
        </div>
        <div className="flex-1 min-w-0 px-2">
          {typeof title === "string" ? (
            <h1
              className="font-semibold tracking-tight truncate"
              style={{
                color: "var(--leadac-text-1)",
                fontSize: "var(--text-title-3)",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h1>
          ) : (
            title
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-1 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  );
}

/**
 * Convenience: an icon button styled for AppBar `actions` / `leading` slots.
 * Always 44pt; always has aria-label.
 */
export function AppBarIconButton({
  icon: Icon,
  label,
  onClick,
  href,
  badge,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: number | boolean;
}) {
  const inner = (
    <span
      className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) relative"
      style={{ color: "var(--leadac-text-1)" }}
    >
      <Icon className="w-5 h-5" strokeWidth={2} />
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 rounded-full text-[10px] font-semibold flex items-center justify-center"
          style={{
            minWidth: "16px",
            height: "16px",
            padding: typeof badge === "number" && badge > 9 ? "0 4px" : "0",
            background: "var(--leadac-error)",
            color: "white",
            border: "1.5px solid hsl(var(--leadac-h) var(--leadac-ns) 8%)",
          }}
        >
          {typeof badge === "number" ? (badge > 99 ? "99+" : badge) : ""}
        </span>
      ) : null}
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} onClick={() => triggerHaptic("light")}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        triggerHaptic("light");
        onClick?.();
      }}
    >
      {inner}
    </button>
  );
}
