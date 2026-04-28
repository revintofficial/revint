"use client";

import React, { useState, useEffect } from "react";

export type OrbitIntegration = {
  name: string;
  /** Full-color logo under `public/integrations/` */
  logoSrc: string;
};

/** Three rings of integrations, inside-out by send proximity. Tooltips use partner names. */
export const INNER_RING_ORBIT: OrbitIntegration[] = [
  { name: "Gmail", logoSrc: "/integrations/gmail.svg" },
  { name: "Outlook", logoSrc: "/integrations/outlook.svg" },
  { name: "Smartlead", logoSrc: "/integrations/smartlead.svg" },
  { name: "Instantly", logoSrc: "/integrations/instantly.svg" },
  { name: "GoHighLevel", logoSrc: "/integrations/gohighlevel.svg" },
  { name: "Google Maps", logoSrc: "/integrations/googlemaps.svg" },
];

export const MIDDLE_RING_ORBIT: OrbitIntegration[] = [
  { name: "Synthflow", logoSrc: "/integrations/synthflow.svg" },
  { name: "Retell", logoSrc: "/integrations/retell.svg" },
  { name: "Vapi", logoSrc: "/integrations/vapi.svg" },
  { name: "Twilio", logoSrc: "/integrations/twilio.svg" },
  { name: "n8n", logoSrc: "/integrations/n8n.svg" },
  { name: "Make", logoSrc: "/integrations/make.svg" },
  { name: "Zapier", logoSrc: "/integrations/zapier.svg" },
  { name: "Calendly", logoSrc: "/integrations/calendly.svg" },
];

export const OUTER_RING_ORBIT: OrbitIntegration[] = [
  { name: "LinkedIn", logoSrc: "/integrations/linkedin.svg" },
  { name: "Apollo", logoSrc: "/integrations/apollo-io.svg" },
  { name: "Stripe", logoSrc: "/integrations/stripe.svg" },
  { name: "Slack", logoSrc: "/integrations/slack.svg" },
  { name: "Notion", logoSrc: "/integrations/notion.svg" },
  { name: "Airtable", logoSrc: "/integrations/airtable.svg" },
  { name: "Salesforce", logoSrc: "/integrations/salesforce.svg" },
  { name: "HubSpot", logoSrc: "/integrations/hubspot.svg" },
  { name: "Webhook", logoSrc: "/integrations/webhook.svg" },
  { name: "Web", logoSrc: "/integrations/web.svg" },
];

/** @deprecated Use ORBIT exports; kept for any old `icon` + Lucide props. */
export type Integration = OrbitIntegration;

type OrbitProps = {
  radius: number;
  centerX: number;
  centerY: number;
  iconSize: number;
  items: OrbitIntegration[];
};

function SemiCircleOrbit({
  radius,
  centerX,
  centerY,
  iconSize,
  items,
}: OrbitProps) {
  const count = items.length;

  return (
    <>
      {items.map((item, index) => {
        const angle = (index / (count - 1)) * 180;
        const x = radius * Math.cos((angle * Math.PI) / 180);
        const y = radius * Math.sin((angle * Math.PI) / 180);

        const tooltipAbove = angle > 90;

        const buttonSize = iconSize + 18;

        return (
          <div
            key={`${item.name}-${index}`}
            className="absolute flex flex-col items-center group"
            style={{
              left: `${centerX + x - buttonSize / 2}px`,
              top: `${centerY - y - buttonSize / 2}px`,
              zIndex: 5,
            }}
          >
            <div
              className="flex items-center justify-center rounded-full bg-white transition-transform duration-200 hover:scale-110 cursor-default p-[5px]"
              style={{
                width: buttonSize,
                height: buttonSize,
                border:
                  "1px solid hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18)",
                boxShadow:
                  "0 1px 2px rgba(22, 19, 31, 0.04), 0 8px 24px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.10)",
              }}
              aria-label={item.name}
            >
              <img
                src={item.logoSrc}
                alt=""
                decoding="async"
                className="select-none object-contain"
                style={{
                  width: Math.max(12, iconSize - 2),
                  height: Math.max(12, iconSize - 2),
                }}
              />
            </div>

            <div
              role="tooltip"
              className={`absolute ${
                tooltipAbove
                  ? "bottom-[calc(100%+10px)]"
                  : "top-[calc(100%+10px)]"
              } pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-medium text-white shadow-lg`}
              style={{ background: "var(--vx-ink, #16131F)" }}
            >
              {item.name}
              <div
                className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
                  tooltipAbove ? "top-full -mt-1" : "bottom-full -mb-1"
                }`}
                style={{ background: "var(--vx-ink, #16131F)" }}
              />
            </div>
          </div>
        );
      })}
    </>
  );
}

export type MultiOrbitSemiCircleProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  rings?: {
    inner?: OrbitIntegration[];
    middle?: OrbitIntegration[];
    outer?: OrbitIntegration[];
  };
};

export default function MultiOrbitSemiCircle({
  eyebrow = "Integrations",
  title = "Plugs into the stack you already pay for.",
  subtitle = "Send from Gmail or Outlook. Export to Smartlead, Instantly, or GHL. Install the AI receptionist into Synthflow, Retell, or Vapi. One subscription, every layer — no new contracts to sign.",
  rings,
}: MultiOrbitSemiCircleProps = {}) {
  const inner = rings?.inner ?? INNER_RING_ORBIT;
  const middle = rings?.middle ?? MIDDLE_RING_ORBIT;
  const outer = rings?.outer ?? OUTER_RING_ORBIT;

  const [width, setWidth] = useState(0);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const baseWidth = width === 0 ? 700 : Math.min(width * 0.86, 760);
  const centerX = baseWidth / 2;
  const centerY = baseWidth * 0.5;

  const iconSize =
    width < 480
      ? Math.max(14, baseWidth * 0.032)
      : width < 768
        ? Math.max(16, baseWidth * 0.036)
        : Math.max(18, baseWidth * 0.04);

  const titleWords = title.split(" ");
  const lastWord = titleWords.at(-1) ?? "";
  const headPart = titleWords.slice(0, -1).join(" ");

  return (
    <section
      id="integrations"
      className="vx-light-section relative py-20 md:py-28 overflow-hidden"
    >
      <div
        className="max-w-(--cine-max) mx-auto"
        style={{
          paddingLeft: "var(--cine-gutter)",
          paddingRight: "var(--cine-gutter)",
        }}
      >
        <div className="flex flex-col items-center text-center gap-5 mb-12 md:mb-16 max-w-3xl mx-auto">
          <span className="vx-badge-light">{eyebrow}</span>
          <h2 className="vx-display text-[clamp(30px,4.6vw,54px)] leading-[1.04] text-(--vx-ink) max-w-[24ch]">
            {headPart}{" "}
            {lastWord && <span className="vx-text-gradient">{lastWord}</span>}
          </h2>
          {subtitle && (
            <p className="text-[14.5px] md:text-[16px] text-(--vx-ink-mute) max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        <div className="relative flex justify-center">
          <div
            aria-hidden
            className="absolute inset-0 flex justify-center pointer-events-none"
          >
            <div
              className="rounded-full blur-3xl"
              style={{
                width: baseWidth,
                height: baseWidth,
                marginTop: -baseWidth * 0.2,
                background:
                  "radial-gradient(circle at center, hsl(var(--leadac-h) var(--leadac-s) 60% / 0.22), transparent 70%)",
              }}
            />
          </div>

          <div
            className="relative"
            style={{
              width: baseWidth,
              height: baseWidth * 0.62,
            }}
          >
            <svg
              aria-hidden
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${baseWidth} ${baseWidth * 0.62}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id="orbit-stroke"
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                >
                  <stop
                    offset="0%"
                    stopColor="hsl(var(--leadac-h) var(--leadac-s) 50% / 0.0)"
                  />
                  <stop
                    offset="50%"
                    stopColor="hsl(var(--leadac-h) var(--leadac-s) 50% / 0.28)"
                  />
                  <stop
                    offset="100%"
                    stopColor="hsl(var(--leadac-h) var(--leadac-s) 50% / 0.0)"
                  />
                </linearGradient>
              </defs>
              {[0.22, 0.36, 0.5].map((r) => (
                <path
                  key={r}
                  d={`M ${centerX - baseWidth * r} ${centerY} A ${
                    baseWidth * r
                  } ${baseWidth * r} 0 0 1 ${centerX + baseWidth * r} ${centerY}`}
                  fill="none"
                  stroke="url(#orbit-stroke)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              ))}
            </svg>

            <SemiCircleOrbit
              radius={baseWidth * 0.22}
              centerX={centerX}
              centerY={centerY}
              iconSize={iconSize}
              items={inner}
            />
            <SemiCircleOrbit
              radius={baseWidth * 0.36}
              centerX={centerX}
              centerY={centerY}
              iconSize={iconSize}
              items={middle}
            />
            <SemiCircleOrbit
              radius={baseWidth * 0.5}
              centerX={centerX}
              centerY={centerY}
              iconSize={iconSize}
              items={outer}
            />
          </div>
        </div>

        <p className="mt-12 md:mt-16 text-center text-[12.5px] uppercase tracking-[0.16em] text-(--vx-ink-mute)">
          We plug into your sender. We don&rsquo;t replace it.
        </p>
      </div>
    </section>
  );
}
