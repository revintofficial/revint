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
  getPublicCities,
  getPublicNiches,
  getPublicBusinessesByNicheCity,
  getRelatedCitiesForNiche,
  getRelatedNichesForCity,
} from "@/lib/seo/programmatic";
import { findNichePackForPrimaryType } from "@/lib/niches";

export const revalidate = 3600;

/**
 * The "money page" — niche × city. This is the high-intent query pattern:
 * "phone repair shops in London", "HVAC contractors in Manchester". Each
 * page earns its spot with real audit data, a city-specific FAQ, and a
 * dense cross-link block.
 *
 * `generateStaticParams` intentionally returns empty at build time; the
 * first visitor to any (niche, city) combo triggers ISR render which is
 * then cached for an hour. This avoids building millions of pages at
 * deploy time.
 */

export async function generateStaticParams() {
  // ISR-only: we build on-demand to avoid multi-million combinations.
  return [];
}

export const dynamicParams = true;

type RouteParams = { verticalSlug: string; citySlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { verticalSlug, citySlug } = await params;
  const [niches, cities] = await Promise.all([
    getPublicNiches(),
    getPublicCities(),
  ]);
  const niche = niches.find((n) => n.nicheSlug === verticalSlug);
  const city = cities.find((c) => c.citySlug === citySlug);
  if (!niche || !city) {
    return buildMetadata({
      path: `/niches/${verticalSlug}/${citySlug}`,
      title: "Not found",
      description: "This combination is not in the directory.",
      index: false,
      follow: false,
    });
  }
  const pack = findNichePackForPrimaryType(niche.nicheName);
  const label = pack ? pack.label : niche.nicheName;
  const description = pack
    ? `${pack.tagline} Audited businesses in ${city.cityName} with website audits, Google ratings, and contact details — refreshed weekly.`
    : `Audited ${niche.nicheName.toLowerCase()} businesses in ${city.cityName} with website audits, Google ratings, and contact details. Live from Google Maps, refreshed weekly.`;
  return buildMetadata({
    path: `/niches/${verticalSlug}/${citySlug}`,
    title: `${label} in ${city.cityName}`,
    description,
    keywords: [
      `${label} ${city.cityName}`,
      `${label} in ${city.cityName}`,
      `${city.cityName} ${label.toLowerCase()} directory`,
      `best ${label.toLowerCase()} ${city.cityName}`,
    ],
  });
}

function combinedFaqs(nicheName: string, cityName: string, count: number) {
  return [
    {
      question: `How many ${nicheName.toLowerCase()} businesses does Leadac AI track in ${cityName}?`,
      answer: `We currently list ${count} audited ${nicheName.toLowerCase()} businesses in ${cityName}. The list updates whenever a new crawl completes; public entries refresh at least weekly.`,
    },
    {
      question: `What does "audited" mean for a ${nicheName.toLowerCase()} business in ${cityName}?`,
      answer: `Every listing runs through a 20-signal Playwright audit: mobile load time, HTTPS, Core Web Vitals, booking-system detection (Calendly, SimplyBook, Setmore, Booksy, Square), Schema.org coverage, security headers, and image optimisation. The results compose a 0-100 opportunity score, an offer tier, and a pitch angle.`,
    },
    {
      question: `Can I use this ${nicheName.toLowerCase()} list for cold outreach in ${cityName}?`,
      answer: `Yes. Sign up for a Leadac AI workspace to export the list to CSV or push straight into Smartlead, Instantly, or GHL. Free trial includes 50 leads plus three per-lead website plans.`,
    },
    {
      question: `How is this different from Google Maps for ${nicheName.toLowerCase()} in ${cityName}?`,
      answer: `Google Maps is a raw directory. Leadac AI adds a website-quality score, a detailed audit, a draft cold-email opener grounded in the audit, and a handbook-based website plan. Google Maps hands you a contact — Leadac hands you a contact plus the first two emails of the pitch.`,
    },
    {
      question: `Are there other cities with ${nicheName.toLowerCase()} listings?`,
      answer: `Yes — see the cross-links at the bottom of this page for every city in our ${nicheName.toLowerCase()} directory. Pick any one to see that city's list, or browse /niches for other verticals.`,
    },
  ];
}

export default async function NicheCityPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { verticalSlug, citySlug } = await params;

  const [niches, cities] = await Promise.all([
    getPublicNiches(),
    getPublicCities(),
  ]);
  const niche = niches.find((n) => n.nicheSlug === verticalSlug);
  const city = cities.find((c) => c.citySlug === citySlug);
  if (!niche || !city) notFound();

  const [businesses, relatedCities, relatedNiches] = await Promise.all([
    getPublicBusinessesByNicheCity(verticalSlug, citySlug, 100),
    getRelatedCitiesForNiche(verticalSlug, citySlug),
    getRelatedNichesForCity(citySlug, verticalSlug),
  ]);

  if (businesses.length === 0) notFound();

  const canonical = `${SITE.url}/niches/${verticalSlug}/${citySlug}`;
  const pack = findNichePackForPrimaryType(niche.nicheName);
  const displayLabel = pack ? pack.label : niche.nicheName;
  const faqs = combinedFaqs(displayLabel, city.cityName, businesses.length);

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `${niche.nicheName} in ${city.cityName}`,
          description: `Audited ${niche.nicheName.toLowerCase()} businesses in ${city.cityName}.`,
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
          { name: city.cityName, url: canonical },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: niche.nicheName,
          areaServed: {
            "@type": "City",
            name: city.cityName,
          },
          provider: { "@id": `${SITE.url}/#organization` },
          description: `Directory of audited ${niche.nicheName.toLowerCase()} businesses in ${city.cityName} with website audits and Google ratings.`,
          url: canonical,
        }}
      />

      <DirectoryShell
        eyebrow={`Directory / ${displayLabel} / ${city.cityName}`}
        title={`${displayLabel} in ${city.cityName}`}
        intro={
          pack
            ? `${businesses.length} audited ${displayLabel.toLowerCase()} businesses in ${city.cityName}. ${pack.tagline} Every listing includes a website audit, Google rating, and a pitch angle a sales team can work with. Data refreshes weekly.`
            : `${businesses.length} audited ${niche.nicheName.toLowerCase()} businesses in ${city.cityName}. Every listing includes a website audit, Google rating, and a pitch angle a sales team can work with. Data refreshes weekly.`
        }
      >
        {/* One-sentence direct answer for AI search engines */}
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
          <strong>Short answer:</strong> {businesses.length}{" "}
          {displayLabel.toLowerCase()} businesses in {city.cityName} are
          currently audited and listed in the Leadac AI directory, ranked by
          Google review volume.
        </p>

        <LeadCardList items={businesses} />

        <CrossLinkBlock
          title={`${niche.nicheName} in other cities`}
          links={relatedCities.map((c) => ({
            label: `${niche.nicheName} in ${c.cityName}`,
            href: `/niches/${verticalSlug}/${c.citySlug}`,
            sub: `${c.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title={`Other niches in ${city.cityName}`}
          links={relatedNiches.map((n) => ({
            label: `${n.nicheName} in ${city.cityName}`,
            href: `/niches/${n.nicheSlug}/${citySlug}`,
            sub: `${n.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title="Explore more"
          links={[
            {
              label: `All ${niche.nicheName} listings`,
              href: `/niches/${verticalSlug}`,
            },
            { label: `All businesses in ${city.cityName}`, href: `/cities/${citySlug}` },
            { label: "All cities", href: "/cities" },
            { label: "All niches", href: "/niches" },
          ]}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}
