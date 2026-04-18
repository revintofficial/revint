import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, UnauthorizedError } from "@/lib/auth";

interface FoundWebsite {
  url: string;
  title: string | null;
  source: "domain_guess" | "google_search";
  reachable: boolean;
}

interface WebsiteSearchResult {
  businessName: string;
  found: boolean;
  websites: FoundWebsite[];
  searchedCount: number;
}

const SOCIAL_AND_DIRECTORY_DOMAINS = [
  "google.com", "google.co.uk", "gstatic.com", "googleapis.com",
  "facebook.com", "fb.com", "twitter.com", "x.com", "instagram.com",
  "linkedin.com", "youtube.com", "tiktok.com", "pinterest.com",
  "yelp.com", "yelp.co.uk", "tripadvisor.com", "tripadvisor.co.uk",
  "yell.com", "192.com", "trustpilot.com", "bark.com", "checkatrade.com",
  "mybuilder.com", "ratedpeople.com", "freeindex.co.uk", "cylex-uk.co.uk",
  "hotfrog.co.uk", "brownbook.net", "scoot.co.uk", "thomsonlocal.com",
  "foursquare.com", "bbb.org", "nextdoor.com", "mapquest.com",
  "apple.com", "bing.com", "yahoo.com", "wikipedia.org", "w3.org",
  "schema.org", "github.com", "amazon.com", "ebay.com", "gumtree.com",
  "justeat.co.uk", "deliveroo.co.uk", "ubereats.com",
  "foodhub.co.uk", "hungryhouse.co.uk",
];

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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return { reachable: false, title: null, finalUrl: null, isParked: false };

    const html = await res.text();
    const lowerHtml = html.toLowerCase();

    const isParked = PARKED_INDICATORS.some(p => lowerHtml.includes(p));

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const defaultTitles = [
      "welcome to nginx", "apache2 default page", "it works",
      "iis windows server", "default web site page", "test page",
    ];
    const isDefault = title ? defaultTitles.some(d => title.toLowerCase().includes(d)) : false;

    if (isParked || isDefault) {
      return { reachable: true, title, finalUrl: res.url, isParked: true };
    }

    return { reachable: true, title, finalUrl: res.url, isParked: false };
  } catch {
    return { reachable: false, title: null, finalUrl: null, isParked: false };
  }
}

async function searchGoogle(businessName: string, address: string): Promise<string[]> {
  try {
    const query = `${businessName} ${address} official website`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return [];

    const html = await res.text();

    const urlPattern = /href="\/url\?q=(https?:\/\/[^&"]+)/g;
    const matches: string[] = [];
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const parsed = new URL(decoded);
        const hostname = parsed.hostname.replace(/^www\./, "");
        if (!SOCIAL_AND_DIRECTORY_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
          matches.push(`${parsed.protocol}//${parsed.hostname}`);
        }
      } catch {
        // skip invalid URLs
      }
    }

    if (matches.length === 0) {
      const broadUrlPattern = /https?:\/\/(?:www\.)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}/gi;
      let broadMatch;
      while ((broadMatch = broadUrlPattern.exec(html)) !== null) {
        try {
          const parsed = new URL(broadMatch[0]);
          const hostname = parsed.hostname.replace(/^www\./, "");
          if (!SOCIAL_AND_DIRECTORY_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
            matches.push(`${parsed.protocol}//${parsed.hostname}`);
          }
        } catch {
          // skip
        }
      }
    }

    return [...new Set(matches)].slice(0, 8);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireUser();
    const body = await request.json();
    const { businessName, address, leadId } = body;

    if (!businessName) {
      return NextResponse.json({ error: "businessName is required" }, { status: 400 });
    }

    const domainCandidates = generateDomainCandidates(businessName);
    const googleUrls = await searchGoogle(businessName, address || "");

    const allCandidates = [...new Set([...googleUrls, ...domainCandidates])];
    const websites: FoundWebsite[] = [];

    const batchSize = 5;
    for (let i = 0; i < allCandidates.length; i += batchSize) {
      const batch = allCandidates.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          const result = await checkUrl(url);
          return { url, ...result };
        })
      );

      for (const r of results) {
        if (r.reachable && !r.isParked) {
          const isFromGoogle = googleUrls.includes(r.url);
          websites.push({
            url: r.finalUrl || r.url,
            title: r.title,
            source: isFromGoogle ? "google_search" : "domain_guess",
            reachable: true,
          });
        }
      }

      if (websites.length >= 5) break;
    }

    const uniqueWebsites = websites.reduce<FoundWebsite[]>((acc, w) => {
      const hostname = new URL(w.url).hostname.replace(/^www\./, "");
      if (!acc.some(existing => new URL(existing.url).hostname.replace(/^www\./, "") === hostname)) {
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
        console.error("Failed to update lead with found website:", e);
      }
    }

    const result: WebsiteSearchResult = {
      businessName,
      found: uniqueWebsites.length > 0,
      websites: uniqueWebsites.slice(0, 5),
      searchedCount: allCandidates.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Website search error:", error);
    return NextResponse.json(
      { error: "Website search failed", details: String(error) },
      { status: 500 }
    );
  }
}
