/**
 * SCENE 03 — "47 fresh local leads. Five minutes." (10s)
 *
 * Rebuilt from scratch — no captured plate. Renders the /app/leads list
 * inside AppChrome with 16 visible lead cards cascading in from below on
 * a stagger, a live counter ticking to 47 in the header, borough and
 * website-status chips on each row. Feels like the real product.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "../primitives/AppChrome";
import { MetricCounter } from "../primitives/MetricCounter";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

interface Lead {
  name: string;
  borough: string;
  category: string;
  score: number;
  hasSite: boolean;
  siteStatus: "dated" | "mobile-broken" | "no-site" | "modern";
  reviews: number;
  rating: number;
}

// 16 hand-picked leads — 4 rows of 4, first rows land first, feels populated.
const LEADS: Lead[] = [
  { name: "Meridian Dental", borough: "SW7", category: "Dentist", score: 87, hasSite: true, siteStatus: "dated", reviews: 412, rating: 4.8 },
  { name: "Kensington Legal", borough: "SW7", category: "Solicitor", score: 82, hasSite: true, siteStatus: "dated", reviews: 188, rating: 4.9 },
  { name: "SW7 Interiors", borough: "SW7", category: "Interior", score: 78, hasSite: true, siteStatus: "mobile-broken", reviews: 96, rating: 4.7 },
  { name: "Chelsea Clinic", borough: "SW3", category: "Clinic", score: 74, hasSite: true, siteStatus: "dated", reviews: 284, rating: 4.6 },
  { name: "Fulham Physio", borough: "SW6", category: "Physio", score: 71, hasSite: true, siteStatus: "mobile-broken", reviews: 143, rating: 4.8 },
  { name: "Notting Hill Tutors", borough: "W11", category: "Tutoring", score: 69, hasSite: false, siteStatus: "no-site", reviews: 77, rating: 4.9 },
  { name: "Bayswater Barbers", borough: "W2", category: "Barber", score: 66, hasSite: true, siteStatus: "dated", reviews: 331, rating: 4.7 },
  { name: "Earl's Court Cafe", borough: "SW5", category: "Cafe", score: 64, hasSite: true, siteStatus: "modern", reviews: 512, rating: 4.5 },
  { name: "Pimlico Plumbers Co", borough: "SW1", category: "Plumber", score: 62, hasSite: true, siteStatus: "mobile-broken", reviews: 204, rating: 4.4 },
  { name: "Knightsbridge Yoga", borough: "SW1", category: "Yoga", score: 61, hasSite: true, siteStatus: "modern", reviews: 157, rating: 4.9 },
  { name: "Belgravia Dry-clean", borough: "SW1", category: "Dry clean", score: 58, hasSite: false, siteStatus: "no-site", reviews: 68, rating: 4.6 },
  { name: "Mayfair Opticians", borough: "W1", category: "Optician", score: 57, hasSite: true, siteStatus: "dated", reviews: 129, rating: 4.8 },
  { name: "Camden Locksmith", borough: "NW1", category: "Locksmith", score: 55, hasSite: true, siteStatus: "mobile-broken", reviews: 83, rating: 4.3 },
  { name: "Primrose Pilates", borough: "NW3", category: "Pilates", score: 53, hasSite: true, siteStatus: "dated", reviews: 114, rating: 4.8 },
  { name: "Soho Tailors", borough: "W1", category: "Tailor", score: 52, hasSite: true, siteStatus: "modern", reviews: 246, rating: 4.7 },
  { name: "Holborn Chiro", borough: "WC1", category: "Chiro", score: 49, hasSite: false, siteStatus: "no-site", reviews: 47, rating: 4.6 },
];

const statusLabel: Record<Lead["siteStatus"], { label: string; color: string }> = {
  dated: { label: "Dated site", color: COLORS.warning },
  "mobile-broken": { label: "Mobile broken", color: COLORS.danger },
  "no-site": { label: "No site", color: COLORS.danger },
  modern: { label: "Modern", color: COLORS.success },
};

function scoreColor(s: number) {
  if (s >= 75) return COLORS.success;
  if (s >= 60) return COLORS.accent;
  if (s >= 50) return COLORS.warning;
  return COLORS.textMuted;
}

const LeadRow: React.FC<{ lead: Lead }> = ({ lead }) => {
  const st = statusLabel[lead.siteStatus];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2.2fr 0.7fr 0.9fr 1.1fr 0.7fr",
        gap: 18,
        alignItems: "center",
        padding: "14px 20px",
        borderRadius: 14,
        background: "rgba(22,22,26,0.82)",
        border: `0.5px solid ${COLORS.borderStrong}`,
        fontFamily: TYPE.family,
      }}
    >
      {/* Name + category */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${scoreColor(lead.score)}55, ${scoreColor(lead.score)}22)`,
            border: `0.5px solid ${scoreColor(lead.score)}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: TYPE.weight.bold,
            color: COLORS.text,
          }}
        >
          {lead.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: TYPE.weight.semibold, color: COLORS.text }}>
            {lead.name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            {lead.category}
          </div>
        </div>
      </div>

      {/* Borough */}
      <div
        style={{
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.04)",
          border: `0.5px solid ${COLORS.border}`,
          fontSize: 11,
          fontWeight: TYPE.weight.semibold,
          color: COLORS.textMuted,
          letterSpacing: TYPE.tracking.eyebrow,
          justifySelf: "start",
        }}
      >
        {lead.borough}
      </div>

      {/* Rating + reviews */}
      <div style={{ fontSize: 13, color: COLORS.text }}>
        <span style={{ color: COLORS.warning }}>★</span>
        <span style={{ fontWeight: TYPE.weight.semibold, marginLeft: 4 }}>{lead.rating}</span>
        <span style={{ color: COLORS.textMuted, marginLeft: 6 }}>({lead.reviews})</span>
      </div>

      {/* Status chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px",
          borderRadius: 999,
          background: `${st.color}14`,
          border: `0.5px solid ${st.color}55`,
          fontSize: 12,
          fontWeight: TYPE.weight.semibold,
          color: st.color,
          justifySelf: "start",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: st.color,
            boxShadow: `0 0 8px ${st.color}`,
          }}
        />
        {st.label}
      </div>

      {/* Score */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: TYPE.weight.semibold,
            color: scoreColor(lead.score),
            letterSpacing: TYPE.tracking.display,
            lineHeight: 1,
          }}
        >
          {lead.score}
        </div>
        <div style={{ color: COLORS.textDim, fontSize: 18 }}>→</div>
      </div>
    </div>
  );
};

export const Discovery: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const countStart = Math.round(fps * 0.6);
  const countDur = Math.round(fps * 2.0);

  // The list scrolls slightly upward over the second half so more rows enter.
  const listScroll = interpolate(
    frame,
    [fps * 4.0, durationInFrames],
    [0, -260],
    {
      easing: EASE.appleInOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="leads"
        title="Leads · SW7, dentists and adjacent"
        subtitle="Pulled from Google Maps · audited · ranked"
        headerRight={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 18px",
              borderRadius: 14,
              background: "rgba(94,106,210,0.14)",
              border: `0.5px solid rgba(94,106,210,0.45)`,
              fontFamily: TYPE.family,
            }}
          >
            <MetricCounter
              from={0}
              to={47}
              startFrame={countStart}
              durationFrames={countDur}
              size={28}
              accent={COLORS.text}
            />
            <div
              style={{
                fontSize: 12,
                color: COLORS.textMuted,
                letterSpacing: TYPE.tracking.eyebrow,
                textTransform: "uppercase",
                fontWeight: TYPE.weight.semibold,
              }}
            >
              new leads · 4.2s
            </div>
          </div>
        }
      >
        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 0.9fr 1.1fr 0.7fr",
            gap: 18,
            padding: "0 20px 10px",
            fontSize: 11,
            letterSpacing: TYPE.tracking.eyebrow,
            textTransform: "uppercase",
            color: COLORS.textDim,
            fontWeight: TYPE.weight.semibold,
            fontFamily: TYPE.family,
          }}
        >
          <div>Business</div>
          <div>Borough</div>
          <div>Reviews</div>
          <div>Website</div>
          <div style={{ textAlign: "right" }}>Score</div>
        </div>

        {/* Lead list */}
        <div
          style={{
            position: "relative",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              transform: `translateY(${listScroll}px)`,
              willChange: "transform",
            }}
          >
            {LEADS.map((lead, i) => {
              // Staggered appearance: row 0 lands at ~0.4s, each +0.09s.
              const appear = Math.round(fps * (0.4 + i * 0.09));
              const local = frame - appear;
              const opacity = interpolate(local, [0, 16], [0, 1], {
                easing: EASE.appleOut,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const ty = interpolate(local, [0, 22], [36, 0], {
                easing: EASE.appleSpring,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={lead.name}
                  style={{
                    opacity,
                    transform: `translateY(${ty}px)`,
                  }}
                >
                  <LeadRow lead={lead} />
                </div>
              );
            })}
          </div>

          {/* Fade mask at bottom so scrolling list feels like a viewport. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 90,
              background:
                "linear-gradient(0deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </AppChrome>

      <TitleCard
        text="47 fresh local leads. Five minutes."
        appearAtFrame={Math.round(fps * 5.2)}
        durationFrames={durationInFrames - Math.round(fps * 5.2)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
