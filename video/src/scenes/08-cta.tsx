/**
 * SCENE 08 — "Leadac AI. Your first 50 leads are five minutes away." (3s)
 *
 * Pure Remotion. Logo lockup + CTA, with a subtle radial gradient backdrop
 * picking up the same indigo glow as the marketing site CTA section.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

export const Cta: React.FC = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [10, 40], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ty = interpolate(frame, [10, 40], [12, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, rgba(94,106,210,0.3), ${COLORS.bg} 65%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: TYPE.family,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${ty}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 32,
            color: COLORS.accent,
            letterSpacing: TYPE.tracking.eyebrow,
            textTransform: "uppercase",
            fontWeight: TYPE.weight.semibold,
            marginBottom: 24,
          }}
        >
          Leadac AI
        </div>
        <div
          style={{
            fontSize: TYPE.size.display,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: TYPE.tracking.display,
            color: COLORS.text,
            lineHeight: 1.05,
            marginBottom: 32,
          }}
        >
          Your first 50 leads
          <br />
          <span style={{ color: COLORS.textMuted }}>are five minutes away.</span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: COLORS.textMuted,
            letterSpacing: TYPE.tracking.body,
          }}
        >
          hustle-zeta.vercel.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
