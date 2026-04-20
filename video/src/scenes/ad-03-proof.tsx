/**
 * AD-03 — Proof slab. 3 big numbers pop in. (5s)
 *
 * Pure motion typography, no app chrome. Three metrics stack horizontally
 * on the frame center, each with spring-overshoot entry at 0.25s stagger,
 * and a faint indigo ambient glow pulsing behind them on the beat.
 *
 * Numbers:
 *   47      audited leads      (from 03-discovery)
 *   4.2 s   crawl + score      (from 02-promise)
 *   > 3-4%  reply baseline     (from MARKETING.md benchmark)
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";
import { MetricCounter } from "./../primitives/MetricCounter";

interface Slab {
  counter?: { from: number; to: number; prefix?: string; suffix?: string };
  staticValue?: string;
  eyebrow: string;
  label: string;
  accent: string;
}

const SLABS: Slab[] = [
  {
    counter: { from: 0, to: 47 },
    eyebrow: "Ranked & audited",
    label: "fresh local leads",
    accent: COLORS.accent,
  },
  {
    counter: { from: 0, to: 4.2, suffix: "s" },
    eyebrow: "Crawl + score",
    label: "per postcode run",
    accent: COLORS.success,
  },
  {
    staticValue: "> 3-4%",
    eyebrow: "Above industry",
    label: "reply baseline",
    accent: COLORS.warning,
  },
];

export const AdProof: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const ambientPulse = interpolate(
    (frame / fps) % 2,
    [0, 1, 2],
    [0.25, 0.45, 0.25],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const outDim = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [0, 0.25],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: TYPE.family,
        overflow: "hidden",
      }}
    >
      {/* Ambient gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, rgba(94,106,210,${ambientPulse * 0.35}), ${COLORS.bg} 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Faint grid */}
      <AbsoluteFill style={{ opacity: 0.12, pointerEvents: "none" }}>
        <svg width="100%" height="100%" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={68 * (i + 1)}
              x2={1920}
              y2={68 * (i + 1)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 24 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={80 * (i + 1)}
              y1={0}
              x2={80 * (i + 1)}
              y2={1080}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          ))}
        </svg>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 80,
          padding: "0 80px",
        }}
      >
        {SLABS.map((s, i) => {
          const appear = Math.round(fps * (0.25 + i * 0.5));
          const local = frame - appear;
          const op = interpolate(local, [0, 16], [0, 1], {
            easing: EASE.appleOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(local, [0, 16, 28], [0.84, 1.06, 1], {
            easing: EASE.appleSpring,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const ty = interpolate(local, [0, 20], [20, 0], {
            easing: EASE.appleOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          return (
            <div
              key={s.eyebrow}
              style={{
                opacity: op,
                transform: `translateY(${ty}px) scale(${scale})`,
                flex: 1,
                maxWidth: 420,
                textAlign: "center",
                padding: "40px 28px",
                borderRadius: 24,
                background: "rgba(22,22,26,0.55)",
                border: `0.5px solid ${s.accent}44`,
                boxShadow: `0 40px 120px rgba(0,0,0,0.45), 0 0 60px ${s.accent}22`,
                backdropFilter: "blur(20px)",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: s.accent,
                  fontWeight: TYPE.weight.semibold,
                  marginBottom: 18,
                }}
              >
                {s.eyebrow}
              </div>

              <div
                style={{
                  fontSize: 120,
                  fontWeight: TYPE.weight.semibold,
                  letterSpacing: TYPE.tracking.display,
                  color: COLORS.text,
                  lineHeight: 1,
                  marginBottom: 14,
                }}
              >
                {s.staticValue ? (
                  s.staticValue
                ) : s.counter ? (
                  <MetricCounter
                    from={s.counter.from}
                    to={s.counter.to}
                    startFrame={appear}
                    durationFrames={Math.round(fps * 0.9)}
                    prefix={s.counter.prefix}
                    suffix={s.counter.suffix}
                    size={120}
                    accent={COLORS.text}
                  />
                ) : null}
              </div>

              <div
                style={{
                  fontSize: 22,
                  color: COLORS.textMuted,
                  fontWeight: TYPE.weight.medium,
                  letterSpacing: TYPE.tracking.body,
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* End darken */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: outDim,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
