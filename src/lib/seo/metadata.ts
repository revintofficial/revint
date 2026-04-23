import type { Metadata } from "next";

/**
 * Central SEO metadata builder for every indexable page.
 *
 * Every page.tsx (static or dynamic) should either export a `metadata` object
 * built via `buildMetadata()` or a `generateMetadata` that calls it. This is
 * the single source of truth for canonical URL, Open Graph, Twitter cards,
 * robots directives, and locale alternates.
 *
 * The `alternates.languages` field is already i18n-ready: today it emits only
 * `{ "en-US": url }`; phase 2 turns on `tr-TR` without touching every page.
 */

const DEFAULT_SITE_URL = "https://leadac.ai";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return raw || DEFAULT_SITE_URL;
}

export const SITE = {
  get url() {
    return resolveSiteUrl();
  },
  name: "Leadac AI",
  legalName: "Leadac AI",
  tagline: "Postcode and a niche. Fresh local leads, audited and pitched.",
  description:
    "Live Google Maps discovery for local-service outbound agencies. Postcode plus niche gives you 47 fresh leads, a 20-signal Playwright audit on every site, a 0-100 opportunity score, and a personalised opener that references what the audit actually found.",
  locale: "en_US",
  defaultLanguage: "en-US" as const,
  supportedLanguages: ["en-US"] as const,
  twitter: "@leadac_ai",
  email: "hello@leadac.ai",
  sameAs: [
    "https://twitter.com/leadac_ai",
    "https://www.linkedin.com/company/leadac-ai",
    "https://github.com/leadac-ai",
    "https://www.crunchbase.com/organization/leadac-ai",
    "https://www.producthunt.com/products/leadac-ai",
    "https://www.g2.com/products/leadac-ai",
    "https://www.capterra.com/p/leadac-ai",
    "https://alternativeto.net/software/leadac-ai/",
  ] as const,
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    bing: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION || undefined,
    indexNowKey: process.env.INDEXNOW_KEY || undefined,
  },
} as const;

export type BuildMetadataOptions = {
  /** Page path starting with a `/`. Used for canonical + alternates. */
  path: string;
  title: string;
  description: string;
  /** Override the page-level OG/Twitter image (defaults to the dynamic route). */
  imagePath?: string;
  /** Set to false to exclude from search results. */
  index?: boolean;
  /** Set to false to tell crawlers not to follow links on the page. */
  follow?: boolean;
  /** `article` for blog, `website` for everything else. */
  ogType?: "website" | "article" | "profile";
  /** Article metadata (blog posts). */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  /** Extra keywords (use sparingly). */
  keywords?: string[];
};

export function canonicalUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE.url}${normalized === "/" ? "" : normalized}`;
}

export function buildAlternateLanguages(
  path: string,
): Record<string, string> {
  const canonical = canonicalUrl(path);
  const alternates: Record<string, string> = {
    [SITE.defaultLanguage]: canonical,
  };
  alternates["x-default"] = canonical;
  return alternates;
}

export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const {
    path,
    title,
    description,
    imagePath,
    index = true,
    follow = true,
    ogType = "website",
    article,
    keywords,
  } = opts;

  const canonical = canonicalUrl(path);
  const fullTitle = title.includes(SITE.name)
    ? title
    : `${title} | ${SITE.name}`;
  const ogImage = imagePath
    ? `${SITE.url}${imagePath}`
    : `${SITE.url}${path === "/" ? "" : path}/opengraph-image`;

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical,
      languages: buildAlternateLanguages(path),
    },
    robots: {
      index,
      follow,
      googleBot: {
        index,
        follow,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: ogType,
      url: canonical,
      siteName: SITE.name,
      title: fullTitle,
      description,
      locale: SITE.locale,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(ogType === "article" && article
        ? {
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            authors: article.author ? [article.author] : undefined,
            section: article.section,
            tags: article.tags,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      site: SITE.twitter,
      creator: SITE.twitter,
      title: fullTitle,
      description,
      images: [ogImage],
    },
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
  };

  return metadata;
}

/**
 * Site-wide defaults used in the root layout's `metadata` export. Individual
 * pages override via `buildMetadata()`; whatever they don't set falls back to
 * this object (via Next.js metadata merge).
 */
export function buildRootMetadata(): Metadata {
  const base = buildMetadata({
    path: "/",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  });

  return {
    ...base,
    metadataBase: new URL(SITE.url),
    applicationName: SITE.name,
    generator: "Next.js",
    referrer: "origin-when-cross-origin",
    authors: [{ name: SITE.name, url: SITE.url }],
    creator: SITE.name,
    publisher: SITE.name,
    category: "technology",
    verification: {
      ...(SITE.verification.google
        ? { google: SITE.verification.google }
        : {}),
      other: {
        ...(SITE.verification.bing
          ? { "msvalidate.01": SITE.verification.bing }
          : {}),
      },
    },
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico" },
      ],
      apple: "/apple-icon.png",
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      title: SITE.name,
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
  };
}
