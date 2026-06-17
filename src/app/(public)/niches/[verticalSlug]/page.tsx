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
  getPublicNiches,
  getPublicBusinessesByNiche,
  getRelatedCitiesForNiche,
} from "@/lib/seo/programmatic";
import { findNichePackForPrimaryType } from "@/lib/niches";

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
  // Mirror the runtime hero enrichment for SEO copy: a pack-aware
  // title + description outranks "audited Restaurant businesses"
  // for vertical-specific queries.
  const pack = findNichePackForPrimaryType(niche.nicheName);
  const label = pack ? pack.label : niche.nicheName;
  const description = pack
    ? `${pack.tagline} ${niche.leadCount} audited businesses with full website audits, Google ratings, and contact details — refreshed weekly.`
    : `${niche.leadCount} audited ${niche.nicheName.toLowerCase()} businesses with website audits, Google ratings, and contact details. Sourced live from Google Maps.`;
  return buildMetadata({
    path: `/niches/${verticalSlug}`,
    title: `${label} — audited local businesses`,
    description,
    keywords: [
      `${label} directory`,
      `${label} lead list`,
      `local ${label} businesses`,
      ...(pack ? [pack.pitchAngle.split(".")[0]] : []),
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
        "Yes. Every row you see on this page can be exported to CSV from inside the Revint workspace (free trial includes 50 exports). One-click push to Smartlead and Instantly is supported.",
    },
    {
      question: `How do you find new ${nicheName} businesses?`,
      answer:
        "Revint reads live from the Google Places API. Feed it a postcode and a vertical, it returns the fresh ranked list — not the same Apollo contacts every other agency has.",
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

  // Hybrid niche enrichment: when the Google primary type ("bar",
  // "cafe", "fine_dining_restaurant"...) matches a NichePack we ship,
  // surface its vertical-specific tagline + pitch angle + featured
  // product modules instead of the generic directory copy. Fallback
  // is the original generic header for primary types we don't have a
  // pack for (avoids breaking unmapped types like "park" or
  // "convenience_store").
  const pack = findNichePackForPrimaryType(niche.nicheName);
  const displayLabel = pack ? pack.label : niche.nicheName;
  const introCopy = pack
    ? `${pack.tagline} Browse ${businesses.length} audited businesses below — every entry includes a 20-signal website audit, Google rating, and contact details. Refreshed weekly.`
    : `${businesses.length} ${niche.nicheName.toLowerCase()} businesses with verified contact details, Google ratings, and a 20-signal website audit on each one. Refreshed weekly.`;
  const directAnswerCopy = pack
    ? `${pack.pitchAngle} The Revint ${displayLabel.toLowerCase()} directory lists ${businesses.length} audited businesses worldwide, each with a verified website audit, Google rating, and contact details.`
    : `The Revint ${niche.nicheName.toLowerCase()} directory currently lists ${businesses.length} audited businesses worldwide, each with a verified website audit, Google rating, and contact details. Browse by city below, or open an individual profile for the full 20-signal audit report.`;

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: `${displayLabel} — audited local businesses`,
          description: pack
            ? `${pack.tagline}`
            : `Directory of audited ${niche.nicheName.toLowerCase()} businesses.`,
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
          { name: displayLabel, url: `/niches/${verticalSlug}` },
        ])}
      />
      <JsonLd data={faqSchema(faqs)} />

      <DirectoryShell
        eyebrow={`Directory / ${displayLabel}`}
        title={`${displayLabel} — ${businesses.length} audited businesses`}
        intro={introCopy}
      >
        <DirectAnswer>{directAnswerCopy}</DirectAnswer>

        {pack && pack.highValueSignals.length > 0 && (
          <section className="rounded-3xl border border-white/8 bg-white/3 p-6 sm:p-7">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
              What we audit on every {displayLabel.toLowerCase()} listing
            </h2>
            <p className="text-[14px] text-white/60 mt-1.5 max-w-2xl">
              The 20-signal audit looks for the gaps that matter most for{" "}
              {displayLabel.toLowerCase()} specifically — not a generic
              checklist.
            </p>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pack.highValueSignals.slice(0, 6).map((signal) => (
                <li
                  key={signal}
                  className="flex items-start gap-2 text-[13.5px] text-white/85 rounded-2xl bg-white/4 border border-white/8 px-4 py-2.5"
                >
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-(--revint-500) shrink-0" />
                  <span className="capitalize">{signal}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pack && pack.featuredProductModules && pack.featuredProductModules.length > 0 && (
          <section className="rounded-3xl border border-white/8 bg-white/3 p-6 sm:p-7">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
              Modules agencies pitch most for {displayLabel.toLowerCase()}
            </h2>
            <p className="text-[14px] text-white/60 mt-1.5 max-w-2xl">
              When you open a lead profile, the AI opener and mockup
              automatically lean on these modules — they convert best for{" "}
              {displayLabel.toLowerCase()}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pack.featuredProductModules.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center rounded-full bg-(--revint-500)/10 border border-(--revint-500)/25 px-3 py-1.5 text-[12.5px] text-(--revint-200)"
                >
                  {m}
                </span>
              ))}
            </div>
          </section>
        )}

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
