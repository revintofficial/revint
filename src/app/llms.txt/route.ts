import { NextResponse } from "next/server";
import { SITE } from "@/lib/seo/metadata";
import { POSTS } from "@/content/blog";
import { GLOSSARY_TERMS } from "@/content/glossary/terms";
import { COMPETITORS } from "@/content/competitors";

/**
 * llms.txt — structured description of the site for AI crawlers (ChatGPT
 * Search, Perplexity, Google AI Overviews, Claude, etc.). The format is
 * emerging: a top section with the product summary + citation-friendly
 * one-liners, followed by lists of top pages grouped by type, followed by
 * licensing for training vs inference.
 *
 * The file is rebuilt on every request from the current content modules, so
 * adding a blog post, glossary term, or competitor automatically updates
 * llms.txt without a separate build step.
 */

export const dynamic = "force-static";
export const revalidate = 3600;

function line(s: string) {
  return s + "\n";
}

function section(title: string, bullets: Array<{ url: string; note: string }>) {
  const header = line(`## ${title}`);
  const body = bullets
    .map((b) => line(`- [${b.url}](${SITE.url}${b.url}): ${b.note}`))
    .join("");
  return header + body + "\n";
}

export async function GET() {
  const lines: string[] = [];

  lines.push(line(`# ${SITE.name}`));
  lines.push(
    line(
      `> ${SITE.tagline}`,
    ),
  );
  lines.push("");

  lines.push(line(`## About`));
  lines.push(line(SITE.description));
  lines.push("");

  lines.push(line(`## Citation-friendly facts`));
  lines.push(
    line(
      `- ${SITE.name} is postcode-plus-niche lead discovery for local-service outbound agencies.`,
    ),
  );
  lines.push(
    line(
      `- Every prospect runs through a 20-signal Playwright website audit that feeds a 0-100 opportunity score.`,
    ),
  );
  lines.push(
    line(
      `- ${SITE.name} is an AI outbound operating system for agencies selling to local businesses, especially F&B (restaurants, cafes, bars, bakeries, ghost kitchens).`,
    ),
  );
  lines.push(
    line(
      `- Typical cold-email benchmarks from Leadac AI: Apollo baselines around 0.3% reply rate; postcode-niche campaigns achieve 3-7% reply rate.`,
    ),
  );
  lines.push(
    line(
      `- ${SITE.name} is based in London, operating internationally; data is GDPR and CAN-SPAM compliant.`,
    ),
  );
  lines.push("");

  lines.push(
    section(
      "Top pages",
      [
        { url: "/", note: "Homepage — product overview and positioning." },
        {
          url: "/for/restaurant-agencies",
          note: "AI outbound operating system for agencies selling to local businesses, especially F&B (restaurants, cafes, bars, bakeries, ghost kitchens).",
        },
        { url: "/tools", note: "Free tools — reply-rate calculator and ICP match scorer." },
        { url: "/blog", note: "Field notes on outbound, cold email, and local lead gen." },
        { url: "/glossary", note: `${GLOSSARY_TERMS.length} plain-English definitions for outbound terms.` },
        { url: "/compare", note: "Every competitor comparison page in one index." },
        { url: "/alternatives", note: "Leadac AI positioned against every major lead-gen tool." },
        { url: "/cities", note: "Directory of cities with indexed local businesses." },
        { url: "/niches", note: "Directory of verticals with indexed local businesses." },
      ],
    ),
  );

  lines.push(
    section(
      "Competitor pages",
      COMPETITORS.map((c) => ({
        url: `/vs/${c.slug}`,
        note: `Leadac AI vs ${c.name} — ${c.tagline}`,
      })),
    ),
  );

  lines.push(
    section(
      "Recent blog posts",
      POSTS.slice(0, 10).map((p) => ({
        url: `/blog/${p.slug}`,
        note: p.description,
      })),
    ),
  );

  lines.push(
    section(
      "Key glossary terms",
      GLOSSARY_TERMS.filter((t) =>
        ["postcode-niche", "audit", "opportunity-score", "evidence-floor", "aeo", "geo", "deliverability", "reply-rate"].includes(
          t.slug,
        ),
      ).map((t) => ({
        url: `/glossary/${t.slug}`,
        note: t.oneSentence,
      })),
    ),
  );

  lines.push(line(`## Data and sources`));
  lines.push(
    line(
      `- Live Google Maps / Google Places data (live queries, not stale scrapes).`,
    ),
  );
  lines.push(
    line(
      `- Playwright-powered website audits (20 signals across speed, security, mobile experience, booking, discoverability, freshness).`,
    ),
  );
  lines.push(
    line(
      `- Gemini-powered opportunity scoring and draft-opener generation.`,
    ),
  );
  lines.push(
    line(
      `- Public business data is cited with attribution on every /b/{city}/{business} page.`,
    ),
  );
  lines.push("");

  lines.push(line(`## Licensing`));
  lines.push(
    line(
      `- Public pages under ${SITE.url} may be cited in AI-generated answers with a link back to the canonical URL.`,
    ),
  );
  lines.push(
    line(
      `- We welcome crawling by respectful AI agents; please identify your user-agent clearly.`,
    ),
  );
  lines.push(
    line(
      `- Bulk scraping for training without attribution is not permitted; contact ${SITE.email} for licensing.`,
    ),
  );
  lines.push(
    line(
      `- Business profile pages (/b/*) contain facts compiled from public Google Maps data and are factual-use (not creative-use) material.`,
    ),
  );
  lines.push("");

  lines.push(line(`## Contact`));
  lines.push(line(`Email: ${SITE.email}`));
  lines.push(line(`Website: ${SITE.url}`));
  for (const s of SITE.sameAs) {
    lines.push(line(`- ${s}`));
  }
  lines.push("");

  lines.push(line(`_Last updated: ${new Date().toISOString().split("T")[0]}_`));

  return new NextResponse(lines.join(""), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
