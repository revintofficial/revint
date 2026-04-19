import { Database, MessageSquareDashed, Layers } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for B2B outbound agencies — fresh leads, mockups, openers",
  metaDescription:
    "Stop fighting over the same Apollo lists. Lead Engine pulls fresh local leads from Google Maps, audits each site, generates a custom mockup, and writes the opener.",
  eyebrow: "For B2B outbound agencies",
  h1: "Apollo's tired.",
  h1Highlight: "Your pipeline doesn't have to be.",
  sub: "Pull fresh local leads from Google Maps every search. Get a website audit, a custom mockup, and a first-draft opener for each one. Push to Smartlead or Instantly in two clicks.",
  primaryCta: "Try with 50 free leads",
  validationQuote: {
    source: "From r/coldemail, 5 days ago — $140k/mo agency stack thread",
    text: "Everyone's fighting over the same Apollo and Clay exports. Same 50 million contacts, same data from the same crawls, same emails that have been cold emailed by 10 other people this month.",
  },
  painsHeading: "Three things killing your reply rate.",
  pains: [
    {
      icon: Database,
      title: "Saturated lists",
      body: "Every agency uses Apollo or Clay. Every prospect gets 5 pitches a week. Reply rate falls below 2% and you blame your copy.",
    },
    {
      icon: MessageSquareDashed,
      title: "Generic personalization",
      body: "ChatGPT first-line generators all sound the same. The receiving inbox can spot it. Your brand pays the price.",
    },
    {
      icon: Layers,
      title: "Manual research kills throughput",
      body: "You can write a great per-prospect message — for 10 prospects a day. That's not a pipeline.",
    },
  ],
  proofHeading: "What changes for your team.",
  proofPoints: [
    "Discovery is per-search, not bulk-imported. Every list you pull is fresh data from Google Maps, not a recycled Apollo dump.",
    "For each shortlisted lead, generate a custom one-page mockup populated with the prospect's actual business info — hero, services, CTA. Attach the link in your opener.",
    "First-draft openers reference specific things on the prospect's existing site (load time, missing booking button, last-updated year). No more 'Hi {firstName}, hope this helps.'",
    "Push to Smartlead or Instantly with native CSV export. Custom variables wire up automatically — mockup URL, audit signals, suggested package.",
    "Auto-send is off by default. AI writes, your SDR ships. Brand stays intact, deliverability holds.",
    "Multi-tenant workspaces (Agency plan) so your client work and your own outbound stay separate.",
  ],
  closingHeading: "Stop fighting over the same lists.",
  closingHeadingHighlight: "Pull leads no one else has.",
  closingBody: "50 fresh leads in your first 5 minutes. No credit card.",
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function AgenciesPage() {
  return <VerticalLanding copy={COPY} />;
}
