import { SITE } from "@/lib/seo/metadata";
import { MARKETING_COMING_SOON } from "@/lib/marketing-coming-soon";

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
    applicationSubCategory: "Lead Generation",
    operatingSystem: "Web",
    description: SITE.description,
    url: SITE.url,
    image: `${SITE.url}/opengraph-image`,
    publisher: { "@id": `${SITE.url}/#organization` },
    ...(MARKETING_COMING_SOON
      ? {}
      : {
          offers: [
            {
              "@type": "Offer",
              name: "Free trial",
              price: "0",
              priceCurrency: "USD",
              description: "50 leads, 1 vertical, 1 postcode, 3 website plans",
            },
            {
              "@type": "Offer",
              name: "Pro",
              price: "79",
              priceCurrency: "USD",
              description: "1,000 leads/mo, all verticals, 50 website plans/mo",
            },
            {
              "@type": "Offer",
              name: "Agency",
              price: "249",
              priceCurrency: "USD",
              description:
                "5,000 leads/mo, 5 seats, multi-tenant workspaces, 300 plans/mo",
            },
          ],
        }),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1",
      bestRating: "5",
      worstRating: "1",
    },
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
