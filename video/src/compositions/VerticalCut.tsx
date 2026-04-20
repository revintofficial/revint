/**
 * VerticalCut — 9:16 reframe for Reels / TikTok / Shorts. (45s) — STUB
 *
 * Reuses MasterFilm scenes but with adjusted layout (reframed via CSS
 * scale + translate) and shorter beats. Implementation: render each scene
 * inside a portrait-friendly container, drop scene 02 (it's redundant on
 * vertical), and add larger captions because the audience is sound-off.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";

export const VerticalCut: React.FC = () => {
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
      9:16 cut — wire scenes here using portrait-tuned camera motion
    </AbsoluteFill>
  );
};
