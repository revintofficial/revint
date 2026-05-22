import type { Metadata } from "next";
import {
  Hero,
  ProofRow,
  StackPositionDiagram,
  ProblemGrid,
  ClosedLoopDiagram,
  PreCallBriefCard,
  QuoteBlock,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "@/components/seo/json-ld";
import { painsForVertical } from "@/content/site/pains";
import { PERSONAS } from "@/content/site/personas";
import { FAQS } from "@/content/site/faq";

/**
 * Homepage — /
 *
 * Psych model: Anchoring + Contrast + Status-quo bias break (psych-map).
 * Structure per _style-guide.md §2:
 *   eyebrow → headline → subhead → CTAs → proof row → stack position →
 *   problem grid → closed loop → in-CRM preview → persona quote →
 *   FAQ → CTA.
 *
 * Anchor pattern: hero shows "$29K/yr Apollo+Clay+Gong+Smartlead stack"
 * so the LeadAC price reads as a small additive line, not a switch cost.
 */

export const metadata: Metadata = buildMetadata({
  path: "/",
  title:
    "LeadAC — operational intelligence for vertical SaaS sales teams",
  description:
    "LeadAC is the memory layer your CRM never had. We find the right local accounts, sync vertical context into HubSpot, and learn from every won and lost deal. Built for vertical SaaS GTM teams at $2M–$50M ARR.",
});

export default function HomePage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd id="ld-site" data={websiteSchema()} />
      <JsonLd id="ld-app" data={softwareApplicationSchema()} />

      <Hero
        eyebrow="Operational intelligence for vertical SaaS"
        headline="We remember what closes for vertical SaaS sales teams."
        subhead="Apollo finds. Clay enriches. Gong records. LeadAC remembers — inside the HubSpot card your SDR already opens before every dial."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Same money as",
          label: "$100K/yr Gong floor — without the 8-week onboarding.",
        }}
        visual={
          <PreCallBriefCard
            account="Pacific Coast Eats Group"
            tag="Restaurant tech · 4 locations · Migration candidate"
            context="Multi-location group on OpenTable Lite. Two new locations added in the last 90 days, owner posted a hiring opening for an Operations Director in Seattle. Reviews mention waitlist friction at the flagship."
            signals={[
              {
                label: "Stack signature",
                value: "OpenTable Lite + Square POS",
              },
              { label: "Location count", value: "4 (3 active, 1 opening)" },
              { label: "Owner activity", value: "Hiring · last 14 days" },
              { label: "Review tone", value: "Operations-strained" },
            ]}
            opener="Saw you opened the Belltown location two weeks ago — most groups on OpenTable Lite hit a waitlist ceiling around four spots. Want the brief on what worked for two other Pacific Northwest groups that moved up to the full platform last quarter?"
          />
        }
      />

      <ProofRow
        cells={[
          {
            value: "5.6 hrs",
            label: "Per SDR per week spent on manual research before LeadAC.",
            source: {
              name: "Salesforce State of Sales 2026",
              url: "https://salesmotion.io/blog/sales-team-manual-account-research-time",
            },
          },
          {
            value: "$22K/rep/yr",
            label: "Burned on account research at the average SDR salary.",
            source: {
              name: "Kwanzoo synthesis",
              url: "https://www.kwanzoo.com/blog/sdrs-spend-40-percent-researching-leads",
            },
          },
          {
            value: "12 fields",
            label:
              "Written into the HubSpot company record on the first sync.",
          },
          {
            value: "< 1 hr",
            label:
              "Onboarding to first brief — no RevOps engineer required.",
          },
        ]}
      />

      <StackPositionDiagram
        eyebrow="Where we live in your stack"
        title="Apollo finds. Clay enriches. Gong records. LeadAC remembers."
        subtitle="We do not replace your stack. We sit one layer below the orchestrator and tie the four boxes together with the memory layer they don't share."
      />

      <ProblemGrid
        eyebrow="What's broken"
        title="The dominant outbound stack was built for desk-worker B2B."
        intro="Apollo, Clay, Gong, Outreach — all built for B2B SaaS selling to other B2B SaaS, where the buyer has a LinkedIn profile and a Crunchbase entry. Vertical SaaS GTM teams selling to local business sit in the gap below."
        pains={painsForVertical("cross-vertical", 6)}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won and lost deal sharpens the next list — automatically."
        subtitle="Your CRM is already telling you what closes. LeadAC reads the closed-won and closed-lost signals back into the discovery layer, then weights the next ICP query against your team's own pattern."
      />

      <QuoteBlock persona={PERSONAS.mike} />

      <FaqBlock
        eyebrow="Buyer questions"
        entries={FAQS.home}
        title="What buyers ask before they pick LeadAC"
      />

      <CtaBlock
        eyebrow="Twenty minutes, on your own data"
        title="Bring one prospect URL. We'll show you the brief that lands in your HubSpot card."
        subtitle="No slideware. Paste a URL on the call, we run LeadAC live, you see the field map and the suggested opener before the call ends."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
