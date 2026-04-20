/**
 * SCENE 07 — "The pipeline lives with the lead." (8s) — rebuilt without plate.
 *
 * Four-column kanban assembles from offscreen via ExplodedParts (reverse =
 * "assemble"), each column at its own z-plane so depth reads. A single
 * lead card then MorphBoxes from column 1 ("New") to column 3 ("Sent"),
 * showing how the pipeline stays bound to the lead record across states.
 * Background is a pure ambient gradient — no captured plate.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PinnedStage } from "../primitives/PinnedStage";
import { ExplodedParts, ExplodedPart } from "../primitives/ExplodedParts";
import { MorphBox } from "../primitives/MorphBox";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

const COLUMNS = [
  { title: "New", count: 12, accent: COLORS.primary },
  { title: "Contacted", count: 8, accent: COLORS.accent },
  { title: "Sent", count: 5, accent: COLORS.success },
  { title: "Won", count: 2, accent: COLORS.warning },
];

const COL_W = 320;
const COL_H = 620;
const COL_GAP = 32;

function columnOffsets(): number[] {
  const total = COLUMNS.length * COL_W + (COLUMNS.length - 1) * COL_GAP;
  return COLUMNS.map((_, i) => -total / 2 + COL_W / 2 + i * (COL_W + COL_GAP));
}

const Column: React.FC<{ idx: number }> = ({ idx }) => {
  const col = COLUMNS[idx];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "rgba(20,20,24,0.82)",
        backdropFilter: "blur(20px)",
        border: `0.5px solid ${COLORS.borderStrong}`,
        borderRadius: 20,
        padding: 20,
        fontFamily: TYPE.family,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: TYPE.weight.semibold,
            color: COLORS.text,
            letterSpacing: TYPE.tracking.subhead,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: col.accent,
              boxShadow: `0 0 10px ${col.accent}`,
            }}
          />
          {col.title}
        </div>
        <div style={{ fontSize: 18, color: COLORS.textMuted }}>{col.count}</div>
      </div>
      {/* Ghost cards so the column isn't empty. */}
      {Array.from({ length: idx === 0 ? 5 : idx === 1 ? 4 : idx === 2 ? 3 : 2 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 54,
            marginBottom: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
};

const LeadCard: React.FC<{ column: number }> = ({ column }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      background: "linear-gradient(180deg, rgba(94,106,210,0.2) 0%, rgba(20,20,24,0.94) 100%)",
      border: `1px solid ${COLORS.accent}`,
      borderRadius: 14,
      padding: 18,
      fontFamily: TYPE.family,
      boxShadow: `0 0 40px rgba(94,106,210,0.35)`,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div style={{ fontSize: 22, fontWeight: TYPE.weight.semibold, color: COLORS.text }}>
      Meridian Dental
    </div>
    <div style={{ fontSize: 15, color: COLORS.textMuted }}>
      SW7 · {COLUMNS[column]?.title ?? ""}
    </div>
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: COLORS.accent,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent }} />
      Opportunity 87
    </div>
  </div>
);

export const Pipeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const offsets = columnOffsets();

  const parts: ExplodedPart[] = offsets.map((x, i) => ({
    id: `col-${i}`,
    element: <Column idx={i} />,
    restPosition: { x, y: 0, z: i % 2 === 0 ? -40 : -80 },
    explodedPosition: { x, y: 900, z: -240 },
    restRotation: { x: 0, y: 0, z: 0 },
    explodedRotation: { x: 8, y: 0, z: i % 2 === 0 ? -6 : 6 },
    width: COL_W,
    height: COL_H,
  }));

  // Lead card morphs from column 0 to column 2 mid-scene.
  const morphStart = Math.round(fps * 4.0);
  const morphDur = Math.round(fps * 1.4);
  const fromCol = 0;
  const toCol = 2;
  const cardW = 280;
  const cardH = 120;
  // Convert stage-centered offsets to absolute screen-space rects.
  // Assume 1920x1080 composition; column offsets are from center.
  const stageCenterX = 1920 / 2;
  const stageCenterY = 1080 / 2;
  const fromRect = {
    x: stageCenterX + offsets[fromCol] - cardW / 2,
    y: stageCenterY - 160,
    width: cardW,
    height: cardH,
  };
  const toRect = {
    x: stageCenterX + offsets[toCol] - cardW / 2,
    y: stageCenterY - 40,
    width: cardW,
    height: cardH,
  };

  // Lead card opacity: fades in before the morph starts, holds after.
  const cardOpacity = interpolate(
    frame,
    [Math.round(fps * 3.0), Math.round(fps * 3.6), durationInFrames - fps, durationInFrames],
    [0, 1, 1, 0.9],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Gradient headline strip behind the board — pure design, no plate.
  const backgroundStrip = (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 60% 40% at 50% 35%, rgba(94,106,210,0.18) 0%, rgba(10,10,15,0) 70%)",
      }}
    >
      {/* Faint horizontal grid lines to suggest a workspace surface */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${12.5 * (i + 1)}%`,
            height: 1,
            background: "rgba(255,255,255,0.025)",
          }}
        />
      ))}
      {/* "Pipeline" eyebrow hovering above the columns */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [0, fps * 0.6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: TYPE.family,
            fontSize: 11,
            letterSpacing: TYPE.tracking.eyebrow,
            textTransform: "uppercase",
            color: COLORS.textDim,
            fontWeight: TYPE.weight.semibold,
          }}
        >
          Pipeline · Meridian Dental follows every status
        </div>
      </div>
    </AbsoluteFill>
  );

  return (
    <PinnedStage
      background_color={COLORS.bg}
      motion={{
        dolly: { from: 1.02, to: 1.0 },
        vignette: { from: 0.2, to: 0.35 },
        ambient: { from: 0.35, to: 0.55 },
      }}
      background={backgroundStrip}
      subject={
        <AbsoluteFill>
          <ExplodedParts
            parts={parts}
            explodeAt={0}
            reverse
            durationSeconds={2.0}
            staggerSeconds={0.09}
          />

          <AbsoluteFill style={{ opacity: cardOpacity }}>
            <MorphBox
              fromRect={fromRect}
              toRect={toRect}
              startFrame={morphStart}
              durationFrames={morphDur}
              before={<LeadCard column={fromCol} />}
              after={<LeadCard column={toCol} />}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      }
      overlay={
        <TitleCard
          text="The pipeline lives with the lead."
          appearAtFrame={Math.round(fps * 2.4)}
          durationFrames={Math.round(fps * 4.8)}
          position="bottom"
          size="subhead"
        />
      }
    />
  );
};
