/**
 * SquareCut — 1:1 reframe for LinkedIn + X feed. (45s) — STUB
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";

export const SquareCut: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: TYPE.family,
        color: COLORS.textMuted,
        fontSize: 28,
      }}
    >
      1:1 cut — wire scenes here with center-cropped framing
    </AbsoluteFill>
  );
};
