"use client";

import type { ReactNode } from "react";

interface SdrPodFrameProps {
  /** Left monitor content (typically the prospecting/discovery surface). */
  leftScreen: ReactNode;
  /** Right monitor content (typically the comms/sending surface). */
  rightScreen: ReactNode;
  /** Optional URL pill for the left monitor. */
  leftUrl?: string;
  /** Optional URL pill for the right monitor. */
  rightUrl?: string;
  /** Tab labels for each monitor. */
  leftTab?: string;
  rightTab?: string;
  className?: string;
}

/**
 * Two side-by-side displays angled toward the operator - the canonical
 * SDR pod look. Each display is browser-chromed with traffic lights and
 * a URL pill so the agencies page reads as "this is what your SDR sees
 * the moment they sit down".
 *
 * Two displays share a single base bar at the bottom for the desk-mount
 * vibe. On `< sm` viewports the displays stack vertically and the desk
 * mount disappears.
 */
export function SdrPodFrame({
  leftScreen,
  rightScreen,
  leftUrl = "leadac.ai/discovery",
  rightUrl = "leadac.ai/pipeline",
  leftTab = "Discovery",
  rightTab = "Pipeline",
  className = "",
}: SdrPodFrameProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Ambient glow */}
      <div
        aria-hidden
        className="hidden sm:block absolute -inset-12 -z-10 rounded-[60px] opacity-65 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(94,106,210,0.32), transparent 72%)",
        }}
      />

      {/* Two monitors */}
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-3 items-stretch">
        <Monitor
          tilt="right"
          url={leftUrl}
          tab={leftTab}
          accent="#A5B4FC"
        >
          {leftScreen}
        </Monitor>
        <Monitor tilt="left" url={rightUrl} tab={rightTab} accent="#86EFAC">
          {rightScreen}
        </Monitor>
      </div>

      {/* Shared desk mount + base */}
      <div
        aria-hidden
        className="hidden sm:flex flex-col items-center -mt-1"
      >
        <div
          className="h-3 w-24 rounded-b"
          style={{
            background:
              "linear-gradient(180deg, #1A1A1D 0%, #0E0E12 100%)",
          }}
        />
        <div
          className="h-1.5 rounded-full"
          style={{
            width: 320,
            background:
              "linear-gradient(180deg, #1A1A1D 0%, #0E0E12 100%)",
            boxShadow:
              "0 6px 16px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
          }}
        />
      </div>
    </div>
  );
}

function Monitor({
  children,
  tilt,
  url,
  tab,
  accent,
}: {
  children: ReactNode;
  tilt: "left" | "right";
  url: string;
  tab: string;
  accent: string;
}) {
  const tiltStyle =
    tilt === "left"
      ? "sm:[transform:perspective(2400px)_rotateY(8deg)]"
      : "sm:[transform:perspective(2400px)_rotateY(-8deg)]";

  return (
    <div className={`relative ${tiltStyle}`}>
      {/* Bezel */}
      <div
        aria-hidden
        className="relative rounded-[10px] sm:rounded-[14px] sm:p-[8px] sm:aspect-16/10"
        style={{
          background:
            "linear-gradient(180deg, #2A2A2E 0%, #1A1A1D 50%, #0F0F12 100%)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.05), 0 24px 60px rgba(0,0,0,0.55)",
        }}
      >
        {/* Inner screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[6px] sm:rounded-[8px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(14,14,18,1) 100%)",
            boxShadow:
              "0 0 0 0.5px rgba(255,255,255,0.06) inset, 0 1px 0 rgba(0,0,0,0.5) inset",
          }}
        >
          {/* Browser chrome */}
          <div
            aria-hidden
            className="hidden sm:flex absolute top-0 inset-x-0 h-8 px-3 items-center gap-2.5 z-10 select-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(38,38,42,0.95), rgba(28,28,32,0.95))",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#FF5F57" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#FEBC2E" }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: "#28C840" }}
              />
            </div>
            <div
              className="flex-1 mx-1 h-4 rounded px-2 flex items-center text-[9.5px] font-medium tabular-nums truncate"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "0.5px solid rgba(255,255,255,0.06)",
                color: "rgba(235,235,245,0.65)",
              }}
            >
              {url}
            </div>
            <div
              className="hidden md:block text-[9.5px] font-medium px-1.5 py-0.5 rounded shrink-0"
              style={{
                background: `${hexToRgba(accent, 0.14)}`,
                color: accent,
                border: `0.5px solid ${hexToRgba(accent, 0.32)}`,
              }}
            >
              {tab}
            </div>
          </div>

          <div className="relative h-full w-full sm:pt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
