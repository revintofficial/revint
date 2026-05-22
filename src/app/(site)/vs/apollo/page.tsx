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

const PATH = "/vs/apollo";
const TITLE =
  "LeadAC vs Apollo — operational context the contact database doesn't index.";
const DESCRIPTION =
  "Apollo gives you contacts and firmographic data. LeadAC gives you the location count, vertical software stack, review tone, and owner activity Apollo's database doesn't index. Keep Apollo. Add the brief.";
const PUBLISHED = "2026-05-22";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function VsApolloPage() {
  const apollo = getCompetitor("apollo");
  const apolloPains = PAINS.filter((p) =>
    ["P-001", "P-002", "P-003"].includes(p.id),
  );

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "LeadAC", url: "/" },
          { name: "Compare", url: "/vs" },
          { name: "vs Apollo", url: PATH },
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
          tags: ["Apollo", "contact database", "vertical SaaS", "local business"],
        })}
      />

      <Hero
        eyebrow="Compare · vs Apollo"
        headline="Apollo answers 'is this a restaurant?'. We answer 'is this the restaurant?'."
        subhead={apollo.reframe}
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        anchor={{
          note: "Apollo Professional",
          label: "$1,392/yr — plus the 12-14% bounce tax on local business",
        }}
      />

      <ProofRow
        cells={[
          {
            value: "12-14%",
            label:
              "Bounce rate on Apollo's local-business contact data before third-party verification.",
            source: {
              name: "Discury practitioner discussion",
              url: "https://discury.io/problems/marketing-ops-outbound-sales-stack-costs",
            },
          },
          {
            value: "$50/seat/mo",
            label:
              "Typical add-on cost for the verification layer Apollo doesn't include.",
          },
          {
            value: "12 fields",
            label:
              "LeadAC writes into HubSpot per account — none overlap with Apollo's firmographic set.",
          },
          {
            value: "Same stack",
            label:
              "Most LeadAC customers keep Apollo. We sit on top, not in place of.",
          },
        ]}
      />

      <ComparisonTable
        eyebrow="Capability matrix"
        title="The contact database vs the operational layer."
        subtitle="Apollo's primitive is firmographic contact matching. LeadAC's primitive is local-business operational signal. They sit on different substrates."
        columns={[
          { label: "Apollo Pro", subLabel: "from $1,392/yr" },
          {
            label: "LeadAC Team",
            isUs: true,
            subLabel: "from $18,000/yr",
          },
        ]}
        rows={[
          {
            capability: "Contact database (B2B SaaS firmographic)",
            values: ["yes", "no"],
          },
          {
            capability: "Local-business operational signals",
            values: ["no", "yes"],
          },
          {
            capability: "Vertical software stack signature",
            values: ["partial", "yes"],
          },
          {
            capability: "Multi-location operator detection",
            values: ["no", "yes"],
          },
          {
            capability: "Review tone & operations strain signals",
            values: ["no", "yes"],
          },
          {
            capability: "Email sequencing engine",
            values: ["yes", "no"],
          },
          {
            capability: "Closed-loop CRM outcome ingestion",
            values: ["no", "yes"],
          },
          {
            capability: "Pre-call brief inside HubSpot card",
            values: ["no", "yes"],
          },
          {
            capability: "Bounce rate on local-business segments",
            values: ["12-14%", "n/a — we don't ship contacts"],
          },
          {
            capability: "Annual cost, 5-seat team",
            values: ["$1,392", "$18,000"],
          },
        ]}
        sources={[
          {
            name: "Apollo pricing, public",
            url: "https://www.apollo.io/pricing",
          },
          {
            name: "MiniLoop AI — Clay vs Apollo B2B Prospecting 2026",
            url: "https://www.miniloop.ai/blog/clay-vs-apollo-b2b-prospecting-2026",
          },
          {
            name: "Discury — outbound stack cost discussion",
            url: "https://discury.io/problems/marketing-ops-outbound-sales-stack-costs",
          },
        ]}
      />

      <ProblemGrid
        eyebrow="Where Apollo's data runs out"
        title="Three places the firmographic database doesn't carry vertical SaaS GTM."
        intro="Apollo is right for B2B SaaS selling to other B2B SaaS, where the buyer has a LinkedIn profile and a Crunchbase entry. These are the moments it doesn't fit local-business outbound."
        pains={apolloPains}
      />

      <QuoteBlock persona={PERSONAS.mike} />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What SDR managers ask when Apollo is already paid for."
        entries={FAQS["vs-apollo"]}
      />

      <CtaBlock
        eyebrow="Keep Apollo"
        title="LeadAC layers on top of Apollo, never in place of."
        subtitle="The pilot writes the operational context Apollo's database doesn't carry — into the same HubSpot company record your team already opens."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
