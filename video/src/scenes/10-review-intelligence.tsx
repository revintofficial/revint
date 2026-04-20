/**
 * SCENE 10 — "What their customers say, scored." (6s)
 *
 * Review Intelligence panel. Left lane: weakness phrases with rising
 * severity bars; right lane: strength phrases. Lead score ticks up into a
 * prominent badge. Mirrors the `ReviewIntelligencePanel` on /app/leads/[id].
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "../primitives/AppChrome";
import { MetricCounter } from "../primitives/MetricCounter";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

interface Phrase {
  text: string;
  weight: number; // 0..1 bar width
  count: number;
}

const WEAKNESSES: Phrase[] = [
  { text: "Hard to book online", weight: 0.92, count: 18 },
  { text: "Phone rings forever", weight: 0.78, count: 14 },
  { text: "Site looks dated", weight: 0.61, count: 9 },
  { text: "Prices not listed", weight: 0.48, count: 7 },
];

const STRENGTHS: Phrase[] = [
  { text: "Staff are lovely", weight: 0.95, count: 32 },
  { text: "Clean waiting area", weight: 0.72, count: 21 },
  { text: "Painless treatment", weight: 0.66, count: 19 },
  { text: "Gentle with kids", weight: 0.54, count: 12 },
];

const PhraseLane: React.FC<{
  phrases: Phrase[];
  title: string;
  accent: string;
  startFrame: number;
  fps: number;
  frame: number;
}> = ({ phrases, title, accent, startFrame, fps, frame }) => (
  <div
    style={{
      flex: 1,
      background: "rgba(22,22,26,0.82)",
      borderRadius: 20,
      border: `0.5px solid ${COLORS.borderStrong}`,
      padding: 28,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: accent,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      <div
        style={{
          fontSize: 12,
          letterSpacing: TYPE.tracking.eyebrow,
          textTransform: "uppercase",
          color: COLORS.textMuted,
          fontWeight: TYPE.weight.semibold,
        }}
      >
        {title}
      </div>
    </div>
    {phrases.map((p, i) => {
      const appear = startFrame + Math.round(fps * (i * 0.18));
      const local = frame - appear;
      const opacity = interpolate(local, [0, 14], [0, 1], {
        easing: EASE.appleOut,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const barFill = interpolate(local, [8, 28], [0, p.weight], {
        easing: EASE.appleInOut,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return (
        <div key={p.text} style={{ opacity, display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 15,
              color: COLORS.text,
            }}
          >
            <span style={{ fontWeight: TYPE.weight.semibold }}>{p.text}</span>
            <span style={{ color: COLORS.textMuted }}>{p.count}</span>
          </div>
          <div
            style={{
              height: 8,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barFill * 100}%`,
                height: "100%",
                background: accent,
                boxShadow: `0 0 14px ${accent}77`,
              }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

export const ReviewIntelligence: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scoreAppear = Math.round(fps * 3.4);

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="leads"
        title="Meridian Dental · Review Intelligence"
        subtitle="412 reviews analysed · SW7 postcode"
        headerRight={
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(94,106,210,0.15)",
              border: `0.5px solid rgba(94,106,210,0.45)`,
              fontSize: 13,
              color: COLORS.text,
              fontWeight: TYPE.weight.semibold,
            }}
          >
            Analysed 2m ago
          </div>
        }
      >
        <div style={{ display: "flex", gap: 24, height: "100%" }}>
          <PhraseLane
            phrases={WEAKNESSES}
            title="Pain points"
            accent={COLORS.danger}
            startFrame={Math.round(fps * 0.4)}
            fps={fps}
            frame={frame}
          />
          <PhraseLane
            phrases={STRENGTHS}
            title="What customers love"
            accent={COLORS.success}
            startFrame={Math.round(fps * 1.2)}
            fps={fps}
            frame={frame}
          />
        </div>

        {/* Lead score badge — top-right overlay inside content area */}
        <div
          style={{
            position: "absolute",
            right: 40,
            top: 40,
            padding: "18px 22px",
            borderRadius: 20,
            background: "rgba(20,20,22,0.9)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            opacity: interpolate(frame, [scoreAppear - 10, scoreAppear + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <MetricCounter
            from={0}
            to={74}
            startFrame={scoreAppear}
            durationFrames={Math.round(fps * 1.2)}
            size={72}
            accent={COLORS.accent}
          />
          <div
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              fontWeight: TYPE.weight.semibold,
              marginTop: 2,
            }}
          >
            lead score
          </div>
        </div>
      </AppChrome>

      <TitleCard
        text="What their customers say, scored."
        appearAtFrame={Math.round(fps * 4.0)}
        durationFrames={durationInFrames - Math.round(fps * 4.0)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
