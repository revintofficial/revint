import type { CompetitorProfile } from "./types";

export const smartlead: CompetitorProfile = {
  slug: "smartlead",
  name: "Smartlead",
  homepage: "https://www.smartlead.ai",
  tagline: "Cold email infrastructure + multi-inbox sending.",
  positioning:
    "Smartlead is deliverability-obsessed cold email with unlimited sending seats, warm-up, and CRM-grade conversation threading. Beloved by agencies that run hundreds of mailboxes.",
  bestFor:
    "Lead-gen agencies sending 50k+ emails/mo across dozens of client mailboxes.",
  weaknesses: [
    "Pure sending tool — no discovery, no audit, no copy.",
    "You still have to source leads and write the message yourself.",
    "Steep UX learning curve for new operators.",
  ],
  pricing: {
    entry: "$39/mo (Basic)",
    mid: "$94/mo (Pro)",
    enterprise: "$174/mo (Custom)",
    freeTrial: "14-day free trial",
  },
  scorecard: {
    localDiscovery: 1,
    websiteAudit: 1,
    outreachAutomation: 5,
    dataFreshness: 3,
    priceForAgencies: 5,
  },
  citations: [
    {
      label: "Smartlead pricing",
      url: "https://www.smartlead.ai/pricing",
    },
    {
      label: "Smartlead vs Instantly — Reddit",
      url: "https://www.reddit.com/r/coldemail/",
      note: "Frequent comparison threads; both rank well on deliverability.",
    },
  ],
  whyLeadacInstead: [
    "Smartlead sends. Leadac sources + audits. Use them together: one-click push from Leadac to Smartlead.",
    "Your Smartlead campaigns perform better when email #1 references the recipient's actual website, not a persona.",
    "Leadac handles the research Smartlead doesn't — postcode, niche, 20-signal audit, pitch angle.",
  ],
};
