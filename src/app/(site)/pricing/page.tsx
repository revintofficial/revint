import type { Metadata } from "next";
import {
  Hero,
  PricingTable,
  ComparisonTable,
  ProofRow,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  softwareApplicationSchema,
  serviceSchema,
  breadcrumbSchema,
} from "@/components/seo/json-ld";
import { FAQS } from "@/content/site/faq";
import { SITE } from "@/lib/seo/metadata";

/**
 * /pricing — four-tier table + stack-cost comparison + FAQ.
 *
 * Psych: Decoy effect + Anchoring (psych-map). The Team tier is the
 * target; Pilot anchors low, Enterprise anchors high, Growth is the
 * decoy that makes Team look like the obvious choice for a 5-seat team.
 *
 * Service + SoftwareApplication schema both ship on this page so
 * Google/AEO can extract the four-tier shape verbatim.
 */

const PATH = "/pricing";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "Pricing — same money as Gong's mid-market floor, with the memory layer included",
  description:
    "Pilot $500/mo for 30 days. Team $1,500/mo. Growth $3,000/mo. Enterprise from $5,000/mo. Cancel anytime, no annual contract, no platform fee. Roughly $50 per SDR per month at the Team tier.",
});

export default function PricingPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd id="ld-app" data={softwareApplicationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Pricing", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: "LeadAC operational intelligence platform",
          description:
            "Closed-loop account discovery and CRM enrichment for vertical SaaS GTM teams selling to local business.",
          url: `${SITE.url}${PATH}`,
          serviceType: "Sales Intelligence",
          audience: [
            "Restaurant tech",
            "Field service software",
            "Dental practice management",
          ],
        })}
      />

      <Hero
        eyebrow="Pricing"
        headline="Four tiers. One job. Same money as Gong's mid-market floor."
        subhead="The Team plan is the default for 5 to 10 SDR teams. The Pilot exists so a VP Sales can say yes without a procurement call. Cancel anytime — every tier is monthly billing, no annual contract."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "#pricing-table", label: "See plans" }}
        anchor={{
          note: "Compared with",
          label: "$100K/yr Gong floor + 8-week onboarding services SOW",
        }}
      />

      <div id="pricing-table" />
      <PricingTable />

      <ProofRow
        cells={[
          {
            value: "$50/SDR/mo",
            label:
              "Team plan, fully loaded — roughly the cost of one outbound sequencer seat.",
          },
          {
            value: "$1,500/mo",
            label:
              "Team plan flat fee. Includes five SDR seats and 5,000 enriched accounts per month.",
          },
          {
            value: "No SOW",
            label:
              "No mandatory onboarding services. Live onboarding call is included on every tier.",
          },
          {
            value: "30-day export",
            label:
              "Cancel anytime — your data exports for 30 days after the cancellation date.",
          },
        ]}
      />

      <ComparisonTable
        eyebrow="The stack-cost math"
        title="What you pay today — and where LeadAC fits."
        subtitle="A typical 5-seat vertical SaaS GTM team running Apollo + Clay + Smartlead + a Gong pilot already spends roughly $29K per year. LeadAC adds the memory layer for $18K per year and doesn't ask you to switch the rest of the stack."
        columns={[
          { label: "Apollo Pro" },
          { label: "Clay Growth" },
          { label: "Smartlead Pro" },
          { label: "Gong Foundation" },
          {
            label: "LeadAC Team",
            isUs: true,
            subLabel: "from $18,000/yr",
          },
        ]}
        rows={[
          {
            capability: "Contact database (240M records)",
            values: ["yes", "no", "no", "no", "no"],
          },
          {
            capability: "Programmable enrichment workflows",
            values: ["partial", "yes", "no", "no", "partial"],
          },
          {
            capability: "Email sequencing",
            values: ["yes", "no", "yes", "no", "no"],
          },
          {
            capability: "Conversation intelligence",
            values: ["no", "no", "no", "yes", "no"],
          },
          {
            capability: "Operational signals on local business",
            values: ["no", "partial", "no", "no", "yes"],
          },
          {
            capability: "Closed-loop ICP refinement from CRM outcomes",
            values: ["no", "no", "no", "partial", "yes"],
          },
          {
            capability: "Vertical packs (HVAC, restaurant, dental)",
            values: ["no", "no", "no", "no", "yes"],
          },
          {
            capability: "Per-account brief inside HubSpot card",
            values: ["no", "no", "no", "no", "yes"],
          },
          {
            capability: "Annual cost, 5-seat team",
            values: [
              "$1,392",
              "$5,352",
              "$468",
              "$22,000+",
              "$18,000",
            ],
          },
          {
            capability: "Annual contract required",
            values: ["no", "no", "no", "yes", "no"],
          },
          {
            capability: "Onboarding time",
            values: [
              "≤ 1 hr",
              "1-4 weeks",
              "≤ 1 hr",
              "8-16 weeks",
              "≤ 1 hr",
            ],
          },
        ]}
        sources={[
          {
            name: "Apollo pricing, public",
            url: "https://www.apollo.io/pricing",
          },
          {
            name: "Clay pricing, public",
            url: "https://www.clay.com/pricing",
          },
          {
            name: "Smartlead pricing, public",
            url: "https://www.smartlead.ai/pricing",
          },
          {
            name: "Gong Foundation listing, TechnologyInSales",
            url: "https://www.technologyinsales.com/tools/clari",
          },
        ]}
      />

      <FaqBlock
        eyebrow="Pricing questions"
        title="What buyers ask before they pick a plan."
        entries={FAQS.pricing}
      />

      <CtaBlock
        eyebrow="Pilot, not free trial"
        title="Start the 30-day pilot for $500. Move to Team only if it earns the seat."
        subtitle="About 70% of pilot teams move to Team at the end of 30 days. The other 30% don't, and we'd rather lose that deal than carry a customer who isn't getting value."
        primaryCta={{ href: "/demo", label: "Start the pilot" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
      />
    </>
  );
}
