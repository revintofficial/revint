import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";

export const Caption: React.FC<{
  text: string;
  subText?: string;
  exitAt?: number;
}> = ({ text, subText, exitAt }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, mass: 0.5 } });
  const exitStart = exitAt ?? durationInFrames - 10;
  const exit = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = enter * (1 - exit);
  const translateY = interpolate(enter, [0, 1], [12, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        bottom: 80,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 1100,
        padding: "24px 32px",
        borderRadius: 20,
        background: "rgba(10, 10, 11, 0.72)",
        backdropFilter: "blur(18px)",
        border: `1px solid rgba(255,255,255,0.06)`,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 44,
          fontWeight: 600,
          color: COLORS.fg,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        {text}
      </div>
      {subText ? (
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 24,
            fontWeight: 400,
            color: COLORS.muted,
          }}
        >
          {subText}
        </div>
      ) : null}
    </div>
  );
};
