/**
 * DepthParallax — multi-layer z-space with scroll-style travel and auto
 * rack-focus.
 *
 * Renders a stack of children each assigned to a virtual z-plane. Over the
 * scene (or an explicit `[startFrame, endFrame]` window), each layer
 * translates on Y by an amount inversely proportional to its depth — so the
 * foreground sweeps past while the background barely drifts. Classic
 * parallax, but with CSS 3D perspective so the layers also sit at different
 * visual distances.
 *
 * Deep layers automatically blur (depth-of-field) via PARALLAX.blurPerDepth.
 * If you want to override the default travel for a layer, pass `travelOverride`.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE } from "../theme/easing";
import { PARALLAX } from "../theme/tokens";

export interface ParallaxLayer {
  id: string;
  /** Z position in CSS px (negative = deeper). Use values from DEPTH token. */
  z: number;
  children: React.ReactNode;
  /** Override auto-travel (CSS px on Y axis over the scene). */
  travelOverride?: number;
  /** Disable the automatic blur for this layer. */
  noBlur?: boolean;
  /** Extra X-axis drift (CSS px over the scene). Useful for non-vertical cameras. */
  driftX?: number;
}

export interface DepthParallaxProps {
  layers: ParallaxLayer[];
  /** Window in frames during which parallax is active. Defaults to the full scene. */
  window?: [number, number];
  /** Override the global perspective for this stack. */
  perspective?: number;
  /** If true, invert travel direction (camera moves down instead of up). */
  invert?: boolean;
}

/** Map a z (CSS px, typically negative) to a sensible auto-travel. */
function autoTravelForZ(z: number): number {
  const absZ = Math.abs(z);
  if (absZ >= 400) return PARALLAX.travel.bg;
  if (absZ >= 240) return PARALLAX.travel.far;
  if (absZ >= 120) return PARALLAX.travel.mid;
  if (absZ >= 40) return PARALLAX.travel.near;
  return PARALLAX.travel.fg;
}

export const DepthParallax: React.FC<DepthParallaxProps> = ({
  layers,
  window: windowRange,
  perspective,
  invert = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const [startFrame, endFrame] = windowRange ?? [0, durationInFrames];

  return (
    <AbsoluteFill
      style={{
        perspective: perspective ?? PARALLAX.perspective,
        perspectiveOrigin: "50% 50%",
      }}
    >
      <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
        {layers.map((layer) => {
          const travel = layer.travelOverride ?? autoTravelForZ(layer.z);
          const direction = invert ? 1 : -1;
          const ty = interpolate(frame, [startFrame, endFrame], [0, travel * direction], {
            easing: EASE.appleInOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const tx = interpolate(frame, [startFrame, endFrame], [0, layer.driftX ?? 0], {
            easing: EASE.appleInOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const autoBlur = layer.noBlur ? 0 : Math.abs(layer.z) * PARALLAX.blurPerDepth;

          return (
            <div
              key={layer.id}
              style={{
                position: "absolute",
                inset: 0,
                transform: `translate3d(${tx}px, ${ty}px, ${layer.z}px)`,
                filter: autoBlur > 0 ? `blur(${autoBlur.toFixed(2)}px)` : undefined,
                willChange: "transform, filter",
              }}
            >
              {layer.children}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
