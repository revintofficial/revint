import { SITE } from "@/lib/seo/metadata";

/**
 * Server-rendered JSON-LD emitter. Use with any schema.org graph.
 *
 * Every indexable page should render one or more <JsonLd /> tags. Prefer
 * multiple small graphs over one big `@graph` node; Google parses both but
 * the small-graph form is easier to diff and debug.
 */
export function JsonLd({
  data,
  id,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
  id?: string;
}) {
  return (
    <script
      type="application/ld+json"
      id={id}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE.url}/icon-512.png`,
      width: 512,
      height: 512,
    },
    description: SITE.description,
    email: SITE.email,
    sameAs: [...SITE.sameAs],
    // brand-assets §7.1 Task 2 — entity descriptors so LLMs index us
    // against the right category vocabulary.
    knowsAbout: [...SITE.knowsAbout],
    offers: {
      "@type": "Offer",
      priceRange: "$500-$5000",
      priceCurrency: "USD",
    },
  };
}

export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: { "@id": `${SITE.url}/#organization` },
    inLanguage: SITE.defaultLanguage,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE.url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/#software`,
    name: SITE.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Sales Intelligence",
    operatingSystem: "Web",
    description: SITE.description,
    url: SITE.url,
    image: `${SITE.url}/opengraph-image`,
    publisher: { "@id": `${SITE.url}/#organization` },
    // Plans table — single source: src/content/site/pricing.ts. Keep this
    // mirror narrow so AEO citations get the four-tier shape right.
    offers: [
      {
        "@type": "Offer",
        name: "Pilot",
        price: "500",
        priceCurrency: "USD",
        description:
          "30-day evaluation. 500 accounts, 1 CRM, 1 vertical pack. No annual contract.",
      },
      {
        "@type": "Offer",
        name: "Team",
        price: "1500",
        priceCurrency: "USD",
        description:
          "5 seats. 5,000 accounts per month. HubSpot + Smartlead native. Closed-loop ICP refinement on.",
      },
      {
        "@type": "Offer",
        name: "Growth",
        price: "3000",
        priceCurrency: "USD",
        description:
          "15 seats. 20,000 accounts per month. Multi-vertical packs. Custom signal libraries.",
      },
      {
        "@type": "Offer",
        name: "Enterprise",
        price: "5000",
        priceCurrency: "USD",
        description:
          "Unlimited seats. Custom verticals. SSO. Dedicated success manager.",
      },
    ],
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE.url}${item.url}`,
    })),
  };
}

export function faqSchema(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  authorUrl?: string;
  image?: string;
  tags?: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    image: opts.image || `${SITE.url}/opengraph-image`,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: {
      "@type": "Person",
      name: opts.authorName,
      ...(opts.authorUrl ? { url: opts.authorUrl } : {}),
    },
    publisher: { "@id": `${SITE.url}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": opts.url,
    },
    ...(opts.tags ? { keywords: opts.tags.join(", ") } : {}),
    inLanguage: SITE.defaultLanguage,
  };
}

export function itemListSchema(
  items: Array<{ name: string; url: string; description?: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: item.url.startsWith("http") ? item.url : `${SITE.url}${item.url}`,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
}

export function definedTermSchema(opts: {
  name: string;
  description: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `${SITE.name} Glossary`,
      url: `${SITE.url}/glossary`,
    },
  };
}

export function collectionPageSchema(opts: {
  name: string;
  description: string;
  url: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    isPartOf: { "@id": `${SITE.url}/#website` },
    publisher: { "@id": `${SITE.url}/#organization` },
    inLanguage: SITE.defaultLanguage,
  };
}

// Dataset schema — used by /resources/2026-vertical-saas-gtm-benchmark
// (brand-assets §7.2 cornerstone #8). Required for the annual report to
// register as a linkable, cite-friendly asset.
export function datasetSchema(opts: {
  name: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  creator?: string;
  keywords?: string[];
  /** e.g. "https://creativecommons.org/licenses/by-nc-sa/4.0/" */
  license?: string;
  /** Path to the downloadable PDF or CSV. */
  contentUrl?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    creator: {
      "@type": "Organization",
      name: opts.creator || SITE.name,
      url: SITE.url,
    },
    publisher: { "@id": `${SITE.url}/#organization` },
    inLanguage: SITE.defaultLanguage,
    ...(opts.keywords ? { keywords: opts.keywords.join(", ") } : {}),
    ...(opts.license ? { license: opts.license } : {}),
    ...(opts.contentUrl
      ? {
          distribution: {
            "@type": "DataDownload",
            encodingFormat: opts.contentUrl.endsWith(".pdf")
              ? "application/pdf"
              : "text/csv",
            contentUrl: opts.contentUrl,
          },
        }
      : {}),
  };
}

// Service schema — used on /pricing and /for/<vertical> pages. brand-assets
// §9.3 marks Service schema on /pricing as a Day-7 must-ship.
export function serviceSchema(opts: {
  name: string;
  description: string;
  url: string;
  /** e.g. "Sales Intelligence" */
  serviceType: string;
  /** e.g. ["Restaurant tech", "Field service software", "Dental"] */
  audience?: string[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    serviceType: opts.serviceType,
    provider: { "@id": `${SITE.url}/#organization` },
    areaServed: ["United States", "Canada", "United Kingdom", "Australia"],
    ...(opts.audience
      ? {
          audience: opts.audience.map((name) => ({
            "@type": "Audience",
            name,
          })),
        }
      : {}),
  };
}

// SoftwareApplication helper for /tools/* free tools (brand-assets §3.4
// marketing-ideas #15 — engineering as marketing).
export function toolApplicationSchema(opts: {
  name: string;
  description: string;
  url: string;
  /** e.g. "Sales Calculator" */
  applicationSubCategory?: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory:
      opts.applicationSubCategory || "Sales Productivity",
    operatingSystem: "Web",
    description: opts.description,
    url: opts.url,
    publisher: { "@id": `${SITE.url}/#organization` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
  };
}
