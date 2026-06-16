import type { Metadata } from "next";
import {
  Hero,
  ProofRow,
  StackLayersDiagram,
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
import { painsByIds } from "@/content/site/pains";
import { PERSONAS } from "@/content/site/personas";
import { FAQS } from "@/content/site/faq";

/**
 * Homepage — /
 *
 * Posture: Apple/Clari. Centered hero (single column, large light type,
 * one anchor pill), then the layered-stack diagram as the marquee visual,
 * then the brief preview as its own "what the rep opens" section.
 *
 * Psych model: Anchoring + Contrast + Status-quo bias break (psych-map).
 * Structure:
 *   hero (centered) → proof row → stack layers → in-CRM brief →
 *   problem grid → closed loop → persona quote → FAQ → CTA.
 *
 * Anchor pattern: hero prices LeadAC against the $100K/yr Gong floor so the
 * category reads as operational intelligence, not another lead list.
 */

export const metadata: Metadata = buildMetadata({
  path: "/",
  title:
    "LeadAC — operational revenue intelligence for SMB markets",
  description:
    "LeadAC is the memory layer that learns what closes in local-business markets and tells your reps the next best action, inside the HubSpot card they already open. Built for vertical SaaS GTM teams selling to SMBs at $2M–$50M ARR.",
});

export default function HomePage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd id="ld-site" data={websiteSchema()} />
      <JsonLd id="ld-app" data={softwareApplicationSchema()} />

      <Hero
        layout="center"
        eyebrow="Operational revenue intelligence for SMB markets"
        headline="We remember what closes in local-business markets."
        subhead="Bring the stack you already run. LeadAC scores every account against the deals your team has actually won, then writes the next best move into the HubSpot card your SDR already opens."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Same money as",
          label: "the $100K/yr Gong floor, minus the 8-week setup.",
        }}
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
              "From signup to your first brief. You won't need a RevOps engineer.",
          },
        ]}
      />

      <StackLayersDiagram
        eyebrow="Works with the stack you already run"
        title="Apollo finds. Clay enriches. Gong records. LeadAC remembers."
        subtitle="Two layers do the work. Sales Intelligence reads every account and turns its operational signals into a sales angle. Operational Intelligence learns which of those signals actually closed and makes every claim carry its evidence. Both write into the HubSpot card your SDR already opens."
      />

      <section className="site-section">
        <div className="site-container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="site-eyebrow mb-3">What the rep opens</div>
            <h2 className="text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-paper-0 md:text-[52px]">
              The Account Intelligence Brief is already in the HubSpot card.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-paper-2 md:text-[19px]">
              Your SDR doesn&rsquo;t open a research doc or dig through five tabs.
              The fit score, the reason it matters this week, and the opener are
              sitting on the company record before the dial.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-xl">
            <PreCallBriefCard
              account="Pacific Coast Eats Group"
              tag="Restaurant tech · 4 locations · Migration candidate"
              context="Multi-location group on OpenTable Lite. Two new locations opened in the last 90 days, and the owner just posted a hiring opening for an Operations Director in Seattle. Reviews mention waitlist friction at the flagship."
              signals={[
                {
                  label: "Stack signature",
                  value: "OpenTable Lite + Square POS",
                },
                { label: "Location count", value: "4 (3 active, 1 opening)" },
                { label: "Owner activity", value: "Hiring · last 14 days" },
                { label: "Review tone", value: "Operations-strained" },
              ]}
              nextAction={{
                label: "Call the operator this week",
                reason:
                  "Three of your last four closed-won deals looked exactly like this: OpenTable Lite, four-plus locations, expansion in the last 90 days. Those closed in 19 days on average.",
              }}
              opener="Saw you opened the Belltown location two weeks ago. Most groups on OpenTable Lite hit a waitlist ceiling around four spots. Want the brief on what worked for two other Pacific Northwest groups that moved up to the full platform last quarter?"
            />
          </div>
        </div>
      </section>

      <ProblemGrid
        eyebrow="What's broken"
        title="Your sales team has no memory."
        intro="Everything your best rep knows — which accounts are worth a call, what to say, why the last one closed — lives in their head. Then they ramp for months, switch verticals, or quit, and it resets to zero. The stack underneath them stores activity, not judgment, so nobody learns from the deals you already won. The research backs this up."
        pains={painsByIds([
          "P-014",
          "P-004",
          "P-016",
          "P-015",
          "P-011",
          "P-001",
        ])}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won and lost deal sharpens the next list on its own."
        subtitle="Your CRM already knows what closes. LeadAC reads the closed-won and closed-lost records back into discovery, then weights the next ICP query toward the pattern your team keeps winning."
      />

      <QuoteBlock persona={PERSONAS.mike} />

      <FaqBlock
        eyebrow="Buyer questions"
        entries={FAQS.home}
        title="What buyers ask before they pick LeadAC"
      />

      <CtaBlock
        eyebrow="Twenty minutes, on your own data"
        title="Bring one prospect URL. We'll show you the brief that lands in the HubSpot card."
        subtitle="Skip the slideware. Paste a prospect URL on the call, we run LeadAC live, and you see the field map and the suggested opener before we hang up."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
