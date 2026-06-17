"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";

/**
 * Pull-to-refresh wrapper for any vertically-scrolling list.
 *
 * Wraps the children in a positioned container; when the user pulls down past
 * threshold while the inner scroll is at the top, fires `onRefresh`. The
 * indicator follows the finger linearly until threshold, then snaps to a
 * spinner while the refresh promise resolves.
 *
 * Disabled on devices that aren't touch-capable (`pointer: fine` desktops use
 * a normal refresh button instead).
 */
export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  className?: string;
  /** Threshold in px to trigger refresh. Default 70. */
  threshold?: number;
  /** Disable the gesture without unmounting the wrapper. */
  disabled?: boolean;
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 70,
  disabled,
}: PullToRefreshProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const startY = React.useRef(0);
  const dragY = React.useRef(0);
  const [pulling, setPulling] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [pullY, setPullY] = React.useState(0);

  const isAtTop = () => {
    const el = containerRef.current;
    if (!el) return false;
    return el.scrollTop <= 0;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || refreshing) return;
    if (!isAtTop()) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!pulling || refreshing || disabled) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      dragY.current = 0;
      setPullY(0);
      return;
    }
    // Resistance curve — gets harder as you pull further
    const resisted = Math.min(dy * 0.55, threshold * 1.6);
    dragY.current = resisted;
    setPullY(resisted);
  };

  const handleTouchEnd = async () => {
    if (!pulling || refreshing || disabled) {
      setPulling(false);
      return;
    }
    setPulling(false);
    if (dragY.current >= threshold) {
      triggerHaptic("medium");
      setRefreshing(true);
      setPullY(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
    dragY.current = 0;
  };

  const progress = Math.min(pullY / threshold, 1);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        setPulling(false);
        setPullY(0);
        dragY.current = 0;
      }}
    >
      {/* Indicator */}
      <div
        aria-hidden={!refreshing}
        role="status"
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{
          top: 0,
          height: `${threshold}px`,
          transform: `translateY(${pullY - threshold}px)`,
          transition: pulling ? "none" : "transform var(--motion-base) var(--motion-ease-emphasized)",
          opacity: pulling || refreshing ? 1 : 0,
        }}
      >
        <div
          className="rounded-full p-2"
          style={{
            background: "hsl(var(--revint-h) var(--revint-ns) 14% / 0.9)",
            border: "0.5px solid hsl(0 0% 100% / 0.1)",
            transform: refreshing
              ? "rotate(0deg)"
              : `rotate(${progress * 270}deg)`,
            transition: refreshing ? "none" : "transform 80ms linear",
          }}
        >
          <RefreshCw
            className={cn("w-4 h-4", refreshing && "animate-spin")}
            style={{
              color:
                progress >= 1 || refreshing
                  ? "var(--revint-300)"
                  : "var(--revint-text-2)",
            }}
            strokeWidth={2.25}
          />
        </div>
      </div>

      <div
        style={{
          transform: pulling || refreshing ? `translateY(${pullY}px)` : "none",
          transition: pulling
            ? "none"
            : "transform var(--motion-base) var(--motion-ease-emphasized)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
