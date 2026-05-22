import type { Metadata } from "next";
import {
  Hero,
  ComparisonTable,
  ProofRow,
  ProblemGrid,
  QuoteBlock,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  articleSchema,
} from "@/components/seo/json-ld";
import { FAQS } from "@/content/site/faq";
import { PERSONAS } from "@/content/site/personas";
import { PAINS } from "@/content/site/pains";
import { getCompetitor } from "@/content/site/competitors";
import { SITE } from "@/lib/seo/metadata";

const PATH = "/vs/clay";
const TITLE =
  "LeadAC vs Clay — the finished product, not the workshop.";
const DESCRIPTION =
  "Clay is a programmable enrichment workshop — flexible, powerful, requires a GTM engineer. LeadAC ships the finished vertical packs Clay teams spend weeks trying to build. Connect HubSpot in an hour.";
const PUBLISHED = "2026-05-22";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function VsClayPage() {
  const clay = getCompetitor("clay");
  const clayPains = PAINS.filter((p) =>
    ["P-003", "P-008", "P-007"].includes(p.id),
  );

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Compare", url: "/vs" },
          { name: "vs Clay", url: PATH },
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
          tags: ["Clay", "enrichment", "GTM engineer", "vertical SaaS"],
        })}
      />

      <Hero
        eyebrow="Compare · vs Clay"
        headline="Clay is a workshop. We are the finished tool."
        subhead={`${clay.reframe} If you have a GTM engineer, keep Clay. If you don't, the LeadAC vertical pack ships the workflow you were trying to build in Clay — in an hour.`}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Clay Growth tier",
          label: `From $5,352/yr — plus a GTM engineer to operate it.`,
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
            value: "3 packs",
            label:
              "LeadAC vertical packs that ship on day one — Field service, Restaurant tech, Dental.",
          },
          {
            value: "1 hour",
            label:
              "LeadAC onboarding — HubSpot OAuth, field mapping, first 200 accounts.",
          },
        ]}
      />

      <ComparisonTable
        eyebrow="Capability matrix"
        title="The workshop vs the finished tool."
        subtitle="Clay's primitive is freeform enrichment workflow. LeadAC's primitive is finished vertical pack. The matrix names which of the two fits which staffing model."
        columns={[
          { label: "Clay Growth", subLabel: "from $5,352/yr" },
          {
            label: "LeadAC Team",
            isUs: true,
            subLabel: "from $18,000/yr",
          },
        ]}
        rows={[
          {
            capability: "Freeform workflow runtime",
            values: ["yes", "no"],
          },
          {
            capability: "150+ enrichment providers",
            values: ["yes", "partial"],
          },
          {
            capability: "Vertical packs (HVAC, restaurant, dental)",
            values: ["no", "yes"],
          },
          {
            capability: "Local-business operational signals",
            values: ["partial", "yes"],
          },
          {
            capability: "Closed-loop CRM outcome ingestion",
            values: ["no", "yes"],
          },
          {
            capability: "HubSpot-native pre-call brief",
            values: ["no", "yes"],
          },
          {
            capability: "Credit-based pricing",
            values: ["yes", "no"],
          },
          {
            capability: "Native email sequencing",
            values: ["no", "no"],
          },
          {
            capability: "Requires GTM engineer",
            values: ["yes", "no"],
          },
          {
            capability: "Onboarding time",
            values: ["1–4 weeks", "≤ 1 hr"],
          },
          {
            capability: "Best for sending under 10k emails/mo",
            values: ["no", "yes"],
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
        eyebrow="When Clay is overkill"
        title="Three signs the workshop is the wrong tool for your team."
        intro="Clay is real and well-built — it's the right tool when the staffing assumption holds. These are the moments it doesn't."
        pains={clayPains}
      />

      <QuoteBlock persona={PERSONAS.mike} />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What teams ask when they already pay for Clay."
        entries={FAQS["vs-clay"]}
      />

      <CtaBlock
        eyebrow="Run it on one vertical"
        title="The pilot is 30 days. The vertical pack is finished on day one."
        subtitle="If LeadAC's vertical pack covers your motion, you'll know inside the first hour. If you need freeform workflow logic Clay handles, we'll say so on the call and point you back to Clay."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
