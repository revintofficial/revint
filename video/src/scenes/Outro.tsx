import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { LogoMark } from "../components/LogoMark";

export const Outro: React.FC<{ title: string; cta: string; url: string }> = ({
  title,
  cta,
  url,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const lift = interpolate(enter, [0, 1], [16, 0]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 70%, ${COLORS.bgSoft} 0%, ${COLORS.bg} 70%)`,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 24,
        opacity,
        transform: `translateY(${lift}px)`,
      }}
    >
      <LogoMark size={120} />
      <h2
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 80,
          fontWeight: 700,
          color: COLORS.fg,
          letterSpacing: "-0.03em",
          textAlign: "center",
          maxWidth: 1400,
        }}
      >
        {title}
      </h2>
      <div
        style={{
          marginTop: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          padding: "20px 36px",
          borderRadius: 999,
          background: COLORS.accent,
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 32,
          fontWeight: 600,
        }}
      >
        {cta}
      </div>
      <p
        style={{
          marginTop: 8,
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: 28,
          color: COLORS.muted,
        }}
      >
        {url}
      </p>
    </AbsoluteFill>
  );
};
