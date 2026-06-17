import type { Metadata } from "next";
import {
  Hero,
  ProofRow,
  ProblemGrid,
  ClosedLoopDiagram,
  BeforeAfterTable,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  serviceSchema,
} from "@/components/seo/json-ld";
import { painsByIds } from "@/content/site/pains";
import { FAQS } from "@/content/site/faq";

/**
 * /for/agency — the agency wedge page.
 *
 * Separate ICP from the homepage. The homepage sells the memory layer to
 * vertical SaaS GTM leaders (big category, slower sale). This page sells the
 * faster motion: agencies running outbound for local-business clients buy on
 * margin and speed, so the spine here is the research-tax / new-niche-in-days
 * story — the efficiency angle deliberately kept off the homepage.
 */

const PATH = "/for/agency";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Revint for agencies — outbound intelligence for local-business clients",
  description:
    "Run outbound for local-business clients without the manual research tax. Revint finds the right local accounts, audits every site, and grounds each opener in what the audit found — so your SDRs dial more and you onboard a new niche in days.",
});

export default function ForAgencyPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "For agencies", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: "Revint for agencies",
          description:
            "Outbound account intelligence for agencies running lead generation for local-business clients: local-account discovery, site audit, review and signal analysis, and a HubSpot-ready brief with a grounded opener.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Sales Intelligence",
          audience: ["Lead generation agencies", "Outbound agencies"],
        })}
      />

      <Hero
        layout="center"
        eyebrow="For · agencies"
        headline="Run outbound for local-business clients without the research tax."
        subhead="Revint finds the right local accounts, audits every site, and grounds each opener in what the audit found — so your SDRs ship more dials per client and you spin up a new niche in days, not weeks."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Runs in front of",
          label: "Apollo and Clay, not instead of them.",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "5.6 hrs",
            label:
              "Per SDR per week your team gets back from manual account research.",
            source: {
              name: "Salesforce State of Sales 2026",
              url: "https://salesmotion.io/blog/sales-team-manual-account-research-time",
            },
          },
          {
            value: "$22K/rep/yr",
            label: "Research cost you absorb on every outbound seat.",
            source: {
              name: "Kwanzoo synthesis",
              url: "https://www.kwanzoo.com/blog/sdrs-spend-40-percent-researching-leads",
            },
          },
          {
            value: "Days, not weeks",
            label: "To stand up a new client niche with a fresh signal pack.",
          },
          {
            value: "12 fields",
            label:
              "Written into your client's HubSpot company record on the first sync.",
          },
        ]}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="site-eyebrow mb-3">Why agencies run Revint</div>
            <h2 className="text-[34px] font-light leading-[1.05] tracking-[-0.03em] text-paper-0 md:text-[52px]">
              More dials, fatter margin, faster niches.
            </h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-3">
            {[
              {
                title: "Win the pitch with proof",
                body: "Walk into the client review with account-level intel their last agency never had — why these accounts, what changed, what closed.",
              },
              {
                title: "More dials per seat",
                body: "Reps stop researching and start dialing. The billable hours you lose to Google Maps come back as pipeline.",
              },
              {
                title: "A new niche in days",
                body: "A new client vertical means loading a signal pack, not a month of manual list-building from scratch.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-ink-3 bg-ink-1 p-6 text-left"
              >
                <div className="text-[18px] font-medium text-paper-0">
                  {c.title}
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-paper-2">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProblemGrid
        eyebrow="What's broken for agency outbound"
        title="Manual research is eating your margin."
        intro="Every hour an SDR spends digging through Google Maps, Yelp, and five browser tabs is an hour you can't bill and can't scale. Apollo's firmographics stop at the company; the local-business context your opener needs isn't in any database — so your team rebuilds it by hand, client after client."
        pains={painsByIds(["P-017", "P-018"])}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won client deal sharpens the next list."
        subtitle="Closed-won and closed-lost outcomes from each client's HubSpot flow back into discovery — so the list you build for them next month is weighted toward the accounts that actually close in their niche, not the ones that just match a filter."
      />

      <BeforeAfterTable
        eyebrow="The shift"
        title="From manual lists to a repeatable outbound engine."
        subtitle="Same SDRs, same client roster. The difference is whether every account arrives researched, or whether your team rebuilds it by hand."
        rows={[
          {
            before: "Each new client niche means a week of manual list-building.",
            after: "A new niche means loading a signal pack — live in days.",
          },
          {
            before: "SDRs burn billable hours on Google Maps research.",
            after: "SDRs open a ready brief and dial.",
          },
          {
            before: "Generic openers; reply rates sag across clients.",
            after: "Every opener is grounded in what the site audit found.",
          },
          {
            before: "Your edge walks out when an SDR leaves.",
            after: "The winning pattern stays in the system.",
          },
        ]}
      />

      <FaqBlock
        eyebrow="Agency questions"
        title="What agency owners ask before they roll Revint out."
        entries={FAQS["for-agency"]}
      />

      <CtaBlock
        eyebrow="The pilot"
        title="Run Revint on one client's niche for 30 days."
        subtitle="$500 pilot, 500 local accounts, one vertical signal pack, your client's HubSpot. Your SDRs see the first brief inside the first hour."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
