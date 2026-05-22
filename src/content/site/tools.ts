/**
 * Free tools index — brand-assets §7.2 ungated calculators.
 *
 * Each tool emits a ToolApplication schema and lives in the /tools/[slug]
 * routes. The list is short on purpose; tools are scarce, not abundant.
 */

export type Tool = {
  slug: string;
  name: string;
  /** One-line description for cards and meta. */
  summary: string;
  /** Long-form benefit copy on the index card. */
  payoff: string;
  /** What category of tool this is — drives icon and copy emphasis. */
  category: "calculator" | "estimator" | "checker";
};

export const TOOLS: Tool[] = [
  {
    slug: "apollo-stack-cost-calculator",
    name: "Apollo + Clay + Gong stack cost calculator",
    summary:
      "Punch in your seat count and tool mix. See the real annual stack cost — with the verification add-ons most teams forget to list.",
    payoff:
      "Most vertical SaaS GTM teams quote their stack at $11K/yr. The real number, with verification and reply-deliverability add-ons, lands closer to $29K/yr.",
    category: "calculator",
  },
  {
    slug: "sdr-ramp-estimator",
    name: "SDR ramp time estimator",
    summary:
      "Three inputs — base salary, current ramp weeks, target ramp weeks. See the dollar cost of un-recovered ramp and the saved cost of cutting it.",
    payoff:
      "Median SDR ramp time is 11 weeks. At $80K loaded cost, that's $16,900 per hire before the rep produces a single closed-won.",
    category: "estimator",
  },
  {
    slug: "hubspot-signal-coverage-checker",
    name: "HubSpot signal coverage checker",
    summary:
      "Paste a list of HubSpot company-record fields. We map them to operational signal categories and report the coverage gap.",
    payoff:
      "Most HubSpot company records carry firmographic fields (industry, employees, revenue) and almost zero operational signal fields. This tool quantifies the gap.",
    category: "checker",
  },
];

export function getTool(slug: string): Tool {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown tool slug: ${slug}`);
  return t;
}
