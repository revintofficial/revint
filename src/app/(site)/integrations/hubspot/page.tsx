import type { Metadata } from "next";
import {
  Hero,
  ProofRow,
  PreCallBriefCard,
  ProblemGrid,
  FaqBlock,
  CtaBlock,
} from "@/components/site/sections";
import { cn } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  JsonLd,
  organizationSchema,
  breadcrumbSchema,
  serviceSchema,
} from "@/components/seo/json-ld";
import { FAQS } from "@/content/site/faq";
import { painsForVertical } from "@/content/site/pains";
import { SITE } from "@/lib/seo/metadata";

/**
 * /integrations/hubspot — the native HubSpot story.
 *
 * Psych: Effort Heuristic + Cognitive Ease (psych-map). The page over-
 * describes the field map and the OAuth scope because the buyer's
 * objection is "another tool I have to wire up" — we name every step
 * so the answer is "no, you don't."
 */

const PATH = "/integrations/hubspot";

const FIELDS = [
  {
    name: "leadac_location_count",
    description:
      "Number of physical locations linked to the company record via Google Business Profile + shared owner email.",
    type: "Number",
  },
  {
    name: "leadac_vertical_stack",
    description:
      "Detected vertical software signature — e.g. 'Housecall Pro' or 'OpenTable Lite + Square POS'.",
    type: "Single-line text",
  },
  {
    name: "leadac_owner_activity_score",
    description:
      "0–100 score blending recent Google Business updates, review responses, and public posts.",
    type: "Number",
  },
  {
    name: "leadac_expansion_signal_date",
    description:
      "Most recent expansion signal — new location, hiring post, press release.",
    type: "Date",
  },
  {
    name: "leadac_review_tone",
    description:
      "One of 'positive', 'neutral', 'operations-strained', 'reputation-risk'.",
    type: "Dropdown",
  },
  {
    name: "leadac_multi_location_flag",
    description: "True when location_count ≥ 2.",
    type: "Boolean",
  },
  {
    name: "leadac_dso_parent",
    description:
      "Parent DSO name where the practice is part of a Dental Service Organization (dental vertical only).",
    type: "Single-line text",
  },
  {
    name: "leadac_brief_url",
    description:
      "Direct link into the LeadAC dashboard view for this account.",
    type: "URL",
  },
];

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title:
    "HubSpot integration — 12 fields, one OAuth flow, no engineer required",
  description:
    "Native HubSpot integration. OAuth in 30 minutes, 12 enriched fields per account, closed-loop outcome ingestion from CRM webhooks. Write access scoped to custom properties only.",
});

export default function HubSpotIntegrationPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Integrations", url: "/integrations" },
          { name: "HubSpot", url: PATH },
        ])}
      />
      <JsonLd
        id="ld-service"
        data={serviceSchema({
          name: "LeadAC HubSpot Integration",
          description:
            "Native HubSpot OAuth integration that writes 12 enriched fields per company record and ingests closed-loop deal outcomes via HubSpot webhooks.",
          url: `${SITE.url}${PATH}`,
          serviceType: "HubSpot Integration",
        })}
      />

      <Hero
        eyebrow="Integrations · HubSpot"
        headline="Write twelve enriched fields into the HubSpot card your SDR already opens."
        subhead="Native HubSpot OAuth. Read scope covers contacts, companies, and deals. Write scope is limited to custom property fields prefixed with leadac_ so nothing in your existing HubSpot is overwritten."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "#field-map", label: "See the field map" }}
        anchor={{
          note: "OAuth scope",
          label: "Read · contacts/companies/deals · Write · custom properties only",
        }}
        visual={
          <PreCallBriefCard
            account="Cascade Foothills HVAC"
            tag="Field service · 5 locations · Expansion mode"
            context="Multi-location HVAC operator on Housecall Pro. Two new locations added in the last 90 days, hiring 'Operations Manager' in Tacoma. Reviews mention dispatch backlog at the flagship."
            signals={[
              { label: "Stack signature", value: "Housecall Pro + Google Local Services" },
              { label: "Locations", value: "5 (4 active, 1 opening)" },
              { label: "Owner activity", value: "Hiring · last 21 days" },
              { label: "Review tone", value: "Operations-strained" },
            ]}
            opener="Saw you opened the Tacoma location three weeks ago — Housecall Pro at 5 locations usually means the dispatch board starts breaking around now. Want the brief on how two other Pacific Northwest operators handled the rollover to a dual-board setup?"
          />
        }
      />

      <ProofRow
        cells={[
          {
            value: "30 min",
            label: "OAuth + field map setup. No engineer required.",
          },
          {
            value: "12 fields",
            label: "Written into the HubSpot company record per account.",
          },
          {
            value: "Webhooks",
            label:
              "Closed-won and closed-lost outcomes ingested back within 5 minutes.",
          },
          {
            value: "0 writes",
            label:
              "Into your lists, sequences, workflows, or pipelines — ever.",
          },
        ]}
      />

      <section id="field-map" className="site-section">
        <div className="site-container">
          <div className="max-w-3xl">
            <div className="site-eyebrow mb-3">Field map</div>
            <h2 className="text-[30px] leading-tight tracking-tight text-paper-0 md:text-[44px]">
              The exact fields LeadAC writes into HubSpot.
            </h2>
            <p className="mt-4 text-[18px] leading-relaxed text-paper-2">
              Every field is a custom property prefixed with leadac_ so
              there&apos;s no collision with your existing schema. You can
              opt out of any field on the field-map screen during onboarding.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-xl border border-ink-3">
            <table className="min-w-full divide-y divide-ink-3">
              <thead className="bg-ink-1">
                <tr>
                  <th className={cn("px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3")}>
                    Field
                  </th>
                  <th className="px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3">
                    Type
                  </th>
                  <th className="px-5 py-4 text-left text-[12px] uppercase tracking-wider text-paper-3">
                    What it carries
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-3 bg-ink-0">
                {FIELDS.map((f) => (
                  <tr key={f.name}>
                    <td className="px-5 py-4">
                      <div className="site-mono text-[13px] text-paper-0">
                        {f.name}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-paper-2">
                      {f.type}
                    </td>
                    <td className="px-5 py-4 text-[14px] leading-relaxed text-paper-1">
                      {f.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] text-paper-3">
            Plus four vertical-specific fields per vertical pack. The
            field-map screen lists every property before you authorise the
            OAuth flow.
          </p>
        </div>
      </section>

      <ProblemGrid
        eyebrow="Why HubSpot first"
        title="Vertical SaaS GTM teams already run on HubSpot."
        intro="Salesforce + Gong is the enterprise default. HubSpot is the vertical SaaS mid-market default. We built native HubSpot first because it is where our buyer already lives."
        pains={painsForVertical("cross-vertical", 3)}
      />

      <FaqBlock
        eyebrow="HubSpot questions"
        title="What HubSpot admins ask before they authorise the OAuth scope."
        entries={FAQS["integrations-hubspot"]}
      />

      <CtaBlock
        eyebrow="See the integration live"
        title="Bring your HubSpot to the call. We'll walk the field map and authorise read-only."
        subtitle="Twenty minutes. Read-only OAuth scope on the call so you can see the map without committing. Pilot starts the day you decide to switch to read+write."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/security", label: "Read the security page" }}
      />
    </>
  );
}
