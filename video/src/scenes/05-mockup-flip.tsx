/**
 * SCENE 05 — "Hand them a draft. Not a deck." (12s) — rebuilt without plate.
 *
 * Three hand-drawn website mockup cards (indigo dentist, emerald legal,
 * warm interiors) rotate in on a CSS 3D carousel. Each mockup is a full
 * browser-framed page with distinct hero art, nav, service grid, CTA,
 * and footer — no captured assets.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TitleCard } from "../primitives/TitleCard";
import { PinnedStage } from "../primitives/PinnedStage";
import { COLORS, PARALLAX, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

type VariantId = "indigo" | "emerald" | "warm";

interface Variant {
  id: VariantId;
  brand: string;
  url: string;
  tagline: string;
  headline: string;
  sub: string;
  cta: string;
  accent: string;
  accentSoft: string;
  bg: string;
  surface: string;
  textOnHero: string;
  services: string[];
}

const VARIANTS: Variant[] = [
  {
    id: "indigo",
    brand: "Meridian Dental",
    url: "meridiandental.co.uk",
    tagline: "Gentle dentistry, SW7",
    headline: "Book in 60 seconds.",
    sub: "Same-day emergency slots · Pay in 3 interest-free.",
    cta: "Book now",
    accent: "#5E6AD2",
    accentSoft: "rgba(94,106,210,0.18)",
    bg: "linear-gradient(135deg, #0E0E18 0%, #151530 100%)",
    surface: "rgba(255,255,255,0.05)",
    textOnHero: "#ECECF7",
    services: ["Check-up", "Whitening", "Invisalign", "Emergency"],
  },
  {
    id: "emerald",
    brand: "Kensington Legal",
    url: "kensingtonlegal.co.uk",
    tagline: "Property law · family · wills",
    headline: "Clear advice. Fixed fees.",
    sub: "Booked online · answered in 24 hours · SRA regulated.",
    cta: "Book a consult",
    accent: "#34D399",
    accentSoft: "rgba(52,211,153,0.18)",
    bg: "linear-gradient(135deg, #0A1512 0%, #0E2A22 100%)",
    surface: "rgba(255,255,255,0.05)",
    textOnHero: "#E8F7EF",
    services: ["Property", "Family", "Wills", "Immigration"],
  },
  {
    id: "warm",
    brand: "SW7 Interiors",
    url: "sw7interiors.co.uk",
    tagline: "Interior design · bespoke joinery",
    headline: "Rooms that feel like home.",
    sub: "Full-service design, 6-week turnarounds, fixed quotes.",
    cta: "See portfolio",
    accent: "#F97362",
    accentSoft: "rgba(249,115,98,0.18)",
    bg: "linear-gradient(135deg, #1A1110 0%, #2D1814 100%)",
    surface: "rgba(255,255,255,0.05)",
    textOnHero: "#FCEEE9",
    services: ["Residential", "Kitchen", "Boutique", "Consult"],
  },
];

const BrowserFrame: React.FC<{ url: string; children: React.ReactNode }> = ({ url, children }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      borderRadius: 22,
      overflow: "hidden",
      background: COLORS.panel,
      border: `1px solid ${COLORS.borderStrong}`,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 60px 140px rgba(0,0,0,0.55)",
    }}
  >
    {/* Top chrome */}
    <div
      style={{
        height: 38,
        padding: "0 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(12,12,16,0.7)",
        borderBottom: `0.5px solid ${COLORS.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", gap: 7 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          height: 22,
          borderRadius: 6,
          background: "rgba(255,255,255,0.05)",
          border: `0.5px solid ${COLORS.border}`,
          padding: "0 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: COLORS.textMuted,
          fontFamily: "'JetBrains Mono', monospace",
          maxWidth: 520,
          margin: "0 auto",
        }}
      >
        <span style={{ marginRight: 8, color: COLORS.success }}>●</span>
        https://{url}
      </div>
      <div style={{ width: 40 }} />
    </div>
    {/* Page body */}
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>{children}</div>
  </div>
);

const WebsiteMockup: React.FC<{ variant: Variant; frame: number; fps: number }> = ({
  variant,
  frame,
  fps,
}) => {
  const buildProgress = interpolate(frame, [0, fps * 3.5], [0, 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <BrowserFrame url={variant.url}>
      <div
        style={{
          height: "100%",
          background: variant.bg,
          color: variant.textOnHero,
          display: "flex",
          flexDirection: "column",
          fontFamily: TYPE.family,
        }}
      >
        {/* Top nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "22px 34px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: variant.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: TYPE.weight.bold,
                color: "#0A0A0F",
                fontSize: 15,
              }}
            >
              {variant.brand[0]}
            </div>
            <div style={{ fontWeight: TYPE.weight.semibold, fontSize: 16 }}>{variant.brand}</div>
          </div>
          <div style={{ display: "flex", gap: 22, fontSize: 13, color: variant.textOnHero, opacity: 0.7 }}>
            {["Services", "About", "Reviews", "Contact"].map((l) => (
              <div key={l}>{l}</div>
            ))}
            <div
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: variant.accent,
                color: "#0A0A0F",
                fontWeight: TYPE.weight.semibold,
              }}
            >
              {variant.cta}
            </div>
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            flex: 1.2,
            padding: "34px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              letterSpacing: TYPE.tracking.eyebrow,
              textTransform: "uppercase",
              color: variant.accent,
              fontWeight: TYPE.weight.semibold,
              opacity: buildProgress > 0.1 ? 1 : 0,
            }}
          >
            {variant.tagline}
          </div>
          <div
            style={{
              fontSize: 64,
              lineHeight: 1.05,
              fontWeight: TYPE.weight.semibold,
              letterSpacing: TYPE.tracking.display,
              color: variant.textOnHero,
              maxWidth: 720,
            }}
          >
            {variant.headline}
          </div>
          <div
            style={{
              fontSize: 19,
              color: variant.textOnHero,
              opacity: 0.75,
              maxWidth: 620,
              lineHeight: 1.45,
            }}
          >
            {variant.sub}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <div
              style={{
                padding: "14px 26px",
                borderRadius: 12,
                background: variant.accent,
                color: "#0A0A0F",
                fontSize: 16,
                fontWeight: TYPE.weight.semibold,
              }}
            >
              {variant.cta} →
            </div>
            <div
              style={{
                padding: "14px 26px",
                borderRadius: 12,
                background: "transparent",
                color: variant.textOnHero,
                fontSize: 16,
                fontWeight: TYPE.weight.semibold,
                border: `1px solid rgba(255,255,255,0.18)`,
              }}
            >
              Meet the team
            </div>
          </div>
        </div>

        {/* Services grid */}
        <div
          style={{
            flex: 1,
            padding: "26px 56px 42px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          {variant.services.map((s, i) => {
            const itemP = interpolate(
              buildProgress,
              [0.3 + i * 0.08, 0.5 + i * 0.08],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <div
                key={s}
                style={{
                  opacity: itemP,
                  transform: `translateY(${(1 - itemP) * 16}px)`,
                  padding: "18px 18px 22px",
                  borderRadius: 14,
                  background: variant.surface,
                  border: `0.5px solid rgba(255,255,255,0.08)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: variant.accentSoft,
                    border: `0.5px solid ${variant.accent}55`,
                  }}
                />
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: TYPE.weight.semibold,
                    color: variant.textOnHero,
                  }}
                >
                  {s}
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    marginBottom: 4,
                  }}
                />
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.05)",
                    width: "70%",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Footer bar */}
        <div
          style={{
            padding: "12px 34px",
            borderTop: `0.5px solid rgba(255,255,255,0.08)`,
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>© {variant.brand}</span>
          <span>Booking · Privacy · Terms</span>
        </div>
      </div>
    </BrowserFrame>
  );
};

interface CardState {
  rotY: number;
  tx: number;
  opacity: number;
  active: boolean;
}

export const MockupFlip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const slotDur = durationInFrames / VARIANTS.length;
  const transitionF = Math.round(fps * 0.6);

  const cardState = (i: number): CardState => {
    const center = i * slotDur + slotDur / 2;
    const d = frame - center;
    const half = slotDur / 2;

    const rotY = interpolate(
      d,
      [-half, -half + transitionF, half - transitionF, half],
      [75, 0, 0, -75],
      { easing: EASE.appleInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const tx = interpolate(
      d,
      [-half, -half + transitionF, half - transitionF, half],
      [260, 0, 0, -260],
      { easing: EASE.appleInOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const opacity = interpolate(
      d,
      [-half, -half + transitionF * 0.6, half - transitionF * 0.6, half],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    const active = Math.abs(d) < half - transitionF;
    return { rotY, tx, opacity, active };
  };

  return (
    <PinnedStage
      background_color={COLORS.bg}
      motion={{
        dolly: { from: 1.0, to: 1.02 },
        vignette: { from: 0.3, to: 0.4 },
        ambient: { from: 0.4, to: 0.55 },
      }}
      subject={
        <AbsoluteFill
          style={{
            perspective: PARALLAX.perspective,
            perspectiveOrigin: "50% 50%",
          }}
        >
          <AbsoluteFill style={{ transformStyle: "preserve-3d" }}>
            {VARIANTS.map((v, i) => {
              const s = cardState(i);
              // Frame counter local to this card's active slot for build animations
              const localFrame = frame - i * slotDur;
              const activeGlow = s.active ? v.accent : "transparent";
              return (
                <div
                  key={v.id}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 1180,
                    height: 740,
                    marginLeft: -590,
                    marginTop: -370,
                    transform: `translateX(${s.tx}px) rotateY(${s.rotY}deg)`,
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                    opacity: s.opacity,
                    boxShadow: `0 70px 160px rgba(0,0,0,0.6), 0 0 120px ${
                      s.active ? activeGlow + "55" : "transparent"
                    }`,
                    borderRadius: 24,
                  }}
                >
                  <WebsiteMockup variant={v} frame={Math.max(0, localFrame)} fps={fps} />
                </div>
              );
            })}
          </AbsoluteFill>
        </AbsoluteFill>
      }
      overlay={
        <TitleCard
          text="Hand them a draft. Not a deck."
          appearAtFrame={Math.round(fps * 0.5)}
          durationFrames={durationInFrames - Math.round(fps * 0.5)}
          position="bottom"
          size="subhead"
        />
      }
    />
  );
};
