import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";

type CursorProps = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  clickAt?: number;
  width: number;
  height: number;
};

export const CursorOverlay: React.FC<CursorProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  clickAt,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const travelEnd = Math.min(durationInFrames - 6, Math.round(fps * 0.8));
  const t = interpolate(frame, [0, travelEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (n) => 1 - Math.pow(1 - n, 3),
  });

  const x = interpolate(t, [0, 1], [fromX * width, toX * width]);
  const y = interpolate(t, [0, 1], [fromY * height, toY * height]);

  const clickFrame = clickAt ?? travelEnd + 2;
  const ringScale = interpolate(frame, [clickFrame, clickFrame + 12], [0.4, 1.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame, [clickFrame, clickFrame + 14], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 96,
          height: 96,
          marginLeft: -48,
          marginTop: -48,
          borderRadius: "50%",
          border: `4px solid ${COLORS.accent}`,
          transform: `scale(${ringScale})`,
          opacity: ringOpacity,
          pointerEvents: "none",
        }}
      />
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-2px, -2px)",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))",
          pointerEvents: "none",
        }}
      >
        <path
          d="M3 2 L3 20 L8 15 L11 22 L14 21 L11 14 L18 14 Z"
          fill="#ffffff"
          stroke="#111"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
