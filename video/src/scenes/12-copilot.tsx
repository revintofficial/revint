/**
 * SCENE 12 — "Ask. Follow up. All one workspace." (5s)
 *
 * Copilot drawer. The right side drawer opens, user question appears,
 * then an AI response types itself with lead-reference chips at the end.
 * Mirrors the real `CopilotDrawer` → `/api/copilot` interaction.
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

const USER_QUESTION = "Who in SW7 has a dated site and great reviews?";
const AI_RESPONSE =
  "Three leads match both signals — dated site (Lighthouse ≤ 55) plus review score above 4.7. Meridian Dental (score 87), Kensington Legal (82) and SW7 Interiors (78). I've opened all three in your pipeline.";

const REF_CHIPS = [
  { name: "Meridian Dental", score: 87 },
  { name: "Kensington Legal", score: 82 },
  { name: "SW7 Interiors", score: 78 },
];

export const Copilot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Drawer slides in from right over 0.6s.
  const drawerX = interpolate(frame, [0, fps * 0.5], [460, 0], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // User question appears at 0.6s.
  const questionOpacity = interpolate(frame, [fps * 0.6, fps * 0.9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // AI response types character by character starting at 1.3s.
  const typeStart = Math.round(fps * 1.3);
  const typeDur = Math.round(fps * 2.4);
  const typeProgress = interpolate(frame, [typeStart, typeStart + typeDur], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typed = AI_RESPONSE.slice(0, Math.floor(typeProgress * AI_RESPONSE.length));

  // Chips fade in at the end.
  const chipsAppear = Math.round(fps * 3.9);

  return (
    <AbsoluteFill>
      <AppChrome activeRoute="dashboard" title="Dashboard">
        <div
          style={{
            opacity: 0.5,
            filter: "blur(4px)",
            pointerEvents: "none",
            height: "100%",
          }}
        >
          {/* Mute dashboard surface so the drawer pops. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 120,
                  borderRadius: 20,
                  background: "rgba(22,22,26,0.6)",
                  border: `0.5px solid ${COLORS.border}`,
                }}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 20,
              height: 220,
              borderRadius: 20,
              background: "rgba(22,22,26,0.6)",
              border: `0.5px solid ${COLORS.border}`,
            }}
          />
        </div>
      </AppChrome>

      {/* Dim overlay */}
      <AbsoluteFill
        style={{
          background: "rgba(0,0,0,0.4)",
          opacity: interpolate(frame, [0, fps * 0.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          pointerEvents: "none",
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: 560,
          background: "rgba(18,18,22,0.96)",
          borderLeft: `1px solid ${COLORS.borderStrong}`,
          backdropFilter: "blur(30px)",
          transform: `translateX(${drawerX}px)`,
          display: "flex",
          flexDirection: "column",
          padding: "28px 30px",
          fontFamily: TYPE.family,
        }}
      >
        {/* Drawer header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: COLORS.primaryGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: TYPE.weight.semibold }}>Copilot</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              Grounded in your workspace data
            </div>
          </div>
        </div>

        {/* User question bubble */}
        <div
          style={{
            opacity: questionOpacity,
            alignSelf: "flex-end",
            maxWidth: "85%",
            marginBottom: 20,
            padding: "12px 16px",
            background: "rgba(94,106,210,0.22)",
            border: `0.5px solid rgba(94,106,210,0.5)`,
            borderRadius: 14,
            borderBottomRightRadius: 4,
            fontSize: 15,
            color: COLORS.text,
            lineHeight: 1.4,
          }}
        >
          {USER_QUESTION}
        </div>

        {/* AI typing bubble */}
        <div
          style={{
            opacity: interpolate(frame, [typeStart - 10, typeStart], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            alignSelf: "flex-start",
            maxWidth: "88%",
            padding: "14px 18px",
            background: "rgba(255,255,255,0.04)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            fontSize: 15,
            color: COLORS.text,
            lineHeight: 1.55,
            marginBottom: 16,
          }}
        >
          {typed}
          {typeProgress > 0 && typeProgress < 1 && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 18,
                marginLeft: 3,
                background: COLORS.accent,
                verticalAlign: "middle",
                opacity: Math.sin((frame / fps) * Math.PI * 4) > 0 ? 1 : 0,
              }}
            />
          )}
        </div>

        {/* Reference chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 6 }}>
          {REF_CHIPS.map((c, i) => {
            const appear = chipsAppear + i * 8;
            const opacity = interpolate(frame, [appear, appear + 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const tx = interpolate(frame, [appear, appear + 18], [-12, 0], {
              easing: EASE.appleSpring,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={c.name}
                style={{
                  opacity,
                  transform: `translateX(${tx}px)`,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(94,106,210,0.12)",
                  border: `0.5px solid rgba(94,106,210,0.35)`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: TYPE.weight.semibold }}>{c.name}</span>
                <span style={{ color: COLORS.accent, fontWeight: TYPE.weight.semibold }}>
                  {c.score}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input field at the bottom */}
        <div
          style={{
            marginTop: "auto",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            color: COLORS.textDim,
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Ask about your leads…</span>
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>⌘ K</span>
        </div>
      </div>

      <TitleCard
        text="Ask. Follow up. All one workspace."
        appearAtFrame={Math.round(fps * 3.4)}
        durationFrames={durationInFrames - Math.round(fps * 3.4)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
