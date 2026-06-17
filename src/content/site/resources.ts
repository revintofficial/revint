/**
 * Cornerstone resources index — brand-assets §7.2 cornerstone list.
 *
 * Each entry powers the /resources hub + the /resources/[slug] detail
 * pages. Keep this list short: cornerstone resources are scarce by
 * design, not a content mill.
 */

export type Resource = {
  slug: string;
  title: string;
  /** One-line description for cards and meta. */
  summary: string;
  /** Resource kind — drives schema choice and ribbon copy. */
  kind: "report" | "guide" | "playbook";
  /** ISO 8601 publish date. */
  publishedAt: string;
  /** Optional dataset metadata for the report-kind entries. */
  dataset?: {
    /** e.g. "Annual benchmark dataset, vertical SaaS GTM" */
    description: string;
    keywords: string[];
    /** Linked download path (PDF or CSV). Falls back to email-gate when absent. */
    contentUrl?: string;
    license?: string;
  };
  /** Author for Article schema. */
  author: string;
};

export const RESOURCES: Resource[] = [
  {
    slug: "2026-vertical-saas-gtm-benchmark",
    title: "2026 vertical SaaS GTM benchmark",
    summary:
      "How 200 vertical SaaS GTM teams at $2M–$50M ARR ran outbound in 2026. Tool spend, SDR ramp, account-research time, and the gap memory leaves behind.",
    kind: "report",
    publishedAt: "2026-05-22",
    author: "Revint research",
    dataset: {
      description:
        "Cross-vertical benchmark dataset covering tool spend (Apollo, Clay, Smartlead, Gong), SDR ramp time, manual-research hours, and closed-loop ICP refinement adoption among vertical SaaS GTM teams at $2M–$50M ARR.",
      keywords: [
        "vertical SaaS GTM",
        "SDR productivity",
        "outbound benchmark",
        "operational intelligence",
        "memory layer",
      ],
      license: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    },
  },
  {
    slug: "apollo-bounce-rate-fix",
    title: "The Apollo bounce-rate fix for local-business outbound",
    summary:
      "Why Apollo's contact data bounces at 12–14% on local-business segments — and the four-step fix vertical SaaS GTM teams ship in 30 days.",
    kind: "playbook",
    publishedAt: "2026-05-22",
    author: "Revint playbooks",
  },
  {
    slug: "closed-loop-icp-refinement",
    title: "Closed-loop ICP refinement — the system, not the spreadsheet",
    summary:
      "The mechanism that turns won and lost CRM deal outcomes into a sharper next list. What the loop indexes, what it ignores, what breaks without it.",
    kind: "guide",
    publishedAt: "2026-05-22",
    author: "Revint guides",
  },
];

export function getResource(slug: string): Resource {
  const r = RESOURCES.find((x) => x.slug === slug);
  if (!r) throw new Error(`Unknown resource slug: ${slug}`);
  return r;
}
