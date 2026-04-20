/**
 * SCENE 11 — "A plan they can actually read." (6s)
 *
 * Website plan document. A long markdown plan scrolls up like the real
 * `/app/leads/[id]` website-plan section, with action chips "Copy" and
 * "Download .md" landing at the end. Communicates the deliverable that
 * separates Leadac AI from Apollo/Clay.
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

const PLAN_SECTIONS = [
  {
    heading: "1 · Positioning",
    lines: [
      "Meridian is the gentle-dentist choice in SW7. The site sells",
      "surgery, not experience. We want the homepage to feel calm,",
      "confident, and booking-first.",
    ],
  },
  {
    heading: "2 · Hero block",
    lines: [
      "Replace 'Welcome to Meridian Dental' with: 'Gentle dentistry",
      "in South Kensington — book for today, pay in 3 interest-free.'",
      "CTA: 'Book in 60 seconds'. Secondary: 'Meet the team'.",
    ],
  },
  {
    heading: "3 · Booking flow",
    lines: [
      "Online booking missing. Install Dentally or NHS e-booking widget",
      "on /book. Reduce clicks from 6 → 2. Add same-day slot badge.",
    ],
  },
  {
    heading: "4 · Trust stack",
    lines: [
      "Pull 6 Google reviews (rating ≥ 4.8) onto the homepage. Add",
      "GDC reg numbers. Add price ranges for top 5 treatments.",
    ],
  },
  {
    heading: "5 · Mobile & speed",
    lines: [
      "Lighthouse mobile 41 → target 82. Compress hero image,",
      "defer Instagram embed, drop jQuery. Expect page-speed lift",
      "to pay back ~12% more booked first visits.",
    ],
  },
  {
    heading: "6 · Local SEO",
    lines: [
      "Schema LocalBusiness + Dentist. GBP: add services, photos,",
      "Q&A. Target 'dentist SW7', 'emergency dentist South Ken'.",
    ],
  },
];

export const WebsitePlan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Scroll offset: the plan document slides upward over the scene.
  const scroll = interpolate(frame, [0, durationInFrames], [0, -420], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chipsAppear = Math.round(fps * 4.0);
  const chipOpacity = interpolate(frame, [chipsAppear, chipsAppear + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chipTx = interpolate(frame, [chipsAppear, chipsAppear + 22], [20, 0], {
    easing: EASE.appleSpring,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="leads"
        title="Meridian Dental · Website plan"
        subtitle="Generated from audit + reviews · 42 lines"
        headerRight={
          <div
            style={{
              display: "flex",
              gap: 10,
              opacity: chipOpacity,
              transform: `translateX(${chipTx}px)`,
            }}
          >
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.05)",
                border: `0.5px solid ${COLORS.borderStrong}`,
                fontSize: 13,
                fontWeight: TYPE.weight.semibold,
                color: COLORS.text,
              }}
            >
              Copy
            </div>
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: COLORS.primary,
                fontSize: 13,
                fontWeight: TYPE.weight.semibold,
                color: "#fff",
              }}
            >
              Download .md
            </div>
          </div>
        }
      >
        {/* Document paper */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            right: 40,
            bottom: 40,
            borderRadius: 20,
            background: "rgba(20,20,24,0.92)",
            border: `0.5px solid ${COLORS.borderStrong}`,
            overflow: "hidden",
            padding: "40px 64px",
          }}
        >
          <div
            style={{
              transform: `translateY(${scroll}px)`,
              willChange: "transform",
            }}
          >
            {PLAN_SECTIONS.map((section, i) => (
              <div key={i} style={{ marginBottom: 40 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: TYPE.weight.semibold,
                    letterSpacing: TYPE.tracking.subhead,
                    color: COLORS.text,
                    marginBottom: 14,
                  }}
                >
                  {section.heading}
                </div>
                {section.lines.map((line, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: 18,
                      color: COLORS.textMuted,
                      lineHeight: 1.55,
                      fontFamily:
                        "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Top + bottom fade masks */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 60,
              background:
                "linear-gradient(180deg, rgba(20,20,24,1) 0%, rgba(20,20,24,0) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              background:
                "linear-gradient(0deg, rgba(20,20,24,1) 0%, rgba(20,20,24,0) 100%)",
              pointerEvents: "none",
            }}
          />
        </div>
      </AppChrome>

      <TitleCard
        text="A plan they can actually read."
        appearAtFrame={Math.round(fps * 4.2)}
        durationFrames={durationInFrames - Math.round(fps * 4.2)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
