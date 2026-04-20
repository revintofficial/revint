/**
 * SCENE 09 — "Your whole pipeline, at a glance." (5s)
 *
 * Dashboard overview. Cascades three KPI cards from below, draws a
 * sparkline that fills in left-to-right, and surfaces a "next best action"
 * pill. Mirrors `/app/dashboard`.
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

interface Kpi {
  label: string;
  value: number;
  suffix?: string;
  sublabel: string;
  accent?: string;
}

const KPIS: Kpi[] = [
  { label: "Leads", value: 312, sublabel: "+47 this week", accent: COLORS.primary },
  { label: "Avg score", value: 71, suffix: "/100", sublabel: "Signal strong" },
  { label: "Drafts sent", value: 94, sublabel: "8 replies · 3 booked", accent: COLORS.success },
];

const SPARKLINE = [12, 18, 14, 22, 26, 24, 31, 29, 34, 38, 42, 47];

export const Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Sparkline path: reveal 0..1 over 1.8s.
  const sparkProgress = interpolate(frame, [fps * 0.4, fps * 2.2], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const maxV = Math.max(...SPARKLINE);
  const sparkPoints = SPARKLINE.map((v, i) => {
    const x = (i / (SPARKLINE.length - 1)) * 100;
    const y = 100 - (v / maxV) * 80;
    return { x, y };
  });
  const fullPath =
    "M " +
    sparkPoints
      .map((p, i) => (i === 0 ? `${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="dashboard"
        title="Dashboard"
        subtitle="Everything you shipped this week."
      >
        {/* KPI cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            marginBottom: 28,
          }}
        >
          {KPIS.map((k, i) => {
            const appear = Math.round(fps * (0.2 + i * 0.15));
            const local = frame - appear;
            const opacity = interpolate(local, [0, 18], [0, 1], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const ty = interpolate(local, [0, 22], [30, 0], {
              easing: EASE.appleSpring,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={k.label}
                style={{
                  opacity,
                  transform: `translateY(${ty}px)`,
                  padding: 24,
                  borderRadius: 20,
                  background: "rgba(22,22,26,0.82)",
                  border: `0.5px solid ${COLORS.borderStrong}`,
                  backdropFilter: "blur(20px)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: TYPE.tracking.eyebrow,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    fontWeight: TYPE.weight.semibold,
                    marginBottom: 10,
                  }}
                >
                  {k.label}
                </div>
                <MetricCounter
                  from={0}
                  to={k.value}
                  startFrame={appear + 10}
                  durationFrames={Math.round(fps * 1.2)}
                  size={56}
                  accent={k.accent ?? COLORS.text}
                  suffix={k.suffix}
                />
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: COLORS.textMuted,
                  }}
                >
                  {k.sublabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sparkline card */}
        <div
          style={{
            padding: 28,
            borderRadius: 20,
            background: "rgba(22,22,26,0.82)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            backdropFilter: "blur(20px)",
            marginBottom: 24,
            opacity: interpolate(frame, [fps * 0.4, fps * 0.8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: TYPE.tracking.eyebrow,
                  color: COLORS.textMuted,
                  textTransform: "uppercase",
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                Discovery velocity
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: TYPE.weight.semibold,
                  marginTop: 4,
                }}
              >
                47 leads · last 12 days
              </div>
            </div>
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(52,211,153,0.15)",
                color: COLORS.success,
                fontSize: 13,
                fontWeight: TYPE.weight.semibold,
              }}
            >
              ↑ 38%
            </div>
          </div>

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "100%", height: 130 }}
          >
            <defs>
              <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#5E6AD2" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5E6AD2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              d={fullPath}
              fill="none"
              stroke="#5E6AD2"
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - sparkProgress}
            />
            <path
              d={fullPath + ` L 100 100 L 0 100 Z`}
              fill="url(#sparkFill)"
              opacity={sparkProgress}
            />
            {sparkPoints.map((p, i) => {
              const t = i / (sparkPoints.length - 1);
              const on = sparkProgress >= t;
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={0.9}
                  fill={on ? "#A5B4FC" : "transparent"}
                />
              );
            })}
          </svg>
        </div>

        {/* Next-best-action pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 20px",
            borderRadius: 16,
            background: "rgba(94,106,210,0.14)",
            border: `0.5px solid rgba(94,106,210,0.45)`,
            opacity: interpolate(frame, [fps * 2.4, fps * 2.9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translateY(${interpolate(
              frame,
              [fps * 2.4, fps * 3.0],
              [10, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}px)`,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: COLORS.primaryGradient,
              color: "#0A0A0F",
              fontWeight: TYPE.weight.bold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            →
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: TYPE.weight.semibold }}>
              Follow up with 4 leads who opened yesterday
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
              Next best action · warm window closes in 3h
            </div>
          </div>
        </div>
      </AppChrome>

      <TitleCard
        text="Your whole pipeline, at a glance."
        appearAtFrame={Math.round(fps * 3.2)}
        durationFrames={durationInFrames - Math.round(fps * 3.2)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
