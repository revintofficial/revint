"use client";

import type { ReactNode } from "react";

interface MacBookFrameProps {
  children: ReactNode;
  /**
   * Browser address bar text (omit to hide the chrome entirely).
   * e.g. "leadac.ai/discovery"
   */
  url?: string;
  /** Tab label (defaults to "Leadac AI"). */
  tabLabel?: string;
  /** Tilt for desktop perspective. */
  tilt?: "left" | "right" | "none";
  className?: string;
}

/**
 * Literal MacBook Pro screen with macOS Safari chrome (traffic lights,
 * URL pill, tab). Pure CSS - no images. The bezel + a thin base hint
 * read as "laptop sitting on a desk" without consuming a full keyboard's
 * worth of vertical space.
 *
 * Decorative chrome is `aria-hidden`; the inner demo retains pointer
 * events. On `< sm` viewports the bezel collapses to a flat rounded card.
 */
export function MacBookFrame({
  children,
  url,
  tabLabel = "Leadac AI",
  tilt = "none",
  className = "",
}: MacBookFrameProps) {
  const tiltStyle =
    tilt === "left"
      ? "sm:[transform:perspective(1800px)_rotateY(5deg)_rotateX(2deg)]"
      : tilt === "right"
        ? "sm:[transform:perspective(1800px)_rotateY(-5deg)_rotateX(2deg)]"
        : "";

  return (
    <div className={`relative ${tiltStyle} ${className}`}>
      {/* Ambient glow */}
      <div
        aria-hidden
        className="hidden sm:block absolute -inset-10 -z-10 rounded-[48px] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.28), transparent 70%)",
        }}
      />

      {/* Lid + screen */}
      <div
        aria-hidden
        className="relative rounded-[12px] sm:rounded-[18px] sm:p-[10px] sm:pb-[12px] sm:aspect-16/10"
        style={{
          background:
            "linear-gradient(180deg, #2A2A2E 0%, #1A1A1D 50%, #0F0F12 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.55), 0 80px 200px rgba(94,35,201,0.22)",
        }}
      >
        {/* Camera notch */}
        <div
          aria-hidden
          className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-[3px] rounded-b-md"
          style={{
            width: 84,
            height: 12,
            background: "#0A0A0C",
          }}
        >
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 4,
              height: 4,
              background: "#1A1A1D",
              boxShadow: "0 0 0 0.5px rgba(255,255,255,0.05)",
            }}
          />
        </div>

        {/* Inner screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[8px] sm:rounded-[10px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(0,0,0,0.5) inset",
          }}
        >
          {/* Safari chrome */}
          {url && (
            <div
              aria-hidden
              className="hidden sm:flex absolute top-0 inset-x-0 h-9 px-3.5 items-center gap-3 z-10 select-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(38,38,42,0.95), rgba(28,28,32,0.95))",
                borderBottom: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Traffic lights */}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: "#FF5F57",
                    boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25) inset",
                  }}
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: "#FEBC2E",
                    boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25) inset",
                  }}
                />
                <span
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: "#28C840",
                    boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25) inset",
                  }}
                />
              </div>

              {/* URL pill */}
              <div
                className="flex-1 mx-2 h-5 rounded-md px-2.5 flex items-center gap-1.5 text-[10.5px] font-medium tabular-nums"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  color: "rgba(235,235,245,0.7)",
                }}
              >
                <svg
                  aria-hidden
                  width="9"
                  height="9"
                  viewBox="0 0 9 9"
                  fill="none"
                  className="opacity-70"
                >
                  <rect
                    x="1.5"
                    y="3.5"
                    width="6"
                    height="4.5"
                    rx="0.6"
                    stroke="currentColor"
                    strokeWidth="0.7"
                  />
                  <path
                    d="M2.8 3.5V2.4a1.7 1.7 0 0 1 3.4 0v1.1"
                    stroke="currentColor"
                    strokeWidth="0.7"
                  />
                </svg>
                <span className="truncate">{url}</span>
              </div>

              {/* Tab label */}
              <div
                className="hidden md:block text-[10.5px] font-medium px-2 py-0.5 rounded"
                style={{
                  background: "rgba(139,92,246,0.14)",
                  color: "#C49AFF",
                  border: "0.5px solid rgba(139,92,246,0.3)",
                }}
              >
                {tabLabel}
              </div>
            </div>
          )}

          <div className={`relative h-full w-full ${url ? "sm:pt-9" : ""}`}>
            {children}
          </div>
        </div>
      </div>

      {/* Laptop base hint (thin slab + notch) */}
      <div
        aria-hidden
        className="hidden sm:block relative mx-auto"
        style={{ width: "108%", marginLeft: "-4%" }}
      >
        <div
          className="h-1.5 rounded-b-xl"
          style={{
            background:
              "linear-gradient(180deg, #1A1A1D 0%, #0E0E12 100%)",
            boxShadow:
              "0 6px 16px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
          }}
        />
        {/* Trackpad notch */}
        <div
          className="mx-auto rounded-b-md"
          style={{
            width: 90,
            height: 4,
            background:
              "linear-gradient(180deg, #0E0E12, transparent)",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
