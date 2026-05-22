/**
 * Marketing homepage (v2).
 *
 * Composition only: every section is its own self-contained component
 * under `src/components/marketing/v2/`. The homepage is intentionally
 * thin so the section order and metadata stay easy to reason about.
 * No interactive widgets, no scroll-stages, no hero parallax. Static
 * stills + CSS-only motion.
 *
 * Positioning: revenue intelligence for local business acquisition.
 * F&B is the live cohort. Medspa, home services, and fitness are
 * marked as coming soon — see `understands-grid.tsx`.
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
  OneWeek,
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
  title: "Revenue intelligence for local business acquisition.",
  description:
    "LeadAC turns outreach, enrichment, and campaign outcomes into niche-specific revenue intelligence agencies can operate on. See what converts. See what stalls. Act before outreach slips.",
  keywords: [
    "revenue intelligence for local business acquisition",
    "outbound revenue intelligence",
    "niche-specific outreach intelligence",
    "agency lead generation platform",
    "outreach learning loop",
    "reply rate optimization",
    "f&b bd intelligence",
    "win pattern aggregation",
    "outreach execution platform",
    "local business acquisition software",
    "adaptive revenue intelligence",
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

      <OneWeek />

      <IntegrationsStrip />

      <BuiltFor />

      <WaitlistBlock />

      <FaqBlock />

      <FinalCta />
    </>
  );
}
