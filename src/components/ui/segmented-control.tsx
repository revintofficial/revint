"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * iOS-style segmented control. Replaces tab strips on phone where horizontal
 * scrolling tabs are too easy to miss. Implements the WAI-ARIA "tabs" pattern
 * (role="tablist") so screen readers announce it correctly.
 *
 * Use for 2–5 segments. More than 5? Use a Select or BottomSheet picker.
 *
 * Renders as a sliding pill — the active segment has the elevated background.
 * Honors `prefers-reduced-motion` (no slide on reduce).
 */
export interface SegmentedItem<V extends string = string> {
  value: V;
  label: React.ReactNode;
  /** Short label used at narrow widths. */
  shortLabel?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

/**
 * Verbose alias kept so call sites can `import { SegmentedControlItem }` —
 * this is the name most consumers expect from a "SegmentedControl" component.
 * Both names point at the same shape; pick whichever reads better in context.
 */
export type SegmentedControlItem<V extends string = string> = SegmentedItem<V>;

export interface SegmentedControlProps<V extends string = string> {
  items: SegmentedItem<V>[];
  value: V;
  onChange: (next: V) => void;
  /** "fill" stretches each segment to fill the row; "compact" shrinks to content. */
  variant?: "fill" | "compact";
  /** Aria label describing what the segmented control selects. */
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}

export function SegmentedControl<V extends string = string>({
  items,
  value,
  onChange,
  variant = "fill",
  ariaLabel,
  className,
  size = "md",
}: SegmentedControlProps<V>) {
  const handleSelect = (next: V) => {
    if (next === value) return;
    triggerHaptic("light");
    onChange(next);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex p-0.5 rounded-xl select-none",
        variant === "fill" ? "flex w-full" : "inline-flex",
        className,
      )}
      style={{
        background: "hsl(0 0% 100% / 0.05)",
        border: "0.5px solid hsl(0 0% 100% / 0.06)",
      }}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelect(item.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const idx = items.findIndex((i) => i.value === value);
                const dir = e.key === "ArrowRight" ? 1 : -1;
                const next = items[(idx + dir + items.length) % items.length];
                handleSelect(next.value);
              }
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[10px] font-medium",
              "transition-all duration-200 ease-out",
              "focus-visible:outline-2 focus-visible:outline-(--leadac-500)",
              variant === "fill" ? "flex-1 min-w-0" : "px-3",
              size === "sm" ? "h-8 text-[12.5px] px-2" : "h-10 px-3",
            )}
            style={{
              background: isActive
                ? "hsl(var(--leadac-h) var(--leadac-ns) 18% / 0.95)"
                : "transparent",
              color: isActive
                ? "var(--leadac-text-1)"
                : "var(--leadac-text-2)",
              fontWeight: isActive ? 600 : 500,
              fontSize: size === "sm" ? "12.5px" : "var(--text-subhead)",
              boxShadow: isActive
                ? "0 1px 2px rgba(0,0,0,0.2), 0 0 0 0.5px rgba(255,255,255,0.06) inset"
                : "none",
              minHeight: size === "sm" ? "32px" : "var(--touch-target-min)",
            }}
          >
            {item.icon && (
              <item.icon
                className={cn(size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4", "shrink-0")}
                strokeWidth={2}
              />
            )}
            <span className="truncate">
              {item.shortLabel ? (
                <>
                  <span className="hidden xs:inline sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline xs:hidden">{item.label}</span>
                  <span className="xs:hidden">{item.shortLabel}</span>
                </>
              ) : (
                item.label
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
