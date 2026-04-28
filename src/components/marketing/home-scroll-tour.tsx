"use client";

import {
  ScrollStage,
  type ScrollScene,
  DiscoveryDemo,
  AuditScorecard,
  MockupGeneratorDemo,
  OpenerComposer,
  DemoData,
} from "@/components/marketing/interactive";

const FEATURED_LEAD = DemoData.HOME_LEADS[0];

const SCENES: ScrollScene[] = [
  {
    id: "discover",
    eyebrow: "01 — Discover",
    title: "From a postcode to a deduped lead list.",
    body: "Country sets the language and the dialing code. Verified Google Places picks lock the search to a real viewport — not the geocoded blob the Apollo crowd works with. Pick a niche pack, hit run, and Leadac fans out across the sub-niches and dedupes by Place ID before anything lands in your workspace.",
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
    title: "Every site, opened up.",
    body: "Twenty-plus signals on every lead — HTTPS, mobile viewport, booking flow, page weight, schema, last-updated year — plus a reviews-pulse pass on up to 500 Google reviews. Gemini ranks the opportunity 0-100, attaches a grade, and tells you the angle that already maps to a service tier in your packages.",
    visual: <AuditScorecard lead={FEATURED_LEAD} />,
  },
  {
    id: "mockup",
    eyebrow: "03 — Mockup",
    title: "Show, don't pitch.",
    body: "One click drafts a one-page mockup using the prospect's real name, real reviews, the gap your audit just flagged, and a colour the AI picks off their existing brand. Hosted at a private branded URL — the message stops being 'hi, can I help' and starts being 'I built you a draft.'",
    visual: <MockupGeneratorDemo lead={FEATURED_LEAD} />,
  },
  {
    id: "opener",
    eyebrow: "04 — Opener",
    title: "AI drafts. You ship.",
    body: "The opener references their actual site, their actual rating, and the exact two issues Gemini flagged in the audit — not a Mad Lib. Read it, edit the line that sounds off, then send from your own Gmail or Outlook. CSV export to Smartlead and Instantly is one click. Auto-send is off by default. Your inbox, your brand.",
    visual: <OpenerComposer lead={FEATURED_LEAD} />,
  },
];

export function HomeScrollTour() {
  return <ScrollStage scenes={SCENES} />;
}
