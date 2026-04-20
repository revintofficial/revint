/**
 * SCENE 15 — "Make it yours in a minute." (5s)
 *
 * Settings sweep. Four stacked cards representing the real settings
 * routes — Offer (AI context), Branding (agency logo/colors), Email
 * (Gmail/Outlook OAuth), Billing (Stripe portal) — each camera-panning
 * past like a sidebar scroll.
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

interface SettingCard {
  title: string;
  eyebrow: string;
  body: React.ReactNode;
}

const OfferCard: React.FC = () => (
  <div>
    <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>
      What you sell · grounds every AI draft
    </div>
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: "rgba(255,255,255,0.05)",
        border: `0.5px solid ${COLORS.border}`,
        fontSize: 15,
        lineHeight: 1.55,
        color: COLORS.text,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      Build conversion-first dental sites in 14 days. Flat £3,900.
      Includes booking widget, GDC trust block, and 6-week growth
      plan.
    </div>
    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
      {["£3,900 flat", "14-day build", "Booking widget"].map((c) => (
        <div
          key={c}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(94,106,210,0.15)",
            border: `0.5px solid rgba(94,106,210,0.4)`,
            fontSize: 12,
            color: COLORS.text,
          }}
        >
          {c}
        </div>
      ))}
    </div>
  </div>
);

const BrandingCard: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <div
      style={{
        width: 100,
        height: 100,
        borderRadius: 20,
        background: "linear-gradient(135deg, #5E6AD2 0%, #A5B4FC 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 40,
        fontWeight: TYPE.weight.bold,
        color: "#0A0A0F",
      }}
    >
      M
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 16, fontWeight: TYPE.weight.semibold }}>
        Meridian Studio
      </div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>
        Used on every mockup, email sig, and CSV export
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {["#5E6AD2", "#0A0A0F", "#A5B4FC"].map((c) => (
          <div
            key={c}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: c,
              border: `0.5px solid ${COLORS.borderStrong}`,
            }}
          />
        ))}
      </div>
    </div>
  </div>
);

const EmailCard: React.FC = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {[
      { provider: "Gmail", addr: "mert@meridian.studio", sent: 128, cap: 200 },
      { provider: "Outlook", addr: "hello@meridian.studio", sent: 44, cap: 150 },
    ].map((a) => (
      <div
        key={a.provider}
        style={{
          padding: 14,
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: `0.5px solid ${COLORS.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: TYPE.weight.semibold }}>
            {a.provider} · {a.addr}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            {a.sent}/{a.cap} sent today · auto-tracked replies
          </div>
        </div>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: "rgba(52,211,153,0.15)",
            color: COLORS.success,
            fontSize: 12,
            fontWeight: TYPE.weight.semibold,
          }}
        >
          Connected
        </div>
      </div>
    ))}
  </div>
);

const BillingCard: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
    <div
      style={{
        padding: "14px 22px",
        borderRadius: 14,
        background:
          "linear-gradient(135deg, rgba(94,106,210,0.25) 0%, rgba(165,180,252,0.08) 100%)",
        border: `0.5px solid rgba(94,106,210,0.4)`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: COLORS.textMuted,
          textTransform: "uppercase",
          letterSpacing: TYPE.tracking.eyebrow,
          fontWeight: TYPE.weight.semibold,
        }}
      >
        Current plan
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: TYPE.weight.bold,
          marginTop: 4,
          color: COLORS.text,
        }}
      >
        Pro Solo
      </div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
        £39/mo · renews 12 May
      </div>
    </div>
    <div style={{ fontSize: 14, color: COLORS.textMuted, flex: 1 }}>
      Upgrade, downgrade, or cancel in one click through the Stripe portal.
      Receipts land in your email automatically.
    </div>
  </div>
);

const CARDS: SettingCard[] = [
  { title: "My offer", eyebrow: "AI context", body: <OfferCard /> },
  { title: "Agency branding", eyebrow: "Mockups + exports", body: <BrandingCard /> },
  { title: "Email accounts", eyebrow: "Gmail & Outlook", body: <EmailCard /> },
  { title: "Billing", eyebrow: "Stripe portal", body: <BillingCard /> },
];

export const SettingsSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // The stack scrolls from card 0 highlighted → card 3 highlighted.
  const t = interpolate(frame, [fps * 0.3, durationInFrames - fps * 0.3], [0, CARDS.length - 1], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AppChrome
        activeRoute="settings"
        title="Settings"
        subtitle="Offer, branding, email, billing — all in one place."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {CARDS.map((c, i) => {
            const distance = Math.abs(t - i);
            const active = distance < 0.5;
            const opacity = interpolate(distance, [0, 1.6], [1, 0.5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const scale = interpolate(distance, [0, 1], [1.0, 0.98], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={c.title}
                style={{
                  opacity,
                  transform: `scale(${scale})`,
                  transformOrigin: "center left",
                  padding: 22,
                  borderRadius: 18,
                  background: active
                    ? "rgba(28,28,34,0.92)"
                    : "rgba(20,20,24,0.72)",
                  border: active
                    ? `0.5px solid rgba(94,106,210,0.45)`
                    : `0.5px solid ${COLORS.border}`,
                  boxShadow: active ? "0 24px 60px rgba(0,0,0,0.5)" : "none",
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
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: TYPE.tracking.eyebrow,
                        textTransform: "uppercase",
                        color: COLORS.textDim,
                        fontWeight: TYPE.weight.semibold,
                      }}
                    >
                      {c.eyebrow}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: TYPE.weight.semibold,
                        letterSpacing: TYPE.tracking.subhead,
                        marginTop: 2,
                      }}
                    >
                      {c.title}
                    </div>
                  </div>
                  {active && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: COLORS.accent,
                        boxShadow: `0 0 12px ${COLORS.accent}`,
                      }}
                    />
                  )}
                </div>
                {c.body}
              </div>
            );
          })}
        </div>
      </AppChrome>

      <TitleCard
        text="Make it yours in a minute."
        appearAtFrame={Math.round(fps * 3.3)}
        durationFrames={durationInFrames - Math.round(fps * 3.3)}
        position="bottom"
        size="subhead"
      />
    </AbsoluteFill>
  );
};
