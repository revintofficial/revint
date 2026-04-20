/**
 * AD-01 — "Same 50M contacts. Ten thousand agencies." (3s)
 *
 * Pure Remotion. Sharpened cold open for the paid-media cut. Differs from
 * `01-cold-open.tsx` in three ways:
 *   - Spreadsheet rows carry real Apollo-flavored data (names + emails +
 *     "CONTACTED" state) so the frame reads as a saturated lead dump.
 *   - Rows erase progressively across 2s — each column dimming left-to-right,
 *     as if the list is burning through itself.
 *   - A big center number ("50,000,000 contacts / 10,000 agencies") lands
 *     at T+1.4s with a spring overshoot.
 *
 * Caption is handled by KineticCaption at the AdCut level, not here.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

const FIRST_NAMES = [
  "Alex", "Sarah", "Mike", "Emma", "Ryan", "Jess", "Dan",
  "Priya", "Luke", "Anya", "Tom", "Nina", "Ben", "Zoe",
  "Sam", "Maya", "Oscar", "Lara", "Jake", "Ivy", "Noah",
];
const COMPANIES = [
  "Acme", "Globex", "Initech", "Umbrella", "Hooli", "Massive Dynamic",
  "Wayne Ent", "Stark Industries", "Pied Piper", "Dunder", "Cyberdyne",
  "Tyrell", "Soylent", "Weyland", "Nakatomi", "Vandelay", "Vehement",
];

const COLS: { key: string; width: string }[] = [
  { key: "Name", width: "1.1fr" },
  { key: "Title", width: "1.2fr" },
  { key: "Email", width: "1.8fr" },
  { key: "Company", width: "1.2fr" },
  { key: "Sector", width: "0.9fr" },
  { key: "State", width: "0.8fr" },
];

const ROW_COUNT = 18;

function rowData(i: number) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const company = COMPANIES[(i * 3) % COMPANIES.length];
  return {
    name: `${first} ${["Carter", "Reid", "Patel", "Chen", "Nguyen", "Diaz", "Okafor"][i % 7]}`,
    title: ["Founder", "Head of Sales", "CEO", "Director", "VP Growth"][i % 5],
    email: `${first.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    company,
    sector: ["SaaS", "MSP", "Agency", "Consulting", "eCom"][i % 5],
    state: "CONTACTED",
  };
}

export const AdPain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const desat = interpolate(frame, [8, 60], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rowEraseStart = Math.round(fps * 0.6);
  const rowEraseDur = Math.round(fps * 1.8);

  // Big tally reveal
  const tallyStart = Math.round(fps * 1.4);
  const tallyOp = interpolate(frame, [tallyStart, tallyStart + 14], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tallyScale = interpolate(
    frame,
    [tallyStart, tallyStart + 16, tallyStart + 28],
    [0.92, 1.04, 1],
    { easing: EASE.appleSpring, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Scene-end darken so transition fades cleanly
  const outDim = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [0, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily: TYPE.family,
        padding: 80,
        overflow: "hidden",
      }}
    >
      {/* CSV / spreadsheet plate */}
      <div
        style={{
          position: "absolute",
          inset: 80,
          background: COLORS.bgAlt,
          borderRadius: 18,
          border: `0.5px solid ${COLORS.border}`,
          padding: "24px 28px",
          filter: `saturate(${1 - desat * 0.9}) brightness(${1 - desat * 0.35})`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: COLS.map((c) => c.width).join(" "),
            gap: 0,
            color: COLORS.text,
          }}
        >
          {COLS.map((c) => (
            <div
              key={c.key}
              style={{
                fontSize: 14,
                fontWeight: TYPE.weight.semibold,
                padding: "14px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                color: COLORS.textMuted,
                letterSpacing: TYPE.tracking.eyebrow,
                textTransform: "uppercase",
              }}
            >
              {c.key}
            </div>
          ))}
          {Array.from({ length: ROW_COUNT }).map((_, r) => {
            const d = rowData(r);
            const rowEraseT = interpolate(
              frame,
              [rowEraseStart + r * 2, rowEraseStart + rowEraseDur + r * 2],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return [
              <div
                key={`${r}-name`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted,
                  fontSize: 15,
                  opacity: 1 - rowEraseT * 0.85,
                }}
              >
                {d.name}
              </div>,
              <div
                key={`${r}-title`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textDim,
                  fontSize: 14,
                  opacity: 1 - rowEraseT * 0.85,
                }}
              >
                {d.title}
              </div>,
              <div
                key={`${r}-email`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textDim,
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  opacity: 1 - rowEraseT * 0.85,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {d.email}
              </div>,
              <div
                key={`${r}-co`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textMuted,
                  fontSize: 14,
                  opacity: 1 - rowEraseT * 0.85,
                }}
              >
                {d.company}
              </div>,
              <div
                key={`${r}-sec`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  color: COLORS.textDim,
                  fontSize: 13,
                  opacity: 1 - rowEraseT * 0.85,
                }}
              >
                {d.sector}
              </div>,
              <div
                key={`${r}-st`}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  fontSize: 12,
                  fontWeight: TYPE.weight.semibold,
                  color: `rgba(248,113,113,${0.85 * (1 - rowEraseT * 0.7)})`,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  opacity: 1 - rowEraseT * 0.5,
                }}
              >
                {d.state}
              </div>,
            ];
          })}
        </div>
      </div>

      {/* Tally stamp — big numbers over the greyed-out plate */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            opacity: tallyOp,
            transform: `scale(${tallyScale})`,
            textAlign: "center",
            padding: "28px 46px",
            borderRadius: 24,
            background: "rgba(10,10,15,0.72)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            backdropFilter: "blur(28px)",
            boxShadow: "0 60px 160px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              color: COLORS.danger,
              fontWeight: TYPE.weight.semibold,
              marginBottom: 12,
            }}
          >
            Apollo · Clay · ZoomInfo
          </div>
          <div
            style={{
              fontSize: 104,
              fontWeight: TYPE.weight.semibold,
              letterSpacing: TYPE.tracking.display,
              color: COLORS.text,
              lineHeight: 1,
            }}
          >
            50,000,000
          </div>
          <div
            style={{
              fontSize: 22,
              color: COLORS.textMuted,
              fontWeight: TYPE.weight.medium,
              marginTop: 10,
              letterSpacing: TYPE.tracking.body,
            }}
          >
            same contacts · 10,000+ agencies · same week
          </div>
        </div>
      </AbsoluteFill>

      {/* End-of-scene darken so the fade transition lands clean */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: outDim,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
