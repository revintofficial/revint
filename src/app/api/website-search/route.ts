import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * Find a website for a business when Google Places didn't return one.
 *
 * The previous implementation scraped `google.com/search` HTML. That path
 * is ToS-violating, gets cloud IP ranges banned within minutes, and breaks
 * whenever Google tweaks their markup. Removed.
 *
 * What remains: domain-name guessing. We generate plausible domain
 * variants from the business name and HEAD-check them directly. No
 * third-party search API required. If the caller wants richer results,
 * wire SerpAPI (or similar) behind a SERPAPI_API_KEY env var and plug it
 * in where indicated below.
 */

interface FoundWebsite {
  url: string;
  title: string | null;
  source: "domain_guess" | "search_api";
  reachable: boolean;
}

interface WebsiteSearchResult {
  businessName: string;
  found: boolean;
  websites: FoundWebsite[];
  searchedCount: number;
}

const PARKED_INDICATORS = [
  "domain for sale", "buy this domain", "parked domain", "sedoparking",
  "parkingcrew", "bodis.com", "hugedomains", "dan.com", "afternic",
  "godaddy parking", "domain parking", "this domain may be for sale",
  "undeveloped.com", "is for sale", "sav.com",
];

function generateDomainCandidates(businessName: string): string[] {
  const cleaned = businessName
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const withoutSuffix = cleaned
    .replace(/\b(ltd|limited|llc|inc|plc|co|company|group|uk|london|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const variants = new Set<string>();
  for (const name of [cleaned, withoutSuffix]) {
    if (!name) continue;
    variants.add(name.replace(/\s+/g, ""));
    variants.add(name.replace(/\s+/g, "-"));
  }

  const extensions = [".com", ".co.uk", ".uk", ".london", ".net", ".org"];
  const candidates = new Set<string>();

  for (const slug of variants) {
    if (!slug || slug.length < 3) continue;
    for (const ext of extensions) {
      candidates.add(`https://www.${slug}${ext}`);
      candidates.add(`https://${slug}${ext}`);
    }
  }

  return Array.from(candidates);
}

async function checkUrl(url: string): Promise<{ reachable: boolean; title: string | null; finalUrl: string | null; isParked: boolean }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadacBot/1.0; +https://leadac.ai/bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return { reachable: false, title: null, finalUrl: null, isParked: false };

    const html = await res.text();
    const lowerHtml = html.toLowerCase();

    const isParked = PARKED_INDICATORS.some((p) => lowerHtml.includes(p));

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const defaultTitles = [
      "welcome to nginx", "apache2 default page", "it works",
      "iis windows server", "default web site page", "test page",
    ];
    const isDefault = title ? defaultTitles.some((d) => title.toLowerCase().includes(d)) : false;

    return {
      reachable: true,
      title,
      finalUrl: res.url,
      isParked: isParked || isDefault,
    };
  } catch {
    return { reachable: false, title: null, finalUrl: null, isParked: false };
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();

    const rl = await checkRateLimit(workspaceId, LIMITS.websiteSearch);
    if (!rl.ok) return rateLimitResponse(rl);

    const body = await request.json();
    const { businessName, leadId } = body;

    if (!businessName) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    const candidates = generateDomainCandidates(businessName);
    const websites: FoundWebsite[] = [];

    const batchSize = 5;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          const result = await checkUrl(url);
          return { url, ...result };
        })
      );

      for (const r of results) {
        if (r.reachable && !r.isParked) {
          websites.push({
            url: r.finalUrl || r.url,
            title: r.title,
            source: "domain_guess",
            reachable: true,
          });
        }
      }

      if (websites.length >= 5) break;
    }

    const uniqueWebsites = websites.reduce<FoundWebsite[]>((acc, w) => {
      const hostname = new URL(w.url).hostname.replace(/^www\./, "");
      if (!acc.some((existing) => new URL(existing.url).hostname.replace(/^www\./, "") === hostname)) {
        acc.push(w);
      }
      return acc;
    }, []);

    if (leadId && uniqueWebsites.length > 0) {
      try {
        await prisma.lead.updateMany({
          where: { id: leadId, workspaceId },
          data: {
            websiteUrl: uniqueWebsites[0].url,
            hasWebsite: true,
          },
        });
      } catch (e) {
        logger.warn("api.website_search.update_failed", { leadId, err: String(e) });
      }
    }

    const result: WebsiteSearchResult = {
      businessName,
      found: uniqueWebsites.length > 0,
      websites: uniqueWebsites.slice(0, 5),
      searchedCount: candidates.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.website_search.error", { err: error });
    return NextResponse.json(
      { error: "Website search failed", details: String(error) },
      { status: 500 }
    );
  }
}
