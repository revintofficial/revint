/**
 * Pain library — sourced verbatim from positioning §3.1 (P-001..P-014).
 *
 * Every "problem section" on a shipped page pulls from this list. Each
 * pain ships with a real quote, a real source, and a real date — humanizer
 * H6 forbids "experts say" vague attributions.
 */

export type Pain = {
  id: string;
  /** One-sentence summary (rewrites OK; keep customer-language). */
  summary: string;
  /** Verbatim quote excerpt from the source. */
  quote: string;
  source: {
    name: string;
    url: string;
    date: string; // ISO 8601
  };
  /** Tags so vertical pages can filter to the pains that matter to them. */
  tags: Array<"cross-vertical" | "field-service" | "restaurant" | "dental" | "tooling" | "ramp" | "ai-sdr" | "memory">;
};

export const PAINS: Pain[] = [
  {
    id: "P-001",
    summary:
      "SDRs at vertical SaaS companies spend roughly 5.6 hours per rep per week on manual account research because Apollo's firmographic data has no local-business operational context.",
    quote:
      "For a team of 10 SDRs working standard 40-hour weeks, 148 of those 400 collective hours per week get consumed by research alone. $222,000 annually for a team of ten.",
    source: {
      name: "Kwanzoo benchmark synthesis",
      url: "https://www.kwanzoo.com/blog/sdrs-spend-40-percent-researching-leads",
      date: "2026-03-22",
    },
    tags: ["cross-vertical", "ramp", "memory"],
  },
  {
    id: "P-002",
    summary:
      "Apollo's contact data has 12–14% bounce rates on local-business segments. Teams bolt on third-party verification at $50 per month per seat just to protect domain health.",
    quote:
      "Apollo's bounce rates run 12-14% without it, plus a standalone dialer at $60/seat because Apollo's dialer audio is unusable… real cost: roughly $430/mo.",
    source: {
      name: "Discury practitioner discussion",
      url: "https://discury.io/problems/marketing-ops-outbound-sales-stack-costs",
      date: "2026-04-04",
    },
    tags: ["cross-vertical", "tooling"],
  },
  {
    id: "P-003",
    summary:
      "The Apollo + Clay + Smartlead + HubSpot stack works for B2B SaaS selling to other B2B SaaS — it produces shallow personalization for vertical SaaS selling into local business.",
    quote:
      "Apollo for discovery, Clay for enrichment, Instantly/Smartlead for sending — the most common setup among technical GTM teams in 2026. But Clay does not have native email sequencing.",
    source: {
      name: "MiniLoop AI — Clay vs Apollo B2B Prospecting 2026",
      url: "https://www.miniloop.ai/blog/clay-vs-apollo-b2b-prospecting-2026",
      date: "2026-04-12",
    },
    tags: ["cross-vertical", "tooling"],
  },
  {
    id: "P-004",
    summary:
      "When a vertical SaaS company opens a new vertical (HVAC → dental, restaurant → boutique hotel), the SDR team's pattern knowledge resets to zero because patterns live in SDR heads, not in the system.",
    quote:
      "As Toast gains more customers in a geographic area, it becomes easier to close new deals.",
    source: {
      name: "Toast SaaStr CRO Confidential",
      url: "https://www.saastr.com/10-things-that-are-different-in-vertical-smb-sales-with-toasts-cro/",
      date: "2026-01-30",
    },
    tags: ["cross-vertical", "ramp", "memory"],
  },
  {
    id: "P-005",
    summary:
      "Mid-market vertical SaaS GTM teams can't afford Gong's $30K+/yr floor or its 8-week RevOps-engineered onboarding. They live without conversation intelligence or Revenue Graph memory, despite needing it as much as enterprise does.",
    quote:
      "Best for organizations with 50 or more reps and a dedicated RevOps team. Opaque pricing and steep 8-16 week implementations make it a poor fit for smaller teams.",
    source: {
      name: "Clari review, TechnologyInSales",
      url: "https://www.technologyinsales.com/tools/clari",
      date: "2026-03-08",
    },
    tags: ["cross-vertical", "tooling"],
  },
  {
    id: "P-007",
    summary:
      "AI SDR tools (11x, Artisan, AiSDR, Regie) promise autonomy and ship decent first drafts that still need rewriting. For vertical SaaS the rewrite rate is higher because generic brand voice doesn't match local-business buyer expectations.",
    quote:
      "Persona configuration has been one of the biggest sources of friction in getting AI outreach to feel right. Teams spend hours tweaking, retesting, and looping in their GTM engineer every time something feels off.",
    source: {
      name: "AiSDR Product Spotlight 57",
      url: "https://aisdr.com/blog/product-spotlight-57-messaging-engine/",
      date: "2026-04-29",
    },
    tags: ["cross-vertical", "ai-sdr"],
  },
  {
    id: "P-008",
    summary:
      "Clay's power is real, but tax-laden — steep learning curve, credit overruns, no native sequencing, requires a GTM Engineer to operate, only worth it for teams sending 10k+ emails per month.",
    quote:
      "Most common G2 and Reddit complaint: not plug-and-play; requires RevOps or technical thinking.",
    source: {
      name: "SalesEcho Clay Review",
      url: "https://www.sales-echo.com/blog/clay-review",
      date: "2026-02-26",
    },
    tags: ["cross-vertical", "tooling"],
  },
  {
    id: "P-010",
    summary:
      "Salesforce State of Sales 2026: reps spend 60% of time on non-selling tasks. The single biggest line item is account research (17%); tool switching alone eats 10%.",
    quote:
      "The average SDR sells for roughly two hours a day. The rest disappears into CRM entry, lead research, tool switching, internal meetings, and manual tasks that technology was supposed to eliminate.",
    source: {
      name: "MarketBetter — SDR Productivity Crisis 2026",
      url: "https://marketbetter.ai/blog/sdr-productivity-crisis-data-2026/",
      date: "2026-03-15",
    },
    tags: ["cross-vertical", "ramp"],
  },
  {
    id: "P-011",
    summary:
      "Gong's May 2026 Revenue Graph launch explicitly claims the memory thesis — but only at enterprise price point. Mid-market vertical SaaS sees the thesis, can't afford the product, has no analogue.",
    quote:
      "The Gong Revenue Graph turns customer interactions across emails, calls, meetings, and deals into a living memory layer.",
    source: {
      name: "Amit Bendov, Gong CEO, PRNewswire",
      url: "https://www.prnewswire.com/news-releases/gong-growth-accelerates-past-55-yoy-as-enterprises-adopt-revenue-ai-arr-tops-500m-302769127.html",
      date: "2026-05-12",
    },
    tags: ["cross-vertical", "tooling", "memory"],
  },
  {
    id: "P-012",
    summary:
      "Toast's CRO publicly confirms vertical SMB sales is fundamentally different — 75–80% field-based, density-based territory, social-proof driven. The dominant outbound stack (Apollo + Clay + Outreach) was built for desk-worker B2B.",
    quote:
      "Toast segments by geographic density, not deal size… in dense verticals like restaurants, social proof isn't just helpful — it's everything. One in five Toast deals comes from referrals.",
    source: {
      name: "Toast SaaStr CRO Confidential",
      url: "https://www.saastr.com/the-top-10-strategies-toasts-cro-uses-to-crush-quotas/",
      date: "2026-01-30",
    },
    tags: ["restaurant", "cross-vertical"],
  },
  {
    id: "P-013",
    summary:
      "ICONIQ Modern GTM Org 2026 benchmark shows winning teams are 20–30% leaner and 9x flatter — achieved when AI embeds in the existing workflow instead of replacing humans.",
    quote:
      "Reps need less hand-holding when they have AI doing pipeline research, call summaries, and follow-up drafts.",
    source: {
      name: "ICONIQ Growth — Modern GTM Org 2026",
      url: "https://www.saastr.com/moderngtmleanerflatter/",
      date: "2026-04-18",
    },
    tags: ["cross-vertical"],
  },
  {
    id: "P-014",
    summary:
      "Median SDR tenure is 14–18 months and annual turnover runs about 34%. On a ten-rep team that's three or four people leaving every year — and every account pattern, objection, and 'why this one closed' leaves with them, because it only ever lived in the rep's head.",
    quote:
      "Median SDR tenure is 14 to 18 months. Average ramp time is 3 to 6 months. That means a typical SDR spends a quarter or more of their entire tenure below full productivity — and then leaves.",
    source: {
      name: "Dialfyne — Sales Rep Turnover Statistics 2026 (The Bridge Group)",
      url: "https://dialfyne.com/blog/sales-rep-turnover-statistics-2026",
      date: "2026-02-10",
    },
    tags: ["cross-vertical", "memory", "ramp"],
  },
  {
    id: "P-015",
    summary:
      "Only about 40% of deals ever get a win-loss review, and most of those are last month's. The other 60% close or die with nobody recording which signals predicted the outcome, so the pattern never makes it back into the next list.",
    quote:
      "On average, 40% of deals go through win-loss analysis, and 70% of these deals analyzed were closed within the month prior.",
    source: {
      name: "Klue — 2025 Win-Loss Trends Report",
      url: "https://klue.com/win-loss-trends-report",
      date: "2025-09-01",
    },
    tags: ["cross-vertical", "memory"],
  },
  {
    id: "P-016",
    summary:
      "Ramp to full quota takes about three months, and reps plateau around month 15 — right before they leave. With tenure near 1.9 years, teams live in perpetual ramp-up, re-teaching the same tacit knowledge to each new hire because the last one took it with them.",
    quote:
      "Industry data from The Bridge Group confirms in-house SDR tenure is now just 22 months with diminishing returns after 15 months, leading to 'perpetual ramp-up.'",
    source: {
      name: "Telenet Marketing — The SDR Churn",
      url: "https://telenetmarketing.com/2026/01/the-sdr-churn-how-to-avoid-structure-risks-in-the-modern-sdr-lifecycle/",
      date: "2026-01-20",
    },
    tags: ["cross-vertical", "memory", "ramp"],
  },
];

/** Filter helper — returns the N most-relevant pains for a vertical. */
export function painsForVertical(
  vertical: "field-service" | "restaurant" | "dental" | "cross-vertical" | "memory",
  limit = 6,
): Pain[] {
  return PAINS.filter((p) => p.tags.includes(vertical)).slice(0, limit);
}

/**
 * Explicit, ordered selection by id — use when a section needs the cards in a
 * specific narrative order rather than array order (e.g. the memoryless-team
 * "what's broken" grid on the homepage). Silently skips unknown ids.
 */
export function painsByIds(ids: string[]): Pain[] {
  return ids
    .map((id) => PAINS.find((p) => p.id === id))
    .filter((p): p is Pain => Boolean(p));
}
