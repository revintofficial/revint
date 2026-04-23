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
import { getPublicNiches } from "@/lib/seo/programmatic";

export const revalidate = 3600;

export const metadata = buildMetadata({
  path: "/niches",
  title: "Local business directory by niche",
  description:
    "Audited local-service businesses grouped by niche — phone repair, HVAC, plumbing, dental, locksmiths, opticians, and more. Each listing includes a website audit.",
});

export default async function NichesIndexPage() {
  const niches = await getPublicNiches();

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: "Local business directory by niche",
          description:
            "Audited local-service businesses grouped by niche — every listing includes a website audit and Google rating.",
          url: `${SITE.url}/niches`,
        })}
      />
      <JsonLd
        data={itemListSchema(
          niches.map((n) => ({
            name: n.nicheName,
            url: `/niches/${n.nicheSlug}`,
            description: `${n.leadCount} audited businesses`,
          })),
        )}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Niches", url: "/niches" },
        ])}
      />

      <DirectoryShell
        eyebrow="Directory"
        title={`Local business directory by niche (${niches.length} niches)`}
        intro="Every niche below has at least three audited businesses. Drill into a niche to see the list, or cross a niche with a city for a focused view."
      >
        <CrossLinkBlock
          title="Browse by niche"
          links={niches.map((n) => ({
            label: n.nicheName,
            href: `/niches/${n.nicheSlug}`,
            sub: `${n.leadCount}`,
          }))}
        />

        <CrossLinkBlock
          title="Or browse by city"
          links={[
            { label: "All cities", href: "/cities" },
            { label: "Alternatives", href: "/alternatives" },
            { label: "Comparison pages", href: "/compare" },
          ]}
        />
      </DirectoryShell>
    </>
  );
}
