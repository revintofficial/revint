/**
 * KineticCaption — word-by-word kinetic typography overlay for beat-synced
 * captions.
 *
 * Each word is animated separately: staggered opacity + small translateY
 * (upwards) + slight mask-reveal so the phrase lands like a spoken line
 * rather than a fading block. An optional eyebrow line drops in from the
 * top a beat earlier, and an optional sub line slides up from below a beat
 * later — the "three-layer title" pattern used in Apple keynote cut-downs.
 *
 * Timing is anchored to `appearAtFrame`. The component emits null when the
 * frame is outside [appearAtFrame, appearAtFrame + durationFrames] so it is
 * cheap to compose many of these in sequence.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

export interface KineticCaptionProps {
  text: string;
  eyebrow?: string;
  sub?: string;
  appearAtFrame: number;
  durationFrames: number;
  position?: "top" | "center" | "bottom";
  /** Main text size. Default "subhead". */
  size?: "body" | "subhead" | "display" | "hero";
  /** Seconds between consecutive word reveals. Default 0.05s. */
  wordStaggerSec?: number;
  accent?: boolean;
}

const SIZE_PX = {
  body: TYPE.size.body,
  subhead: TYPE.size.subhead,
  display: TYPE.size.display,
  hero: TYPE.size.hero,
} as const;

export const KineticCaption: React.FC<KineticCaptionProps> = ({
  text,
  eyebrow,
  sub,
  appearAtFrame,
  durationFrames,
  position = "bottom",
  size = "subhead",
  wordStaggerSec = 0.05,
  accent = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearAtFrame;

  if (local < -6 || local > durationFrames + 6) return null;

  const words = text.split(" ");
  const stagger = Math.round(wordStaggerSec * fps);
  const revealDur = Math.round(0.45 * fps);
  const fadeOutStart = durationFrames - Math.round(0.35 * fps);
  const fadeOutDur = Math.round(0.35 * fps);

  const outOpacity = interpolate(
    local,
    [fadeOutStart, fadeOutStart + fadeOutDur],
    [1, 0],
    { easing: EASE.appleIn, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const eyebrowOp = interpolate(local, [-6, 12], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eyebrowTy = interpolate(local, [-6, 12], [-10, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subDelay = Math.round(stagger * words.length + 0.15 * fps);
  const subOp = interpolate(local, [subDelay, subDelay + 14], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subTy = interpolate(local, [subDelay, subDelay + 14], [8, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const justifyContent =
    position === "top" ? "flex-start" : position === "center" ? "center" : "flex-end";
  const padding =
    position === "top"
      ? "110px 0 0 0"
      : position === "bottom"
        ? "0 0 90px 0"
        : "0";

  const fontSize = SIZE_PX[size];

  // Scrim strength follows the caption's own opacity so it never sits dark
  // on an already-transitioned frame. Bottom + top get a directional gradient;
  // center gets a soft radial halo.
  const scrimAlpha = 0.58 * outOpacity;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent,
        padding,
        pointerEvents: "none",
        fontFamily: TYPE.family,
        opacity: outOpacity,
      }}
    >
      {/* Scrim — keeps the text legible over busy app backgrounds. */}
      {position === "bottom" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 420,
            background: `linear-gradient(to top, rgba(5,5,9,${scrimAlpha}) 0%, rgba(5,5,9,${scrimAlpha * 0.75}) 35%, rgba(5,5,9,0) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
      {position === "top" && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 380,
            background: `linear-gradient(to bottom, rgba(5,5,9,${scrimAlpha}) 0%, rgba(5,5,9,${scrimAlpha * 0.7}) 40%, rgba(5,5,9,0) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          maxWidth: "72%",
          textAlign: "center",
          textShadow:
            "0 2px 10px rgba(0,0,0,0.9), 0 8px 40px rgba(0,0,0,0.75)",
          position: "relative",
        }}
      >
        {eyebrow && (
          <div
            style={{
              opacity: eyebrowOp,
              transform: `translateY(${eyebrowTy}px)`,
              fontSize: 18,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              color: COLORS.accent,
              fontWeight: TYPE.weight.semibold,
            }}
          >
            {eyebrow}
          </div>
        )}

        <div
          style={{
            fontSize,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: size === "hero" ? TYPE.tracking.display : TYPE.tracking.subhead,
            lineHeight: 1.05,
            color: accent ? COLORS.accent : COLORS.text,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.28em",
          }}
        >
          {words.map((w, i) => {
            const wordStart = i * stagger;
            const op = interpolate(local, [wordStart, wordStart + revealDur], [0, 1], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const ty = interpolate(local, [wordStart, wordStart + revealDur], [14, 0], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const blur = interpolate(local, [wordStart, wordStart + revealDur], [6, 0], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={`${w}-${i}`}
                style={{
                  display: "inline-block",
                  opacity: op,
                  transform: `translateY(${ty}px)`,
                  filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                  willChange: "transform, opacity",
                }}
              >
                {w}
              </span>
            );
          })}
        </div>

        {sub && (
          <div
            style={{
              opacity: subOp,
              transform: `translateY(${subTy}px)`,
              fontSize: 26,
              color: COLORS.textMuted,
              fontWeight: TYPE.weight.medium,
              letterSpacing: TYPE.tracking.body,
              maxWidth: "80%",
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
