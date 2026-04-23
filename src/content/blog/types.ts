import type { ReactNode } from "react";

/**
 * Blog post schema. Posts are plain TypeScript modules that export a
 * `post` object matching this shape — no contentlayer/velite build step,
 * full type safety, renders through the shared blog shell.
 */
export type BlogAuthor = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  avatar?: string;
  url?: string;
  links?: {
    twitter?: string;
    linkedin?: string;
  };
};

export type BlogPost = {
  slug: string;
  title: string;
  /** 50-160 char meta description. Use this in previews too. */
  description: string;
  /** ISO8601 date. */
  publishedAt: string;
  updatedAt?: string;
  author: BlogAuthor;
  tags: string[];
  /** One-line lede used at the top of the article + in RSS feeds. */
  lede: string;
  /** Estimated read time in minutes. */
  readMinutes: number;
  /** Rendered article body. */
  body: () => ReactNode;
  /** Optional FAQs rendered at the bottom with FAQPage schema. */
  faqs?: Array<{ question: string; answer: string }>;
  /** Optional citations block. */
  citations?: Array<{ label: string; url: string; note?: string }>;
};

export const AUTHORS: Record<string, BlogAuthor> = {
  "leadac-team": {
    slug: "leadac-team",
    name: "Leadac AI team",
    role: "Founders and operators",
    bio: "We build Leadac AI from London — postcode + niche discovery for outbound agencies selling websites and growth services to local-service businesses. This blog is where we write down what we've learned, what worked, and what didn't.",
    url: "/about/leadac-team",
    links: {
      twitter: "https://twitter.com/leadac_ai",
      linkedin: "https://www.linkedin.com/company/leadac-ai",
    },
  },
};
