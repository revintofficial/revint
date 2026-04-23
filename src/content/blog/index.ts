import type { BlogPost } from "./types";
import { post as apolloPost } from "./posts/apollo-reply-rates-cratered";
import { post as postcodePost } from "./posts/postcode-niche-playbook";
import { post as auditPost } from "./posts/20-signal-audit-explained";
import { post as openerPost } from "./posts/opener-frameworks-that-work";
import { post as nichePost } from "./posts/choosing-first-niche";
import { post as auditsDataPost } from "./posts/10000-website-audits-what-we-found";
import { post as benchmarksPost } from "./posts/cold-email-reply-rate-benchmarks-2026";
import { post as apolloTeardownPost } from "./posts/apollo-90-day-teardown";
import { post as deliverabilityPost } from "./posts/deliverability-isnt-your-problem";
import { post as icpPost } from "./posts/icp-scoring-is-mostly-bs";
import { post as plumberPost } from "./posts/plumber-outbound-playbook";
import { post as dentistPost } from "./posts/dentist-outbound-playbook";
import { post as dentistReviewsPost } from "./posts/2000-dentist-reviews-analysis";
import { post as postcodeKeywordPost } from "./posts/postcode-vs-keyword-discovery";
import { post as aiPersonalizationPost } from "./posts/ai-personalization-without-ground-truth";

const ALL_POSTS: BlogPost[] = [
  apolloPost,
  postcodePost,
  auditPost,
  openerPost,
  nichePost,
  auditsDataPost,
  benchmarksPost,
  apolloTeardownPost,
  deliverabilityPost,
  icpPost,
  plumberPost,
  dentistPost,
  dentistReviewsPost,
  postcodeKeywordPost,
  aiPersonalizationPost,
];

export const POSTS: BlogPost[] = ALL_POSTS.slice().sort(
  (a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
);

export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getAllPostSlugs(): string[] {
  return POSTS.map((p) => p.slug);
}

export function getPostsByAuthor(authorSlug: string): BlogPost[] {
  return POSTS.filter((p) => p.author.slug === authorSlug);
}

export function getPostsByTag(tag: string): BlogPost[] {
  return POSTS.filter((p) => p.tags.includes(tag));
}

export function getAllTags(): string[] {
  const all = POSTS.flatMap((p) => p.tags);
  return Array.from(new Set(all)).sort();
}

export function getAllAuthors() {
  const byId = new Map<string, (typeof POSTS)[number]["author"]>();
  for (const p of POSTS) {
    byId.set(p.author.slug, p.author);
  }
  return Array.from(byId.values());
}
