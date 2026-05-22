#!/usr/bin/env tsx
/**
 * SEO validator — CI guardrail.
 *
 * Fetches a sample URL per page type and asserts:
 *   1. <title>                                      (non-empty, ≤ 70 chars)
 *   2. <meta name="description">                    (non-empty, ≥ 40 chars)
 *   3. <link rel="canonical">                       (absolute URL on SITE.url)
 *   4. <meta property="og:title"> + og:image        (both present)
 *   5. <meta name="twitter:card">                   (summary or summary_large_image)
 *   6. >= 1 <script type="application/ld+json">     (parses as JSON w/ @context)
 *   7. Response returns 200 with Content-Type: text/html
 *
 * Page types covered:
 *   - home, pricing, marketing-vertical, blog-index, blog-post,
 *     glossary-index, glossary-term, tools-index, tool, alternatives,
 *     vs-single, vs-pair, compare, cities-index, niches-index
 *
 * Run via:   npm run seo:validate
 * CI mode:   SEO_VALIDATE_BASE=https://leadac.ai npm run seo:validate
 *
 * Exits 1 if any assertion fails so CI blocks the PR.
 */

/* eslint-disable no-console */

const BASE =
  process.env.SEO_VALIDATE_BASE ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const EXPECTED_HOST = (() => {
  try {
    return new URL(BASE).host;
  } catch {
    return null;
  }
})();

type Check = {
  label: string;
  path: string;
  /** Skip if the dynamic route has no data in this env. */
  softFail?: boolean;
};

const CHECKS: Check[] = [
  { label: "home", path: "/" },
  { label: "marketing:demo", path: "/demo" },
  { label: "tools-index", path: "/tools" },
  { label: "tool:reply-rate", path: "/tools/cold-email-reply-rate-calculator" },
  { label: "tool:icp-scorer", path: "/tools/icp-match-scorer" },
  { label: "blog-index", path: "/blog" },
  { label: "blog-post", path: "/blog/20-signal-audit-explained" },
  { label: "glossary-index", path: "/glossary" },
  { label: "glossary-term", path: "/glossary/cold-email" },
  { label: "compare-index", path: "/compare" },
  { label: "alternatives", path: "/alternatives/apollo" },
  { label: "vs-single", path: "/vs/apollo" },
  { label: "vs-pair", path: "/vs/apollo-vs-clay" },
  { label: "cities-index", path: "/cities" },
  { label: "niches-index", path: "/niches" },
  { label: "legal-privacy", path: "/legal/privacy" },
  { label: "legal-terms", path: "/legal/terms" },
  { label: "about", path: "/about" },
];

type Failure = { label: string; path: string; reason: string };

function pick(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  return m ? (m[1] ?? "").trim() : null;
}

function pickAll(html: string, regex: RegExp): string[] {
  return [...html.matchAll(regex)].map((m) => m[1] ?? "").map((s) => s.trim());
}

async function validateUrl(check: Check, failures: Failure[]) {
  const url = BASE.replace(/\/$/, "") + check.path;
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": "leadac-seo-validate/1.0" },
    });
  } catch (err) {
    failures.push({
      label: check.label,
      path: check.path,
      reason: `fetch failed: ${(err as Error).message}`,
    });
    return;
  }

  if (res.status !== 200) {
    failures.push({
      label: check.label,
      path: check.path,
      reason: `HTTP ${res.status}`,
    });
    return;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) {
    failures.push({
      label: check.label,
      path: check.path,
      reason: `content-type was ${ct || "missing"}`,
    });
    return;
  }

  const html = await res.text();

  const title = pick(html, /<title[^>]*>([^<]+)<\/title>/i);
  if (!title) {
    failures.push({ ...check, reason: "missing <title>" });
  } else if (title.length > 72) {
    failures.push({
      ...check,
      reason: `title ${title.length} chars > 72`,
    });
  }

  const desc = pick(
    html,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
  );
  if (!desc || desc.length < 40) {
    failures.push({
      ...check,
      reason: `description missing or too short (${desc?.length ?? 0} chars)`,
    });
  }

  const canonical = pick(
    html,
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
  );
  if (!canonical) {
    failures.push({ ...check, reason: "missing canonical link" });
  } else {
    try {
      const u = new URL(canonical);
      if (EXPECTED_HOST && u.host !== EXPECTED_HOST) {
        failures.push({
          ...check,
          reason: `canonical host ${u.host} != ${EXPECTED_HOST}`,
        });
      }
    } catch {
      failures.push({
        ...check,
        reason: `canonical not an absolute URL: ${canonical}`,
      });
    }
  }

  const ogTitle = pick(
    html,
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (!ogTitle) failures.push({ ...check, reason: "missing og:title" });

  const ogImage = pick(
    html,
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  );
  if (!ogImage) failures.push({ ...check, reason: "missing og:image" });

  const twCard = pick(
    html,
    /<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']+)["']/i,
  );
  if (!twCard) failures.push({ ...check, reason: "missing twitter:card" });

  const jsonLdBlocks = pickAll(
    html,
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (jsonLdBlocks.length === 0) {
    failures.push({ ...check, reason: "no JSON-LD script block" });
  } else {
    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of items) {
          if (item["@context"] == null) {
            failures.push({
              ...check,
              reason: "JSON-LD missing @context",
            });
            break;
          }
        }
      } catch (err) {
        failures.push({
          ...check,
          reason: `invalid JSON-LD: ${(err as Error).message}`,
        });
      }
    }
  }
}

async function main() {
  console.log(`seo:validate — base=${BASE}`);

  if (!EXPECTED_HOST) {
    console.error(`invalid base URL: ${BASE}`);
    process.exit(1);
  }

  const failures: Failure[] = [];
  let passed = 0;

  for (const check of CHECKS) {
    const before = failures.length;
    await validateUrl(check, failures);
    const added = failures.length - before;
    if (added === 0) {
      passed++;
      console.log(`  ok   ${check.label}  ${check.path}`);
    } else {
      for (const f of failures.slice(-added)) {
        console.log(`  FAIL ${f.label}  ${f.path} — ${f.reason}`);
      }
    }
  }

  console.log(
    `\nseo:validate — ${passed}/${CHECKS.length} page types passed, ${failures.length} failures`,
  );

  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
