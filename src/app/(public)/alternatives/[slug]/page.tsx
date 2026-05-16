import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import {
  DirectoryShell,
  FaqBlock,
} from "@/components/public-directory/directory-shell";
import {
  ScorecardTable,
  PricingComparison,
  CitationsBlock,
  WhyReasons,
  CompetitorLinkGrid,
} from "@/components/public-directory/competitor-comparison";
import {
  COMPETITORS,
  LEADAC_SELF,
  getCompetitor,
  listCompetitorSlugs,
} from "@/content/competitors";

export function generateStaticParams() {
  return listCompetitorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) {
    return buildMetadata({
      path: `/alternatives/${slug}`,
      title: "Alternative not found",
      description: "We have not profiled this tool yet.",
      index: false,
      follow: false,
    });
  }
  return buildMetadata({
    path: `/alternatives/${slug}`,
    title: `${competitor.name} alternative — Leadac AI`,
    description: `Looking for a ${competitor.name} alternative? Leadac AI replaces ${competitor.name}'s ${competitor.weaknesses[0]?.toLowerCase() || "gaps"} with postcode + niche discovery and a 20-signal website audit on every lead.`,
    keywords: [
      `${competitor.name} alternative`,
      `${competitor.name} competitor`,
      `alternatives to ${competitor.name}`,
      `${competitor.name} vs leadac`,
    ],
  });
}

function alternativeFaqs(competitorName: string) {
  return [
    {
      question: `Why look for a ${competitorName} alternative at all?`,
      answer: `Most teams evaluating alternatives to ${competitorName} cite either cost, data coverage gaps for local-service verticals, or the lack of a website-audit layer. Leadac AI answers all three: flat monthly pricing, live Google Maps discovery for local businesses, and a 20-signal Playwright audit on every lead.`,
    },
    {
      question: `Is Leadac AI cheaper than ${competitorName}?`,
      answer: `For agencies running 1-5k leads per month, yes — and we collapse the per-prospect homework cost line that ${competitorName} doesn't address. Plans are being shaped with the first cohort right now; join the waitlist at /#waitlist for the full breakdown when we open.`,
    },
    {
      question: `Can I import ${competitorName} data into Leadac AI?`,
      answer: `You can import CSVs of domains or business names and run them through the Leadac audit engine to enrich them. Most teams do the opposite — discover with Leadac, send with Smartlead or Instantly.`,
    },
    {
      question: `How is Leadac AI different from ${competitorName}?`,
      answer: `The short version: ${competitorName} ${competitorName === "Apollo.io" ? "sells contact data" : "sells sending infrastructure or contact credits"}; Leadac AI sells lead discovery + per-lead website audits + a draft pitch grounded in what the audit actually found. Different job.`,
    },
  ];
}

export default async function AlternativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competitor = getCompetitor(slug);
  if (!competitor) notFound();

  const canonical = `${SITE.url}/alternatives/${slug}`;
  const faqs = alternativeFaqs(competitor.name);

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `${competitor.name} alternative — Leadac AI`,
          description: `${competitor.name} alternative from Leadac AI, scored dimension by dimension.`,
          url: canonical,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Alternatives", url: "/alternatives" },
          {
            name: `${competitor.name} alternative`,
            url: `/alternatives/${slug}`,
          },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow={`Alternative to ${competitor.name}`}
        title={`Looking for a ${competitor.name} alternative?`}
        intro={`Most teams evaluating alternatives to ${competitor.name} hit one of three walls: cost, data gaps on local-service verticals, or no website-audit layer. Leadac AI addresses all three. Here's the side-by-side.`}
      >
        {/* Direct answer block for AI search */}
        <p
          style={{
            padding: "16px 20px",
            marginBottom: 32,
            background: "rgba(165,180,252,0.08)",
            border: "0.5px solid rgba(165,180,252,0.18)",
            borderRadius: 10,
            color: "rgba(237,237,240,0.9)",
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          <strong>Short answer:</strong> Leadac AI is the {competitor.name}{" "}
          alternative for agencies selling websites and growth services to
          local businesses. {competitor.name} gives you contacts or sends emails.
          Leadac AI gives you postcode + niche discovery, a 20-signal audit on
          every site, and a draft opener that references the audit.
        </p>

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 8px",
          }}
        >
          Where {competitor.name} falls short
        </h2>
        <ul
          style={{
            paddingLeft: 22,
            marginBottom: 24,
            color: "rgba(237,237,240,0.85)",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          {competitor.weaknesses.map((w) => (
            <li key={w} style={{ marginBottom: 6 }}>
              {w}
            </li>
          ))}
        </ul>

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "32px 0 8px",
          }}
        >
          Scorecard
        </h2>
        <ScorecardTable competitor={competitor} />

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "32px 0 8px",
          }}
        >
          Pricing side-by-side
        </h2>
        <PricingComparison a={LEADAC_SELF} b={competitor} />

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "32px 0 8px",
          }}
        >
          Why a Leadac-leaning buyer switches
        </h2>
        <WhyReasons reasons={competitor.whyLeadacInstead} />

        <CitationsBlock citations={competitor.citations} />

        <CompetitorLinkGrid
          exclude={competitor.slug}
          basePath="/alternatives"
          competitors={COMPETITORS}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}
