import { Compass, Send, Briefcase } from "lucide-react";
import { type VerticalCopy } from "@/components/marketing/vertical-landing";
import { SmmaLanding } from "@/components/marketing/smma-landing";
import {
  SMMA_LEADS,
  SMMA_CITIES,
  SMMA_NICHES,
} from "@/components/marketing/interactive/demo-data";

const COPY: VerticalCopy = {
  metaTitle:
    "Lead Engine for new SMMA owners - first 10 emails today, not next quarter",
  metaDescription:
    "Most new SMMA owners' strategy is referrals, posting on social, and hoping. Lead Engine gives you 50 audited prospects with mockups, so the first 10 emails take 15 minutes instead of 8 hours.",
  eyebrow: "For SMMA owners landing their first clients",
  h1: "Referrals, posting, and hoping.",
  h1Highlight: "That's not a strategy. That's a prayer.",
  sub: "Every new SMMA owner ends up here: the deliverable is solid, the testimonials are slowly coming, but the pipeline is whoever your cousin introduced you to last week. Lead Engine pulls 50 audited local prospects in 30 seconds, generates a mockup for each, and writes the opener that references their actual site. Your first 10 emails stop being the thing that breaks you.",
  primaryCta: "Get my first 50 leads free",
  validationQuote: {
    source: "7 days ago - new agency owner asking r/coldemail for tools",
    subreddit: "coldemail",
    upvotes: 3,
    comments: 44,
    text: "I'm building my digital marketing agency and currently exploring email outreach as my primary strategy for landing new clients. Which tool do you actually use, and would you genuinely recommend it?",
  },
  painsHeading: "The first 90 days are not what the gurus told you.",
  pains: [
    {
      icon: Compass,
      title: "Your strategy is a prayer",
      body: "Referrals, social posts, and hoping. The deliverable is fine. The pipeline is whoever your cousin knew. The gurus didn't tell you the bottleneck would be finding 50 prospects, not building 50 reels.",
    },
    {
      icon: Send,
      title: "Apollo is a foreign language",
      body: "Cold email looks like a tool built for SDR teams, not for you. ChatGPT first-line generators all sound like ChatGPT. The middle path between 'guru course' and 'six months of trial and error' is what's missing.",
    },
    {
      icon: Briefcase,
      title: "Without proof, the call is you talking",
      body: "No portfolio, no case study, just a Calendly link and your laptop camera angle. The first call dies in the first three minutes unless you walk in with something concrete the prospect can react to.",
    },
  ],
  proofHeading: "What changes for you.",
  proofTourTitle: "From 8 hours to 15 minutes for your first 10 emails.",
  proofPoints: [
    "Pick a city and a niche. Lead Engine pulls 50 real local businesses from Google Maps in 30 seconds. No Apollo seat required.",
    "Each lead arrives with a website audit telling you what's broken. That's the conversation starter you didn't have to invent.",
    "One click generates a custom one-page mockup for each prospect. Show it on the call and watch the conversation shift from 'who are you' to 'how do we start'.",
    "First-draft opener written for you, referencing their actual site. Edit, hit send. Your first 10 emails take 15 minutes, not 8 hours.",
    "Free plan covers your first 50 prospects. Your first signed deal pays for Pro for a year.",
    "Pipeline view tracks every conversation. Notes, status, meeting outcomes live with the lead. No second CRM.",
    "When the volume picks up, push 'maybe' leads to Smartlead in two clicks. Auto-send stays off; you ship the email.",
  ],
  closingHeading: "Stop praying for the next intro.",
  closingHeadingHighlight: "Send the first 10 today.",
  closingBody:
    "50 fresh leads, audits, mockups, opener. Free plan, no card. The first signed deal pays for Pro for a year.",
  demoCities: SMMA_CITIES,
  demoNiches: SMMA_NICHES,
  demoLeads: SMMA_LEADS,
  beforeAfter: {
    beforeLabel: "Manual prospecting · 8 hours",
    afterLabel: "Lead Engine · 15 minutes",
  },
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SmmaPage() {
  return <SmmaLanding copy={COPY} />;
}
