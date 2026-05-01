/**
 * scrape-google-maps-leads.ts
 *
 * Finds restaurant and hotel leads in a target city using Apify's
 * Google Maps scraper, then runs a quick website check to identify
 * prospects that lack a proper QR/digital menu.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json research/finedine/scripts/scrape-google-maps-leads.ts \
 *     --city "Dubai, UAE" \
 *     --query "restaurant" \
 *     --maxResults 100
 *
 * Requires APIFY_TOKEN in your .env file.
 * Output: research/finedine/output/leads-{city}-{date}.json
 *
 * Actor used: compass/crawler-google-places
 * Cost estimate: ~$0.01-0.03 per 100 results (Apify pay-per-result)
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

interface GoogleMapsResult {
  title: string;
  url?: string;
  website?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  totalScore?: number;
  reviewsCount?: number;
  categoryName?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  // FineDine-specific scoring added by this script
  finedineScore?: number;
  finedineTier?: "T1" | "T2" | "T3";
  hasQrMenu?: boolean;
  isHotel?: boolean;
  isMultiBranch?: boolean;
}

async function runApifyActor<T>(
  actorId: string,
  input: unknown,
  timeoutSec = 120,
): Promise<T[]> {
  const url = new URL(
    `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`,
  );
  url.searchParams.set("token", APIFY_TOKEN!);
  url.searchParams.set("timeout", String(timeoutSec));

  console.log(`\nRunning Apify actor: ${actorId}...`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify ${actorId} returned ${res.status}: ${body.slice(0, 400)}`);
  }

  const items = (await res.json()) as T[];
  console.log(`  Got ${items.length} results.`);
  return items;
}

/**
 * Quick heuristic: does the website URL or page title contain signals
 * indicating a QR menu integration?
 */
function detectQrMenuSignals(website?: string): boolean {
  if (!website) return false;
  const known = [
    "finedinemenu",
    "menutigr",
    "flipmenu",
    "qrco.de",
    "menubly",
    "tableqr",
    "plumqr",
    "glorifood",
    "menudrive",
    "grubhub.com/restaurant",
    "qr.me",
    "menutiger",
    "mydigimenu",
    "bopple",
    "orderdizzy",
    "yoello",
    "flipdish",
    "ordermark",
    "bentobox",
  ];
  const lower = website.toLowerCase();
  return known.some((k) => lower.includes(k));
}

/**
 * Applies the FineDine ICP scoring model to a GMaps result.
 */
function scoreForFineDine(place: GoogleMapsResult): number {
  let score = 0;

  // Website signals
  if (!place.website) {
    score += 1; // no web presence at all = likely still paper
  } else if (detectQrMenuSignals(place.website)) {
    score -= 2; // already has a QR menu tool - deprioritize
  } else {
    score += 3; // has website but no known QR menu tool = best prospect
  }

  // Multi-branch / chain signal from title
  const titleLower = (place.title || "").toLowerCase();
  if (
    titleLower.includes(" group") ||
    titleLower.includes(" chain") ||
    titleLower.includes("&") ||
    titleLower.includes("branches") ||
    titleLower.includes(" - ") // "Brand - Location" naming pattern
  ) {
    score += 2;
  }

  // Hotel signal
  const hotelKeywords = ["hotel", "resort", "suites", "palace", "inn", "lodge", "motel", "villa", "ritz", "hilton", "marriott", "hyatt", "sheraton", "westin", "intercontinental", "accor"];
  const isHotel = hotelKeywords.some(
    (k) => titleLower.includes(k) || (place.categoryName || "").toLowerCase().includes(k),
  );
  if (isHotel) score += 2;

  // Review volume (active operation)
  if ((place.reviewsCount ?? 0) >= 50) score += 1;
  if ((place.reviewsCount ?? 0) >= 200) score += 1;

  // Rating quality
  if ((place.totalScore ?? 0) >= 4.0) score += 1;

  return score;
}

async function main() {
  const args = process.argv.slice(2);
  const cityArg = args[args.indexOf("--city") + 1] || "Dubai, UAE";
  const queryArg = args[args.indexOf("--query") + 1] || "restaurant";
  const maxResults = parseInt(args[args.indexOf("--maxResults") + 1] || "100", 10);

  console.log(`\n=== FineDine Lead Scraper ===`);
  console.log(`City: ${cityArg}`);
  console.log(`Query: ${queryArg}`);
  console.log(`Max results: ${maxResults}`);

  const places = await runApifyActor<GoogleMapsResult>(
    "compass/crawler-google-places",
    {
      searchStringsArray: [`${queryArg} in ${cityArg}`],
      maxCrawledPlacesPerSearch: maxResults,
      language: "en",
      includeWebResults: false,
      // Only full-service restaurants and hotels
      placeMinimumStars: 3.5,
    },
    180,
  );

  // Score and classify
  const scored = places.map((place) => {
    const finedineScore = scoreForFineDine(place);
    const isHotel = ["hotel", "resort", "suites", "palace"].some(
      (k) => (place.title || "").toLowerCase().includes(k),
    );
    return {
      ...place,
      finedineScore,
      finedineTier: finedineScore >= 5 ? "T1" : finedineScore >= 3 ? "T2" : "T3",
      isHotel,
      hasQrMenu: detectQrMenuSignals(place.website),
    } as GoogleMapsResult;
  });

  // Sort by score descending
  scored.sort((a, b) => (b.finedineScore ?? 0) - (a.finedineScore ?? 0));

  const t1 = scored.filter((p) => p.finedineTier === "T1");
  const t2 = scored.filter((p) => p.finedineTier === "T2");
  const t3 = scored.filter((p) => p.finedineTier === "T3");

  console.log(`\n=== Scoring Results ===`);
  console.log(`Tier 1 (direct call): ${t1.length}`);
  console.log(`Tier 2 (email sequence): ${t2.length}`);
  console.log(`Tier 3 (batch drip): ${t3.length}`);

  console.log(`\n=== Top 10 Tier 1 Leads ===`);
  t1.slice(0, 10).forEach((p, i) => {
    console.log(
      `${i + 1}. ${p.title} | Score: ${p.finedineScore} | Reviews: ${p.reviewsCount ?? 0} | ⭐${p.totalScore ?? "-"} | ${p.website || "no website"}`,
    );
  });

  // Write output
  const outDir = path.resolve(__dirname, "../output");
  fs.mkdirSync(outDir, { recursive: true });
  const citySlug = cityArg.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `leads-${citySlug}-${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(scored, null, 2), "utf8");
  console.log(`\nSaved ${scored.length} leads to ${outPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
