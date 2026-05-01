"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Swipeable list row — drag left/right to reveal up to two action buttons,
 * commit at threshold for the primary action.
 *
 * Apple HIG: leading swipe = constructive (e.g. "Mark as contacted"),
 * trailing swipe = destructive (e.g. "Archive"). We follow the same default.
 *
 * Implementation: a content layer that translates on `pointermove`, with
 * action layers rendered behind. Uses pointer events for cross-device support
 * (mouse + touch). Falls back to no-swipe on devices without pointer events.
 *
 * Notes:
 *   - We commit at 60% of the row width. Releasing past 90% fires
 *     `onLeadingCommit` / `onTrailingCommit` with haptic feedback.
 *   - Click events on children are forwarded only when the drag distance is
 *     below 8px so a tap doesn't accidentally trigger after a small drag.
 */
export interface SwipeAction {
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Background color for the action panel (HSL or var). */
  color?: string;
  /** Text color for the action panel. */
  textColor?: string;
  onSelect: () => void;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  leadingAction?: SwipeAction;
  trailingAction?: SwipeAction;
  /** Long-press handler — fires after 500ms hold. */
  onLongPress?: () => void;
  className?: string;
  /** Disable swipe + long-press behavior (e.g. when row is in edit mode). */
  disabled?: boolean;
}

const COMMIT_THRESHOLD = 0.6;
const ACTION_WIDTH = 96;
const LONG_PRESS_MS = 500;
const TAP_THRESHOLD = 8;

export function SwipeableRow({
  children,
  leadingAction,
  trailingAction,
  onLongPress,
  className,
  disabled,
}: SwipeableRowProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const dragX = React.useRef(0);
  const isHorizontal = React.useRef(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedRef = React.useRef(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const setTransform = React.useCallback((x: number) => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translateX(${x}px)`;
    }
  }, []);

  const reset = React.useCallback(() => {
    setIsAnimating(true);
    setTransform(0);
    dragX.current = 0;
    setTimeout(() => setIsAnimating(false), 250);
  }, [setTransform]);

  const cancelLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontal.current = false;
    committedRef.current = false;

    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        triggerHaptic("heavy");
        onLongPress();
        committedRef.current = true; // suppress click
      }, LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
      cancelLongPress();
    }

    // Only enter horizontal-drag mode if the gesture is clearly sideways
    // — otherwise let vertical scrolling win.
    if (!isHorizontal.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > TAP_THRESHOLD) {
        isHorizontal.current = true;
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(dy) > TAP_THRESHOLD) {
        return;
      }
    }
    if (!isHorizontal.current) return;
    e.preventDefault();

    let nextX = dx;
    if (dx > 0 && !leadingAction) nextX = dx * 0.2;
    if (dx < 0 && !trailingAction) nextX = dx * 0.2;

    const w = containerRef.current?.offsetWidth ?? 320;
    const max = w * 0.92;
    nextX = Math.max(-max, Math.min(max, nextX));

    dragX.current = nextX;
    setTransform(nextX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelLongPress();
    if (disabled) return reset();

    const w = containerRef.current?.offsetWidth ?? 320;
    const dx = dragX.current;
    const ratio = Math.abs(dx) / w;

    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (ratio >= COMMIT_THRESHOLD) {
      triggerHaptic("medium");
      committedRef.current = true;
      if (dx > 0 && leadingAction) leadingAction.onSelect();
      if (dx < 0 && trailingAction) trailingAction.onSelect();
    }
    reset();
    isHorizontal.current = false;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (committedRef.current || isHorizontal.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden touch-pan-y select-none", className)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        cancelLongPress();
        reset();
      }}
      onPointerLeave={() => cancelLongPress()}
    >
      {leadingAction && (
        <SwipeActionPanel
          side="leading"
          action={leadingAction}
          width={ACTION_WIDTH}
        />
      )}
      {trailingAction && (
        <SwipeActionPanel
          side="trailing"
          action={trailingAction}
          width={ACTION_WIDTH}
        />
      )}
      <div
        ref={contentRef}
        onClickCapture={handleClickCapture}
        style={{
          transition: isAnimating
            ? "transform var(--motion-base) var(--motion-ease-emphasized)"
            : "none",
          willChange: "transform",
          touchAction: "pan-y",
        }}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  );
}

function SwipeActionPanel({
  side,
  action,
  width,
}: {
  side: "leading" | "trailing";
  action: SwipeAction;
  width: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-y-0 flex items-center justify-center"
      style={{
        [side === "leading" ? "left" : "right"]: 0,
        width: `${width}px`,
        background: action.color ?? "var(--leadac-500)",
        color: action.textColor ?? "white",
      }}
    >
      <div className="flex flex-col items-center gap-1 px-2">
        {action.icon && (
          <action.icon className="w-5 h-5" strokeWidth={2.25} />
        )}
        <span className="text-[12px] font-semibold tracking-tight">
          {action.label}
        </span>
      </div>
    </div>
  );
}
