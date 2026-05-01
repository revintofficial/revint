"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Bottom sheet — phone-first modal that slides up from the bottom edge.
 *
 * Built on Radix Dialog so all the accessibility plumbing (focus trap,
 * Esc to close, aria-modal) is correct by default. Snap-points are CSS
 * controlled (`--sheet-snap-*`); for true draggable snapping we'll pull in
 * `vaul` later, but the static three-tier height is enough for v1.
 *
 * On tablet/desktop the sheet collapses to a centered card (use `<Dialog>`
 * directly if you want centered-only behavior).
 *
 * Usage:
 *   <BottomSheet open={open} onOpenChange={setOpen} title="Filters" snap="mid">
 *     ...content...
 *     <BottomSheetFooter>...buttons...</BottomSheetFooter>
 *   </BottomSheet>
 */
export type BottomSheetSnap = "min" | "mid" | "max" | "auto";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Hide the visual handle bar at the top (rare). */
  hideHandle?: boolean;
  /** Hide the close button (rare; useful for forced-action sheets). */
  hideClose?: boolean;
  /** Initial height. `auto` fits content up to 92vh. */
  snap?: BottomSheetSnap;
  /** Force-render a centered modal even on phone. */
  centered?: boolean;
  className?: string;
  children: React.ReactNode;
}

const SNAP_HEIGHT: Record<Exclude<BottomSheetSnap, "auto">, string> = {
  min: "var(--sheet-snap-min)",
  mid: "var(--sheet-snap-mid)",
  max: "var(--sheet-snap-max)",
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  hideHandle,
  hideClose,
  snap = "auto",
  centered,
  className,
  children,
}: BottomSheetProps) {
  React.useEffect(() => {
    if (open) triggerHaptic("light");
  }, [open]);

  const phoneHeight = snap === "auto" ? "auto" : SNAP_HEIGHT[snap];
  const phoneMaxHeight = snap === "auto" ? "var(--sheet-snap-max)" : SNAP_HEIGHT[snap];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{ animationDuration: "var(--motion-base)" }}
        />
        <DialogPrimitive.Content
          className={cn(
            // Phone: bottom sheet
            "fixed left-0 right-0 bottom-0 z-60 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            // Tablet+ (or when `centered`): center the sheet
            centered
              ? "md:inset-0 md:flex md:items-center md:justify-center md:bottom-auto"
              : "md:left-1/2 md:right-auto md:bottom-auto md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-[calc(100%-2rem)]",
            className,
          )}
          style={{
            animationDuration: "var(--motion-base)",
            animationTimingFunction: "var(--motion-ease-emphasized)",
          }}
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus on first focusable element so the sheet
            // doesn't yank focus into a form input on open. Title gets focus.
            e.preventDefault();
            const root = e.currentTarget as HTMLElement;
            (root.querySelector("[data-sheet-title]") as HTMLElement | null)?.focus();
          }}
        >
          <div
            className={cn(
              "rounded-t-2xl md:rounded-2xl flex flex-col safe-pb md:safe-pb-0",
              "max-h-[92vh] md:max-h-[80vh]",
              "shadow-[0_-8px_40px_rgba(0,0,0,0.5)]",
            )}
            style={{
              background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.97)",
              backdropFilter: "saturate(180%) blur(30px)",
              WebkitBackdropFilter: "saturate(180%) blur(30px)",
              border: "0.5px solid hsl(0 0% 100% / 0.1)",
              height: snap === "auto" ? "auto" : phoneHeight,
              minHeight: snap === "auto" ? undefined : phoneHeight,
              maxHeight: phoneMaxHeight,
            }}
          >
            {!hideHandle && (
              <div className="flex justify-center pt-2 pb-1 md:hidden" aria-hidden="true">
                <div
                  className="rounded-full"
                  style={{
                    width: "36px",
                    height: "5px",
                    background: "hsl(0 0% 100% / 0.25)",
                  }}
                />
              </div>
            )}

            {(title || description || !hideClose) && (
              <div
                className="flex items-start gap-3 px-5 pt-3 pb-3"
                style={{ borderBottom: "0.5px solid hsl(0 0% 100% / 0.06)" }}
              >
                <div className="flex-1 min-w-0">
                  {title && (
                    <DialogPrimitive.Title asChild>
                      <h2
                        data-sheet-title
                        tabIndex={-1}
                        className="font-semibold tracking-tight focus:outline-none"
                        style={{
                          color: "var(--leadac-text-1)",
                          fontSize: "var(--text-title-3)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {title}
                      </h2>
                    </DialogPrimitive.Title>
                  )}
                  {description && (
                    <DialogPrimitive.Description
                      className="mt-0.5"
                      style={{
                        color: "var(--leadac-text-2)",
                        fontSize: "var(--text-footnote)",
                      }}
                    >
                      {description}
                    </DialogPrimitive.Description>
                  )}
                </div>
                {!hideClose && (
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className="touch-target rounded-lg hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) -mr-1.5 -mt-1"
                    style={{ color: "var(--leadac-text-2)" }}
                  >
                    <X className="w-5 h-5" strokeWidth={2.25} />
                  </DialogPrimitive.Close>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function BottomSheetFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row gap-2 sm:justify-end px-5 py-3 -mx-5 -mb-4 mt-4",
        className,
      )}
      style={{
        borderTop: "0.5px solid hsl(0 0% 100% / 0.06)",
        background: "hsl(var(--leadac-h) var(--leadac-ns) 8% / 0.6)",
      }}
    >
      {children}
    </div>
  );
}
