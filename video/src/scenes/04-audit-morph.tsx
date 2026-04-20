/**
 * SCENE 04 — "Five signals. One score." (12s) — rebuilt without plate.
 *
 * Full lead-detail page drawn from scratch: left pane is the business
 * card (name, address, socials, rating, category), right pane is the
 * audit panel. The 5 signals cascade in with their severity bars filling,
 * then the "Opportunity Score" badge counts from 0 to 87. Closes on a
 * "Draft opener" CTA pulse.
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

interface Signal {
  label: string;
  detail: string;
  status: "bad" | "warning" | "good";
  severity: number; // 0..1
}

const SIGNALS: Signal[] = [
  { label: "HTTPS", detail: "HTTP only — visitors warned by Chrome", status: "bad", severity: 0.95 },
  { label: "Mobile fit", detail: "Viewport not set · tap targets overlap", status: "bad", severity: 0.9 },
  { label: "Booking flow", detail: "Phone-only intake · no online slot picker", status: "bad", severity: 0.85 },
  { label: "Page speed", detail: "5.2s on 4G · Lighthouse mobile 41", status: "warning", severity: 0.55 },
  { label: "Last updated", detail: "© 2019 · content unchanged since 2020", status: "warning", severity: 0.45 },
];

const statusColor: Record<Signal["status"], string> = {
  bad: COLORS.danger,
  warning: COLORS.warning,
  good: COLORS.success,
};

const BusinessCard: React.FC = () => (
  <div
    style={{
      padding: 26,
      borderRadius: 22,
      background: "rgba(22,22,26,0.9)",
      border: `0.5px solid ${COLORS.borderStrong}`,
      fontFamily: TYPE.family,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: 22,
    }}
  >
    {/* Hero */}
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: "linear-gradient(135deg, #5E6AD2 0%, #A5B4FC 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: TYPE.weight.bold,
          fontSize: 24,
          color: "#0A0A0F",
        }}
      >
        MD
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: TYPE.tracking.subhead,
            color: COLORS.text,
          }}
        >
          Meridian Dental
        </div>
        <div style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 2 }}>
          Dentist · SW7
        </div>
      </div>
    </div>

    {/* Rating bar */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${COLORS.border}`,
      }}
    >
      <span style={{ color: COLORS.warning, fontSize: 18 }}>★</span>
      <span style={{ fontSize: 18, fontWeight: TYPE.weight.semibold, color: COLORS.text }}>
        4.8
      </span>
      <span style={{ fontSize: 13, color: COLORS.textMuted }}>from 412 reviews</span>
    </div>

    {/* Facts */}
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {[
        { label: "Address", value: "48 Old Brompton Rd, SW7 3DY" },
        { label: "Website", value: "meridiandental.co.uk" },
        { label: "Phone", value: "020 7584 2211" },
        { label: "GMB category", value: "Cosmetic dentist" },
      ].map((row) => (
        <div key={row.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              color: COLORS.textDim,
              fontWeight: TYPE.weight.semibold,
            }}
          >
            {row.label}
          </div>
          <div style={{ fontSize: 14, color: COLORS.text }}>{row.value}</div>
        </div>
      ))}
    </div>

    {/* Social icons */}
    <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
      {["@", "ig", "fb", "li"].map((g) => (
        <div
          key={g}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.05)",
            border: `0.5px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: COLORS.textMuted,
            fontWeight: TYPE.weight.semibold,
          }}
        >
          {g}
        </div>
      ))}
    </div>
  </div>
);

export const AuditMorph: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const signalStart = Math.round(fps * 1.2);
  const scoreStart = signalStart + Math.round(fps * 3.0);
  const scoreDur = Math.round(fps * 1.6);
  const ctaStart = scoreStart + Math.round(fps * 2.0);

  const ctaPulse = interpolate(
    frame,
    [ctaStart, ctaStart + 20, ctaStart + 40],
    [1, 1.04, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const ctaOpacity = interpolate(frame, [ctaStart - 20, ctaStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="leads"
        title="Meridian Dental"
        subtitle="Audit · 5 signals scored from the live site"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.9fr 1.3fr",
            gap: 22,
            height: "100%",
          }}
        >
          <BusinessCard />

          {/* Audit panel */}
          <div
            style={{
              padding: 26,
              borderRadius: 22,
              background: "rgba(22,22,26,0.9)",
              border: `0.5px solid ${COLORS.borderStrong}`,
              fontFamily: TYPE.family,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: TYPE.tracking.eyebrow,
                    textTransform: "uppercase",
                    color: COLORS.textDim,
                    fontWeight: TYPE.weight.semibold,
                  }}
                >
                  Website audit
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: TYPE.weight.semibold,
                    letterSpacing: TYPE.tracking.subhead,
                    color: COLORS.text,
                    marginTop: 2,
                  }}
                >
                  Five signals. One score.
                </div>
              </div>
              {/* Opportunity score badge */}
              <div
                style={{
                  padding: "14px 20px",
                  borderRadius: 18,
                  background: "rgba(10,10,15,0.75)",
                  border: `0.5px solid rgba(94,106,210,0.45)`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  boxShadow: "0 0 40px rgba(94,106,210,0.3)",
                  opacity: interpolate(frame, [scoreStart - 18, scoreStart], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                }}
              >
                <MetricCounter
                  from={0}
                  to={87}
                  startFrame={scoreStart}
                  durationFrames={scoreDur}
                  size={56}
                  accent={COLORS.accent}
                />
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: TYPE.tracking.eyebrow,
                    color: COLORS.textMuted,
                    textTransform: "uppercase",
                    fontWeight: TYPE.weight.semibold,
                    marginTop: 4,
                  }}
                >
                  opportunity score
                </div>
              </div>
            </div>

            {/* Signal rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              {SIGNALS.map((sig, i) => {
                const appear = signalStart + Math.round(fps * (i * 0.28));
                const local = frame - appear;
                const opacity = interpolate(local, [0, 16], [0, 1], {
                  easing: EASE.appleOut,
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const tx = interpolate(local, [0, 20], [-20, 0], {
                  easing: EASE.appleSpring,
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const barFill = interpolate(
                  local,
                  [10, 36],
                  [0, sig.severity],
                  {
                    easing: EASE.appleInOut,
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                );
                const color = statusColor[sig.status];
                return (
                  <div
                    key={sig.label}
                    style={{
                      opacity,
                      transform: `translateX(${tx}px)`,
                      padding: "14px 16px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: `0.5px solid ${COLORS.border}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: color,
                            boxShadow: `0 0 10px ${color}`,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: TYPE.weight.semibold,
                            color: COLORS.text,
                            minWidth: 140,
                          }}
                        >
                          {sig.label}
                        </span>
                        <span style={{ fontSize: 14, color: COLORS.textMuted }}>
                          {sig.detail}
                        </span>
                      </div>
                      <div
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: `${color}1f`,
                          color,
                          fontSize: 11,
                          fontWeight: TYPE.weight.semibold,
                          letterSpacing: TYPE.tracking.eyebrow,
                          textTransform: "uppercase",
                        }}
                      >
                        {sig.status}
                      </div>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${barFill * 100}%`,
                          height: "100%",
                          background: color,
                          boxShadow: `0 0 12px ${color}77`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: 14,
                background: "rgba(94,106,210,0.14)",
                border: `0.5px solid rgba(94,106,210,0.45)`,
                opacity: ctaOpacity,
                transform: `scale(${ctaPulse})`,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: TYPE.weight.semibold, color: COLORS.text }}>
                  Draft a personalised opener
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                  Uses the 5 signals + 412 reviews · ready in 1.8s
                </div>
              </div>
              <div
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  background: COLORS.primary,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                Draft →
              </div>
            </div>
          </div>
        </div>
      </AppChrome>

      <TitleCard
        text="Five signals. One score."
        appearAtFrame={Math.round(fps * 6.8)}
        durationFrames={durationInFrames - Math.round(fps * 6.8)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
