import type { Metadata } from "next";
import {
  Hero,
  ProblemGrid,
  ClosedLoopDiagram,
  PreCallBriefCard,
  LearnedPatternCard,
  BeforeAfterTable,
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
import { FAQS } from "@/content/site/faq";

/**
 * Homepage — /
 *
 * v3: one ICP (vertical SaaS GTM leader selling into local business), one
 * vertical example (restaurant), two concepts (memory + next-best-action).
 * Conversion-ordered, ~half the length of v2 — the stack diagram, the
 * efficiency proof-row, the persona quote, and the multi-vertical pattern
 * strip were cut to keep a single narrative spine: a closed-loop revenue
 * learning system.
 *
 * Order:
 *   1. hero            — one-line definition: past wins → next accounts.
 *   2. why ORI         — the data-ontology shift: signals, not firmographics.
 *   3. memory          — the brief + the one learned pattern behind it.
 *   4. problem         — felt, not paper: the CRM stores activity, not judgment.
 *   5. closed loop     — the memory compounds with every won/lost deal.
 *   6. before → after  — the transformation (+ proof anchor).
 *   7. FAQ → CTA.
 */

export const metadata: Metadata = buildMetadata({
  path: "/",
  title: "Revint — operational revenue intelligence for SMB markets",
  description:
    "Revint learns the pattern behind your closed-won deals and scores every new account against it — then drops the next best action into the HubSpot card your rep already opens. Built for vertical SaaS GTM teams selling to local business at $2M–$50M ARR.",
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
        headline="We turn your past wins into the next accounts your SDR should call."
        subhead="Revint learns the pattern behind your closed-won deals, scores every new account against it, and drops the next move into the HubSpot card your rep already opens."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Same money as",
          label: "the $100K/yr Gong floor, minus the 8-week setup.",
        }}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="site-eyebrow mb-3">Why operational intelligence</div>
            <h2 className="text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-paper-0 md:text-[52px]">
              Local businesses don&rsquo;t have firmographics. They have signals.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-paper-2 md:text-[19px]">
              A restaurant doesn&rsquo;t buy because it has 120 employees. It buys
              when the operation changes. Those signals never reach a database, so
              Revint reads them off the open web and remembers which ones turned
              into revenue.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                signal: "Reviews dropped",
                why: "Service strain. A switching window just opened.",
              },
              {
                signal: "Expansion started",
                why: "New locations in the last 90 days. Budget is moving.",
              },
              {
                signal: "Stack changed",
                why: "A POS or platform migration — the buying moment.",
              },
              {
                signal: "Hiring accelerated",
                why: "Ops scaling faster than the current tools allow.",
              },
              {
                signal: "Waitlist pressure",
                why: "Capacity pain showing up in the reviews.",
              },
            ].map((s) => (
              <div
                key={s.signal}
                className="rounded-xl border border-paper-2/15 bg-paper-2/5 p-4 text-left"
              >
                <div className="text-[15px] font-medium text-paper-0">
                  {s.signal}
                </div>
                <div className="mt-1 text-[13px] leading-relaxed text-paper-2">
                  {s.why}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="site-eyebrow mb-3">The memory, made visible</div>
            <h2 className="text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-paper-0 md:text-[52px]">
              The recommendation, and the memory behind it.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-paper-2 md:text-[19px]">
              Left: the brief your rep opens in HubSpot. Right: the closed-won
              pattern behind it — so the next move is a learned behavior, not an
              AI guess.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-start">
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
                  "Matches closed-won pattern #14 — three of your last four wins looked exactly like this and closed in 19 days on average.",
              }}
              opener="Saw you opened the Belltown location two weeks ago. Most groups on OpenTable Lite hit a waitlist ceiling around four spots. Want the brief on what worked for two other Pacific Northwest groups that moved up to the full platform last quarter?"
            />
            <LearnedPatternCard
              patternId="Closed-won pattern #14"
              signals={["OpenTable Lite", "4+ locations", "Expansion < 90 days"]}
              stats={[
                { label: "Accounts seen", value: "37" },
                { label: "Won", value: "9" },
                { label: "Lost", value: "2" },
              ]}
              winRate={82}
              confidence="T3"
              footnote="Learned from your own HubSpot closed-won and closed-lost records — so the recommendation on the left carries the pattern that earned it."
            />
          </div>
        </div>
      </section>

      <ProblemGrid
        eyebrow="What's broken"
        title="Your sales team has no memory."
        intro="Your CRM stores activity, not judgment. It knows what happened — not why it happened. So everything your best rep knows — which accounts to call, why the last deal closed — lives in their head until they ramp out or quit. Then the next hire starts from zero, and nobody learns from the deals you already won."
        pains={painsByIds(["P-014", "P-015"])}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won and lost deal sharpens the next list on its own."
        subtitle="Revint reads your closed-won and closed-lost records back into discovery, then weights the next list toward the pattern your team keeps winning — so each cycle skews toward accounts that look like revenue, not just accounts that look like your ICP."
      />

      <BeforeAfterTable
        eyebrow="The shift"
        title="From guessing to pattern-driven."
        subtitle="Same stack, same reps. The difference is whether the system remembers why you win — or whether that knowledge leaves when the rep does."
        rows={[
          {
            before: "Reps lose hours every week to manual account research.",
            after: "Every account arrives scored against your closed-won patterns.",
          },
          {
            before: "The CRM is full of activity and empty of judgment.",
            after: "The next best action is waiting inside the HubSpot card.",
          },
          {
            before: "ICP is a guess; lists go stale within a quarter.",
            after: "Each won and lost deal sharpens the next list automatically.",
          },
          {
            before: "Win patterns walk out the door at every resignation.",
            after: "The pattern stays in the system when the rep leaves.",
          },
        ]}
      />

      <FaqBlock
        eyebrow="Buyer questions"
        entries={FAQS.home}
        title="What buyers ask before they pick Revint"
      />

      <CtaBlock
        eyebrow="Twenty minutes, on your own data"
        title="Bring one prospect URL. We'll show you the brief that lands in the HubSpot card."
        subtitle="Skip the slideware. Paste a prospect URL on the call, we run Revint live, and you see the field map and the suggested opener before we hang up."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
