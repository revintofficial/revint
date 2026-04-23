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
} from "@/components/public-directory/directory-shell";
import { getPublicCities } from "@/lib/seo/programmatic";

export const revalidate = 3600;

export const metadata = buildMetadata({
  path: "/cities",
  title: "Local business directory by city",
  description:
    "Audited local-service businesses, organised by city. Every profile includes a website audit, response-rate signals, and contact details sourced from Google Maps.",
});

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

      <DirectoryShell
        eyebrow="Directory"
        title={`Local business directory (${cities.length} cities)`}
        intro="Every city below has at least three audited local-service businesses in our directory. We keep the list fresh by re-crawling weekly and dropping stale entries."
      >
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
      </DirectoryShell>
    </>
  );
}
