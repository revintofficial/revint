/**
 * Marketing homepage (v2).
 *
 * Composition only: every section is its own self-contained component
 * under `src/components/marketing/v2/`. The homepage is intentionally
 * thin so the section order and metadata stay easy to reason about.
 * No interactive widgets, no scroll-stages, no hero parallax. Static
 * stills + CSS-only motion.
 *
 * Positioning: revenue intelligence for local business sales — built
 * for vertical and SMB SaaS GTM teams selling into local-business
 * verticals (restaurant tech, field service, dental practice software,
 * legal practice management, etc.). Restaurant tech is the live
 * beachhead cohort — we are validating the model in production
 * alongside a design-partner SaaS vendor in that segment (intentionally
 * unnamed on the public surface). Field service / HVAC, dental, and
 * legal ship next — see `understands-grid.tsx`.
 *
 * Pricing is deliberately not exposed on the homepage during pre-launch:
 * plans are being shaped with the first cohort of vertical SaaS GTM
 * teams. The waitlist block stands in for the pricing section until
 * production rollout.
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
  title: "Revenue intelligence for local business sales.",
  description:
    "LeadAC is the revenue intelligence layer for vertical SaaS GTM teams selling into local-business verticals. Vertical-aware account discovery, deep local enrichment, CRM-native sync, and closed-loop learning from every won and lost deal.",
  keywords: [
    "revenue intelligence for local business sales",
    "vertical saas gtm platform",
    "account intelligence for vertical saas",
    "local account discovery",
    "field service saas sales intelligence",
    "restaurant tech outbound platform",
    "hvac software gtm intelligence",
    "vertical saas sdr enablement",
    "crm-native account enrichment",
    "closed-loop icp refinement",
    "local business account graph",
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
