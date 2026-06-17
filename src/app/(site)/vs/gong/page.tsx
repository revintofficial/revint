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

/**
 * /vs/gong — the Gong reframe. brand-assets §1.5 Gong reframe in full.
 *
 * Psych: Anchoring + Asymmetric Framing (psych-map). The page never
 * argues Gong is bad; it argues Gong is right for a different buyer,
 * and the price floor that comes with that buyer rules out vertical
 * SaaS mid-market.
 */

const PATH = "/vs/gong";
const TITLE =
  "Revint vs Gong — operational intelligence, not conversation intelligence.";
const DESCRIPTION =
  "Gong indexes what your team said on calls. Revint indexes what the account is doing in the world. Same word — memory — different substrate, different price floor, different buyer.";
const PUBLISHED = "2026-05-22";

export const metadata: Metadata = buildMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
});

export default function VsGongPage() {
  const gong = getCompetitor("gong");

  // Only the pains that frame the Gong-vs-Revint discussion.
  const gongPains = PAINS.filter((p) =>
    ["P-005", "P-011", "P-013"].includes(p.id),
  );

  return (
    <>
      <JsonLd id="ld-org" data={organizationSchema()} />
      <JsonLd
        id="ld-bc"
        data={breadcrumbSchema([
          { name: "Revint", url: "/" },
          { name: "Compare", url: "/vs" },
          { name: "vs Gong", url: PATH },
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
          tags: ["Gong", "Revenue Graph", "conversation intelligence"],
        })}
      />

      <Hero
        eyebrow="Compare · vs Gong"
        headline="Gong remembers what your team said. We remember what the account is doing."
        subhead="Same word — memory — different substrate. Gong serves 5,000 enterprise teams with a $100K floor and 8-week onboarding. We serve the 50,000+ vertical SaaS teams that economics excludes by design."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/manifesto", label: "Read the manifesto" }}
        anchor={{
          note: "Gong floor",
          label: `${gong.publicTagline.slice(0, 40)}… — $100K/yr, 25-rep minimum`,
        }}
      />

      <ProofRow
        cells={[
          {
            value: "$100K/yr",
            label:
              "Gong Foundation tier floor for 25 reps, before onboarding services.",
            source: gong.publicTaglineSource,
          },
          {
            value: "8-16 weeks",
            label:
              "Gong implementation window for mid-market — RevOps engineer required.",
            source: {
              name: "Clari review, TechnologyInSales",
              url: "https://www.technologyinsales.com/tools/clari",
            },
          },
          {
            value: "$18K/yr",
            label:
              "Revint Team — 5 seats, 5,000 accounts/mo, HubSpot-native.",
          },
          {
            value: "< 1 hr",
            label:
              "Revint onboarding — OAuth flow, field map, first 200 accounts.",
          },
        ]}
      />

      <ComparisonTable
        eyebrow="Capability matrix"
        title="What each tool does. What they don't share."
        subtitle="The matrix is honest — Gong owns conversation intelligence and we don't compete with it. The disagreement is which substrate matters for vertical SaaS GTM at $5M–$30M ARR."
        columns={[
          { label: "Gong Foundation", subLabel: "from $100,000/yr" },
          {
            label: "Revint Team",
            isUs: true,
            subLabel: "from $18,000/yr",
          },
        ]}
        rows={[
          {
            capability: "Conversation intelligence (calls, emails)",
            values: ["yes", "no"],
          },
          {
            capability: "Operational signals (reviews, stack, location)",
            values: ["no", "yes"],
          },
          {
            capability: "Memory layer scope",
            values: ["What your team said", "What the account is doing"],
          },
          {
            capability: "Closed-loop ICP refinement",
            values: ["partial", "yes"],
          },
          {
            capability: "CRM-native surface",
            values: ["partial", "yes"],
          },
          {
            capability: "Vertical packs (HVAC, restaurant, dental)",
            values: ["no", "yes"],
          },
          {
            capability: "Monthly billing, no annual contract",
            values: ["no", "yes"],
          },
          {
            capability: "RevOps engineer required to onboard",
            values: ["yes", "no"],
          },
          {
            capability: "Onboarding time",
            values: ["8-16 weeks", "≤ 1 hr"],
          },
          {
            capability: "Minimum team size",
            values: ["25 reps", "1 rep (pilot) / 5 reps (Team)"],
          },
          {
            capability: "Annual cost, 5-seat team",
            values: ["~$22,000+", "$18,000"],
          },
        ]}
        sources={[
          {
            name: "Gong public hero & licensing model",
            url: "https://www.gong.io",
          },
          {
            name: "Clari/TechnologyInSales 8–16 week implementation note",
            url: "https://www.technologyinsales.com/tools/clari",
          },
          {
            name: "Gong Revenue Graph launch — PRNewswire",
            url: "https://www.prnewswire.com/news-releases/gong-growth-accelerates-past-55-yoy-as-enterprises-adopt-revenue-ai-arr-tops-500m-302769127.html",
          },
        ]}
      />

      <ProblemGrid
        eyebrow="What's broken at the price floor"
        title="The mid-market vertical SaaS team can't afford Gong, and lives without memory."
        intro="Gong's own product page disqualifies teams under 25 reps. Vertical SaaS GTM at $5M to $30M ARR sits inside that exclusion zone — and still needs the memory layer."
        pains={gongPains}
      />

      <QuoteBlock persona={PERSONAS.daniel} />

      <FaqBlock
        eyebrow="Buyer questions"
        title="What VPs of Sales ask when they're already using Gong."
        entries={FAQS["vs-gong"]}
      />

      <CtaBlock
        eyebrow="Keep Gong if you have it"
        title="Revint sits next to Gong, not against it. Add the operational layer for the price of one Gong seat."
        subtitle="If you already pay for Gong, we don't replace it — we sit one layer below the conversation graph and feed signal context into the same CRM Gong reads from."
        primaryCta={{ href: "/demo", label: "Book a 20-min demo" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
      />
    </>
  );
}
