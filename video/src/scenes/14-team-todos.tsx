/**
 * SCENE 14 — "Your team works on the same record." (4s)
 *
 * Team todos board. Three columns (To do / Doing / Done) with assignee
 * avatars slide in and a card animates from "Doing" to "Done".
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "../primitives/AppChrome";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

const AVATARS = [
  { initials: "MK", color: "#5E6AD2" },
  { initials: "SO", color: "#34D399" },
  { initials: "JH", color: "#F97362" },
];

const COL_COLORS: Record<string, string> = {
  "To do": COLORS.textMuted,
  Doing: COLORS.primary,
  Done: COLORS.success,
};

interface Todo {
  title: string;
  lead: string;
  assignee: number;
}

const COLS: { title: string; items: Todo[] }[] = [
  {
    title: "To do",
    items: [
      { title: "Pull audit for Kensington Legal", lead: "Kensington Legal", assignee: 0 },
      { title: "Record voice note on SW7 Interiors", lead: "SW7 Interiors", assignee: 1 },
    ],
  },
  {
    title: "Doing",
    items: [
      { title: "Send mockup link", lead: "Meridian Dental", assignee: 2 },
    ],
  },
  {
    title: "Done",
    items: [
      { title: "Opener drafted", lead: "Chelsea Clinic", assignee: 0 },
      { title: "Booked intro call", lead: "Fulham Physio", assignee: 1 },
    ],
  },
];

const Avatar: React.FC<{ idx: number; size?: number }> = ({ idx, size = 22 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: AVATARS[idx].color,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.45,
      fontWeight: TYPE.weight.bold,
      border: `1.5px solid ${COLORS.bg}`,
    }}
  >
    {AVATARS[idx].initials}
  </div>
);

export const TeamTodos: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Card moves from Doing (col 1) → Done (col 2) between 2.2s and 3.2s.
  const flyStart = Math.round(fps * 2.2);
  const flyDur = Math.round(fps * 1.0);
  const flyT = interpolate(frame, [flyStart, flyStart + flyDur], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="todos"
        title="Team tasks"
        subtitle="Attached to the lead, not the inbox."
        headerRight={
          <div style={{ display: "flex", marginLeft: -4 }}>
            {AVATARS.map((_, i) => (
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar idx={i} size={30} />
              </div>
            ))}
          </div>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            height: "100%",
          }}
        >
          {COLS.map((col, ci) => {
            const colOpacity = interpolate(
              frame,
              [fps * (0.2 + ci * 0.15), fps * (0.5 + ci * 0.15)],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <div
                key={col.title}
                style={{
                  opacity: colOpacity,
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(22,22,26,0.82)",
                  border: `0.5px solid ${COLORS.borderStrong}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 14,
                      fontWeight: TYPE.weight.semibold,
                      color: COLORS.text,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COL_COLORS[col.title],
                      }}
                    />
                    {col.title}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                    {col.items.length +
                      (ci === 1 && flyT > 0.5 ? -1 : 0) +
                      (ci === 2 && flyT > 0.5 ? 1 : 0)}
                  </div>
                </div>

                {col.items.map((t, i) => {
                  // The "Send mockup link" card is the one that migrates.
                  const isMigrating =
                    ci === 1 && t.title === "Send mockup link" && flyT > 0;
                  const destCard = ci === 2 && i === 0 ? 0 : null;
                  const hideHere = isMigrating && flyT > 0.5;
                  const renderGhost = destCard !== null && flyT < 0.5;

                  if (hideHere) return null;
                  if (renderGhost) {
                    // In Done column, placeholder so the new landing spot makes sense
                    return null;
                  }

                  const itemAppear = Math.round(
                    fps * (0.4 + ci * 0.15 + i * 0.08),
                  );
                  const itemOp = interpolate(frame, [itemAppear, itemAppear + 14], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });

                  return (
                    <div
                      key={t.title}
                      style={{
                        opacity: itemOp,
                        padding: 14,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.04)",
                        border: `0.5px solid ${COLORS.border}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: TYPE.weight.semibold,
                          color: COLORS.text,
                        }}
                      >
                        {t.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                          color: COLORS.textMuted,
                        }}
                      >
                        <span>{t.lead}</span>
                        <Avatar idx={t.assignee} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Flying card overlay — travels between columns. */}
        {flyT > 0 && flyT < 1 && (
          <div
            style={{
              position: "absolute",
              left: `calc(33.3% + ${20 + (33.3 / 100) * 1200 * flyT}px)`,
              top: 200,
              width: 320,
              padding: 14,
              borderRadius: 12,
              background: "rgba(94,106,210,0.18)",
              border: `1px solid ${COLORS.accent}`,
              boxShadow: `0 16px 60px rgba(94,106,210,0.4)`,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: TYPE.weight.semibold,
                color: COLORS.text,
                marginBottom: 6,
              }}
            >
              Send mockup link
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              Meridian Dental
            </div>
          </div>
        )}
      </AppChrome>

      <TitleCard
        text="Your team works on the same record."
        appearAtFrame={Math.round(fps * 1.8)}
        durationFrames={durationInFrames - Math.round(fps * 1.8)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
