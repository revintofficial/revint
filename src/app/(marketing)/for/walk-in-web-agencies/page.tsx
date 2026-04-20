/**
 * P0.9 - Walk-in web agency vertical landing page (4. ICP).
 *
 * Hedef: Londra'da sahada gezip yerel işletmelere site satmaya çalışan
 * 22 yaşında 3 kişilik grup. Plan §6 ICP4'ün direkt karşılığı.
 *
 * Hero: "Walk in. Open the tablet. Close the deal."
 * Pricing CTA: Pro Team $149/3 seat (P0.8'de eklendi).
 *
 * Mevcut /for/agencies pattern'ini kopyala, COPY object'i ICP4 için yeniden
 * yaz, demo akışı tablet view'a göre optimize edilir (PWA + responsive UI'ya
 * yönlendirir).
 */

import { Tablet, MapPinned, Hand } from "lucide-react";
import { type VerticalCopy } from "@/components/marketing/vertical-landing";
import { WalkInLanding } from "@/components/marketing/walk-in-landing";
import {
  AGENCY_LEADS,
  AGENCY_CITIES,
  AGENCY_NICHES,
} from "@/components/marketing/interactive/demo-data";

const COPY: VerticalCopy = {
  metaTitle: "Leadac AI for walk-in web sales crews - the tablet does the talking",
  metaDescription:
    "Door-knocking websites in 2026 means selling to a guy who's been told every agency is scamming him. Leadac AI puts his actual broken site on your tablet in 20 seconds, before he writes you off.",
  eyebrow: "For door-to-door web sales crews",
  h1: "He's been pitched five times this week.",
  h1Highlight: "You've got 30 seconds before he writes you off.",
  sub: "The plumber on the other side of the door reads r/smallbusiness on his lunch break, and the top comment last week called local SEO agencies 'borderline scamming'. Your portfolio doesn't fix that. His own broken site loaded on your tablet in 20 seconds does. Leadac AI handles the leads, the audit, and the mockup. The walking is still you.",
  primaryCta: "Try it with 50 free leads",
  validationQuote: {
    source: "11 days ago · plumber asking about a $3,500/mo SEO quote",
    subreddit: "smallbusiness",
    upvotes: 144,
    comments: 255,
    text: "That's excessive. You'll be able to find a more economical one that's just as effective. This is absolutely not worth it to you. Charging that much for a local Plumber is borderline scamming.",
  },
  painsHeading: "What you're actually up against on the doorstep.",
  pains: [
    {
      icon: Hand,
      title: "He's heard the pitch already",
      body: "Five other agencies knocked this month. Squarespace keeps emailing him about its AI builder. Reddit told him to just open Google Ads. By the time you say 'website', he's reaching for the door.",
    },
    {
      icon: Tablet,
      title: "Promises don't beat proof",
      body: "Your portfolio is somebody else's site. He doesn't care. The only thing that turns the conversation is his own site, on a screen, with the broken parts circled. You can either build that on the spot or leave a brochure that goes in the bin.",
    },
    {
      icon: MapPinned,
      title: "Forty doors a day, no memory by 6pm",
      body: "You parked in Camden, knocked on five barbers, walked back to the car, opened a spreadsheet, and couldn't remember which one said 'maybe next week'. The crew ends up calling the same shop twice. Half the day's pipeline dies in transit.",
    },
  ],
  proofHeading: "What changes when the tablet does the talking.",
  proofTourTitle: "One morning, four screens, no deck.",
  proofPoints: [
    "Type 'Camden + plumber' in the cab. 47 audited leads loaded before the first knock, sorted by which sites are most broken.",
    "Tap his shop. His site loads in 6.2 seconds, has no booking widget, last updated 2019. The screen runs the first 20 seconds of the conversation, not you.",
    "Hit 'Generate website plan'. 20 seconds later he's looking at a hero, his actual services, a booking button, a price. Hand him the tablet and let him scroll. Most owners stop arguing once they're touching it.",
    "Voice memo on the way to the next door. 30 seconds, auto-transcribed, attached to the lead. No 'I'll write it up tonight' lie that you'll forget by 9pm.",
    "Pro Team is $149 a month for three of you. Shared workspace, voice notes, mockups, the lot. One signed deposit covers it for a year.",
    "At night, push the 'maybe' leads into Smartlead. The follow-up writes itself - 'we walked past your shop today, here's the mockup we showed you'. Auto-send stays off; one of you ships it from the sofa.",
    "Tomorrow morning, GPS sorts the next 30 leads by walking distance. Hackney, then Hammersmith. The walking part is still yours. The pipeline is the platform.",
  ],
  closingHeading: "He doesn't believe you yet.",
  closingHeadingHighlight: "Show him before you talk.",
  closingBody:
    "50 fresh leads, his actual broken site, your mockup in 20 seconds. No card needed. Open it on the iPad you're taking out tomorrow morning.",
  demoCities: AGENCY_CITIES,
  demoNiches: AGENCY_NICHES,
  demoLeads: AGENCY_LEADS,
  beforeAfter: {
    beforeLabel: "Brochure · in the bin before you reach the car",
    afterLabel: "His own site, fixed · the owner scrolls through it himself",
  },
};

export const metadata = {
  title: COPY.metaTitle,
  description: COPY.metaDescription,
};

export default function WalkInWebAgenciesPage() {
  return <WalkInLanding copy={COPY} />;
}
