import { buildMetadata, SITE } from "@/lib/seo/metadata";
import {
  JsonLd,
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/components/seo/json-ld";
import {
  DirectoryShell,
  CrossLinkBlock,
  DirectAnswer,
  FaqBlock,
} from "@/components/public-directory/directory-shell";
import { faqSchema } from "@/components/seo/json-ld";
import { getPublicCities } from "@/lib/seo/programmatic";

export const revalidate = 3600;

export const metadata = buildMetadata({
  path: "/cities",
  title: "Local business directory by city",
  description:
    "Audited local-service businesses, organised by city. Every profile includes a website audit, response-rate signals, and contact details sourced from Google Maps.",
});

const FAQS = [
  {
    question: "How are cities chosen for the directory?",
    answer:
      "A city joins the directory once it has at least three audited local-service businesses that pass our evidence floor (audit complete, reviews attached, or opportunity analysis present). Cities below that threshold are excluded to keep the directory dense.",
  },
  {
    question: "How often is each city refreshed?",
    answer:
      "We re-crawl every published profile weekly. Businesses that close, lose their Google listing, or drop below the evidence floor are removed automatically. New discoveries join as soon as they pass the audit.",
  },
  {
    question: "Can I request a city that isn't listed?",
    answer:
      "Yes — we prioritise cities with active Revint users. If you sign up and run discovery in your target postcode, your city's profile count will rise; once three businesses pass the floor, the city appears in the directory.",
  },
];

export default async function CitiesIndexPage() {
  const cities = await getPublicCities();

  const items = cities.map((c) => ({
    name: `${c.cityName} (${c.leadCount})`,
    url: `/cities/${c.citySlug}`,
  }));

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Local business directory by city",
          description:
            "Audited local-service businesses organised by city, sourced live from Google Maps.",
          url: `${SITE.url}/cities`,
        })}
      />
      <JsonLd data={itemListSchema(items)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Cities", url: "/cities" },
        ])}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <DirectoryShell
        eyebrow="Directory"
        title={`Local business directory (${cities.length} cities)`}
        intro="Every city below has at least three audited local-service businesses in our directory. We keep the list fresh by re-crawling weekly and dropping stale entries."
      >
        <DirectAnswer>
          The Revint directory currently lists {cities.length} cities
          with at least three audited local-service businesses each,
          refreshed weekly from live Google Maps data.
        </DirectAnswer>

        <CrossLinkBlock
          title="Browse by city"
          links={cities.map((c) => ({
            label: c.cityName,
            href: `/cities/${c.citySlug}`,
            sub: `${c.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title="Or browse by niche"
          links={[
            { label: "All niches", href: "/niches" },
            { label: "Comparison pages", href: "/compare" },
            { label: "Alternatives", href: "/alternatives" },
          ]}
        />

        <FaqBlock items={FAQS} />
      </DirectoryShell>
    </>
  );
}
