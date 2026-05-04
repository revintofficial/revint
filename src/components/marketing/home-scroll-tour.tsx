"use client";

import {
  ScrollStage,
  type ScrollScene,
  DiscoveryDemo,
  LeadCardLive,
  MockupGeneratorDemo,
  OpenerComposer,
  DemoData,
} from "@/components/marketing/interactive";

const FEATURED_LEAD = DemoData.HOME_LEADS[0];

const SCENES: ScrollScene[] = [
  {
    id: "discover",
    eyebrow: "01 — Discover",
    title: "Pick a postcode and a niche.",
    body: "Every matching business pulled straight from Google Maps. Live data, not a recycled list the whole industry already emailed.",
    visual: (
      <DiscoveryDemo
        cities={DemoData.HOME_CITIES}
        niches={DemoData.HOME_NICHES}
        leads={DemoData.HOME_LEADS}
      />
    ),
  },
  {
    id: "audit",
    eyebrow: "02 — Audit & score",
    title: "Every site gets opened up.",
    body: "20+ signals checked: HTTPS, mobile, booking flow, page speed. Each business gets a 0-100 score and you can see exactly why.",
    visual: (
      <div className="rounded-2xl p-4" style={{
        background: "linear-gradient(180deg, rgba(32,32,36,0.92), rgba(22,22,26,0.96))",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px hsl(var(--leadac-h) var(--leadac-s) 42% / 0.25)",
      }}>
        <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-(--leadac-300) mb-3 px-1">
          Lead detail · click to expand
        </p>
        <LeadCardLive lead={FEATURED_LEAD} defaultExpanded />
      </div>
    ),
  },
  {
    id: "mockup",
    eyebrow: "03 — Mockup",
    title: "Show them, don't pitch them.",
    body: "One click builds a page with their real name, reviews, and the features they're missing. Drop the link in the email. You're not asking to help anymore, you already started.",
    visual: <MockupGeneratorDemo lead={FEATURED_LEAD} />,
  },
  {
    id: "opener",
    eyebrow: "04 — Opener",
    title: "AI writes the draft. You send it.",
    body: "References their actual site, not a template. Read it, fix anything that sounds off, export to Smartlead or Instantly. Auto-send stays off.",
    visual: <OpenerComposer lead={FEATURED_LEAD} />,
  },
];

export function HomeScrollTour() {
  return <ScrollStage scenes={SCENES} />;
}
