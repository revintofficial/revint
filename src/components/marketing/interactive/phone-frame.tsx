"use client";

import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  appLabel?: string;
  clock?: string;
  className?: string;
}

/**
 * Literal iPhone bezel for the "follow-up from the sofa" card. Same chrome
 * recipe as TabletFrame, narrower aspect, smaller bezel. Decorative chrome
 * is `aria-hidden`; demo content keeps pointer events.
 */
export function PhoneFrame({
  children,
  appLabel,
  clock = "9:41",
  className = "",
}: PhoneFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow */}
      <div
        aria-hidden
        className="hidden sm:block absolute -inset-6 -z-10 rounded-[40px] opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.28), transparent 70%)",
        }}
      />

      {/* Bezel */}
      <div
        aria-hidden
        className="relative rounded-[12px] sm:rounded-[36px] sm:p-[10px] sm:aspect-9/19"
        style={{
          background:
            "linear-gradient(160deg, #2A2A2E 0%, #18181B 35%, #0F0F12 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.55), 0 60px 160px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.22)",
        }}
      >
        {/* Dynamic island */}
        <div
          aria-hidden
          className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-[6px] rounded-full"
          style={{
            width: 78,
            height: 18,
            background: "#0A0A0C",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
          }}
        />

        {/* Inner screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[8px] sm:rounded-[28px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(0,0,0,0.5) inset",
          }}
        >
          {/* Status bar (sits beside the dynamic island) */}
          {appLabel && (
            <div
              aria-hidden
              className="hidden sm:flex absolute top-[8px] inset-x-0 h-5 px-7 items-center justify-between text-[10px] font-medium z-10 select-none"
              style={{ color: "hsl(var(--leadac-h) var(--leadac-nts) 92% / 0.85)" }}
            >
              <span className="tabular-nums">{clock}</span>
              <span className="opacity-0">.</span>
              <span className="flex items-center gap-1">
                <span className="flex items-end gap-[1.5px]">
                  {[3, 5, 7, 9].map((h) => (
                    <span
                      key={h}
                      className="w-[2px] rounded-sm bg-current"
                      style={{ height: `${h}px`, opacity: 0.85 }}
                    />
                  ))}
                </span>
                <span
                  className="relative inline-block"
                  style={{
                    width: 16,
                    height: 7,
                    border: "0.6px solid currentColor",
                    borderRadius: 2,
                    opacity: 0.85,
                  }}
                >
                  <span
                    className="absolute"
                    style={{
                      left: 1,
                      top: 1,
                      bottom: 1,
                      width: 11,
                      background: "currentColor",
                      borderRadius: 1,
                    }}
                  />
                </span>
              </span>
            </div>
          )}

          <div className={`relative h-full w-full ${appLabel ? "sm:pt-9" : ""}`}>
            {children}
          </div>
        </div>

        {/* Home indicator */}
        <div
          aria-hidden
          className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-[4px] h-[3px] rounded-full"
          style={{ width: 110, background: "rgba(255,255,255,0.22)" }}
        />
      </div>
    </div>
  );
}
