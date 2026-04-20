/**
 * SCENE 16 — "Four tiers. Pro Solo is where 80% of you start." (6s)
 *
 * Pricing page. Four plan cards rise in with stagger; the "Pro Solo"
 * card scales up and is highlighted with accent glow. Mirrors the real
 * /pricing marketing page, taglines from lib/plans.ts.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TitleCard } from "../primitives/TitleCard";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

interface Plan {
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "£0",
    cadence: "forever",
    tagline: "Test it on your next prospect list.",
    features: ["25 leads / mo", "1 workspace", "Manual exports"],
  },
  {
    name: "Pro Solo",
    price: "£39",
    cadence: "per month",
    tagline: "For solo SDRs and vertical specialists.",
    features: [
      "300 leads / mo",
      "Unlimited audits",
      "Per-lead mockups",
      "AI copilot",
    ],
    highlight: true,
  },
  {
    name: "Pro Team",
    price: "£89",
    cadence: "per month",
    tagline: "For walk-in web agency starters.",
    features: [
      "1,000 leads / mo",
      "5 seats",
      "Gmail + Outlook OAuth",
      "Public mockups",
    ],
  },
  {
    name: "Agency",
    price: "£249",
    cadence: "per month",
    tagline: "For agencies running outbound for clients.",
    features: [
      "5,000 leads / mo",
      "Unlimited seats",
      "White-label branding",
      "Priority inference",
    ],
  },
];

const PlanCard: React.FC<{ plan: Plan; appear: number; frame: number; fps: number }> = ({
  plan,
  appear,
  frame,
  fps,
}) => {
  const local = frame - appear;
  const opacity = interpolate(local, [0, 18], [0, 1], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(local, [0, 26], [60, 0], {
    easing: EASE.appleSpring,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const glow = interpolate(frame, [appear + fps, appear + fps * 2], [0, plan.highlight ? 1 : 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${ty}px) scale(${plan.highlight ? 1.04 : 1.0})`,
        padding: "28px 24px",
        borderRadius: 22,
        background: plan.highlight
          ? "linear-gradient(180deg, rgba(94,106,210,0.18) 0%, rgba(22,22,26,0.95) 55%)"
          : "rgba(22,22,26,0.82)",
        border: plan.highlight
          ? `1px solid rgba(94,106,210,0.6)`
          : `0.5px solid ${COLORS.borderStrong}`,
        boxShadow: plan.highlight
          ? `0 40px 100px rgba(94,106,210,${0.25 + glow * 0.25})`
          : `0 12px 36px rgba(0,0,0,0.4)`,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: 420,
      }}
    >
      {plan.highlight && (
        <div
          style={{
            alignSelf: "flex-start",
            padding: "5px 12px",
            borderRadius: 999,
            background: COLORS.primary,
            color: "#fff",
            fontSize: 11,
            fontWeight: TYPE.weight.bold,
            letterSpacing: TYPE.tracking.eyebrow,
            textTransform: "uppercase",
          }}
        >
          Most popular
        </div>
      )}
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: TYPE.tracking.eyebrow,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            fontWeight: TYPE.weight.semibold,
          }}
        >
          {plan.tagline}
        </div>
        <div
          style={{
            fontSize: 30,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: TYPE.tracking.subhead,
            color: COLORS.text,
            marginTop: 6,
          }}
        >
          {plan.name}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: TYPE.tracking.display,
            color: plan.highlight ? COLORS.accent : COLORS.text,
            lineHeight: 1,
          }}
        >
          {plan.price}
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>{plan.cadence}</div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          paddingTop: 10,
          borderTop: `0.5px solid ${COLORS.border}`,
        }}
      >
        {plan.features.map((f) => (
          <div
            key={f}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              color: COLORS.text,
            }}
          >
            <span
              style={{
                color: plan.highlight ? COLORS.accent : COLORS.success,
                fontSize: 16,
              }}
            >
              ✓
            </span>
            {f}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          padding: "12px 16px",
          borderRadius: 12,
          background: plan.highlight ? COLORS.primary : "rgba(255,255,255,0.05)",
          color: plan.highlight ? "#fff" : COLORS.text,
          fontSize: 14,
          fontWeight: TYPE.weight.semibold,
          textAlign: "center",
          border: plan.highlight ? "none" : `0.5px solid ${COLORS.borderStrong}`,
        }}
      >
        {plan.name === "Free" ? "Start free" : "Start 7-day trial"}
      </div>
    </div>
  );
};

export const Pricing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 70% 50% at 50% 35%, rgba(94,106,210,0.2) 0%, rgba(10,10,15,0) 60%), ${COLORS.bg}`,
        padding: "80px 80px 40px",
        fontFamily: TYPE.family,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ opacity: headerOpacity, textAlign: "center", marginBottom: 40 }}>
        <div
          style={{
            fontSize: 13,
            letterSpacing: TYPE.tracking.eyebrow,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            fontWeight: TYPE.weight.semibold,
            marginBottom: 10,
          }}
        >
          Pricing
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: TYPE.weight.semibold,
            letterSpacing: TYPE.tracking.display,
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          Half the price of a Clay setup.
        </div>
        <div style={{ fontSize: 18, color: COLORS.textMuted }}>
          Mockups included. Cancel anytime.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 18,
          flex: 1,
        }}
      >
        {PLANS.map((p, i) => (
          <PlanCard
            key={p.name}
            plan={p}
            appear={Math.round(fps * (0.6 + i * 0.2))}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>

      <TitleCard
        text="Four tiers. Solo is where 80% of you start."
        appearAtFrame={Math.round(fps * 3.6)}
        durationFrames={durationInFrames - Math.round(fps * 3.6)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
