import type { Metadata } from "next";
import {
  Hero,
  VerticalSignalList,
  ProofRow,
  ProblemGrid,
  ClosedLoopDiagram,
  QuoteBlock,
  FaqBlock,
  CtaBlock,
  LeadMagnetBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  serviceSchema,
} from "@/components/seo/json-ld";
import { getVertical } from "@/content/site/verticals";
import { PERSONAS } from "@/content/site/personas";
import { PAINS } from "@/content/site/pains";
import { FAQS } from "@/content/site/faq";
import { SITE } from "@/lib/seo/metadata";

/**
 * /for/field-service-saas — Wave 2 beachhead vertical.
 *
 * Psych: Identity / Tribe (psych-map). The page reads as if written by an
 * insider — ServiceTitan, Jobber, Housecall Pro named by name, multi-truck
 * operator language used verbatim.
 */

const PATH = "/for/field-service-saas";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Field service software outbound — the memory layer for HVAC, plumbing, and electrical software vendors",
  description:
    "See which HVAC operators run ServiceTitan, Jobber, Housecall Pro, or FieldEdge — plus location count, owner activity, expansion signals. Synced to HubSpot in under an hour.",
});

export default function FieldServicePage() {
  const vertical = getVertical("field-service-saas");
  const persona = PERSONAS[vertical.personaId];
  const pains = PAINS.filter((p) => vertical.painIds.includes(p.id));

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "For verticals", url: "/for" },
          { name: vertical.shortName, url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: `Revint for ${vertical.name}`,
          description:
            "Operational intelligence for field service software vendors: vertical software signature detection, multi-location operator linking, owner-operator activity scoring, HubSpot-native sync.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Sales Intelligence",
          audience: ["Field service software vendors"],
        })}
      />

      <Hero
        eyebrow="For · Field service software"
        headline={vertical.hero.headline}
        subhead={vertical.hero.subhead}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={vertical.sampleBrief}
        anchor={{
          note: "Built for",
          label: "5-15 seat SDR teams selling to multi-location HVAC operators",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "4 stacks",
            label:
              "ServiceTitan, Jobber, Housecall Pro, FieldEdge — detected on day one.",
          },
          {
            value: "3+ locations",
            label:
              "Multi-truck operator threshold where vertical SaaS deals start to convert.",
          },
          {
            value: "90 days",
            label:
              "Expansion-window the brief surfaces — recent acquisitions, hiring posts, new locations.",
          },
          {
            value: "12 fields",
            label:
              "Written into HubSpot per account — operator name, location count, install, expansion date.",
          },
        ]}
      />

      <VerticalSignalList
        eyebrow="What we index"
        title="The six signals that decide an HVAC outbound deal."
        subtitle="Each signal is a public, observable footprint — no third-party data brokers, no scraping of private systems."
        vertical={vertical}
      />

      <ProblemGrid
        eyebrow="What's broken for field service GTM"
        title="Why the Apollo + Clay stack misses HVAC operators."
        intro="HVAC operators don't have a LinkedIn Sales Navigator presence. Their footprint is reviews, Google Business Profiles, and dispatch software footers. The dominant outbound stack doesn't index any of those."
        pains={pains}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won HVAC deal sharpens the next list — automatically."
        subtitle="Won deals against a Housecall Pro operator weight the next list toward more Housecall Pro operators in the same metro. Lost deals against ServiceTitan operators down-weight that signal until the next attempt."
      />

      <QuoteBlock persona={persona} />

      <LeadMagnetBlock
        eyebrow="Sample brief"
        title="Download a sample HVAC account brief."
        subtitle="One real multi-location HVAC operator on Housecall Pro, anonymised. The brief landed in HubSpot in under three minutes — same field map you'd see on the demo call."
        bullets={[
          "Operator profile: 4 locations, owner email confirmed",
          "Stack signature: Housecall Pro + Google Local Services + Yelp Pro",
          "Expansion: 2 new locations in last 90 days, hiring 'Operations Manager'",
          "Suggested opener: customer-language, 2 sentences, ready to dial",
        ]}
        cta={vertical.sampleBrief}
      />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What field service software VPs of Sales ask on the call."
        entries={FAQS["for-field-service"]}
      />

      <CtaBlock
        eyebrow="The pilot"
        title="Run the field service pack on 500 of your own accounts for 30 days."
        subtitle="$500 for the pilot. We pre-load the ServiceTitan, Jobber, Housecall Pro, and FieldEdge signal libraries. Your team sees the first brief inside the first hour."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
