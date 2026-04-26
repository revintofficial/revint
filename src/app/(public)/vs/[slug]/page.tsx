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

/**
 * "/vs/[slug]" = Leadac AI vs {competitor}. Reuses the alternatives
 * template but frames the page as a head-to-head instead of a
 * one-sided alternative pitch.
 */

/**
 * Handles both URL shapes:
 *   /vs/{competitor}            → Leadac vs {competitor}
 *   /vs/{competitorA}-vs-{B}    → {A} vs {B} (neither is Leadac)
 *
 * The second form uses `slug.split("-vs-")`. We pre-generate every
 * single-competitor page plus every ordered pair so sitemap coverage is
 * complete at build time.
 */

function parsePair(slug: string): { a: string; b: string } | null {
  const parts = slug.split("-vs-");
  if (parts.length !== 2) return null;
  return { a: parts[0], b: parts[1] };
}

export const dynamicParams = true;

export function generateStaticParams() {
  const all = listCompetitorSlugs();
  const single = all.map((slug) => ({ slug }));
  const pairs: Array<{ slug: string }> = [];
  for (const a of all) {
    for (const b of all) {
      if (a !== b) pairs.push({ slug: `${a}-vs-${b}` });
    }
  }
  return [...single, ...pairs];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const pair = parsePair(slug);
  if (pair) {
    const a = getCompetitor(pair.a);
    const b = getCompetitor(pair.b);
    if (!a || !b) {
      return buildMetadata({
        path: `/vs/${slug}`,
        title: "Comparison not found",
        description: "We have not profiled one of these tools.",
        index: false,
        follow: false,
      });
    }
    return buildMetadata({
      path: `/vs/${slug}`,
      title: `${a.name} vs ${b.name}`,
      description: `${a.name} vs ${b.name}: scorecard, pricing side-by-side, citations, and where each fits. See where Leadac AI lands on the same dimensions.`,
      keywords: [
        `${a.name} vs ${b.name}`,
        `${b.name} vs ${a.name}`,
        `${a.name} alternative`,
        `${b.name} alternative`,
      ],
    });
  }

  const competitor = getCompetitor(slug);
  if (!competitor) {
    return buildMetadata({
      path: `/vs/${slug}`,
      title: "Comparison not found",
      description: "We have not profiled this tool yet.",
      index: false,
      follow: false,
    });
  }
  return buildMetadata({
    path: `/vs/${slug}`,
    title: `Leadac AI vs ${competitor.name}`,
    description: `Leadac AI vs ${competitor.name}: dimension-by-dimension scorecard, side-by-side pricing, citations, and where each tool fits. Picking the right one depends on whether you need contacts, sending, or lead discovery + audits.`,
    keywords: [
      `leadac vs ${competitor.name.toLowerCase()}`,
      `${competitor.name} vs leadac`,
      `${competitor.name} alternative`,
    ],
  });
}

function vsFaqs(competitorName: string) {
  return [
    {
      question: `Who is Leadac AI vs ${competitorName} better for?`,
      answer: `Leadac AI is built for outbound agencies selling websites and growth services to local-service businesses — postcode + niche discovery, per-lead website audit, draft opener. ${competitorName} suits ${competitorName === "Apollo.io" || competitorName === "ZoomInfo" || competitorName === "Lusha" ? "B2B SaaS teams needing enterprise contact data" : "teams that already have a list and need sending infrastructure"}.`,
    },
    {
      question: `Can I use Leadac AI and ${competitorName} together?`,
      answer:
        "Yes. Many teams do. Leadac sources and audits the list; your existing sender (Smartlead, Instantly, Lemlist, HubSpot) sends the sequence. Push exports directly or via CSV.",
    },
    {
      question: `Does Leadac AI replace ${competitorName}?`,
      answer: `If you use ${competitorName} primarily to discover new local-business leads, yes — postcode + niche is the replacement for saturated contact lists. If you use ${competitorName} for sending, Leadac complements rather than replaces it.`,
    },
    {
      question: `What data sources does Leadac AI use vs ${competitorName}?`,
      answer:
        "Leadac AI reads live from the Google Places API (discovery), runs Playwright on every site (audit), and compiles Google reviews. Workspaces are isolated; no cross-tenant data leaks.",
    },
  ];
}

export default async function VsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const pair = parsePair(slug);
  if (pair) {
    const a = getCompetitor(pair.a);
    const b = getCompetitor(pair.b);
    if (!a || !b) notFound();
    return <PairComparison slug={slug} a={a} b={b} />;
  }

  const competitor = getCompetitor(slug);
  if (!competitor) notFound();

  const canonical = `${SITE.url}/vs/${slug}`;
  const faqs = vsFaqs(competitor.name);

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `Leadac AI vs ${competitor.name}`,
          description: `Head-to-head comparison of Leadac AI and ${competitor.name}.`,
          url: canonical,
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
          {
            name: `Leadac vs ${competitor.name}`,
            url: `/vs/${slug}`,
          },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow="Head to head"
        title={`Leadac AI vs ${competitor.name}`}
        intro={`Both tools help with outbound, but they solve different jobs. Leadac AI does discovery + audit + opener. ${competitor.name} does ${competitor.scorecard.outreachAutomation >= 4 ? "sending infrastructure" : "contact lookup"}. Here's the side-by-side.`}
      >
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
          <strong>Short answer:</strong> Pick Leadac AI when you need a list of
          local-service businesses and a reason to reach out. Pick{" "}
          {competitor.name} when you need{" "}
          {competitor.scorecard.outreachAutomation >= 4
            ? "to send sequences at scale."
            : "enterprise contact data."}{" "}
          They're complementary more often than they're substitutes.
        </p>

        <ScorecardTable competitor={competitor} />
        <PricingComparison a={LEADAC_SELF} b={competitor} />

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "32px 0 8px",
          }}
        >
          Why pick Leadac AI
        </h2>
        <WhyReasons reasons={competitor.whyLeadacInstead} />

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#ffffff",
            margin: "32px 0 8px",
          }}
        >
          Why pick {competitor.name}
        </h2>
        <ul
          style={{
            paddingLeft: 22,
            color: "rgba(237,237,240,0.85)",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          <li>Best for: {competitor.bestFor}</li>
          <li>Strength: {competitor.tagline}</li>
          {competitor.scorecard.outreachAutomation === 5 && (
            <li>Class-leading deliverability and sending infrastructure.</li>
          )}
        </ul>

        <CitationsBlock citations={competitor.citations} />

        <CompetitorLinkGrid
          exclude={competitor.slug}
          basePath="/vs"
          competitors={COMPETITORS}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}

function PairComparison({
  slug,
  a,
  b,
}: {
  slug: string;
  a: import("@/content/competitors").CompetitorProfile;
  b: import("@/content/competitors").CompetitorProfile;
}) {
  const canonical = `${SITE.url}/vs/${slug}`;
  const faqs = [
    {
      question: `${a.name} vs ${b.name}: which is better for local-service outbound?`,
      answer: `Neither is purpose-built for local-service outbound. ${a.name} and ${b.name} serve different jobs (see the scorecard). For postcode + niche discovery with a website audit on every lead, teams increasingly pick Leadac AI instead.`,
    },
    {
      question: `Can I use ${a.name} and ${b.name} together?`,
      answer:
        "In some stacks yes (typically discovery + sender). But if both tools overlap on the same job, most teams pick one and drop the other. Add Leadac AI as the discovery + audit layer sitting in front of your sender.",
    },
    {
      question: `Where does Leadac AI sit vs ${a.name} and ${b.name}?`,
      answer: `Leadac AI replaces the discovery + research layer. ${a.name} and ${b.name} compete on ${a.scorecard.outreachAutomation >= 4 && b.scorecard.outreachAutomation >= 4 ? "sending infrastructure" : "contact data"}; Leadac sits upstream — postcode, niche, 20-signal audit, draft opener.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${a.name} vs ${b.name}`,
          description: `Head-to-head comparison of ${a.name} and ${b.name}.`,
          url: canonical,
          isPartOf: { "@id": `${SITE.url}/#website` },
        }}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
          { name: `${a.name} vs ${b.name}`, url: `/vs/${slug}` },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow="Head to head"
        title={`${a.name} vs ${b.name}`}
        intro={`Side-by-side comparison of ${a.name} and ${b.name} across five dimensions that matter for outbound teams. Scores are opinionated but sourced (see citations below).`}
      >
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
          <strong>Short answer:</strong> {a.name}: {a.bestFor} {b.name}:{" "}
          {b.bestFor} Neither handles local-service discovery with per-lead
          audits; that's where <a href="/" style={{ color: "var(--leadac-300)" }}>Leadac AI</a>{" "}
          fits.
        </p>

        <table
          style={{
            width: "100%",
            marginTop: 24,
            borderCollapse: "collapse",
            fontSize: 14,
            background: "#121214",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr
              style={{
                background: "rgba(255,255,255,0.04)",
                textAlign: "left",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(237,237,240,0.65)",
              }}
            >
              <th style={{ padding: "12px 16px" }}>Dimension</th>
              <th style={{ padding: "12px 16px" }}>{a.name}</th>
              <th style={{ padding: "12px 16px" }}>{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: "localDiscovery" as const, label: "Local discovery" },
              { key: "websiteAudit" as const, label: "Website audit" },
              { key: "outreachAutomation" as const, label: "Outreach automation" },
              { key: "dataFreshness" as const, label: "Data freshness" },
              { key: "priceForAgencies" as const, label: "Price for agencies" },
            ].map((d) => (
              <tr
                key={d.key}
                style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}
              >
                <td style={{ padding: "12px 16px", color: "#ededf0" }}>
                  {d.label}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {"★".repeat(a.scorecard[d.key])}
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>
                    {"★".repeat(5 - a.scorecard[d.key])}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {"★".repeat(b.scorecard[d.key])}
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>
                    {"★".repeat(5 - b.scorecard[d.key])}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
        <PricingComparison a={a} b={b} />

        <CitationsBlock
          title="Sources"
          citations={[...a.citations, ...b.citations]}
        />

        <CompetitorLinkGrid
          exclude={a.slug}
          basePath="/vs"
          competitors={COMPETITORS}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}
