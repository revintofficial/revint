import type { Metadata } from "next";
import {
  Hero,
  ComparisonTable,
  StackPositionDiagram,
  ProofRow,
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
import { SITE } from "@/lib/seo/metadata";

/**
 * /vs/apollo-clay-gong — the "you already have all three" comparison.
 *
 * Psych: Status-quo bias break + Anchoring (psych-map). The page admits
 * the current stack works for individual jobs, then names the one job it
 * doesn't do — learn — and positions Revint as the additive memory layer
 * at $18K/yr that closes the loop.
 */

const PATH = "/vs/apollo-clay-gong";
const TITLE =
  "Revint vs Apollo + Clay + Gong — the memory layer your stack doesn't share.";
const DESCRIPTION =
  "Apollo finds contacts. Clay enriches them. Gong records calls. None of the three feeds your won and lost outcomes back into the next list. Revint is the $18K/yr memory layer that ties the stack together.";
const PUBLISHED = "2026-05-22";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function VsApolloClayGongPage() {
  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Compare", url: "/vs" },
          { name: "Apollo + Clay + Gong", url: PATH },
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
          tags: ["Apollo", "Clay", "Gong", "vertical SaaS", "GTM stack"],
        })}
      />

      <Hero
        eyebrow="Compare · Apollo + Clay + Gong"
        headline="Your stack already finds, enriches, and records. None of the three remembers."
        subhead="A typical 5-seat vertical SaaS GTM team running Apollo + Clay + Smartlead + a Gong pilot spends roughly $29K per year and still doesn't ingest its own won and lost outcomes. Revint sits next to the four boxes and closes the loop."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Current stack cost",
          label: "$29,212/yr — Apollo + Clay + Smartlead + Gong pilot",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "$29,212/yr",
            label:
              "5-seat team running Apollo Pro + Clay Growth + Smartlead Pro + Gong Foundation pilot.",
            source: {
              name: "Public pricing pages, May 2026",
              url: "https://www.apollo.io/pricing",
            },
          },
          {
            value: "0",
            label:
              "Of the four tools ingest your CRM closed-won and closed-lost outcomes back into discovery.",
          },
          {
            value: "+$18,000/yr",
            label:
              "Revint Team — adds the memory layer, replaces zero of the existing tools.",
          },
          {
            value: "< 1 hr",
            label:
              "Onboarding. HubSpot OAuth, field mapping, first 200 accounts written. No engineer needed.",
          },
        ]}
      />

      <StackPositionDiagram
        eyebrow="Where each tool lives"
        title="Apollo finds. Clay enriches. Gong records. Revint remembers."
        subtitle="The four boxes do four different jobs well. We do the fifth job none of them do, at a price that fits on top of the stack you already paid for."
      />

      <ComparisonTable
        eyebrow="Capability matrix"
        title="What each tool does. What none of them do."
        subtitle="Same shape as the pricing table comparison, with the focus on the capability gap instead of the cost gap."
        columns={[
          { label: "Apollo" },
          { label: "Clay" },
          { label: "Gong" },
          { label: "Revint", isUs: true, subLabel: "from $1,500/mo" },
        ]}
        rows={[
          {
            capability: "Contact discovery (firmographic)",
            values: ["yes", "partial", "no", "no"],
          },
          {
            capability: "Programmable enrichment workflow",
            values: ["partial", "yes", "no", "partial"],
          },
          {
            capability: "Conversation intelligence",
            values: ["no", "no", "yes", "no"],
          },
          {
            capability: "Operational signals on local business",
            values: ["no", "partial", "no", "yes"],
          },
          {
            capability: "Vertical packs (HVAC, restaurant, dental)",
            values: ["no", "no", "no", "yes"],
          },
          {
            capability: "Per-account brief inside HubSpot card",
            values: ["no", "no", "no", "yes"],
          },
          {
            capability: "Closed-loop CRM outcome ingestion",
            values: ["no", "no", "partial", "yes"],
          },
          {
            capability: "Onboarding time",
            values: [
              "≤ 1 hr",
              "1-4 weeks",
              "8-16 weeks",
              "≤ 1 hr",
            ],
          },
          {
            capability: "Annual cost, 5-seat team",
            values: ["$1,392", "$5,352", "$22,000+", "$18,000"],
          },
        ]}
        sources={[
          { name: "Apollo pricing", url: "https://www.apollo.io/pricing" },
          { name: "Clay pricing", url: "https://www.clay.com/pricing" },
          {
            name: "Gong Foundation tier listing",
            url: "https://www.technologyinsales.com/tools/clari",
          },
        ]}
      />

      <QuoteBlock persona={PERSONAS.daniel} />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What VPs of Sales ask on the call."
        entries={FAQS["vs-apollo-clay-gong"]}
      />

      <CtaBlock
        eyebrow="Twenty minutes, one of your accounts"
        title="Bring one prospect URL. We'll show you the brief your current stack didn't write."
        subtitle="No slideware. Paste the URL on the call, we run Revint live, you compare what landed in HubSpot against what Apollo + Clay would have surfaced for the same account."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/tools/apollo-stack-cost-calculator", label: "Run the stack-cost calculator" }}
      />
    </>
  );
}
