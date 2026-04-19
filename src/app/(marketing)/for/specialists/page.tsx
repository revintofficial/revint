import { Compass, Send, Briefcase } from "lucide-react";
import { VerticalLanding, type VerticalCopy } from "@/components/marketing/vertical-landing";

const COPY: VerticalCopy = {
  metaTitle: "Lead Engine for vertical specialists — Klaviyo, Webflow, GoHighLevel agencies",
  metaDescription:
    "You know the work. You don't know the client acquisition. Lead Engine gives you ready-to-pitch local leads with mockups, so you can stop guessing and start selling.",
  eyebrow: "For vertical specialists starting their own agency",
  h1: "You know the work.",
  h1Highlight: "We'll handle the pipeline.",
  sub: "Klaviyo, Webflow, GoHighLevel, Shopify Plus, Notion — you've got the deliverable nailed. Lead Engine gives you a ready-to-pitch list of local prospects, each with a custom mockup, so client acquisition stops being your bottleneck.",
  primaryCta: "Get my first 50 leads free",
  validationQuote: {
    source: "From r/agency, 1 day ago",
    text: "I've worked as an executor in 3 Klaviyo agencies. Brands generate 7-8 figure/year, I have case studies — but I worked as an executor and don't know how agencies acquire clients.",
  },
  painsHeading: "Three things between you and your first 5 clients.",
  pains: [
    {
      icon: Briefcase,
      title: "You know the deliverable",
      body: "Klaviyo flows, Webflow builds, GoHighLevel automations — you've shipped them dozens of times. You're not the bottleneck.",
    },
    {
      icon: Compass,
      title: "You don't know the prospecting",
      body: "Cold email looks like a foreign language. Apollo is overwhelming. You don't have a system, just hope.",
    },
    {
      icon: Send,
      title: "You can't show value upfront",
      body: "A generic 'I do Klaviyo' email gets ignored. You need something specific, fast, and free to send before they trust you.",
    },
  ],
  proofHeading: "What changes for you.",
  proofPoints: [
    "Pick your specialty (e-commerce brands for Klaviyo, local services for Webflow, etc.) and Lead Engine pulls a fresh prospect list from Google Maps in 30 seconds.",
    "Each lead comes with a website audit pinpointing exactly what's broken — the conversation starter you couldn't write yourself.",
    "Generate a one-page custom mockup for each shortlisted prospect. Attach it to your cold email. The reply isn't 'who are you', it's 'how much.'",
    "First-draft opener references their actual site, written in plain language. You edit the parts that need your voice and ship.",
    "Track every conversation in a built-in pipeline. Notes, status, meeting outcomes — no GoHighLevel CRM setup needed.",
    "Skip the cold email guru courses. The system is the product, not the playbook.",
  ],
  closingHeading: "Stop guessing how to sell.",
  closingHeadingHighlight: "Start with 50 ready-to-pitch leads.",
  closingBody: "Free to start. No credit card. Your first deal pays for the year.",
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SpecialistsPage() {
  return <VerticalLanding copy={COPY} />;
}
