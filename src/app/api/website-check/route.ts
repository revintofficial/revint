import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { assertSafeFetchUrl, UrlGuardError } from "@/lib/url-guard";
import { checkRateLimit, LIMITS, rateLimitResponse } from "@/lib/ratelimit";

interface ContentAnalysis {
  url: string;
  reachable: boolean;
  verdict: "placeholder" | "basic" | "developed" | "unreachable";
  score: number;
  signals: {
    label: string;
    status: "good" | "bad" | "warning";
    detail: string;
  }[];
  summary: string;
  htmlSize: number;
  wordCount: number;
  imageCount: number;
  internalLinkCount: number;
  hasCustomContent: boolean;
  isParked: boolean;
  isComingSoon: boolean;
  builderDetected: string | null;
}

const PLACEHOLDER_PHRASES = [
  "lorem ipsum",
  "dolor sit amet",
  "coming soon",
  "under construction",
  "site is under construction",
  "website coming soon",
  "we're working on it",
  "launching soon",
  "stay tuned",
  "check back later",
  "parked domain",
  "this domain is for sale",
  "domain for sale",
  "buy this domain",
  "this page is not yet available",
  "default web page",
  "it works!",
  "welcome to nginx",
  "apache2 default page",
  "congratulations! your website",
  "this is a placeholder",
  "sample page",
  "hello world",
  "just another wordpress site",
];

const PARKING_INDICATORS = [
  "godaddy",
  "sedoparking",
  "parkingcrew",
  "bodis.com",
  "hugedomains",
  "dan.com",
  "afternic",
  "namecheap parking",
  "domain parking",
  "registrar-servers",
  "above.com",
  "undeveloped.com",
];

function detectBuilder(html: string): string | null {
  const checks: Record<string, RegExp[]> = {
    Wix: [/wix\.com/i, /_wix_/i, /wixstatic\.com/i],
    Squarespace: [/squarespace\.com/i, /squarespace-cdn/i, /sqs-/i],
    WordPress: [/wp-content/i, /wp-includes/i, /wordpress/i],
    Shopify: [/cdn\.shopify\.com/i, /shopify/i],
    Weebly: [/weebly\.com/i, /editmysite/i],
    "GoDaddy Builder": [/godaddy\.com\/websites/i, /secureserver\.net/i, /website-builder/i],
    Webflow: [/webflow/i, /website-files\.com/i],
    "Google Sites": [/sites\.google\.com/i],
    Jimdo: [/jimdo/i, /jimdosite/i],
    Duda: [/duda\.co/i, /dudaone/i],
  };

  for (const [builder, patterns] of Object.entries(checks)) {
    if (patterns.some((p) => p.test(html))) {
      return builder;
    }
  }
  return null;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function analyzeHtml(html: string, url: string): ContentAnalysis {
  const signals: ContentAnalysis["signals"] = [];
  let score = 0;
  const lowerHtml = html.toLowerCase();

  const htmlSize = html.length;
  const visibleText = stripHtmlTags(html);
  const words = visibleText.split(/\s+/).filter((w) => w.length > 1);
  const wordCount = words.length;

  const imgMatches = html.match(/<img[^>]+>/gi) || [];
  const imageCount = imgMatches.length;

  const internalLinks = html.match(/<a[^>]+href=["'][^"'#][^"']*["']/gi) || [];
  const internalLinkCount = internalLinks.length;

  const hasPlaceholder = PLACEHOLDER_PHRASES.some((phrase) =>
    lowerHtml.includes(phrase)
  );

  const isParked = PARKING_INDICATORS.some((indicator) =>
    lowerHtml.includes(indicator)
  );

  const isComingSoon =
    lowerHtml.includes("coming soon") ||
    lowerHtml.includes("under construction") ||
    lowerHtml.includes("launching soon");

  const builderDetected = detectBuilder(html);

  const hasTitle = /<title>[^<]+<\/title>/i.test(html);
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : "";

  const hasMetaDesc = /meta[^>]+name=["']description["']/i.test(html);
  const hasH1 = /<h1[^>]*>[^<]+<\/h1>/i.test(html);
  const hasH2 = /<h2[^>]*>/i.test(html);
  const hasForms = /<form/i.test(html);
  const hasNav = /<nav/i.test(html);
  const hasFooter = /<footer/i.test(html);
  const hasCustomCss =
    /<link[^>]+stylesheet/i.test(html) || /<style/i.test(html);
  const hasJs =
    /<script[^>]+src/i.test(html) || /<script[^>]*>[^<]{50,}<\/script>/i.test(html);

  const hasFavicon = /rel=["'](?:shortcut )?icon["']/i.test(html);
  const hasOpenGraph = /property=["']og:/i.test(html);
  const hasViewport = /name=["']viewport["']/i.test(html);
  const hasStructuredData = /application\/ld\+json/i.test(html);

  if (htmlSize > 20000) {
    score += 10;
    signals.push({ label: "HTML Size", status: "good", detail: `${(htmlSize / 1024).toFixed(0)} KB - Comprehensive content` });
  } else if (htmlSize > 5000) {
    score += 5;
    signals.push({ label: "HTML Size", status: "warning", detail: `${(htmlSize / 1024).toFixed(0)} KB - Moderate content` });
  } else {
    signals.push({ label: "HTML Size", status: "bad", detail: `${(htmlSize / 1024).toFixed(0)} KB - Very little content` });
  }

  if (wordCount > 300) {
    score += 15;
    signals.push({ label: "Word Count", status: "good", detail: `${wordCount} words - Rich content` });
  } else if (wordCount > 100) {
    score += 8;
    signals.push({ label: "Word Count", status: "warning", detail: `${wordCount} words - Thin content` });
  } else {
    signals.push({ label: "Word Count", status: "bad", detail: `${wordCount} words - Very insufficient` });
  }

  if (imageCount > 5) {
    score += 10;
    signals.push({ label: "Images", status: "good", detail: `${imageCount} images found` });
  } else if (imageCount > 0) {
    score += 5;
    signals.push({ label: "Images", status: "warning", detail: `Only ${imageCount} image(s)` });
  } else {
    signals.push({ label: "Images", status: "bad", detail: "No images at all" });
  }

  if (hasTitle && titleText.length > 5) {
    score += 5;
    signals.push({ label: "Title", status: "good", detail: titleText });
  } else {
    signals.push({ label: "Title", status: "bad", detail: hasTitle ? "Title is too short" : "No title tag" });
  }

  if (hasMetaDesc) {
    score += 5;
    signals.push({ label: "Meta Description", status: "good", detail: "Present" });
  } else {
    signals.push({ label: "Meta Description", status: "bad", detail: "Missing" });
  }

  if (hasNav) {
    score += 8;
    signals.push({ label: "Navigation", status: "good", detail: "Menu structure present" });
  } else {
    signals.push({ label: "Navigation", status: "bad", detail: "No menu structure" });
  }

  if (hasFooter) {
    score += 5;
    signals.push({ label: "Footer", status: "good", detail: "Footer section present" });
  } else {
    signals.push({ label: "Footer", status: "warning", detail: "No footer" });
  }

  if (hasH1 && hasH2) {
    score += 8;
    signals.push({ label: "Heading Structure", status: "good", detail: "H1 and H2 present" });
  } else if (hasH1) {
    score += 4;
    signals.push({ label: "Heading Structure", status: "warning", detail: "Only H1 present" });
  } else {
    signals.push({ label: "Heading Structure", status: "bad", detail: "Heading structure missing" });
  }

  if (hasForms) {
    score += 7;
    signals.push({ label: "Form / Contact", status: "good", detail: "Form element present" });
  } else {
    signals.push({ label: "Form / Contact", status: "warning", detail: "No form found" });
  }

  if (internalLinkCount > 10) {
    score += 8;
    signals.push({ label: "Internal Links", status: "good", detail: `${internalLinkCount} links - Multi-page site` });
  } else if (internalLinkCount > 3) {
    score += 4;
    signals.push({ label: "Internal Links", status: "warning", detail: `${internalLinkCount} links` });
  } else {
    signals.push({ label: "Internal Links", status: "bad", detail: `Only ${internalLinkCount} link(s)` });
  }

  if (hasOpenGraph) { score += 3; }
  if (hasFavicon) { score += 2; }
  if (hasViewport) { score += 3; }
  if (hasStructuredData) { score += 4; }

  const technicalFeatures = [hasOpenGraph, hasFavicon, hasViewport, hasStructuredData, hasCustomCss, hasJs].filter(Boolean).length;
  if (technicalFeatures >= 4) {
    signals.push({ label: "Technical Quality", status: "good", detail: `${technicalFeatures}/6 technical features present` });
    score += 5;
  } else if (technicalFeatures >= 2) {
    signals.push({ label: "Technical Quality", status: "warning", detail: `${technicalFeatures}/6 technical features` });
  } else {
    signals.push({ label: "Technical Quality", status: "bad", detail: `${technicalFeatures}/6 technical features - Very weak` });
  }

  if (hasPlaceholder) {
    score -= 20;
    signals.push({ label: "Placeholder Content", status: "bad", detail: "Lorem ipsum or placeholder text detected" });
  }

  if (isParked) {
    score -= 30;
    signals.push({ label: "Parked Domain", status: "bad", detail: "This domain appears to be a parking page" });
  }

  if (isComingSoon) {
    score -= 15;
    signals.push({ label: "Coming Soon", status: "bad", detail: "Site is not live yet" });
  }

  if (builderDetected) {
    signals.push({ label: "Site Builder", status: "warning", detail: `Built with ${builderDetected}` });
  }

  score = Math.max(0, Math.min(100, score));

  const hasCustomContent = wordCount > 100 && !hasPlaceholder && !isParked;

  let verdict: ContentAnalysis["verdict"];
  let summary: string;

  if (isParked) {
    verdict = "placeholder";
    summary = "This domain is parked. There is no active website. An excellent target for a new site pitch.";
  } else if (isComingSoon || (wordCount < 50 && !hasNav)) {
    verdict = "placeholder";
    summary = "Site is not yet developed or is still at a placeholder stage. Content is nearly nonexistent. Ideal target for a professional web design pitch.";
  } else if (hasPlaceholder && wordCount < 150) {
    verdict = "placeholder";
    summary = "Placeholder content detected. The site is built on a template but not customized. A good target for a web development offer.";
  } else if (score < 35) {
    verdict = "basic";
    summary = "Basic-level website. Thin content and weak technical foundation. A serious redesign or rebuild offer is a good fit.";
  } else if (score < 65) {
    verdict = "basic";
    summary = "Mid-level website. Some basics are in place but it falls short of a professional site. A polish and modernization offer would land well.";
  } else {
    verdict = "developed";
    summary = "Well-developed website. Rich content, solid technical foundation, and professional structure. Maintenance, updates, or specialized feature offers are a better fit than a rebuild.";
  }

  return {
    url,
    reachable: true,
    verdict,
    score,
    signals,
    summary,
    htmlSize,
    wordCount,
    imageCount,
    internalLinkCount,
    hasCustomContent,
    isParked,
    isComingSoon,
    builderDetected,
  };
}

export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const rl = await checkRateLimit(session.workspaceId, LIMITS.websiteCheck);
    if (!rl.ok) return rateLimitResponse(rl);
    const body = await request.json().catch(() => null);
    const url = body && typeof body === "object" ? (body as { url?: unknown }).url : undefined;

    if (typeof url !== "string" || !url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // SSRF guard: rejects non-http(s), private/loopback/link-local addresses,
    // and DNS-rebinding-style hostnames (which would otherwise let an
    // authenticated user probe internal services from the app server).
    let safeUrl: URL;
    try {
      safeUrl = await assertSafeFetchUrl(url);
    } catch (err) {
      if (err instanceof UrlGuardError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(safeUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return NextResponse.json({
          url,
          reachable: false,
          verdict: "unreachable",
          score: 0,
          signals: [{ label: "Access", status: "bad", detail: `HTTP ${response.status} - Site unreachable` }],
          summary: `Website returned HTTP ${response.status}. The site is unreachable or does not exist.`,
          htmlSize: 0,
          wordCount: 0,
          imageCount: 0,
          internalLinkCount: 0,
          hasCustomContent: false,
          isParked: false,
          isComingSoon: false,
          builderDetected: null,
        });
      }

      const html = await response.text();
      const analysis = analyzeHtml(html, url);

      return NextResponse.json(analysis);
    } catch (fetchError) {
      clearTimeout(timeout);
      const errorMessage =
        fetchError instanceof Error ? fetchError.message : "Unknown error";

      return NextResponse.json({
        url,
        reachable: false,
        verdict: "unreachable",
        score: 0,
        signals: [{ label: "Access", status: "bad", detail: `Connection error: ${errorMessage}` }],
        summary: `Could not reach the website: ${errorMessage}. Likely a DNS error, server down, or SSL issue.`,
        htmlSize: 0,
        wordCount: 0,
        imageCount: 0,
        internalLinkCount: 0,
        hasCustomContent: false,
        isParked: false,
        isComingSoon: false,
        builderDetected: null,
      });
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("api.website_check.error", { err: error });
    return NextResponse.json(
      { error: "Website check failed", details: String(error) },
      { status: 500 }
    );
  }
}
