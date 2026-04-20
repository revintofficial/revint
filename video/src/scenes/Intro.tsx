import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { LogoMark } from "../components/LogoMark";

export const Intro: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 16, mass: 0.6 } });
  const exitStart = durationInFrames - 12;
  const exit = interpolate(frame, [exitStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = enter * (1 - exit);
  const translateY = interpolate(enter, [0, 1], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 30%, ${COLORS.bgSoft} 0%, ${COLORS.bg} 70%)`,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <LogoMark size={140} />
      <h1
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 96,
          fontWeight: 700,
          color: COLORS.fg,
          letterSpacing: "-0.04em",
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          maxWidth: 1100,
          textAlign: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 36,
          fontWeight: 400,
          color: COLORS.muted,
          letterSpacing: "-0.01em",
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};
