import { Rocket, Eye, Handshake } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for new SMMA owners — start with leads, not theory",
  metaDescription:
    "You took the course. You watched the YouTube. Now you need clients. Lead Engine gives you ready-to-pitch local leads with mockups so your first deal happens this week.",
  eyebrow: "For SMMA owners getting their first clients",
  h1: "You took the course.",
  h1Highlight: "Now go close the deal.",
  sub: "Iman Gadzhi, Charlie Morgan, Joel Kaplan — the playbook is clear. The hard part is doing the work fast enough to land your first 3 clients before you burn out. Lead Engine handles the prospecting so you can spend your time selling.",
  primaryCta: "Get 50 leads in 5 minutes",
  validationQuote: {
    source: "From r/SMMA, 6 days ago",
    text: "Got on a call with this guy last year. Mid 30s. First thing he says is 'how old are you?' I tell him 16. He laughs. I pulled up my audit on his site and showed him 3 things he was missing. He signed a €2k/month contract 40 minutes later.",
  },
  painsHeading: "Why most new agencies die in the first 90 days.",
  pains: [
    {
      icon: Rocket,
      title: "All theory, no traction",
      body: "You watched 80 hours of YouTube. You can quote Hormozi. But you've sent zero cold emails this week because the manual research is brutal.",
    },
    {
      icon: Eye,
      title: "Generic outreach gets ignored",
      body: "Mass-blasting templates kills your domain. Personalizing each one takes an hour. Either way you ship 10 emails and quit.",
    },
    {
      icon: Handshake,
      title: "First call is a disaster without proof",
      body: "Without a portfolio or case study, prospects ghost. You need something to show — a mockup, an audit — before they take you seriously.",
    },
  ],
  proofHeading: "What you actually get.",
  proofPoints: [
    "Pick a city, pick a niche (phone repair, dental, gym, anything). Lead Engine pulls 50 real local businesses from Google Maps in 30 seconds.",
    "Each lead has a website audit telling you what's wrong — the conversation starter you didn't have to invent.",
    "One click generates a custom one-page mockup for each prospect. Show it on the cold call. Watch the dynamic change.",
    "First-draft opener written for you, referencing their actual site. Edit, hit send. Your first 10 emails take 15 minutes, not 8 hours.",
    "Free plan covers your first 50 prospects. Your first signed deal pays for Pro for a year.",
    "No credit card to start. No 'gotcha' renewal. If it doesn't work, you walk away with the audit data anyway.",
  ],
  closingHeading: "The course taught you what to do.",
  closingHeadingHighlight: "This is the tool that does it.",
  closingBody: "Start free with 50 leads. No card. Your first close pays for everything.",
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SmmaPage() {
  return <VerticalLanding copy={COPY} />;
}
