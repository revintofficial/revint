/**
 * Changelog entries — single source of truth for /changelog.
 *
 * Keep the list short and chronological (newest first). Each entry is
 * a real product or company milestone; no marketing fluff, no
 * pre-launch promises.
 */

export type ChangelogEntry = {
  date: string;
  version?: string;
  kind: "ship" | "milestone" | "vertical" | "integration";
  title: string;
  body: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-22",
    kind: "milestone",
    title: "Pre-login site rebuilt.",
    body: "New marketing surface, new content, new design system. Operator-instrument-panel visual identity, /resources cornerstone reports, three free tools, full /vs and /alternatives coverage. We rebuilt the site because the old one over-promised and under-positioned. This one tells the truth.",
  },
  {
    date: "2026-05-15",
    kind: "vertical",
    title: "Dental pack ships.",
    body: "Dentrix, Eaglesoft, Open Dental, and Curve Dental signatures live in the discovery layer. NPI-registry-to-DSO-parent linker enabled. Twelve new HubSpot fields per dental account record.",
  },
  {
    date: "2026-04-30",
    kind: "integration",
    title: "Smartlead handoff goes native.",
    body: "Eight LeadAC merge variables now available inside Smartlead sequences. Webhook bidirectional — Smartlead reply data ingests back into closed-loop ICP refinement.",
  },
  {
    date: "2026-04-12",
    kind: "ship",
    version: "1.4",
    title: "Closed-loop ICP refinement v2.",
    body: "Deal-stage webhook from HubSpot now updates discovery weights within five minutes (was nightly). Lost-reason taxonomy ships with four canonical buckets — stack-mismatch, scale-mismatch, timing, no-decision.",
  },
  {
    date: "2026-03-28",
    kind: "vertical",
    title: "Restaurant tech pack ships.",
    body: "Toast, OpenTable, Resy, Square, and Yelp Guest Manager signatures live. OpenTable-Lite-to-full migration tag is the strongest single signal we have measured in any vertical.",
  },
  {
    date: "2026-03-04",
    kind: "milestone",
    title: "Series Seed close.",
    body: "$4.2M led by an LP we will name in Q3. Hiring two ICs — design partner ops and HubSpot integration engineer. Public roadmap published the same week.",
  },
  {
    date: "2026-02-15",
    kind: "ship",
    version: "1.3",
    title: "Pre-call brief inside HubSpot card.",
    body: "Custom-property block renders the pre-call brief on the HubSpot contact card. SDR opens the contact and reads the brief without leaving HubSpot — no new tab, no copy-paste.",
  },
  {
    date: "2026-01-20",
    kind: "vertical",
    title: "Field service pack ships.",
    body: "ServiceTitan, Jobber, Housecall Pro, and FieldEdge signatures live. First vertical pack out of the workshop and into the production discovery layer.",
  },
  {
    date: "2025-12-10",
    kind: "milestone",
    title: "Public beta open.",
    body: "First eight design partners onboarded. Pricing finalised at $500 pilot, $1,800/seat/yr Team. HubSpot integration certified through the App Marketplace partner program.",
  },
  {
    date: "2025-10-04",
    kind: "milestone",
    title: "LeadAC founded.",
    body: "Two of us, one Notion doc, one bet — that vertical SaaS GTM needs an operational memory layer Apollo, Clay, and Gong cannot ship inside their existing product shape.",
  },
];
