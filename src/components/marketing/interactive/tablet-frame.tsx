"use client";

import type { ReactNode } from "react";

interface TabletFrameProps {
  children: ReactNode;
  /** "landscape" (default) or "portrait" */
  orientation?: "landscape" | "portrait";
  /** Subtle perspective tilt on desktop. Flat on mobile. */
  tilt?: "left" | "right" | "none";
  /** Status bar app label (e.g. "Lead Engine"). Hidden if omitted. */
  appLabel?: string;
  /** Status bar clock. Defaults to "9:41" (Apple's signature time). */
  clock?: string;
  /** Optional className passthrough on the outer wrapper. */
  className?: string;
}

/**
 * Literal iPad bezel for in-context demos. Pure CSS - no images, no extra deps.
 *
 * The chrome is decorative (`aria-hidden`); the inner demo retains all
 * pointer events and is the only thing screen readers see. On `< sm`
 * viewports the bezel collapses to a flat rounded card so it doesn't
 * crowd small screens.
 */
export function TabletFrame({
  children,
  orientation = "landscape",
  tilt = "none",
  appLabel,
  clock = "9:41",
  className = "",
}: TabletFrameProps) {
  const tiltStyle =
    tilt === "left"
      ? "sm:[transform:perspective(1800px)_rotateY(6deg)_rotateX(2deg)]"
      : tilt === "right"
        ? "sm:[transform:perspective(1800px)_rotateY(-6deg)_rotateX(2deg)]"
        : "";

  return (
    <div className={`relative ${tiltStyle} ${className}`}>
      {/* Outer ambient glow - desktop only, decorative */}
      <div
        aria-hidden
        className="hidden sm:block absolute -inset-10 -z-10 rounded-[48px] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(94,106,210,0.28), transparent 70%)",
        }}
      />

      {/* Bezel - only visible on sm+ to keep mobile clean */}
      <div
        aria-hidden
        className={`relative rounded-[14px] sm:rounded-[28px] sm:p-[12px] ${
          orientation === "portrait" ? "sm:aspect-11/16" : "sm:aspect-16/11"
        }`}
        style={{
          background:
            "linear-gradient(160deg, #2A2A2E 0%, #18181B 35%, #0F0F12 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.55), 0 80px 200px rgba(49,46,129,0.25)",
        }}
      >
        {/* Camera dot (landscape: top-center; portrait: top-center vertical) */}
        <div
          aria-hidden
          className={`hidden sm:block absolute rounded-full ${
            orientation === "landscape"
              ? "left-1/2 -translate-x-1/2 top-[5px] w-1.5 h-1.5"
              : "left-1/2 -translate-x-1/2 top-[5px] w-1.5 h-1.5"
          }`}
          style={{
            background: "#0A0A0C",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
          }}
        />

        {/* Inner screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[10px] sm:rounded-[20px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(0,0,0,0.5) inset",
          }}
        >
          {/* iPadOS-style status bar */}
          {appLabel && (
            <div
              aria-hidden
              className="hidden sm:flex absolute top-0 inset-x-0 h-7 px-5 items-center justify-between text-[10.5px] font-medium z-10 select-none"
              style={{
                color: "rgba(235,235,245,0.78)",
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.35), transparent)",
              }}
            >
              <span className="tabular-nums">{clock}</span>
              <span className="tracking-tight">{appLabel}</span>
              <span className="flex items-center gap-1.5">
                {/* Signal */}
                <span className="flex items-end gap-[1.5px]" aria-hidden>
                  {[3, 5, 7, 9].map((h) => (
                    <span
                      key={h}
                      className="w-[2px] rounded-sm bg-current"
                      style={{ height: `${h}px`, opacity: 0.85 }}
                    />
                  ))}
                </span>
                {/* Wifi (chevron stack) */}
                <svg
                  aria-hidden
                  width="11"
                  height="9"
                  viewBox="0 0 11 9"
                  fill="none"
                  className="opacity-85"
                >
                  <path
                    d="M5.5 1.5C7.5 1.5 9.2 2.2 10.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5.5 4C6.7 4 7.8 4.5 8.6 5.3"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                  <circle cx="5.5" cy="7" r="0.9" fill="currentColor" />
                </svg>
                {/* Battery */}
                <span
                  className="relative inline-block"
                  style={{
                    width: 18,
                    height: 8,
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
                      width: 13,
                      background: "currentColor",
                      borderRadius: 1,
                    }}
                  />
                  <span
                    className="absolute"
                    style={{
                      right: -2.5,
                      top: 2.5,
                      width: 1.5,
                      height: 3,
                      background: "currentColor",
                      borderRadius: 1,
                    }}
                  />
                </span>
              </span>
            </div>
          )}

          {/* Demo content - retains pointer events */}
          <div
            className={`relative h-full w-full ${appLabel ? "sm:pt-7" : ""}`}
          >
            {children}
          </div>
        </div>

        {/* Home indicator pill */}
        <div
          aria-hidden
          className="hidden sm:block absolute left-1/2 -translate-x-1/2 bottom-[4px] h-[3px] rounded-full"
          style={{
            width: 90,
            background: "rgba(255,255,255,0.22)",
          }}
        />
      </div>
    </div>
  );
}
