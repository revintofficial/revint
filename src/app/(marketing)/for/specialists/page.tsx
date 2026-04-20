import { Compass, Send, Briefcase } from "lucide-react";
import { type VerticalCopy } from "@/components/marketing/vertical-landing";
import { SpecialistsLanding } from "@/components/marketing/specialists-landing";
import {
  SPECIALIST_LEADS,
  SPECIALIST_CITIES,
  SPECIALIST_NICHES,
} from "@/components/marketing/interactive/demo-data";

const COPY: VerticalCopy = {
  metaTitle:
    "Leadac AI for vertical specialists - the deliverable is yours, the pipeline is ours",
  metaDescription:
    "You shipped Klaviyo flows and Webflow builds in three agencies. You never saw how those agencies got clients. Leadac AI gives you 50 audited prospects with mockups, so the cold start stops being the part you guess at.",
  eyebrow: "For vertical specialists going independent",
  h1: "You shipped 50 flows.",
  h1Highlight: "You never sent 50 emails.",
  sub: "You spent three years executing inside someone else's agency. The deliverable is muscle memory by now. What you never saw was how the agency landed those clients in the first place. Leadac AI gives you a fresh prospect list, an audit on each one, a custom mockup for the call, and the opener already drafted. The pipeline stops being the part you guess at.",
  primaryCta: "Get my first 50 leads free",
  validationQuote: {
    source: "1 day ago - Klaviyo specialist starting their own agency",
    subreddit: "agency",
    upvotes: 6,
    comments: 14,
    text: "I've worked as an account manager and Klaviyo Specialist in three different agencies. Most of the brands I worked with generate 7-8 figure/year and I have enough case studies. Problem is, I worked as an executor, and I don't know how agencies acquire clients.",
  },
  painsHeading: "The deliverable is the easy part. The cold start is not.",
  pains: [
    {
      icon: Briefcase,
      title: "You know the work cold",
      body: "Klaviyo flows, Webflow builds, custom email templates. Two agencies and a third on the side. The execution is muscle memory by now.",
    },
    {
      icon: Compass,
      title: "You never saw how the lead got there",
      body: "The CEO posted on LinkedIn, the founder ran ads, somebody booked a call. By the time the brief hit your desk, the hard part was already done. Now you do the hard part too.",
    },
    {
      icon: Send,
      title: "'I do Klaviyo' opens nothing",
      body: "A generic 'I help brands with email' email gets ignored. The reply rate is zero unless the cold email already proves you understand what they ship and what they're missing.",
    },
  ],
  proofHeading: "What changes for you.",
  proofTourTitle: "From the deliverable you know to the pipeline you didn't.",
  proofPoints: [
    "Pick your specialty. Leadac AI pulls a fresh prospect list from Google Maps in 30 seconds. Filtered by site signal, not bought from Apollo.",
    "Each lead arrives with a website audit pinpointing what's broken. That's the cold-email opener you couldn't write yourself.",
    "Generate a one-page custom mockup for each shortlisted prospect. Attach the link in the cold email. Replies start with 'how soon can you start' instead of 'who are you'.",
    "First-draft opener references their actual site, in plain English. You edit the parts that need your voice and ship.",
    "Track every conversation in a built-in pipeline. Notes, status, meeting outcomes live with the lead. You don't need a second CRM.",
    "Voice notes between meetings get auto-transcribed and pinned to the lead. The follow-up writes itself by Friday.",
    "When you're ready to scale, push 'maybe' leads into Smartlead in two clicks. Auto-send stays off; you ship the email.",
  ],
  closingHeading: "The deliverable was always yours.",
  closingHeadingHighlight: "The pipeline doesn't have to be.",
  closingBody:
    "50 fresh leads, audits, mockups, opener. Free plan, no card. The first signed retainer pays for Pro for a year.",
  demoCities: SPECIALIST_CITIES,
  demoNiches: SPECIALIST_NICHES,
  demoLeads: SPECIALIST_LEADS,
  beforeAfter: {
    beforeLabel: "Klaviyo flows · executor",
    afterLabel: "Leadac AI pipeline · operator",
  },
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function SpecialistsPage() {
  return <SpecialistsLanding copy={COPY} />;
}
