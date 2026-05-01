/**
 * scrape-restaurant-website.ts
 *
 * Given a list of restaurant websites (from the Google Maps scraper output),
 * crawls each site to detect:
 *   - Whether a proper QR/digital menu exists
 *   - PDF-only QR codes (bad UX = upgrade opportunity)
 *   - Online ordering capability
 *   - Reservation system presence
 *   - Number of locations mentioned (multi-branch signal)
 *   - Social media links (Instagram / Facebook)
 *
 * Uses Apify's apify/website-content-crawler (1 ACU per ~20 pages).
 * For large batches, run 20-25 URLs at a time to keep cost < $0.10/run.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json research/finedine/scripts/scrape-restaurant-website.ts \
 *     --input research/finedine/output/leads-dubai-uae-2026-04-25.json \
 *     --tier T1
 *
 * Output: appends website_audit fields to each lead in the input file.
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const APIFY_TOKEN = process.env.APIFY_TOKEN;
if (!APIFY_TOKEN) {
  console.error("ERROR: APIFY_TOKEN not set in .env");
  process.exit(1);
}

const APIFY_API_BASE = "https://api.apify.com/v2";

interface LeadWithAudit {
  title: string;
  website?: string;
  finedineScore?: number;
  finedineTier?: string;
  websiteAudit?: RestaurantWebsiteAudit;
}

interface RestaurantWebsiteAudit {
  hasQrMenu: boolean;
  hasPdfMenu: boolean;
  hasOnlineOrdering: boolean;
  hasReservationSystem: boolean;
  locationCount: number;
  hasInstagram: boolean;
  hasFacebook: boolean;
  detectedMenuTools: string[];
  crawledAt: string;
}

interface CrawlerResult {
  url: string;
  text?: string;
  html?: string;
}

const QR_MENU_TOOLS: Record<string, string> = {
  finedinemenu: "FineDine",
  menutiger: "MenuTiger",
  "menu-tiger": "MenuTiger",
  flipmenu: "FlipMenu",
  "plumqr.com": "PlumQR",
  menubly: "Menubly",
  tableqr: "TableQR",
  "glorifood.com": "GloriaFood",
  flipdish: "Flipdish",
  "yoello.com": "Yoello",
  "qr.me": "QR.me",
  "orderdizzy": "OrderDizzy",
  "bopple.com": "Bopple",
  "bentobox": "BentoBox",
  "olo.com": "Olo",
  "toast.com": "Toast",
  "square.com/menu": "Square",
  "opentable.com": "OpenTable",
  "resy.com": "Resy",
  "sevenrooms.com": "SevenRooms",
};

function auditPageContent(result: CrawlerResult): Partial<RestaurantWebsiteAudit> {
  const text = (result.text || result.html || "").toLowerCase();
  const html = (result.html || "").toLowerCase();

  const detectedMenuTools: string[] = [];
  for (const [pattern, toolName] of Object.entries(QR_MENU_TOOLS)) {
    if (text.includes(pattern) || html.includes(pattern)) {
      if (!detectedMenuTools.includes(toolName)) {
        detectedMenuTools.push(toolName);
      }
    }
  }

  const hasQrMenu =
    detectedMenuTools.length > 0 ||
    text.includes("qr menu") ||
    text.includes("qr code menu") ||
    text.includes("scan to order") ||
    text.includes("digital menu") ||
    text.includes("scan and order");

  const hasPdfMenu =
    text.includes(".pdf") &&
    (text.includes("menu") || text.includes("food"));

  const hasOnlineOrdering =
    text.includes("order online") ||
    text.includes("order now") ||
    text.includes("place an order") ||
    text.includes("delivery") ||
    html.includes("add to cart") ||
    html.includes("order-button");

  const hasReservationSystem =
    text.includes("reserve a table") ||
    text.includes("make a reservation") ||
    text.includes("book a table") ||
    text.includes("opentable") ||
    text.includes("sevenrooms") ||
    text.includes("resy.com") ||
    text.includes("yelp.com/reservations");

  // Count location mentions (rough heuristic)
  const locationMatches = text.match(/\b(branch|location|outlet|venue)\b/g);
  const locationCount = locationMatches ? Math.min(locationMatches.length, 10) : 1;

  const hasInstagram =
    html.includes("instagram.com") || html.includes("instagram");
  const hasFacebook =
    html.includes("facebook.com") || html.includes("facebook");

  return {
    hasQrMenu,
    hasPdfMenu,
    hasOnlineOrdering,
    hasReservationSystem,
    locationCount,
    hasInstagram,
    hasFacebook,
    detectedMenuTools,
  };
}

async function crawlWebsites(urls: string[]): Promise<Map<string, Partial<RestaurantWebsiteAudit>>> {
  const apiUrl = new URL(
    `${APIFY_API_BASE}/acts/apify~website-content-crawler/run-sync-get-dataset-items`,
  );
  apiUrl.searchParams.set("token", APIFY_TOKEN!);
  apiUrl.searchParams.set("timeout", "120");

  console.log(`\nCrawling ${urls.length} websites...`);
  const res = await fetch(apiUrl.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      startUrls: urls.map((url) => ({ url })),
      maxCrawlDepth: 1,        // homepage + 1 level (menu page)
      maxCrawlPages: urls.length * 3,
      maxResultsPerCrawl: urls.length * 3,
      includeUrlGlobs: ["/**"],
      saveMarkdown: false,
      saveHtml: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Crawler returned ${res.status}: ${body.slice(0, 400)}`);
  }

  const results = (await res.json()) as CrawlerResult[];
  const auditMap = new Map<string, Partial<RestaurantWebsiteAudit>>();

  for (const result of results) {
    try {
      const baseUrl = new URL(result.url).hostname;
      const existing = auditMap.get(baseUrl) ?? {};
      const fresh = auditPageContent(result);

      // Merge: OR booleans, max numbers, concat arrays
      auditMap.set(baseUrl, {
        hasQrMenu: existing.hasQrMenu || fresh.hasQrMenu,
        hasPdfMenu: existing.hasPdfMenu || fresh.hasPdfMenu,
        hasOnlineOrdering: existing.hasOnlineOrdering || fresh.hasOnlineOrdering,
        hasReservationSystem: existing.hasReservationSystem || fresh.hasReservationSystem,
        locationCount: Math.max(existing.locationCount ?? 1, fresh.locationCount ?? 1),
        hasInstagram: existing.hasInstagram || fresh.hasInstagram,
        hasFacebook: existing.hasFacebook || fresh.hasFacebook,
        detectedMenuTools: [
          ...(existing.detectedMenuTools ?? []),
          ...(fresh.detectedMenuTools ?? []),
        ].filter((v, i, a) => a.indexOf(v) === i),
      });
    } catch {
      // ignore URL parse errors
    }
  }

  return auditMap;
}

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[args.indexOf("--input") + 1];
  const tier = args[args.indexOf("--tier") + 1] || "T1";

  if (!inputFile) {
    console.error("Usage: --input <path-to-leads.json> [--tier T1|T2|T3]");
    process.exit(1);
  }

  const leads: LeadWithAudit[] = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const targets = leads.filter(
    (l) => l.finedineTier === tier && l.website && !l.websiteAudit,
  );

  console.log(`\n=== Restaurant Website Auditor ===`);
  console.log(`Input: ${inputFile} (${leads.length} total, ${targets.length} ${tier} without audit)`);

  const BATCH_SIZE = 20; // keep cost per run low
  let processed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const urls = batch.map((l) => l.website!).filter(Boolean);

    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}: ${urls.length} URLs`);
    const auditMap = await crawlWebsites(urls);

    for (const lead of batch) {
      if (!lead.website) continue;
      try {
        const hostname = new URL(lead.website).hostname;
        const partial = auditMap.get(hostname) ?? {};
        lead.websiteAudit = {
          hasQrMenu: partial.hasQrMenu ?? false,
          hasPdfMenu: partial.hasPdfMenu ?? false,
          hasOnlineOrdering: partial.hasOnlineOrdering ?? false,
          hasReservationSystem: partial.hasReservationSystem ?? false,
          locationCount: partial.locationCount ?? 1,
          hasInstagram: partial.hasInstagram ?? false,
          hasFacebook: partial.hasFacebook ?? false,
          detectedMenuTools: partial.detectedMenuTools ?? [],
          crawledAt: new Date().toISOString(),
        };

        // Adjust score: no QR menu = +3 bonus (already counted in initial score, but confirm)
        if (!lead.websiteAudit.hasQrMenu && lead.finedineScore !== undefined) {
          // Already scored as +3 (no known QR) but now confirmed via crawl
          console.log(
            `  ✅ No QR menu confirmed: ${lead.title} (${lead.website})`,
          );
        } else if (lead.websiteAudit.detectedMenuTools.length > 0) {
          console.log(
            `  ⚠️  Already has ${lead.websiteAudit.detectedMenuTools.join(", ")}: ${lead.title}`,
          );
        }
      } catch {
        // ignore URL parse errors
      }
    }

    processed += batch.length;
    console.log(`Processed ${processed}/${targets.length}`);
  }

  // Save back
  fs.writeFileSync(inputFile, JSON.stringify(leads, null, 2), "utf8");
  console.log(`\nSaved website audit results to ${inputFile}`);

  // Summary stats
  const audited = leads.filter((l) => l.websiteAudit);
  const noQr = audited.filter((l) => !l.websiteAudit!.hasQrMenu);
  const pdfOnly = audited.filter((l) => l.websiteAudit!.hasPdfMenu && !l.websiteAudit!.hasQrMenu);
  console.log(`\nSummary:`);
  console.log(`  Audited: ${audited.length}`);
  console.log(`  No QR menu (FineDine opportunity): ${noQr.length}`);
  console.log(`  PDF-only menu (worst UX → easiest upsell): ${pdfOnly.length}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
