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
  DirectAnswer,
} from "@/components/public-directory/directory-shell";
import {
  getPublicCities,
  getPublicBusinessesByCity,
  getRelatedNichesForCity,
} from "@/lib/seo/programmatic";

export const revalidate = 3600;

export async function generateStaticParams() {
  const cities = await getPublicCities();
  return cities.map((c) => ({ citySlug: c.citySlug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}): Promise<Metadata> {
  const { citySlug } = await params;
  const cities = await getPublicCities();
  const city = cities.find((c) => c.citySlug === citySlug);
  if (!city) {
    return buildMetadata({
      path: `/cities/${citySlug}`,
      title: "City not found",
      description: "This city is not in the directory.",
      index: false,
      follow: false,
    });
  }
  return buildMetadata({
    path: `/cities/${citySlug}`,
    title: `Local businesses in ${city.cityName}`,
    description: `${city.leadCount} audited local-service businesses in ${city.cityName} — with contact details, Google ratings, and website audits.`,
    keywords: [
      `local businesses ${city.cityName}`,
      `${city.cityName} business directory`,
      `google maps businesses ${city.cityName}`,
    ],
  });
}

function cityFaqs(cityName: string, leadCount: number) {
  return [
    {
      question: `How many businesses are listed for ${cityName}?`,
      answer: `There are currently ${leadCount} audited local-service businesses in our ${cityName} directory. The list grows as we crawl more of the city.`,
    },
    {
      question: `Where does the ${cityName} data come from?`,
      answer:
        "Every profile is sourced live from Google Maps and enriched with a Playwright-driven audit of the business's website, plus recent Google reviews. We only publish businesses that pass our evidence floor (at least one of: completed audit, three reviews, or a sales-opportunity analysis).",
    },
    {
      question: `Is this list the same as Google Maps for ${cityName}?`,
      answer: `No. Google Maps is a raw directory. Revint adds a website-quality score, a 20-signal audit, and a short pitch angle for each business so sales teams can work the list without researching every lead by hand.`,
    },
    {
      question: `How often is the ${cityName} directory updated?`,
      answer:
        "We re-crawl public profiles weekly. Businesses that close, lose their Google listing, or drop below the evidence floor are removed automatically.",
    },
  ];
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ citySlug: string }>;
}) {
  const { citySlug } = await params;
  const cities = await getPublicCities();
  const city = cities.find((c) => c.citySlug === citySlug);
  if (!city) notFound();

  const [businesses, relatedNiches] = await Promise.all([
    getPublicBusinessesByCity(citySlug, 100),
    getRelatedNichesForCity(citySlug),
  ]);

  const canonical = `${SITE.url}/cities/${citySlug}`;
  const faqs = cityFaqs(city.cityName, businesses.length);

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `Local businesses in ${city.cityName}`,
          description: `Audited local-service businesses in ${city.cityName}, sourced from Google Maps.`,
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
          { name: "Cities", url: "/cities" },
          { name: city.cityName, url: `/cities/${citySlug}` },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow={`Directory / ${city.cityName}`}
        title={`Local businesses in ${city.cityName}`}
        intro={`${businesses.length} audited local-service businesses in ${city.cityName}. Every profile below includes a website audit, Google rating, and contact details. Data refreshes weekly.`}
      >
        <DirectAnswer>
          There are {businesses.length} audited local-service businesses in
          the Revint directory for {city.cityName}, each with a website
          audit, Google rating, and contact details. Listings refresh weekly
          from live Google Maps data.
        </DirectAnswer>

        <LeadCardList items={businesses} />

        <CrossLinkBlock
          title={`Browse niches in ${city.cityName}`}
          links={relatedNiches.map((n) => ({
            label: `${n.nicheName} in ${city.cityName}`,
            href: `/niches/${n.nicheSlug}/${citySlug}`,
            sub: `${n.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title="Explore more"
          links={[
            { label: "All cities", href: "/cities" },
            { label: "All niches", href: "/niches" },
            { label: "Comparison pages", href: "/compare" },
          ]}
        />

        <FaqBlock items={faqs} />
      </DirectoryShell>
    </>
  );
}
