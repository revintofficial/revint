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

const PATH = "/for/restaurant-tech-saas";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Restaurant tech software outbound — operational signals for F&B SaaS sales teams",
  description:
    "See which restaurants run Toast, OpenTable, Resy, or Square — plus migration signals, multi-location group, hiring patterns. Built for Toast competitors and the next generation of restaurant tech vendors.",
});

export default function RestaurantTechPage() {
  const vertical = getVertical("restaurant-tech-saas");
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
            "Operational intelligence for restaurant tech vendors: footer signature detection (Toast, OpenTable, Resy, Square), migration-candidate identification, multi-location group linking.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Sales Intelligence",
          audience: ["Restaurant technology software vendors"],
        })}
      />

      <Hero
        eyebrow="For · Restaurant tech software"
        headline={vertical.hero.headline}
        subhead={vertical.hero.subhead}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={vertical.sampleBrief}
        anchor={{
          note: "Built with",
          label:
            "FineDine and a small set of next-generation F&B SaaS vendors",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "5 stacks",
            label:
              "Toast, OpenTable, Resy, Square, Yelp Guest Manager — indexed day one.",
          },
          {
            value: "OpenTable Lite",
            label:
              "Single biggest migration signal we surface. The Lite-to-full upgrade trigger.",
          },
          {
            value: "3+ locations",
            label:
              "Multi-location group threshold where group-level decisions flow through one operator.",
          },
          {
            value: "12 fields",
            label:
              "Written into HubSpot — install, location count, group signature, migration tag.",
          },
        ]}
      />

      <VerticalSignalList
        eyebrow="What we index"
        title="The six signals that decide a restaurant tech outbound deal."
        subtitle="Every signal is observable in public — the footer, the booking widget, the menu page, the review tone. No private POS data, no Toast-internal API."
        vertical={vertical}
      />

      <ProblemGrid
        eyebrow="What's broken for F&B GTM"
        title="Why the Apollo + Clay stack misses restaurants."
        intro="Restaurant operators don't have a Crunchbase entry. Their footprint is a website footer, a booking widget, and a Yelp page. The dominant outbound stack indexes none of those."
        pains={pains}
      />

      <ClosedLoopDiagram
        eyebrow="How the memory works"
        title="Every won restaurant tech deal sharpens the next list — automatically."
        subtitle="Won deals against OpenTable Lite groups weight the next list toward more OpenTable Lite groups in the same metro. Lost deals against full-Toast operators down-weight that signal until your team finds a new wedge."
      />

      <QuoteBlock persona={persona} />

      <LeadMagnetBlock
        eyebrow="Sample brief"
        title="Download a sample restaurant tech account brief."
        subtitle="One real four-location restaurant group on OpenTable Lite, anonymised. The brief landed in HubSpot in under three minutes — the same field map you'd see on the demo call."
        bullets={[
          "Group profile: 4 locations across two metros, shared owner email",
          "Stack signature: OpenTable Lite + Square POS + Yelp Guest Manager",
          "Migration tag: Lite-to-full candidate, two new locations added last quarter",
          "Suggested opener: insider-language, 2 sentences, ready to dial",
        ]}
        cta={vertical.sampleBrief}
      />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What restaurant tech VPs of Sales ask on the call."
        entries={FAQS["for-restaurant-tech"]}
      />

      <CtaBlock
        eyebrow="The pilot"
        title="Run the restaurant tech pack on 500 of your own accounts for 30 days."
        subtitle="$500 for the pilot. We pre-load Toast, OpenTable, Resy, Square, and Yelp Guest Manager signal libraries. Your team sees the first brief inside the first hour."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
