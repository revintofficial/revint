"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Inbox,
  Send,
  Zap,
  Workflow,
  MapPin,
  Phone,
  PhoneCall,
  Mic,
  MessageCircle,
  GitBranch,
  Settings2,
  Bot,
  CalendarDays,
  Briefcase,
  Building2,
  CreditCard,
  MessageSquare,
  FileText,
  Database,
  Cloud,
  TrendingUp,
  Webhook,
  Globe,
  type LucideIcon,
} from "lucide-react";

type Integration = {
  name: string;
  icon: LucideIcon;
};

/* Three rings of integrations, ordered inside-out by how proximate the
 * tool is to a finished agency send. Inner ring = the inbox / sender we
 * push the draft into. Middle ring = the post-reply install layer we
 * export to. Outer ring = the data + workflow surface that we receive
 * from or write back to. Tooltip copy is the actual partner name; this
 * is the section that has to look credible to a buyer. */
const INNER_RING: Integration[] = [
  { name: "Gmail", icon: Mail },
  { name: "Outlook", icon: Inbox },
  { name: "Smartlead", icon: Send },
  { name: "Instantly", icon: Zap },
  { name: "GoHighLevel", icon: Workflow },
  { name: "Google Maps", icon: MapPin },
];

const MIDDLE_RING: Integration[] = [
  { name: "Synthflow", icon: Phone },
  { name: "Retell", icon: PhoneCall },
  { name: "Vapi", icon: Mic },
  { name: "Twilio", icon: MessageCircle },
  { name: "n8n", icon: GitBranch },
  { name: "Make", icon: Settings2 },
  { name: "Zapier", icon: Bot },
  { name: "Calendly", icon: CalendarDays },
];

const OUTER_RING: Integration[] = [
  { name: "LinkedIn", icon: Briefcase },
  { name: "Apollo", icon: Building2 },
  { name: "Stripe", icon: CreditCard },
  { name: "Slack", icon: MessageSquare },
  { name: "Notion", icon: FileText },
  { name: "Airtable", icon: Database },
  { name: "Salesforce", icon: Cloud },
  { name: "HubSpot", icon: TrendingUp },
  { name: "Webhook", icon: Webhook },
  { name: "Web", icon: Globe },
];

type OrbitProps = {
  radius: number;
  centerX: number;
  centerY: number;
  iconSize: number;
  items: Integration[];
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
        const Icon = item.icon;

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
              className="flex items-center justify-center rounded-full bg-white transition-transform duration-200 hover:scale-110 cursor-default"
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
              <Icon
                className="text-(--vx-purple-700)"
                style={{ width: iconSize, height: iconSize }}
                strokeWidth={1.75}
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
    inner?: Integration[];
    middle?: Integration[];
    outer?: Integration[];
  };
};

export default function MultiOrbitSemiCircle({
  eyebrow = "Integrations",
  title = "Plugs into the stack you already pay for.",
  subtitle = "Send from Gmail or Outlook. Export to Smartlead, Instantly, or GHL. Install the AI receptionist into Synthflow, Retell, or Vapi. One subscription, every layer.",
  rings,
}: MultiOrbitSemiCircleProps = {}) {
  const inner = rings?.inner ?? INNER_RING;
  const middle = rings?.middle ?? MIDDLE_RING;
  const outer = rings?.outer ?? OUTER_RING;

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
          {/* Soft warm glow behind the orbits */}
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
            {/* Faint guide arcs so the orbits read even before icons render */}
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
