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

/**
 * /alternatives/apollo — "Apollo alternatives" SEO surface.
 *
 * Psych: Status-quo bias break + Contrast effect. The page admits Apollo
 * is right for some teams and names the segments where the database
 * primitive runs out of road.
 */

const PATH = "/alternatives/apollo";
const TITLE =
  "Apollo alternatives for vertical SaaS — when the contact database isn't the right primitive";
const DESCRIPTION =
  "Apollo is right for B2B SaaS selling to other B2B SaaS. For vertical SaaS GTM teams selling to local business, the firmographic database is the wrong shape. Five alternatives, when each fits.";
const PUBLISHED = "2026-05-22";

const ALTS = [
  {
    name: "LeadAC",
    pitch: "Operational intelligence layer for vertical SaaS GTM. Indexes location count, vertical stack, owner activity — not contact databases.",
    fit: "Best when you sell vertical SaaS to local business and want operational context Apollo's database does not carry.",
    cost: "$18,000/yr for 5 seats",
    isUs: true,
  },
  {
    name: "Clay",
    pitch: "Programmable enrichment workflow runtime with 150+ providers.",
    fit: "Best when you have a GTM engineer and need bespoke enrichment chains. Burns credits unpredictably.",
    cost: "$5,352/yr (Growth), more at scale",
  },
  {
    name: "LeadIQ",
    pitch: "Contact data with a Chrome extension and CRM-native enrichment.",
    fit: "Best when you want Apollo-style contact data but with deeper LinkedIn workflow integration. Same primitive class as Apollo.",
    cost: "$948/yr per seat (Pro)",
  },
  {
    name: "Cognism",
    pitch: "B2B contact data with European GDPR-compliant emails.",
    fit: "Best when EU is your primary market and Apollo's EU data feels thin. Same primitive class as Apollo.",
    cost: "Custom (~$15K+/yr typical)",
  },
  {
    name: "ZoomInfo",
    pitch: "Largest B2B contact database with intent data layered on top.",
    fit: "Best for enterprise outbound where contact volume matters more than vertical context. Expensive.",
    cost: "$15K-$50K/yr typical floor",
  },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function ApolloAlternativesPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Alternatives", url: "/alternatives" },
          { name: "Apollo alternatives", url: PATH },
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
          tags: ["Apollo alternatives", "B2B contact data", "vertical SaaS"],
        })}
      />

      <Hero
        eyebrow="Alternatives · Apollo"
        headline="When the contact database isn't the right primitive."
        subhead="Apollo is real and well-built for B2B SaaS selling to other B2B SaaS. For vertical SaaS selling to local business — restaurants, HVAC, dental — the firmographic primitive runs out of road. Here are five alternatives, ranked by when each fits."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/vs/apollo", label: "Direct comparison vs Apollo" }}
        anchor={{
          note: "Apollo bounce rate",
          label: "12–14% on local-business segments without verification",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "12-14%",
            label:
              "Apollo bounce rate on local-business segments without third-party verification.",
            source: {
              name: "Discury practitioner discussion",
              url: "https://discury.io/problems/marketing-ops-outbound-sales-stack-costs",
            },
          },
          {
            value: "$430/mo",
            label:
              "Real Apollo cost with verification + dialer add-ons most teams need.",
          },
          {
            value: "5 alts",
            label:
              "Each carries a different primitive — pick the one that matches your motion.",
          },
          {
            value: "Keep Apollo",
            label:
              "Most LeadAC customers keep Apollo. We sit on top, never in place of.",
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
                      href="/vs/apollo"
                      className="mt-4 inline-flex items-center gap-2 text-[13px] text-signal hover:underline"
                    >
                      Side-by-side: LeadAC vs Apollo
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
        title="What each alternative carries that Apollo doesn't."
        subtitle="The matrix names the capability gap, not the cost gap. Cost is a different conversation per category."
        columns={[
          { label: "Apollo Pro" },
          { label: "LeadAC Team", isUs: true, subLabel: "from $18,000/yr" },
          { label: "Clay Growth" },
          { label: "Cognism" },
          { label: "ZoomInfo" },
        ]}
        rows={[
          {
            capability: "B2B SaaS contact database",
            values: ["yes", "no", "partial", "yes", "yes"],
          },
          {
            capability: "Local-business operational signals",
            values: ["no", "yes", "partial", "no", "no"],
          },
          {
            capability: "Vertical software stack detection",
            values: ["no", "yes", "partial", "no", "partial"],
          },
          {
            capability: "Multi-location operator linking",
            values: ["no", "yes", "no", "no", "no"],
          },
          {
            capability: "Programmable workflow runtime",
            values: ["partial", "no", "yes", "no", "no"],
          },
          {
            capability: "EU-compliant contact data",
            values: ["partial", "n/a — no contacts", "partial", "yes", "yes"],
          },
          {
            capability: "Closed-loop ICP refinement from CRM outcomes",
            values: ["no", "yes", "no", "no", "partial"],
          },
        ]}
        sources={[
          {
            name: "Apollo pricing & docs",
            url: "https://www.apollo.io/pricing",
          },
          {
            name: "Clay pricing & docs",
            url: "https://www.clay.com/pricing",
          },
          {
            name: "MiniLoop AI — Clay vs Apollo B2B Prospecting 2026",
            url: "https://www.miniloop.ai/blog/clay-vs-apollo-b2b-prospecting-2026",
          },
        ]}
      />

      <ProblemGrid
        eyebrow="Where Apollo's primitive runs out"
        title="Three patterns that send teams looking for an alternative."
        intro="Apollo isn't broken. The primitive is firmographic. These are the moments where vertical SaaS GTM teams hit a wall."
        pains={PAINS.filter((p) => ["P-001", "P-002", "P-003"].includes(p.id))}
      />

      <QuoteBlock persona={PERSONAS.mike} />

      <CtaBlock
        eyebrow="Keep Apollo, add the layer"
        title="Most LeadAC customers keep Apollo. We sit on top, not in place of."
        subtitle="The pilot writes the operational context Apollo's database doesn't carry — into the same HubSpot company record your team already opens. Twenty-minute demo on one of your own accounts."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
