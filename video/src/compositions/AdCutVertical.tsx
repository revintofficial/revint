/**
 * AdCutVertical — 9:16 reframe of AdCut for TikTok / Reels / Shorts.
 *
 * Renders the master 1920×1080 AdCut at 56.25% scale (fits 1080 of width)
 * centered in a 1080×1920 canvas. Top and bottom bands carry brand
 * reinforcement (logo + static caption strip) so the vertical frame is
 * filled with intent, not letterbox black.
 *
 * Uses the same AD_CUT_DURATION_FRAMES so the master and vertical renders
 * stay in lockstep — re-score the music and both cuts update together.
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { AdCut, AD_CUT_DURATION_FRAMES } from "./AdCut";
import { COLORS, FPS, TYPE, AD_BEATS } from "../theme/tokens";
import { EASE } from "../theme/easing";

const BAND_LABELS: { fromBeat: number; text: string }[] = [
  { fromBeat: AD_BEATS.pain, text: "Same list. Same week. Same inbox." },
  { fromBeat: AD_BEATS.promise, text: "Postcode + niche → 47 leads" },
  { fromBeat: AD_BEATS.discovery, text: "Fresh from Google Maps" },
  { fromBeat: AD_BEATS.audit, text: "Five signals. One score." },
  { fromBeat: AD_BEATS.wedge, text: "A website plan on every reply" },
  { fromBeat: AD_BEATS.opener, text: "Ask. Draft. Ship." },
  { fromBeat: AD_BEATS.proof, text: "Above the reply-rate baseline" },
  { fromBeat: AD_BEATS.cta, text: "Your first 50 leads · leadac.ai" },
];

const BandCaption: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const active = [...BAND_LABELS]
    .reverse()
    .find((b) => t >= b.fromBeat) ?? BAND_LABELS[0];

  // Cross-fade out as we approach the next band's boundary.
  const activeIndex = BAND_LABELS.indexOf(active);
  const nextBand = BAND_LABELS[activeIndex + 1];
  const fade = nextBand
    ? interpolate(t, [nextBand.fromBeat - 0.3, nextBand.fromBeat], [1, 0], {
        easing: EASE.appleIn,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <div
      style={{
        opacity: fade,
        fontSize: 36,
        fontWeight: TYPE.weight.semibold,
        letterSpacing: TYPE.tracking.subhead,
        color: COLORS.text,
        textAlign: "center",
        maxWidth: 900,
        lineHeight: 1.2,
        textShadow: "0 6px 24px rgba(0,0,0,0.5)",
      }}
    >
      {active.text}
    </div>
  );
};

export const AdCutVertical: React.FC = () => {
  const VIDEO_W = 1920;
  const VIDEO_H = 1080;
  const CANVAS_W = 1080;
  const CANVAS_H = 1920;
  const scale = CANVAS_W / VIDEO_W; // 0.5625
  const videoRenderH = VIDEO_H * scale; // 607.5
  const topBand = (CANVAS_H - videoRenderH) / 2; // ~656

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, rgba(94,106,210,0.18), ${COLORS.bg} 70%)`,
        overflow: "hidden",
      }}
    >
      {/* Top band — logo + brand */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: topBand,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 60px 60px",
          gap: 34,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: COLORS.primaryGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: TYPE.family,
              fontWeight: TYPE.weight.bold,
              color: "#0A0A0F",
              fontSize: 28,
              boxShadow: "0 14px 40px rgba(94,106,210,0.45)",
            }}
          >
            L
          </div>
          <div
            style={{
              fontSize: 22,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              color: COLORS.text,
              fontWeight: TYPE.weight.semibold,
              fontFamily: TYPE.family,
            }}
          >
            Leadac AI
          </div>
        </div>

        <div
          style={{ fontFamily: TYPE.family, display: "flex", justifyContent: "center" }}
        >
          <BandCaption />
        </div>
      </div>

      {/* Center video */}
      <div
        style={{
          position: "absolute",
          top: topBand,
          left: 0,
          width: CANVAS_W,
          height: videoRenderH,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: VIDEO_W,
            height: VIDEO_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <Sequence from={0} durationInFrames={AD_CUT_DURATION_FRAMES}>
            {/* Hide in-video captions since the top band carries them. */}
            <AdCut hideCaptions />
          </Sequence>
        </div>
      </div>

      {/* Bottom band — URL + CTA chip */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: topBand,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "60px 60px 0",
          gap: 26,
          fontFamily: TYPE.family,
        }}
      >
        <div
          style={{
            padding: "18px 42px",
            borderRadius: 999,
            background:
              "linear-gradient(120deg, rgba(255,255,255,0.04), rgba(94,106,210,0.28))",
            border: `0.5px solid rgba(165,180,252,0.45)`,
            fontSize: 38,
            fontWeight: TYPE.weight.semibold,
            color: COLORS.text,
            letterSpacing: TYPE.tracking.body,
            boxShadow:
              "0 30px 80px rgba(94,106,210,0.35), 0 0 0 1px rgba(165,180,252,0.25)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ color: COLORS.accent }}>→</span>
          leadac.ai
        </div>
        <div
          style={{
            fontSize: 22,
            color: COLORS.textMuted,
            letterSpacing: TYPE.tracking.body,
            fontWeight: TYPE.weight.medium,
            textAlign: "center",
          }}
        >
          50 free leads · 5 free website plans · no card
        </div>
      </div>
    </AbsoluteFill>
  );
};
