/**
 * PinnedStage — Apple's "product sits center, the cinematography happens
 * around it" stage framing.
 *
 * Provides the camera treatment (dolly, rack-focus, vignette, ambient
 * gradient) that PlateCamera gives to plate-backed scenes, but for scenes
 * with no captured plate — pure Remotion 2D/3D content.
 *
 * The child `subject` renders pinned to the center and is subject to the
 * dolly + optional rack-focus blur. The `overlay` slot renders on top,
 * unaffected by the dolly (titles, UI pills, score badges).
 * The `background` slot renders behind everything at a deep z plane with
 * automatic blur — use for gradient backdrops or blurred plates.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE } from "../theme/easing";
import { COLORS, PARALLAX } from "../theme/tokens";

interface Ramp {
  from: number;
  to: number;
}

export interface PinnedStageMotion {
  /** CSS scale, both applied to the subject. Default: 1.0 -> 1.04. */
  dolly?: Ramp;
  /** Rack focus. Pixels of blur on the subject. Default: none. */
  rackFocus?: Ramp;
  /** Vignette alpha 0..1. Default: 0.15 -> 0.3 (subtle). */
  vignette?: Ramp;
  /** Ambient background tint strength 0..1. Default: 0.35 flat. */
  ambient?: Ramp;
}

export interface PinnedStageProps {
  subject: React.ReactNode;
  overlay?: React.ReactNode;
  background?: React.ReactNode;
  motion?: PinnedStageMotion;
  /** Override the background color. */
  background_color?: string;
}

export const PinnedStage: React.FC<PinnedStageProps> = ({
  subject,
  overlay,
  background,
  motion = {},
  background_color = COLORS.bg,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const interp = (r: Ramp | undefined, fallback: number) =>
    r
      ? interpolate(frame, [0, durationInFrames], [r.from, r.to], {
          easing: EASE.appleInOut,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : fallback;

  const scale = interp(motion.dolly, 1.02);
  const blur = interp(motion.rackFocus, 0);
  const vignette = interp(motion.vignette, 0.2);
  const ambient = interp(motion.ambient, 0.35);

  return (
    <AbsoluteFill style={{ background: background_color, overflow: "hidden" }}>
      {/* Ambient gradient — soft brand glow behind the subject. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 48%, rgba(94,106,210,${0.28 * ambient}) 0%, rgba(94,106,210,0) 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* Background slot — deep plane with automatic parallax blur. */}
      {background && (
        <AbsoluteFill
          style={{
            perspective: PARALLAX.perspective,
            pointerEvents: "none",
          }}
        >
          <AbsoluteFill
            style={{
              transform: "translateZ(-320px)",
              filter: "blur(6px)",
              opacity: 0.85,
            }}
          >
            {background}
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* Subject — dolly + rack focus applied here. */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          filter: blur > 0 ? `blur(${blur.toFixed(2)}px)` : undefined,
          willChange: "transform, filter",
        }}
      >
        {subject}
      </AbsoluteFill>

      {/* Vignette. */}
      {vignette > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${vignette}) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Overlay — titles, pills, score badges. Not affected by dolly/focus. */}
      {overlay && <AbsoluteFill style={{ pointerEvents: "none" }}>{overlay}</AbsoluteFill>}
    </AbsoluteFill>
  );
};
