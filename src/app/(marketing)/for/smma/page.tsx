import { Rocket, Eye, Handshake } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for new SMMA owners — start with leads, not theory",
  metaDescription:
    "Lead Engine gives new agency owners ready-to-pitch local leads, audits, and one-page mockups so the first deal happens this week instead of next quarter.",
  eyebrow: "For SMMA owners landing their first clients",
  h1: "First clients are the hardest.",
  h1Highlight: "Skip the manual prospecting.",
  sub: "You know the playbook. The bottleneck is finding 50 prospects, researching each one, and writing a message that doesn't sound like a template. Lead Engine handles the prospecting so your first 5 clients ship this month, not next quarter.",
  primaryCta: "Get 50 leads in 5 minutes",
  validationQuote: {
    source: "From r/SMMA, 6 days ago",
    text: "Got on a call with this guy last year. Mid 30s. First thing he says is 'how old are you?' I tell him 16. He laughs. I pulled up my audit on his site and showed him 3 things he was missing. He signed a €2k/month contract 40 minutes later.",
  },
  painsHeading: "Why most new agencies stall in the first 90 days.",
  pains: [
    {
      icon: Rocket,
      title: "All planning, no shipping",
      body: "You've read the guides and watched the breakdowns. The blocker isn't strategy. It's that manual prospecting kills momentum before you send your first 10 emails.",
    },
    {
      icon: Eye,
      title: "Generic outreach gets ignored",
      body: "Mass-blasting templates burns your domain. Writing each message by hand takes an hour each. Either way you ship 10 emails and stall.",
    },
    {
      icon: Handshake,
      title: "First call is a disaster without proof",
      body: "Without a portfolio or case study, prospects don't take you seriously. You need something concrete to show before the call — an audit, a mockup, a number — that justifies the meeting.",
    },
  ],
  proofHeading: "What you actually get.",
  proofPoints: [
    "Pick a city, pick a niche (phone repair, dental, gym, anything). Lead Engine pulls 50 real local businesses from Google Maps in 30 seconds.",
    "Each lead has a website audit telling you what's broken — the conversation starter you didn't have to invent.",
    "One click generates a custom one-page mockup for each prospect. Show it on the call. Different conversation.",
    "First-draft opener written for you, referencing their actual site. Edit, hit send. Your first 10 emails take 15 minutes, not 8 hours.",
    "Free plan covers your first 50 prospects. Your first signed deal pays for Pro for a year.",
    "No credit card to start. No surprise renewal. If it doesn't work for you, you keep the audit data either way.",
  ],
  closingHeading: "Stop reading playbooks.",
  closingHeadingHighlight: "Send your first 50 emails today.",
  closingBody: "Start free with 50 leads. No card. Your first close pays for everything.",
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SmmaPage() {
  return <VerticalLanding copy={COPY} />;
}
