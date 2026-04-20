/**
 * SCENE 13 — "Auto-segmented. Ready to send." (5s)
 *
 * Campaigns page. Four segmented lead packs assemble from offscreen with
 * stagger — each card shows a segment name (Dated sites, High intent,
 * Mobile-broken, Price silent), a count, and a primary CTA. Mirrors
 * `/app/campaigns`.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "../primitives/AppChrome";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

interface Segment {
  name: string;
  count: number;
  why: string;
  accent: string;
  drafts: number;
}

const SEGMENTS: Segment[] = [
  {
    name: "Dated sites · SW7",
    count: 18,
    why: "Last updated pre-2020 · score ≤ 60",
    accent: COLORS.primary,
    drafts: 18,
  },
  {
    name: "High intent",
    count: 11,
    why: "Reviews mention 'book' or 'appointment'",
    accent: COLORS.accent,
    drafts: 11,
  },
  {
    name: "Mobile broken",
    count: 14,
    why: "Lighthouse mobile ≤ 50",
    accent: COLORS.warning,
    drafts: 14,
  },
  {
    name: "Price silent",
    count: 9,
    why: "No prices on site · customers ask",
    accent: COLORS.success,
    drafts: 9,
  },
];

export const Campaigns: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="campaigns"
        title="Campaigns"
        subtitle="Automatically segmented as leads get scored."
        headerRight={
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: COLORS.primary,
              fontSize: 13,
              color: "#fff",
              fontWeight: TYPE.weight.semibold,
            }}
          >
            New campaign
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 22,
          }}
        >
          {SEGMENTS.map((s, i) => {
            const appear = Math.round(fps * (0.3 + i * 0.2));
            const local = frame - appear;
            const opacity = interpolate(local, [0, 18], [0, 1], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const tx = interpolate(local, [0, 24], [i % 2 === 0 ? -40 : 40, 0], {
              easing: EASE.appleSpring,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={s.name}
                style={{
                  opacity,
                  transform: `translateX(${tx}px)`,
                  padding: 26,
                  borderRadius: 20,
                  background: "rgba(22,22,26,0.82)",
                  border: `0.5px solid ${COLORS.borderStrong}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 4,
                    height: "100%",
                    background: s.accent,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: TYPE.weight.semibold,
                      color: COLORS.text,
                      letterSpacing: TYPE.tracking.subhead,
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: TYPE.weight.bold,
                      color: s.accent,
                      letterSpacing: TYPE.tracking.display,
                    }}
                  >
                    {s.count}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: COLORS.textMuted }}>{s.why}</div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.05)",
                      border: `0.5px solid ${COLORS.border}`,
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: TYPE.weight.semibold,
                    }}
                  >
                    {s.drafts} drafts ready
                  </div>
                  <div
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(94,106,210,0.12)",
                      border: `0.5px solid rgba(94,106,210,0.35)`,
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: TYPE.weight.semibold,
                    }}
                  >
                    Export CSV
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AppChrome>

      <TitleCard
        text="Auto-segmented. Ready to send."
        appearAtFrame={Math.round(fps * 3.2)}
        durationFrames={durationInFrames - Math.round(fps * 3.2)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
