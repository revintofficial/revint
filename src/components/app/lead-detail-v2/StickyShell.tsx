"use client";

/**
 * StickyShell — sticky 56px header + main scroll area + bottom slot
 * for the queue strip (empty in Phase 0, wired in Phase 3).
 *
 * Reserves bottom space using `100dvh - safe-area-inset-bottom` so the
 * iOS Safari URL-bar dismissal can't make the queue strip overlap the
 * dial CTA (build plan §6 risk #9).
 */

import { type ReactNode } from "react";

export interface StickyShellProps {
  header: ReactNode;
  children: ReactNode;
  /** Phase 3 wires the queue-of-3 strip here. Phase 0 leaves it empty. */
  queueStrip?: ReactNode;
}

const HEADER_PX = 56;
const QUEUE_STRIP_RESERVE_PX = 56;

export function StickyShell({ header, children, queueStrip }: StickyShellProps) {
  return (
    <div
      className="relative flex flex-col"
      style={{
        minHeight: "calc(100dvh - env(safe-area-inset-bottom, 0px))",
        backgroundColor: "var(--leadac-bg)",
      }}
    >
      <div
        className="sticky top-0 z-30 flex items-center border-b border-white/8 backdrop-blur-md"
        style={{
          height: HEADER_PX,
          background: "hsl(var(--leadac-h) var(--leadac-ns) 9% / 0.85)",
        }}
        role="banner"
      >
        {header}
      </div>

      <main
        id="lead-detail-v2-main"
        className="relative flex-1 overflow-x-hidden"
        style={{
          paddingBottom: queueStrip
            ? QUEUE_STRIP_RESERVE_PX + 16
            : `calc(env(safe-area-inset-bottom, 0px) + 16px)`,
        }}
      >
        {children}
      </main>

      {queueStrip ? (
        <div
          className="sticky bottom-0 z-30 border-t border-white/8 backdrop-blur-md"
          style={{
            height: QUEUE_STRIP_RESERVE_PX,
            background: "hsl(var(--leadac-h) var(--leadac-ns) 9% / 0.92)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {queueStrip}
        </div>
      ) : null}
    </div>
  );
}
