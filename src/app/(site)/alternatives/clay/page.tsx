import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Hero,
  ProofRow,
  ComparisonTable,
  ProblemGrid,
  QuoteBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  articleSchema,
} from "@/components/seo/json-ld";
import { PERSONAS } from "@/content/site/personas";
import { PAINS } from "@/content/site/pains";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/alternatives/clay";
const TITLE =
  "Clay alternatives for vertical SaaS — when the workshop is the wrong tool";
const DESCRIPTION =
  "Clay is powerful, flexible, and requires a GTM engineer. For vertical SaaS GTM teams without one, here are five finished-product alternatives sorted by when each one fits.";
const PUBLISHED = "2026-05-22";

const ALTS = [
  {
    name: "Revint",
    pitch:
      "Finished vertical packs — Field service, Restaurant tech, Dental — instead of a programmable workflow runtime.",
    fit: "Best when you don't have a GTM engineer, send under 10K emails/month, or want pre-built workflows for your specific vertical.",
    cost: "$18,000/yr for 5 seats",
    isUs: true,
  },
  {
    name: "Apollo",
    pitch:
      "B2B SaaS contact database with sequencing built in. Different primitive than Clay — list of people, not workflow chain.",
    fit: "Best when you need contact volume and basic personalisation but not credit-burning enrichment chains.",
    cost: "$1,392/yr for one seat (Pro)",
  },
  {
    name: "Instantly",
    pitch:
      "Email outbound platform with deliverability tooling. Sender, not enricher.",
    fit: "Best when your bottleneck is sending volume and inbox warmup, not data enrichment.",
    cost: "$444/yr starter",
  },
  {
    name: "Smartlead",
    pitch:
      "Sequencer that pairs with Revint's brief variables natively. Sender of record, not workflow runtime.",
    fit: "Best when you already have decent data and just need a clean sender + reply loop.",
    cost: "$468/yr Pro",
  },
  {
    name: "Ocean.io",
    pitch:
      "Look-alike account discovery with firmographic filtering. Lighter Clay competitor with less engineering tax.",
    fit: "Best when you want Clay-style enrichment without the credit overrun risk and don't need 150 providers.",
    cost: "$10K-$30K/yr typical",
  },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function ClayAlternativesPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Alternatives", url: "/alternatives" },
          { name: "Clay alternatives", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-article"
        data={articleSchema({
          headline: TITLE,
          description: DESCRIPTION,
          url: `${SITE.url}${PATH}`,
          datePublished: PUBLISHED,
          authorName: SITE.name,
          tags: ["Clay alternatives", "GTM engineering", "vertical SaaS"],
        })}
      />

      <Hero
        eyebrow="Alternatives · Clay"
        headline="When the workshop is the wrong tool."
        subhead="Clay is a programmable enrichment workshop. Powerful, flexible, and a tax on teams that don't have a GTM engineer. If you fit the staffing assumption, keep Clay. If you don't, these are the five finished-product alternatives ranked by when each fits."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/vs/clay", label: "Direct comparison vs Clay" }}
        anchor={{
          note: "Clay credit burn threshold",
          label: "Not worth it under 10K emails/month — SalesEcho 2026",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "10k emails/mo",
            label:
              "Threshold where Clay's credit burn stops being worth the workshop tax.",
            source: {
              name: "SalesEcho Clay Review",
              url: "https://www.sales-echo.com/blog/clay-review",
            },
          },
          {
            value: "Required",
            label:
              "GTM engineer to operate Clay at any non-trivial scope.",
          },
          {
            value: "5 alts",
            label:
              "Each carries a different primitive — pick the one that matches your staffing.",
          },
          {
            value: "3 packs",
            label:
              "Revint vertical packs that ship the workflow Clay teams try to build in week one.",
          },
        ]}
      />

      <section className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">The five alternatives</div>
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              Each option is a different primitive. Read them as a menu, not a leaderboard.
            </h2>
          </div>
          <div className="mt-12 grid gap-4">
            {ALTS.map((a) => (
              <article
                key={a.name}
                className={`flex flex-col gap-6 rounded-2xl border bg-ink-1 p-6 md:flex-row md:items-start md:gap-8 md:p-8 ${
                  a.isUs ? "border-signal" : "border-ink-3"
                }`}
              >
                <div className="md:w-1/3">
                  <div className="flex items-center gap-2">
                    {a.isUs ? <span className="site-signal-dot" /> : null}
                    <div className="text-[20px] font-medium text-paper-0">
                      {a.name}
                    </div>
                  </div>
                  <div className="site-mono mt-2 text-[12px] uppercase tracking-wider text-paper-3">
                    {a.cost}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] leading-relaxed text-paper-1">
                    {a.pitch}
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-paper-2">
                    <span className="text-paper-0">When it fits.</span>{" "}
                    {a.fit}
                  </p>
                  {a.isUs ? (
                    <Link
                      href="/vs/clay"
                      className="mt-4 inline-flex items-center gap-2 text-[13px] text-signal hover:underline"
                    >
                      Side-by-side: Revint vs Clay
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ComparisonTable
        eyebrow="Capability matrix"
        title="What each alternative does instead of Clay's primitive."
        subtitle="Clay is freeform workflow. Each row asks: does this tool need a GTM engineer to operate?"
        columns={[
          { label: "Clay Growth" },
          { label: "Revint Team", isUs: true, subLabel: "from $18,000/yr" },
          { label: "Apollo Pro" },
          { label: "Smartlead Pro" },
          { label: "Ocean.io" },
        ]}
        rows={[
          {
            capability: "Programmable workflow runtime",
            values: ["yes", "no", "partial", "no", "partial"],
          },
          {
            capability: "Requires GTM engineer",
            values: ["yes", "no", "no", "no", "partial"],
          },
          {
            capability: "Vertical packs (HVAC, restaurant, dental)",
            values: ["no", "yes", "no", "no", "no"],
          },
          {
            capability: "Credit-based pricing risk",
            values: ["yes", "no", "no", "no", "partial"],
          },
          {
            capability: "Native email sequencing",
            values: ["no", "no", "yes", "yes", "no"],
          },
          {
            capability: "Local-business operational signals",
            values: ["partial", "yes", "no", "no", "no"],
          },
          {
            capability: "Onboarding time",
            values: ["1-4 weeks", "≤ 1 hr", "≤ 1 hr", "≤ 1 hr", "1-2 weeks"],
          },
        ]}
        sources={[
          {
            name: "Clay pricing & docs",
            url: "https://www.clay.com/pricing",
          },
          {
            name: "SalesEcho Clay Review, 2026",
            url: "https://www.sales-echo.com/blog/clay-review",
          },
        ]}
      />

      <ProblemGrid
        eyebrow="When Clay is the wrong tool"
        title="Three signs the workshop is more tax than value."
        intro="Clay is real and well-built. These are the moments the staffing assumption breaks."
        pains={PAINS.filter((p) => ["P-003", "P-007", "P-008"].includes(p.id))}
      />

      <QuoteBlock persona={PERSONAS.daniel} />

      <CtaBlock
        eyebrow="The pilot"
        title="Run the Revint vertical pack for 30 days. Decide at the end."
        subtitle="If our vertical pack covers your motion, you'll know inside the first hour. If you need freeform workflow logic Clay handles, we'll say so on the call and point you back."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
