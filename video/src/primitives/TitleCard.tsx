/**
 * TitleCard — typography overlay that fades in, holds, fades out.
 *
 * Defaults to bottom-center placement with the Apple-style display tracking.
 * Pass `position` to anchor it differently for a specific scene.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

export interface TitleCardProps {
  text: string;
  appearAtFrame?: number;
  durationFrames?: number;
  position?: "top" | "center" | "bottom";
  size?: "eyebrow" | "body" | "subhead" | "display";
  accent?: boolean;
}

export const TitleCard: React.FC<TitleCardProps> = ({
  text,
  appearAtFrame = 0,
  durationFrames = 90,
  position = "bottom",
  size = "subhead",
  accent = false,
}) => {
  const frame = useCurrentFrame();
  const local = frame - appearAtFrame;

  if (local < 0 || local > durationFrames) return null;

  const fadeInEnd = 18;
  const fadeOutStart = durationFrames - 18;

  const opacity = interpolate(
    local,
    [0, fadeInEnd, fadeOutStart, durationFrames],
    [0, 1, 1, 0],
    { easing: EASE.appleOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const translateY = interpolate(local, [0, fadeInEnd], [12, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const justifyContent =
    position === "top" ? "flex-start" : position === "center" ? "center" : "flex-end";
  const padding =
    position === "top"
      ? "120px 0 0 0"
      : position === "bottom"
        ? "0 0 120px 0"
        : "0";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent,
        padding,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          fontFamily: TYPE.family,
          fontSize: TYPE.size[size],
          fontWeight: TYPE.weight.semibold,
          letterSpacing: TYPE.tracking.subhead,
          lineHeight: 1.05,
          color: accent ? COLORS.accent : COLORS.text,
          textAlign: "center",
          maxWidth: "60%",
          textShadow: "0 4px 24px rgba(0,0,0,0.55)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
