/**
 * SCENE 06 — "The opener writes itself." (10s) — rebuilt without plate.
 *
 * Handmade Gmail-style compose window. The To / Subject / Body fields
 * populate in sequence: subject types first, then body types character-
 * by-character with a cursor, referencing specific audit signals by name
 * (HTTPS, booking flow, mobile). A "Sent" toast slides in at the end.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PinnedStage } from "../primitives/PinnedStage";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

const TO_EMAIL = "hello@meridiandental.co.uk";
const SUBJECT = "Quick SW7 note — 3 small tweaks I'd make to meridiandental.co.uk";
const BODY_LINES = [
  "Hey Meridian team,",
  "",
  "Saw you the other day — 4.8★ across 412 reviews, properly impressive.",
  "",
  "Had a look at the site and there are three small things that would most likely",
  "lift bookings without touching the brand:",
  "",
  "  1. HTTPS — the site is still on HTTP so Chrome warns visitors.",
  "  2. Booking flow — intake is phone-only; an online picker would catch",
  "     the 40% of traffic arriving 8pm–midnight.",
  "  3. Mobile fit — viewport's not set, tap targets overlap on iPhone.",
  "",
  "I put together a rough mockup and a one-page plan for each fix —",
  "link below, no sign-up. Worth a 15-min call to walk through?",
  "",
  "— Mert",
];
const BODY = BODY_LINES.join("\n");

const HeaderField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 20px",
      borderBottom: `0.5px solid ${COLORS.border}`,
    }}
  >
    <div
      style={{
        fontSize: 12,
        letterSpacing: TYPE.tracking.eyebrow,
        textTransform: "uppercase",
        color: COLORS.textDim,
        fontWeight: TYPE.weight.semibold,
        width: 64,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 14, color: COLORS.text, flex: 1, fontFamily: TYPE.family }}>
      {value}
    </div>
  </div>
);

export const Opener: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timeline:
  //   0.0s  window + headers fade in
  //   0.5s  subject types over 1.2s
  //   1.9s  body types over 5.0s
  //   7.3s  Send button pulses
  //   7.8s  "Sent · queued" toast slides up
  const subjectStart = Math.round(fps * 0.5);
  const subjectDur = Math.round(fps * 1.2);
  const subjectProgress = interpolate(frame, [subjectStart, subjectStart + subjectDur], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedSubject = SUBJECT.slice(0, Math.floor(subjectProgress * SUBJECT.length));

  const bodyStart = Math.round(fps * 1.9);
  const bodyDur = Math.round(fps * 5.0);
  const bodyProgress = interpolate(frame, [bodyStart, bodyStart + bodyDur], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedBody = BODY.slice(0, Math.floor(bodyProgress * BODY.length));

  const sendStart = Math.round(fps * 7.3);
  const sendPulse = interpolate(
    frame,
    [sendStart, sendStart + 10, sendStart + 20, sendStart + 30],
    [1, 1.06, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const toastStart = Math.round(fps * 7.8);
  const toastOp = interpolate(frame, [toastStart, toastStart + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const toastTy = interpolate(frame, [toastStart, toastStart + 22], [24, 0], {
    easing: EASE.appleSpring,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const windowOpacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const windowScale = interpolate(frame, [0, fps * 0.5], [0.96, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursor blink
  const cursorOn = Math.floor((frame / fps) * 2) % 2 === 0;

  return (
    <PinnedStage
      background_color={COLORS.bg}
      motion={{
        dolly: { from: 1.01, to: 1.0 },
        vignette: { from: 0.25, to: 0.4 },
        ambient: { from: 0.3, to: 0.5 },
      }}
      subject={
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          {/* Compose window */}
          <div
            style={{
              width: 1200,
              maxWidth: "100%",
              height: 720,
              borderRadius: 22,
              background: "rgba(22,22,26,0.94)",
              border: `0.5px solid ${COLORS.borderStrong}`,
              backdropFilter: "blur(20px)",
              boxShadow: "0 60px 140px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              opacity: windowOpacity,
              transform: `scale(${windowScale})`,
              fontFamily: TYPE.family,
            }}
          >
            {/* Window titlebar */}
            <div
              style={{
                height: 46,
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                background: "rgba(14,14,18,0.8)",
                borderBottom: `0.5px solid ${COLORS.border}`,
                gap: 14,
              }}
            >
              <div style={{ display: "flex", gap: 7 }}>
                {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
                  <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
                ))}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: COLORS.primary,
                  }}
                />
                New message · Draft auto-saved
              </div>
            </div>

            {/* Fields */}
            <HeaderField
              label="From"
              value={
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: COLORS.primaryGradient,
                      fontSize: 10,
                      fontWeight: TYPE.weight.bold,
                      color: "#0A0A0F",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    M
                  </div>
                  <span>mert@meridian.studio</span>
                  <span style={{ color: COLORS.textMuted, marginLeft: 6, fontSize: 12 }}>
                    · Gmail · 128/200 today
                  </span>
                </div>
              }
            />
            <HeaderField label="To" value={<span>{TO_EMAIL}</span>} />
            <HeaderField
              label="Subject"
              value={
                <span style={{ fontWeight: TYPE.weight.semibold, color: COLORS.text }}>
                  {typedSubject}
                  {subjectProgress > 0 && subjectProgress < 1 && cursorOn && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 17,
                        marginLeft: 2,
                        background: COLORS.accent,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </span>
              }
            />

            {/* Body */}
            <div
              style={{
                flex: 1,
                padding: "24px 26px",
                fontSize: 15,
                color: COLORS.text,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                fontFamily: TYPE.family,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {typedBody}
              {bodyProgress > 0 && bodyProgress < 1 && cursorOn && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 18,
                    marginLeft: 2,
                    background: COLORS.accent,
                    verticalAlign: "middle",
                  }}
                />
              )}

              {/* Inline personalization hints — faint chips tying copy to audit signals */}
              {bodyProgress > 0.25 && (
                <div
                  style={{
                    position: "absolute",
                    right: 26,
                    top: 26,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    opacity: interpolate(bodyProgress, [0.25, 0.4], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  <div
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: `${COLORS.danger}15`,
                      border: `0.5px solid ${COLORS.danger}55`,
                      fontSize: 11,
                      color: COLORS.danger,
                      fontWeight: TYPE.weight.semibold,
                      letterSpacing: TYPE.tracking.eyebrow,
                      textTransform: "uppercase",
                    }}
                  >
                    ↳ from audit · HTTPS
                  </div>
                  <div
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: `${COLORS.danger}15`,
                      border: `0.5px solid ${COLORS.danger}55`,
                      fontSize: 11,
                      color: COLORS.danger,
                      fontWeight: TYPE.weight.semibold,
                      letterSpacing: TYPE.tracking.eyebrow,
                      textTransform: "uppercase",
                    }}
                  >
                    ↳ from audit · booking
                  </div>
                  <div
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: `${COLORS.warning}15`,
                      border: `0.5px solid ${COLORS.warning}55`,
                      fontSize: 11,
                      color: COLORS.warning,
                      fontWeight: TYPE.weight.semibold,
                      letterSpacing: TYPE.tracking.eyebrow,
                      textTransform: "uppercase",
                    }}
                  >
                    ↳ from reviews · 4.8★
                  </div>
                </div>
              )}
            </div>

            {/* Footer toolbar */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: `0.5px solid ${COLORS.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {["Bold", "Italic", "Link", "Attach", "Emoji"].map((t) => (
                  <div
                    key={t}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      border: `0.5px solid ${COLORS.border}`,
                      fontSize: 11,
                      color: COLORS.textMuted,
                    }}
                  >
                    {t}
                  </div>
                ))}
                <div
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "rgba(94,106,210,0.14)",
                    border: `0.5px solid rgba(94,106,210,0.45)`,
                    fontSize: 11,
                    color: COLORS.accent,
                    fontWeight: TYPE.weight.semibold,
                  }}
                >
                  ✦ AI · rewrite warmer
                </div>
              </div>
              <div
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: COLORS.primary,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: TYPE.weight.semibold,
                  transform: `scale(${sendPulse})`,
                  boxShadow: sendPulse > 1 ? `0 0 30px ${COLORS.primary}99` : "none",
                }}
              >
                Send →
              </div>
            </div>

            {/* Sent toast */}
            <div
              style={{
                position: "absolute",
                bottom: 92,
                right: 40,
                padding: "12px 18px",
                borderRadius: 12,
                background: "rgba(52,211,153,0.15)",
                border: `0.5px solid ${COLORS.success}66`,
                backdropFilter: "blur(20px)",
                opacity: toastOp,
                transform: `translateY(${toastTy}px)`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: COLORS.success,
                fontWeight: TYPE.weight.semibold,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.success,
                  boxShadow: `0 0 10px ${COLORS.success}`,
                }}
              />
              Sent · reply-tracked · pipeline → Contacted
            </div>
          </div>
        </AbsoluteFill>
      }
      overlay={
        <TitleCard
          text="The opener writes itself."
          appearAtFrame={Math.round(fps * 4.0)}
          durationFrames={durationInFrames - Math.round(fps * 4.0)}
          position="bottom"
          size="subhead"
        />
      }
    />
  );
};
