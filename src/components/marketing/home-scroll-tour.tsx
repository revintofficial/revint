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
    body: "Leadac AI pulls every matching local business straight from Google Maps the moment you ask. The data is live, never a recycled Apollo export the whole industry already burned.",
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
    title: "We open the hood on every site.",
    body: "Twenty-plus signals: HTTPS, mobile fit, booking flow, page weight, last-updated year. Gemini scores the opportunity 0-100 and tells you exactly why it landed there.",
    visual: (
      <div className="rounded-2xl p-4" style={{
        background: "linear-gradient(180deg, rgba(32,32,36,0.92), rgba(22,22,26,0.96))",
        border: "0.5px solid rgba(255,255,255,0.09)",
        boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 80px 200px rgba(49,46,129,0.25)",
      }}>
        <p className="text-[10.5px] uppercase tracking-[0.12em] font-semibold text-[#A5B4FC] mb-3 px-1">
          Lead detail · click to expand
        </p>
        <LeadCardLive lead={FEATURED_LEAD} defaultExpanded />
      </div>
    ),
  },
  {
    id: "mockup",
    eyebrow: "03 — Mockup",
    title: "Show, don't pitch.",
    body: "One click drafts a custom one-page mockup using the prospect's real name, reviews, and missing features. Drop the link in your email and the message stops being 'hi, can I help' and starts being 'I built you a draft.'",
    visual: <MockupGeneratorDemo lead={FEATURED_LEAD} />,
  },
  {
    id: "opener",
    eyebrow: "04 — Opener",
    title: "AI writes the first draft. You ship.",
    body: "The opener references their actual site, not a Mad Lib. You read it, edit the line that sounds off, and push the file to Smartlead or Instantly. Auto-send is off by default, on purpose.",
    visual: <OpenerComposer lead={FEATURED_LEAD} />,
  },
];

export function HomeScrollTour() {
  return <ScrollStage scenes={SCENES} />;
}
