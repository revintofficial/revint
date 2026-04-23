import { Database, MessageSquareDashed, Layers } from "lucide-react";
import { type VerticalCopy } from "@/components/marketing/vertical-landing";
import { AgenciesLanding } from "@/components/marketing/agencies-landing";
import {
  AGENCY_LEADS,
  AGENCY_CITIES,
  AGENCY_NICHES,
} from "@/components/marketing/interactive/demo-data";

const COPY: VerticalCopy = {
  metaTitle:
    "Leadac AI for B2B outbound agencies - fresh local signals, not Apollo's exhaust",
  metaDescription:
    "AI cold email is tanking everyone's reply rates. Leadac AI pulls fresh local leads from Google Maps every search, audits each site, generates a custom mockup, and writes openers grounded in what the prospect actually sees - not GPT-fabricated 'I noticed you...'",
  eyebrow: "For B2B outbound agencies",
  h1: "AI personalization is dying.",
  h1Highlight: "Reply rates: 1 to 2 per 200.",
  sub: "Six months of AI-generated 'I noticed you...' openers and the receiving inbox figured it out. Reply rates tanked across the industry. Leadac AI doesn't try harder at GPT personalization. It pulls fresh local signals from Google Maps, audits the site, builds the mockup, and grounds the opener in something the prospect sees the moment they open their own homepage. Different fuel, not louder.",
  primaryCta: "Try with 50 free leads",
  validationQuote: {
    source: "14 days ago - 8-year cold email vet on what shifted in 2026",
    subreddit: "coldemail",
    upvotes: 42,
    comments: 33,
    text: "I'm not here to tell you cold email is dead because it's not. I still book meetings every week, my clients still book meetings every week. But something has shifted in the last 12 months that I think is worth talking about.",
  },
  painsHeading: "What killed your last six months of reply rate.",
  pains: [
    {
      icon: Database,
      title: "Apollo is everyone's exhaust",
      body: "Same 50 million contacts, same crawls, same prospects pitched by ten other agencies this month. Reply rate falls below 2% and your team blames the copy.",
    },
    {
      icon: MessageSquareDashed,
      title: "AI personalization stopped working",
      body: "GPT first-line generators all sound the same. The receiving inbox can spot it. Reply rates tanked across the industry; most replies are 'please remove me.' Different fuel beats louder personalization.",
    },
    {
      icon: Layers,
      title: "Manual research kills throughput",
      body: "You can write a great per-prospect message, for ten a day. That's not a pipeline. The middle path between 'AI slop at scale' and 'hand-write every email' is the gap nothing is filling.",
    },
  ],
  proofHeading: "What changes for your team.",
  proofTourTitle: "Same SDR seat, different fuel.",
  proofPoints: [
    "Discovery is per-search, not bulk-imported. Every list you pull is fresh data from Google Maps, not a recycled Apollo dump.",
    "For each shortlisted lead, the audit pinpoints what's broken on their site. The score and the signals are the conversation starter your SDR used to write themselves.",
    "Generate a custom one-page mockup using the prospect's actual reviews, services, and address. Attach the link in your opener.",
    "First-draft openers reference specific things on the prospect's existing site. Edit the parts that need your voice and push to Smartlead.",
    "Auto-send is off by default. AI writes the draft, your SDR ships it. Your domain doesn't burn over the weekend.",
    "Reply tracking and pipeline view live in the same workspace. Your SDR doesn't toggle between four tabs to update one lead's status.",
    "Per-search billing for prospect data, not per-seat. Your team scales without renegotiating with Apollo every quarter.",
  ],
  closingHeading: "Stop fighting over Apollo's exhaust.",
  closingHeadingHighlight: "Pull fresh leads, audit live, ship today.",
  closingBody:
    "50 fresh leads, audits, mockups, openers. No card, no Apollo seat, no Clay table. Push to Smartlead when you're ready.",
  demoCities: AGENCY_CITIES,
  demoNiches: AGENCY_NICHES,
  demoLeads: AGENCY_LEADS,
  beforeAfter: {
    beforeLabel: "Apollo · saturated",
    afterLabel: "Leadac AI · fresh signal",
  },
};

import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  path: "/for/agencies",
  title: COPY.metaTitle,
  description: COPY.metaDescription,
});

export default function AgenciesPage() {
  return <AgenciesLanding copy={COPY} />;
}
