"use client";

import * as React from "react";
import { BottomSheet } from "./bottom-sheet";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * iOS-style action sheet — a list of single-tap actions with optional
 * destructive styling. Used as the long-press / overflow menu on phone.
 *
 * Apple HIG: keep destructive actions visually distinct, group with separators
 * if more than 4 items, and always offer "Cancel" as the last item.
 */
export type ActionSheetItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** Tooltip / sub-label below main label. */
  description?: string;
};

export interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: ActionSheetItem[];
  /** Defaults to "Cancel". Pass null to hide the cancel button. */
  cancelLabel?: string | null;
}

export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  items,
  cancelLabel = "Cancel",
}: ActionSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      hideHandle={false}
      snap="auto"
    >
      <div role="menu" className="flex flex-col gap-1 -mx-2">
        {items.map((item) => (
          <button
            key={item.id}
            role="menuitem"
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              triggerHaptic(item.destructive ? "warning" : "light");
              item.onSelect();
              onOpenChange(false);
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-xl text-left",
              "hover:bg-white/5 active:bg-white/10 disabled:opacity-40 disabled:pointer-events-none",
              "focus-visible:outline-2 focus-visible:outline-(--leadac-500)",
            )}
            style={{
              minHeight: "var(--touch-target-min)",
              color: item.destructive
                ? "var(--leadac-error)"
                : "var(--leadac-text-1)",
            }}
          >
            {item.icon && (
              <item.icon
                className="w-5 h-5 shrink-0"
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
            <div className="flex-1 min-w-0">
              <div
                className="font-medium truncate"
                style={{ fontSize: "var(--text-callout)" }}
              >
                {item.label}
              </div>
              {item.description && (
                <div
                  className="truncate mt-0.5"
                  style={{
                    color: "var(--leadac-text-3)",
                    fontSize: "var(--text-footnote)",
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {cancelLabel !== null && (
        <div className="-mx-5 -mb-4 mt-3 px-5 py-3" style={{ borderTop: "0.5px solid hsl(0 0% 100% / 0.06)" }}>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onOpenChange(false);
            }}
            className="w-full rounded-xl py-3 font-semibold focus-visible:outline-2 focus-visible:outline-(--leadac-500) hover:bg-white/5 active:bg-white/10"
            style={{
              minHeight: "var(--touch-target-min)",
              fontSize: "var(--text-callout)",
              color: "var(--leadac-text-1)",
              background: "hsl(0 0% 100% / 0.04)",
            }}
          >
            {cancelLabel}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
