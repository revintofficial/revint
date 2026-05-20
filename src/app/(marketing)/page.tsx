/**
 * Marketing homepage (v2 — F&B-first, Apple-minimal).
 *
 * Composition only: every section is its own self-contained component
 * under `src/components/marketing/v2/`. The homepage is intentionally
 * thin so the section order and metadata stay easy to reason about.
 * No interactive widgets, no scroll-stages, no hero parallax. Static
 * stills + CSS-only motion.
 *
 * Pricing is deliberately not exposed on the homepage during pre-launch:
 * plans are being shaped with the first cohort of agencies. The waitlist
 * block stands in for the pricing section until production rollout.
 */
import { buildMetadata } from "@/lib/seo/metadata";
import {
  Hero,
  ProblemGrid,
  PreCallBrief,
  HowItThinks,
  UnderstandsGrid,
  PodControlRoom,
  IntelligenceLoop,
  IntegrationsStrip,
  BuiltFor,
  WaitlistBlock,
  FaqBlock,
  FinalCta,
} from "@/components/marketing/v2";
import { HOMEPAGE_FAQ } from "@/components/marketing/v2/faq-block";
import { JsonLd, faqSchema } from "@/components/seo/json-ld";

export const metadata = buildMetadata({
  path: "/",
  title: "Pre-call briefs for BD pods.",
  description:
    "The pre-call brief in front of every dial. Fresh dossier on every restaurant your BD pod will phone this morning, with the first 30 seconds ready to read.",
  keywords: [
    "pre-call brief for sdr",
    "bd pod tool",
    "restaurant outbound brief",
    "f&b bd intelligence",
    "call opener generator for sdr",
    "restaurant prospect dossier",
    "local business calling intelligence",
    "dialer brief layer",
    "bd morning queue",
    "restaurant tech bd tool",
  ],
});

export default function LandingPage() {
  return (
    <>
      <JsonLd
        data={faqSchema(
          HOMEPAGE_FAQ.map((qa) => ({ question: qa.q, answer: qa.a })),
        )}
        id="ld-homepage-faq"
      />

      <Hero />

      <ProblemGrid />

      <PreCallBrief />

      <HowItThinks />

      <UnderstandsGrid />

      <PodControlRoom />

      <IntelligenceLoop />

      <IntegrationsStrip />

      <BuiltFor />

      <WaitlistBlock />

      <FaqBlock />

      <FinalCta />
    </>
  );
}
