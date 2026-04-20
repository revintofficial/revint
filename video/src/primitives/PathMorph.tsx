/**
 * PathMorph — SVG path → path interpolation via Flubber.
 *
 * Flubber produces an interpolator function that maps t in [0, 1] to a `d`
 * attribute that smoothly transforms one shape into another. We cache the
 * interpolator so it doesn't recompute every frame.
 *
 * Use this for "phone silhouette morphs into an audit card", "logo lockup
 * morphs to an icon", or any other shape-to-shape transition that isn't a
 * simple rect-rect (for rect-rect, use MorphBox instead).
 */
import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { interpolate as flubberInterpolate } from "flubber";
import { EASE } from "../theme/easing";

export interface PathMorphProps {
  fromPath: string;
  toPath: string;
  /** Frame at which the morph starts. */
  startFrame: number;
  /** Frames over which the morph happens. */
  durationFrames: number;
  /** SVG viewBox. Defaults to 0 0 1920 1080. */
  viewBox?: string;
  /** Fill / stroke styling applied to the morphing path. */
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** If true, the path is rendered from rest state before `startFrame`. */
  showBeforeStart?: boolean;
  /** If true, keeps the final path visible after the morph ends. */
  showAfterEnd?: boolean;
  /** Optional extra transform on the <g>. */
  transform?: string;
  /** Opacity envelope: fades in at startFrame and out at endFrame by this many frames. */
  fadeFrames?: number;
}

export const PathMorph: React.FC<PathMorphProps> = ({
  fromPath,
  toPath,
  startFrame,
  durationFrames,
  viewBox = "0 0 1920 1080",
  fill = "currentColor",
  stroke,
  strokeWidth,
  showBeforeStart = true,
  showAfterEnd = true,
  transform,
  fadeFrames = 0,
}) => {
  const frame = useCurrentFrame();

  const interpolator = useMemo(
    () => flubberInterpolate(fromPath, toPath, { maxSegmentLength: 8 }),
    [fromPath, toPath],
  );

  const t = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const d = interpolator(t);

  let opacity = 1;
  if (!showBeforeStart && frame < startFrame) opacity = 0;
  if (!showAfterEnd && frame > startFrame + durationFrames) opacity = 0;

  if (fadeFrames > 0) {
    const fadeIn = interpolate(frame, [startFrame, startFrame + fadeFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(
      frame,
      [startFrame + durationFrames - fadeFrames, startFrame + durationFrames],
      [1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    opacity = Math.min(fadeIn, showAfterEnd ? 1 : fadeOut);
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={transform}>
          <path
            d={d}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
