import { Rocket, Eye, Handshake } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for new SMMA owners — start with leads, not theory",
  metaDescription:
    "Lead Engine gives new agency owners ready-to-pitch local leads, audits, and one-page mockups so the first deal happens this week instead of next quarter.",
  eyebrow: "For SMMA owners landing their first clients",
  h1: "First clients are the hardest.",
  h1Highlight: "Skip the manual prospecting.",
  sub: "You know the playbook. The bottleneck is finding 50 prospects, researching each one, and writing a message that doesn't sound like a template. Lead Engine handles the prospecting so finding clients stops being the thing that breaks you.",
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
      body: "Blast templates and your domain burns. Hand-write every email and you ship ten before you give up. The middle path doesn't exist without tools.",
    },
    {
      icon: Handshake,
      title: "First call is a disaster without proof",
      body: "Without a portfolio or case study, prospects don't take you seriously. You need something concrete to show before the call. An audit and a mockup do the job; without them, the call is you talking about yourself.",
    },
  ],
  proofHeading: "What you actually get.",
  proofPoints: [
    "Pick a city and a niche. Phone repair, dental, gyms, whatever you want to specialize in. Lead Engine pulls 50 real local businesses from Google Maps in 30 seconds.",
    "Each lead arrives with a website audit telling you what's broken. That's the conversation starter you didn't have to invent.",
    "One click generates a custom one-page mockup for each prospect. Show it on the call. Different conversation.",
    "First-draft opener written for you, referencing their actual site. Edit, hit send. Your first 10 emails take 15 minutes, not 8 hours.",
    "Free plan covers your first 50 prospects. Your first signed deal pays for Pro for a year.",
    "No credit card to start. If you cancel, you keep the audit data.",
  ],
  closingHeading: "Stop reading playbooks.",
  closingHeadingHighlight: "Send your first 50 emails today.",
  closingBody: "Start free with 50 leads. Your first close pays for everything.",
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SmmaPage() {
  return <VerticalLanding copy={COPY} />;
}
