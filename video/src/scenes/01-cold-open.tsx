/**
 * SCENE 01 — "Same list. Ten agencies." (3s)
 *
 * Pure Remotion. No Steel plate — we draw a fake CSV/spreadsheet that
 * fades from full colour to grey over 3 seconds, while a single line of
 * tipografi appears bottom-center.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";
import { TitleCard } from "../primitives/TitleCard";

const ROWS = Array.from({ length: 22 });
const COLS = ["Name", "Title", "Email", "Phone", "Company", "Industry"];

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  const desaturate = interpolate(frame, [10, 80], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: TYPE.family,
        padding: 80,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: COLORS.bgAlt,
          borderRadius: 18,
          border: `0.5px solid ${COLORS.border}`,
          padding: 24,
          filter: `saturate(${1 - desaturate}) brightness(${1 - desaturate * 0.4})`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS.length}, 1fr)`,
            gap: 0,
            color: COLORS.text,
            fontSize: 18,
          }}
        >
          {COLS.map((c) => (
            <div
              key={c}
              style={{
                fontWeight: TYPE.weight.semibold,
                padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted,
              }}
            >
              {c}
            </div>
          ))}
          {ROWS.map((_, r) =>
            COLS.map((_, c) => (
              <div
                key={`${r}-${c}`}
                style={{
                  padding: "16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted,
                  fontSize: 16,
                }}
              >
                {`apollo_export_${r * COLS.length + c + 1042}`.slice(0, 18)}
              </div>
            )),
          )}
        </div>
      </div>

      <TitleCard
        text="Same list. Ten agencies."
        appearAtFrame={30}
        durationFrames={130}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
