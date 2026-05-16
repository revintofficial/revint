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
  HowItThinks,
  UnderstandsGrid,
  IntelligenceLoop,
  DossierProof,
  BuiltFor,
  IntegrationsStrip,
  WaitlistBlock,
  FaqBlock,
  FinalCta,
} from "@/components/marketing/v2";

export const metadata = buildMetadata({
  path: "/",
  title: "LeadAC — AI outbound system for local business sales.",
  description:
    "LeadAC finds local businesses showing buying signals, analyzes their online presence, and generates outreach angles your agency can act on immediately. Built for agencies selling to restaurants, cafes, bars, bakeries, and ghost kitchens.",
  keywords: [
    "ai outbound for agencies",
    "local business lead generation",
    "restaurant lead intelligence",
    "f&b outbound system",
    "ai sdr operating system",
    "google maps lead generation",
    "agency lead intelligence",
    "restaurant marketing outbound",
    "audit-driven cold email",
    "local business prospecting",
  ],
});

export default function LandingPage() {
  return (
    <>
      <Hero />

      <ProblemGrid />

      <HowItThinks />

      <UnderstandsGrid />

      <IntelligenceLoop />

      <DossierProof />

      <BuiltFor />

      <IntegrationsStrip />

      <WaitlistBlock />

      <FaqBlock />

      <FinalCta />
    </>
  );
}
