/**
 * AD-04 — "Your first 50 leads are five minutes away." CTA (6.5s).
 *
 * Rebuilt from 08-cta.tsx with AdCut-specific copy and a two-stage reveal:
 *   0.0-0.6s   Logo mark drops in from top
 *   0.6-2.0s   Hero headline types in word-by-word (already handled by the
 *              KineticCaption overlay at AdCut level; here we provide the
 *              stage)
 *   1.6-3.0s   Subline "Free. No card. 5 free plans." fades up
 *   3.0-4.0s   URL chip appears with subtle pulse glow
 *   4.0-5.0s   Tagline stamp "Lead + website value engine."
 *   5.0-6.5s   Hold + radial ambient breathing
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

export const AdCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;

  // Logo
  const logoOp = interpolate(frame, [0, 18], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoTy = interpolate(frame, [0, 22], [-18, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Hero
  const heroStart = Math.round(fps * 0.6);
  const heroOp = interpolate(frame, [heroStart, heroStart + 24], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const heroTy = interpolate(frame, [heroStart, heroStart + 28], [16, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subline
  const subStart = Math.round(fps * 1.6);
  const subOp = interpolate(frame, [subStart, subStart + 18], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subTy = interpolate(frame, [subStart, subStart + 22], [10, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // URL chip
  const urlStart = Math.round(fps * 3.0);
  const urlOp = interpolate(frame, [urlStart, urlStart + 18], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlScale = interpolate(
    frame,
    [urlStart, urlStart + 16, urlStart + 30],
    [0.9, 1.06, 1],
    { easing: EASE.appleSpring, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const urlPulse = 1 + Math.sin(Math.max(0, t - 3.0) * Math.PI * 1.4) * 0.015;

  // Tagline
  const tagStart = Math.round(fps * 4.0);
  const tagOp = interpolate(frame, [tagStart, tagStart + 20], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagTy = interpolate(frame, [tagStart, tagStart + 22], [8, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Radial ambient breath
  const ambient = 0.32 + Math.sin(t * Math.PI * 0.6) * 0.06;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, rgba(94,106,210,${ambient}), ${COLORS.bg} 65%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: TYPE.family,
        padding: "80px 80px",
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          opacity: logoOp,
          transform: `translateY(${logoTy}px)`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: COLORS.primaryGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: TYPE.weight.bold,
            color: "#0A0A0F",
            fontSize: 24,
            boxShadow: "0 14px 40px rgba(94,106,210,0.45)",
          }}
        >
          L
        </div>
        <div
          style={{
            fontSize: 22,
            color: COLORS.text,
            letterSpacing: TYPE.tracking.eyebrow,
            textTransform: "uppercase",
            fontWeight: TYPE.weight.semibold,
          }}
        >
          Leadac AI
        </div>
      </div>

      {/* Hero headline */}
      <div
        style={{
          opacity: heroOp,
          transform: `translateY(${heroTy}px)`,
          textAlign: "center",
          fontSize: 108,
          fontWeight: TYPE.weight.semibold,
          letterSpacing: TYPE.tracking.display,
          color: COLORS.text,
          lineHeight: 1.02,
          maxWidth: 1400,
        }}
      >
        Your first 50 leads
        <br />
        <span style={{ color: COLORS.textMuted }}>
          are five minutes away.
        </span>
      </div>

      {/* Subline */}
      <div
        style={{
          opacity: subOp,
          transform: `translateY(${subTy}px)`,
          marginTop: 36,
          fontSize: 28,
          color: COLORS.textMuted,
          letterSpacing: TYPE.tracking.body,
          fontWeight: TYPE.weight.medium,
          display: "flex",
          gap: 18,
          alignItems: "center",
        }}
      >
        <span>Free.</span>
        <span style={{ color: COLORS.textDim }}>·</span>
        <span>No card.</span>
        <span style={{ color: COLORS.textDim }}>·</span>
        <span>5 free website plans.</span>
      </div>

      {/* URL chip */}
      <div
        style={{
          opacity: urlOp,
          transform: `scale(${urlScale * urlPulse})`,
          marginTop: 40,
          padding: "18px 32px",
          borderRadius: 999,
          background: "linear-gradient(120deg, rgba(255,255,255,0.06), rgba(94,106,210,0.22))",
          border: `0.5px solid rgba(165,180,252,0.45)`,
          fontSize: 26,
          fontWeight: TYPE.weight.semibold,
          color: COLORS.text,
          letterSpacing: TYPE.tracking.body,
          boxShadow: "0 20px 60px rgba(94,106,210,0.35), 0 0 0 1px rgba(165,180,252,0.2)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: COLORS.accent }}>→</span>
        leadac.ai
      </div>

      {/* Tagline */}
      <div
        style={{
          opacity: tagOp,
          transform: `translateY(${tagTy}px)`,
          marginTop: 44,
          fontSize: 16,
          color: COLORS.textDim,
          letterSpacing: TYPE.tracking.eyebrow,
          textTransform: "uppercase",
          fontWeight: TYPE.weight.semibold,
        }}
      >
        Lead + website value engine
      </div>
    </AbsoluteFill>
  );
};
