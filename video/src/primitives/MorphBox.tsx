/**
 * MorphBox — Framer-style "layoutId" morph between two screen-space rectangles.
 *
 * Renders `before` until the morph window starts, then animates a transform
 * that maps before's rect onto after's rect, and finally crossfades to the
 * `after` element. Use it for the audit-card → audit-panel expand or any
 * other "this UI piece becomes that UI piece" transition.
 *
 * The component is layout-agnostic: it positions `before` and `after` at
 * absolute pixel coordinates so the math is a single matrix interpolation,
 * not a CSS layout calculation per frame.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE } from "../theme/easing";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MorphBoxProps {
  fromRect: Rect;
  toRect: Rect;
  startFrame: number;
  durationFrames: number;
  before: React.ReactNode;
  after: React.ReactNode;
}

export const MorphBox: React.FC<MorphBoxProps> = ({
  fromRect,
  toRect,
  startFrame,
  durationFrames,
  before,
  after,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  const t = interpolate(local, [0, durationFrames], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Linear interp between rects.
  const r: Rect = {
    x: fromRect.x + (toRect.x - fromRect.x) * t,
    y: fromRect.y + (toRect.y - fromRect.y) * t,
    width: fromRect.width + (toRect.width - fromRect.width) * t,
    height: fromRect.height + (toRect.height - fromRect.height) * t,
  };

  // Crossfade content during second half.
  const beforeOpacity = interpolate(t, [0, 0.55], [1, 0], { extrapolateRight: "clamp" });
  const afterOpacity = interpolate(t, [0.45, 1], [0, 1], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: r.x,
          top: r.y,
          width: r.width,
          height: r.height,
          overflow: "hidden",
          borderRadius: 16,
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: beforeOpacity }}>
          {before}
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: afterOpacity }}>
          {after}
        </div>
      </div>
    </AbsoluteFill>
  );
};
