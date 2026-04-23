import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
  faqSchema,
} from "@/components/seo/json-ld";
import {
  DirectoryShell,
  LeadCardList,
  CrossLinkBlock,
  FaqBlock,
} from "@/components/public-directory/directory-shell";
import {
  getPublicNiches,
  getPublicBusinessesByNiche,
  getRelatedCitiesForNiche,
} from "@/lib/seo/programmatic";

export const revalidate = 3600;

export async function generateStaticParams() {
  const niches = await getPublicNiches();
  return niches.map((n) => ({ verticalSlug: n.nicheSlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ verticalSlug: string }>;
}): Promise<Metadata> {
  const { verticalSlug } = await params;
  const niches = await getPublicNiches();
  const niche = niches.find((n) => n.nicheSlug === verticalSlug);
  if (!niche) {
    return buildMetadata({
      path: `/niches/${verticalSlug}`,
      title: "Niche not found",
      description: "This niche is not in the directory.",
      index: false,
      follow: false,
    });
  }
  return buildMetadata({
    path: `/niches/${verticalSlug}`,
    title: `${niche.nicheName} — audited local businesses`,
    description: `${niche.leadCount} audited ${niche.nicheName.toLowerCase()} businesses with website audits, Google ratings, and contact details. Sourced live from Google Maps.`,
    keywords: [
      `${niche.nicheName} directory`,
      `${niche.nicheName} lead list`,
      `local ${niche.nicheName} businesses`,
    ],
  });
}

function nicheFaqs(nicheName: string) {
  return [
    {
      question: `How is each ${nicheName} business audited?`,
      answer:
        "Every listing runs through a 20-signal Playwright audit — mobile load time, HTTPS, Core Web Vitals, booking-system detection, Schema.org coverage, security headers, and more. The results are condensed into a 0-100 opportunity score.",
    },
    {
      question: `Can I export the ${nicheName} list?`,
      answer:
        "Yes. Every row you see on this page can be exported to CSV from inside the Leadac AI workspace (free trial includes 50 exports). One-click push to Smartlead and Instantly is supported.",
    },
    {
      question: `How do you find new ${nicheName} businesses?`,
      answer:
        "Leadac AI reads live from the Google Places API. Feed it a postcode and a vertical, it returns the fresh ranked list — not the same Apollo contacts every other agency has.",
    },
    {
      question: `How fresh is the ${nicheName} directory?`,
      answer:
        "We re-crawl at least weekly and drop entries that close, lose their Google listing, or fall below our evidence floor.",
    },
  ];
}

export default async function NichePage({
  params,
}: {
  params: Promise<{ verticalSlug: string }>;
}) {
  const { verticalSlug } = await params;
  const niches = await getPublicNiches();
  const niche = niches.find((n) => n.nicheSlug === verticalSlug);
  if (!niche) notFound();

  const [businesses, relatedCities] = await Promise.all([
    getPublicBusinessesByNiche(verticalSlug, 100),
    getRelatedCitiesForNiche(verticalSlug),
  ]);

  const canonical = `${SITE.url}/niches/${verticalSlug}`;
  const faqs = nicheFaqs(niche.nicheName);

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `${niche.nicheName} — audited local businesses`,
          description: `Directory of audited ${niche.nicheName.toLowerCase()} businesses.`,
          url: canonical,
        })}
      />
      <JsonLd
        data={itemListSchema(
          businesses.map((b) => ({
            name: b.businessName,
            url: b.href,
            description: b.oneLiner ?? undefined,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Niches", url: "/niches" },
          { name: niche.nicheName, url: `/niches/${verticalSlug}` },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow={`Directory / ${niche.nicheName}`}
        title={`${niche.nicheName} — ${businesses.length} audited businesses`}
        intro={`${businesses.length} ${niche.nicheName.toLowerCase()} businesses with verified contact details, Google ratings, and a 20-signal website audit on each one. Refreshed weekly.`}
      >
        <LeadCardList items={businesses} />

        <CrossLinkBlock
          title={`${niche.nicheName} by city`}
          links={relatedCities.map((c) => ({
            label: `${niche.nicheName} in ${c.cityName}`,
            href: `/niches/${verticalSlug}/${c.citySlug}`,
            sub: `${c.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title="Explore more"
          links={[
            { label: "All niches", href: "/niches" },
            { label: "All cities", href: "/cities" },
            { label: "Comparison pages", href: "/compare" },
          ]}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}
