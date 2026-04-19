import { Database, MessageSquareDashed, Layers } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";
import {
  AGENCY_LEADS,
  AGENCY_CITIES,
  AGENCY_NICHES,
} from "@/components/marketing/interactive/demo-data";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for B2B outbound agencies — fresh leads, mockups, openers",
  metaDescription:
    "Stop fighting over the same Apollo lists. Lead Engine pulls fresh local leads from Google Maps, audits each site, generates a custom mockup, and writes the opener.",
  eyebrow: "For B2B outbound agencies",
  h1: "Apollo's tired.",
  h1Highlight: "Your pipeline doesn't have to be.",
  sub: "Pull fresh local leads from Google Maps every search. Each one comes with a website audit, a custom mockup, and a draft opener. Push the file to Smartlead or Instantly in two clicks.",
  primaryCta: "Try with 50 free leads",
  validationQuote: {
    source: "5 days ago · $140k/mo agency stack thread",
    subreddit: "coldemail",
    upvotes: 39,
    comments: 47,
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
  proofTourTitle: "Same SDR, four different screens.",
  proofPoints: [
    "Discovery is per-search, not bulk-imported. Every list you pull is fresh data from Google Maps, not a recycled Apollo dump.",
    "For each shortlisted lead, the audit pinpoints what's broken on their site. The score and the signals are the conversation starter you used to write yourself.",
    "Generate a custom one-page mockup using the prospect's actual reviews, services, and address. Attach the link in your opener.",
    "First-draft openers reference specific things on the prospect's existing site. Edit the parts that need your voice and push to Smartlead.",
    "Auto-send is off by default. AI writes the draft, your SDR ships it.",
    "Multi-tenant workspaces (Agency plan) so your client work and your own outbound stay separate.",
    "Native CSV export to Smartlead and Instantly. Custom variables (mockup URL, audit signals, suggested package) wire up on import.",
  ],
  closingHeading: "Stop fighting over the same lists.",
  closingHeadingHighlight: "Pull leads no one else has.",
  closingBody: "Get 50 fresh leads in five minutes without a credit card.",
  demoCities: AGENCY_CITIES,
  demoNiches: AGENCY_NICHES,
  demoLeads: AGENCY_LEADS,
  beforeAfter: {
    beforeLabel: "Apollo export · burnt",
    afterLabel: "Lead Engine · fresh from Google Maps",
  },
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function AgenciesPage() {
  return <VerticalLanding copy={COPY} />;
}
