/**
 * AD-02 — "And a website plan you can attach to the first reply." (5s)
 *
 * The wedge scene. Renders a faithful slice of the /app/leads/[id] website
 * plan view inside AppChrome: markdown-flavored plan body scrolling slightly,
 * eyebrow chips (pages, sections, SEO, CTAs), and a "Copy plan" + "Download
 * mockup" action row. The plan itself animates section-by-section so the
 * eye sees a deliverable building, not a static document.
 *
 * Caption is handled at AdCut level by KineticCaption — this scene stays
 * silent on top and carries the visual.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "../primitives/AppChrome";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

interface Section {
  num: string;
  title: string;
  lines: string[];
}

const SECTIONS: Section[] = [
  {
    num: "01",
    title: "Hero — Mobile booking in 60 seconds",
    lines: [
      "Above the fold CTA: Book an engineer",
      "Subhead: same-day phone repair, SW7 + surrounding",
      "Trust row: 412 Google reviews · 4.8★ · Warranty",
    ],
  },
  {
    num: "02",
    title: "Services grid",
    lines: [
      "iPhone screen · battery · water damage",
      "Android · Samsung · Google Pixel",
      "Per-service fixed pricing · £ from",
    ],
  },
  {
    num: "03",
    title: "Booking widget",
    lines: [
      "Embed Calendly or in-house slot picker",
      "SMS confirmation · engineer name · ETA",
      "Fallback: WhatsApp click-to-chat",
    ],
  },
  {
    num: "04",
    title: "Proof — Reviews + before/after",
    lines: [
      "Pull top 6 Google reviews (schema.org)",
      "Before/after grid · 3 hero repairs",
      "Warranty badge · 90-day cover",
    ],
  },
  {
    num: "05",
    title: "SEO & GEO",
    lines: [
      "Location pages · SW7, SW3, SW5, SW6",
      "FAQ schema · 12 questions",
      "Organization + LocalBusiness JSON-LD",
    ],
  },
];

export const AdWedge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Sections appear staggered from T+0.2s onward.
  const sectionDelaySec = 0.55;

  // Slight scroll drift so the plan feels deep
  const scroll = interpolate(
    frame,
    [Math.round(fps * 1.8), durationInFrames],
    [0, -120],
    { easing: EASE.appleInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Chip row at the top
  const chips = [
    { label: "12 sections", color: COLORS.accent },
    { label: "SEO + GEO ready", color: COLORS.success },
    { label: "Core Web Vitals", color: COLORS.warning },
    { label: "Audit-grounded", color: COLORS.primary },
  ];

  // Action row flashes at end
  const actionIn = interpolate(
    frame,
    [Math.round(fps * 3.4), Math.round(fps * 3.7)],
    [0, 1],
    { easing: EASE.appleOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="leads"
        title="Meridian Dental · SW7 — Website plan"
        subtitle="Grounded in live audit · Gemini 2.5 · 14-section handbook"
        headerRight={
          <div
            style={{
              display: "flex",
              gap: 10,
              opacity: actionIn,
              transform: `translateY(${(1 - actionIn) * 6}px)`,
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                border: `0.5px solid ${COLORS.border}`,
                fontSize: 13,
                fontWeight: TYPE.weight.semibold,
                color: COLORS.textMuted,
                fontFamily: TYPE.family,
              }}
            >
              Copy plan
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: "linear-gradient(120deg, #5E6AD2 0%, #8590FF 100%)",
                fontSize: 13,
                fontWeight: TYPE.weight.semibold,
                color: "#fff",
                fontFamily: TYPE.family,
                boxShadow: "0 10px 30px rgba(94,106,210,0.35)",
              }}
            >
              Download mockup →
            </div>
          </div>
        }
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          {chips.map((c, i) => {
            const appear = Math.round(fps * (0.15 + i * 0.08));
            const op = interpolate(frame, [appear, appear + 10], [0, 1], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const ty = interpolate(frame, [appear, appear + 12], [8, 0], {
              easing: EASE.appleOut,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={c.label}
                style={{
                  opacity: op,
                  transform: `translateY(${ty}px)`,
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: `${c.color}18`,
                  border: `0.5px solid ${c.color}55`,
                  color: c.color,
                  fontSize: 12,
                  fontWeight: TYPE.weight.semibold,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  fontFamily: TYPE.family,
                }}
              >
                {c.label}
              </div>
            );
          })}
        </div>

        {/* Plan document */}
        <div
          style={{
            position: "relative",
            height: "calc(100% - 60px)",
            overflow: "hidden",
            borderRadius: 20,
            border: `0.5px solid ${COLORS.borderStrong}`,
            background: "rgba(22,22,26,0.7)",
            padding: "32px 44px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              transform: `translateY(${scroll}px)`,
              willChange: "transform",
              fontFamily: TYPE.family,
            }}
          >
            {SECTIONS.map((s, i) => {
              const appear = Math.round(fps * (0.5 + i * sectionDelaySec));
              const local = frame - appear;
              const op = interpolate(local, [0, 16], [0, 1], {
                easing: EASE.appleOut,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const ty = interpolate(local, [0, 20], [14, 0], {
                easing: EASE.appleOut,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <div
                  key={s.num}
                  style={{
                    opacity: op,
                    transform: `translateY(${ty}px)`,
                    display: "flex",
                    gap: 20,
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      flexShrink: 0,
                      fontSize: 14,
                      fontWeight: TYPE.weight.semibold,
                      color: COLORS.textDim,
                      letterSpacing: TYPE.tracking.eyebrow,
                      paddingTop: 4,
                    }}
                  >
                    {s.num}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: TYPE.weight.semibold,
                        color: COLORS.text,
                        letterSpacing: TYPE.tracking.subhead,
                        marginBottom: 10,
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {s.lines.map((ln) => (
                        <div
                          key={ln}
                          style={{
                            fontSize: 15,
                            color: COLORS.textMuted,
                            lineHeight: 1.55,
                            display: "flex",
                            gap: 10,
                          }}
                        >
                          <span style={{ color: COLORS.accent, marginTop: 2 }}>·</span>
                          <span>{ln}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom fade so scroll is motivated */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 120,
              background: `linear-gradient(to bottom, rgba(22,22,26,0), rgba(22,22,26,0.9) 70%, rgba(22,22,26,1))`,
              pointerEvents: "none",
            }}
          />
        </div>
      </AppChrome>
    </AbsoluteFill>
  );
};
