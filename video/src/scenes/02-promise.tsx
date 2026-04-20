/**
 * SCENE 02 — "Type a postcode. Pick a niche." (5s) — rebuilt as a real form.
 *
 * A faithful reproduction of the /app/discovery hero input:
 *
 *   0.0–0.4s  Card fades + scales in. Header "Find leads near you".
 *   0.4–1.6s  Postcode input focuses; "SW7" types in with a blinking caret.
 *   1.6–2.6s  Niche picker dropdown opens; options stagger in; mouse hovers
 *             "Dentists" (pill glows), picker closes with it selected.
 *   2.6–3.1s  Radius chip "2 miles" gets selected with a spring pop.
 *   3.1–3.6s  Primary CTA activates (inert → live gradient) and pulses.
 *   3.6–4.0s  Button "pressed" (scales down) and flips into a searching
 *             state with a spinner + "Searching Google Maps…" copy.
 *   4.0–5.0s  Chip strip "+47 leads · 4.2s · SW7" slides up from below.
 *
 * Behind the card: a hand-drawn London street grid with a soft map blob
 * that pulses once during the search.
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

const POSTCODE = "SW7";

const NICHES = [
  { id: "dentists", label: "Dentists", icon: "🦷", hint: "Health · 4.2k UK" },
  { id: "plumbers", label: "Plumbers", icon: "🔧", hint: "Trades · 18k UK" },
  { id: "solicitors", label: "Solicitors", icon: "⚖", hint: "Legal · 9.3k UK" },
  { id: "salons", label: "Hair salons", icon: "✂", hint: "Beauty · 22k UK" },
  { id: "tutors", label: "Tutors", icon: "🎓", hint: "Education · 6k UK" },
];

const RADII = [
  { id: "1", label: "1 mi" },
  { id: "2", label: "2 mi" },
  { id: "5", label: "5 mi" },
  { id: "10", label: "10 mi" },
];

const MapBackdrop: React.FC<{ frame: number; fps: number; searchStart: number }> = ({
  frame,
  fps,
  searchStart,
}) => {
  // Single radar pulse during the "searching" phase.
  const pulseStart = searchStart;
  const pulseDur = fps * 0.9;
  const pulseT = interpolate(frame, [pulseStart, pulseStart + pulseDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringR = interpolate(pulseT, [0, 1], [60, 420]);
  const ringOpacity = interpolate(pulseT, [0, 0.1, 1], [0, 0.6, 0]);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.4,
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="mapGrid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5E6AD2" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#5E6AD2" stopOpacity={0} />
          </linearGradient>
          <radialGradient id="mapBlob" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5E6AD2" stopOpacity={0.35} />
            <stop offset="60%" stopColor="#5E6AD2" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#5E6AD2" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Soft blob */}
        <ellipse cx="960" cy="540" rx="720" ry="460" fill="url(#mapBlob)" />

        {/* Street grid — straight roads */}
        {Array.from({ length: 14 }).map((_, i) => (
          <line
            key={`h${i}`}
            x1={0}
            y1={78 * (i + 1)}
            x2={1920}
            y2={78 * (i + 1)}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={110 * (i + 1)}
            y1={0}
            x2={110 * (i + 1)}
            y2={1080}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {/* Diagonal crossing to suggest the Thames */}
        <path
          d="M 0 680 Q 320 620 640 700 T 1280 720 T 1920 760"
          stroke="rgba(94,106,210,0.35)"
          strokeWidth={3}
          fill="none"
          opacity={0.6}
        />

        {/* Postcode POI marker at the map center */}
        <g transform="translate(960 540)">
          {/* Radar pulse */}
          <circle
            cx={0}
            cy={0}
            r={ringR}
            fill="none"
            stroke="#A5B4FC"
            strokeWidth={1.5}
            opacity={ringOpacity}
          />
          {/* Fixed outer halo */}
          <circle cx={0} cy={0} r={36} fill="#5E6AD2" opacity={0.25} />
          <circle cx={0} cy={0} r={14} fill="#A5B4FC" opacity={0.9} />
          <circle cx={0} cy={0} r={5} fill="#FFFFFF" />
        </g>

        {/* Faint POI dots scattered where nearby businesses are */}
        {[
          [800, 420],
          [1120, 460],
          [860, 640],
          [1080, 620],
          [720, 560],
          [1180, 520],
          [940, 380],
          [1020, 700],
        ].map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="#A5B4FC"
            opacity={0.5 + (i % 3) * 0.15}
          />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

export const Promise: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ------------------------------- Timings -------------------------------
  const CARD_IN = 0;
  const TYPE_START = Math.round(fps * 0.5);
  const TYPE_DUR = Math.round(fps * 1.0); // 3 chars
  const PICKER_OPEN = Math.round(fps * 1.7);
  const PICKER_HOVER = Math.round(fps * 2.1);
  const PICKER_SELECT = Math.round(fps * 2.5);
  const PICKER_CLOSE = Math.round(fps * 2.7);
  const RADIUS_SELECT = Math.round(fps * 2.9);
  const CTA_LIVE = Math.round(fps * 3.2);
  const CTA_PRESS = Math.round(fps * 3.6);
  const SEARCH_START = Math.round(fps * 3.75);
  const COUNT_IN = Math.round(fps * 4.3);

  // ------------------------- Card entry animation ------------------------
  const cardOpacity = interpolate(frame, [CARD_IN, CARD_IN + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardScale = interpolate(frame, [CARD_IN, CARD_IN + 18], [0.96, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ---------------------------- Postcode typing --------------------------
  const charsTyped = Math.max(
    0,
    Math.min(POSTCODE.length, Math.floor((frame - TYPE_START) / (TYPE_DUR / POSTCODE.length))),
  );
  const typed = POSTCODE.slice(0, charsTyped);
  const focused = frame >= TYPE_START && frame < PICKER_OPEN - 4;
  const caretOn = Math.floor((frame / fps) * 2.5) % 2 === 0;

  // --------------------------- Picker animation --------------------------
  const pickerOpen = frame >= PICKER_OPEN && frame < PICKER_CLOSE + 6;
  const pickerT = interpolate(frame, [PICKER_OPEN, PICKER_OPEN + 10], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pickerClose = interpolate(frame, [PICKER_CLOSE, PICKER_CLOSE + 10], [1, 0], {
    easing: EASE.appleIn,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pickerAlpha = Math.min(pickerT, pickerClose);

  const nichePicked = frame >= PICKER_SELECT ? "dentists" : null;

  // -------------------------- Radius chip select -------------------------
  const radiusPop = interpolate(
    frame,
    [RADIUS_SELECT, RADIUS_SELECT + 10, RADIUS_SELECT + 22],
    [1, 1.15, 1],
    { easing: EASE.appleSpring, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const radiusSelected = frame >= RADIUS_SELECT;

  // ------------------------------- CTA -----------------------------------
  const ctaLive = frame >= CTA_LIVE;
  const ctaPulse = interpolate(
    frame,
    [CTA_LIVE, CTA_LIVE + 12, CTA_LIVE + 24, CTA_LIVE + 36],
    [1, 1.03, 1, 1],
    { easing: EASE.appleOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const ctaPressScale = interpolate(
    frame,
    [CTA_PRESS, CTA_PRESS + 5, CTA_PRESS + 12],
    [1, 0.96, 1],
    { easing: EASE.appleInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const searching = frame >= SEARCH_START && frame < COUNT_IN + 20;

  // Spinner rotation
  const spin = ((frame - SEARCH_START) / fps) * 360 * 1.2;

  // Count slide-up
  const countOpacity = interpolate(frame, [COUNT_IN, COUNT_IN + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const countTy = interpolate(frame, [COUNT_IN, COUNT_IN + 20], [24, 0], {
    easing: EASE.appleSpring,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <PinnedStage
      background_color={COLORS.bg}
      motion={{
        dolly: { from: 1.02, to: 1.0 },
        vignette: { from: 0.25, to: 0.4 },
        ambient: { from: 0.3, to: 0.55 },
      }}
      background={<MapBackdrop frame={frame} fps={fps} searchStart={SEARCH_START} />}
      subject={
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 820,
              opacity: cardOpacity,
              transform: `scale(${cardScale})`,
              padding: "38px 40px 34px",
              borderRadius: 28,
              background: "rgba(22,22,26,0.92)",
              border: `0.5px solid ${COLORS.borderStrong}`,
              backdropFilter: "blur(30px)",
              boxShadow: "0 60px 160px rgba(0,0,0,0.55), 0 0 90px rgba(94,106,210,0.15)",
              fontFamily: TYPE.family,
              display: "flex",
              flexDirection: "column",
              gap: 22,
              position: "relative",
            }}
          >
            {/* Eyebrow + title */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: COLORS.textDim,
                  fontWeight: TYPE.weight.semibold,
                  marginBottom: 8,
                }}
              >
                Discovery
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: TYPE.weight.semibold,
                  letterSpacing: TYPE.tracking.subhead,
                  color: COLORS.text,
                }}
              >
                Find leads near you
              </div>
            </div>

            {/* Row 1: Postcode input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: COLORS.textDim,
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                Postcode
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 18px",
                  height: 62,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: focused
                    ? `1px solid rgba(94,106,210,0.65)`
                    : `0.5px solid ${COLORS.border}`,
                  boxShadow: focused
                    ? "0 0 0 4px rgba(94,106,210,0.18)"
                    : "none",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    color: COLORS.textMuted,
                    fontWeight: TYPE.weight.semibold,
                  }}
                >
                  ⌖
                </div>
                <div
                  style={{
                    flex: 1,
                    fontSize: 22,
                    fontWeight: TYPE.weight.semibold,
                    color: typed ? COLORS.text : COLORS.textDim,
                    letterSpacing: 2,
                    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
                  }}
                >
                  {typed || "e.g. SW7"}
                  {focused && caretOn && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 3,
                        height: 26,
                        marginLeft: 4,
                        background: COLORS.accent,
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                </div>
                {typed.length === POSTCODE.length && (
                  <div
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: `${COLORS.success}18`,
                      border: `0.5px solid ${COLORS.success}66`,
                      fontSize: 11,
                      color: COLORS.success,
                      fontWeight: TYPE.weight.semibold,
                      letterSpacing: TYPE.tracking.eyebrow,
                      textTransform: "uppercase",
                      opacity: interpolate(
                        frame,
                        [TYPE_START + TYPE_DUR, TYPE_START + TYPE_DUR + 10],
                        [0, 1],
                        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                      ),
                    }}
                  >
                    South Kensington
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Niche picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: COLORS.textDim,
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                Niche
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 18px",
                  height: 62,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: pickerOpen
                    ? `1px solid rgba(94,106,210,0.65)`
                    : `0.5px solid ${COLORS.border}`,
                  boxShadow: pickerOpen ? "0 0 0 4px rgba(94,106,210,0.18)" : "none",
                  justifyContent: "space-between",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 18,
                    fontWeight: TYPE.weight.semibold,
                    color: nichePicked ? COLORS.text : COLORS.textDim,
                  }}
                >
                  <span style={{ fontSize: 22 }}>{nichePicked ? "🦷" : "…"}</span>
                  {nichePicked ? "Dentists" : "Pick a category"}
                </div>
                <div
                  style={{
                    fontSize: 16,
                    color: COLORS.textMuted,
                    transform: pickerOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "none",
                  }}
                >
                  ▾
                </div>
              </div>

              {/* Picker dropdown */}
              {pickerAlpha > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 96,
                    left: 0,
                    right: 0,
                    padding: 10,
                    borderRadius: 16,
                    background: "rgba(18,18,22,0.96)",
                    border: `0.5px solid ${COLORS.borderStrong}`,
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
                    opacity: pickerAlpha,
                    transform: `translateY(${(1 - pickerAlpha) * -8}px)`,
                    zIndex: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {NICHES.map((n, i) => {
                    const appear = PICKER_OPEN + i * 4;
                    const itemOp = interpolate(frame, [appear, appear + 10], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    });
                    const hovered = n.id === "dentists" && frame >= PICKER_HOVER;
                    return (
                      <div
                        key={n.id}
                        style={{
                          opacity: itemOp,
                          padding: "11px 14px",
                          borderRadius: 10,
                          background: hovered
                            ? "rgba(94,106,210,0.22)"
                            : "transparent",
                          border: hovered
                            ? `0.5px solid rgba(94,106,210,0.5)`
                            : "0.5px solid transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 18 }}>{n.icon}</span>
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: TYPE.weight.semibold,
                              color: COLORS.text,
                            }}
                          >
                            {n.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: COLORS.textMuted }}>{n.hint}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Row 3: Radius chips */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: COLORS.textDim,
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                Search radius
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {RADII.map((r) => {
                  const selected = r.id === "2" && radiusSelected;
                  const scale = selected ? radiusPop : 1;
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 12,
                        background: selected
                          ? "rgba(94,106,210,0.22)"
                          : "rgba(255,255,255,0.04)",
                        border: selected
                          ? `0.5px solid rgba(94,106,210,0.55)`
                          : `0.5px solid ${COLORS.border}`,
                        fontSize: 14,
                        fontWeight: TYPE.weight.semibold,
                        color: selected ? COLORS.accent : COLORS.textMuted,
                        transform: `scale(${scale})`,
                      }}
                    >
                      {r.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div
              style={{
                marginTop: 6,
                padding: "18px 22px",
                borderRadius: 16,
                background: ctaLive
                  ? "linear-gradient(120deg, #5E6AD2 0%, #8590FF 50%, #A5B4FC 100%)"
                  : "rgba(255,255,255,0.04)",
                border: ctaLive ? "none" : `0.5px solid ${COLORS.border}`,
                color: ctaLive ? "#FFFFFF" : COLORS.textDim,
                fontSize: 17,
                fontWeight: TYPE.weight.semibold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                transform: `scale(${ctaPulse * ctaPressScale})`,
                boxShadow: ctaLive
                  ? "0 16px 40px rgba(94,106,210,0.4), 0 0 0 1px rgba(165,180,252,0.35)"
                  : "none",
                cursor: "default",
                letterSpacing: TYPE.tracking.body,
              }}
            >
              {searching ? (
                <>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#FFFFFF",
                      transform: `rotate(${spin}deg)`,
                    }}
                  />
                  Searching Google Maps · SW7
                </>
              ) : (
                <>
                  {ctaLive ? "Find leads" : "Fill both fields"}
                  {ctaLive && <span style={{ marginLeft: 2 }}>→</span>}
                </>
              )}
            </div>

            {/* Result chip strip */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 10,
                opacity: countOpacity,
                transform: `translateY(${countTy}px)`,
                marginTop: -4,
              }}
            >
              {[
                { label: "47 leads", color: COLORS.success, big: true },
                { label: "4.2 sec", color: COLORS.accent },
                { label: "SW7 · 2 mi", color: COLORS.textMuted },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    background: `${c.color}14`,
                    border: `0.5px solid ${c.color}55`,
                    color: c.color,
                    fontSize: c.big ? 14 : 12,
                    fontWeight: TYPE.weight.semibold,
                    letterSpacing: TYPE.tracking.eyebrow,
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {c.big && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: c.color,
                        boxShadow: `0 0 8px ${c.color}`,
                      }}
                    />
                  )}
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        </AbsoluteFill>
      }
      overlay={
        <TitleCard
          text="Type a postcode. Pick a niche."
          appearAtFrame={Math.round(fps * 0.2)}
          durationFrames={durationInFrames - Math.round(fps * 0.2)}
          position="bottom"
          size="subhead"
        />
      }
    />
  );
};
