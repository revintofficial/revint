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
  CrossLinkBlock,
  DirectAnswer,
  FaqBlock,
} from "@/components/public-directory/directory-shell";
import { getPublicNiches } from "@/lib/seo/programmatic";

export const revalidate = 3600;

export const metadata = buildMetadata({
  path: "/niches",
  title: "Local business directory by niche",
  description:
    "Audited local-service businesses grouped by niche — phone repair, HVAC, plumbing, dental, locksmiths, opticians, and more. Each listing includes a website audit.",
});

const FAQS = [
  {
    question: "Which niches work best for local outbound?",
    answer:
      "Niches with visible website quality gaps, reasonable willingness-to-pay, and enough density per postcode to iterate on. Phone repair, dental clinics, opticians, HVAC, driving instructors, and mobile mechanics all score well; restaurants, hair salons, and gyms are saturated or chain-dominated.",
  },
  {
    question: "How many niches does Leadac AI cover?",
    answer:
      "We index any local-service vertical that has at least three audited businesses in any single city. The list grows as our agency customers run discovery in new verticals.",
  },
  {
    question: "Can I cross a niche with a specific city?",
    answer:
      "Yes. Every niche page has a 'by city' cross-link block; open any niche-city page (e.g., phone-repair in London) to see the focused list and the FAQ specific to that combination.",
  },
];

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
      <JsonLd data={faqSchema(FAQS)} />

      <DirectoryShell
        eyebrow="Directory"
        title={`Local business directory by niche (${niches.length} niches)`}
        intro="Every niche below has at least three audited businesses. Drill into a niche to see the list, or cross a niche with a city for a focused view."
      >
        <DirectAnswer>
          The Leadac AI directory indexes {niches.length} local-service
          niches — each with at least three audited businesses.
          Intersect a niche with a city for the highest-intent view.
        </DirectAnswer>

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

        <FaqBlock items={FAQS} />
      </DirectoryShell>
    </>
  );
}
