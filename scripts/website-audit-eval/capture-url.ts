// scripts/website-audit-eval/capture-url.ts
/**
 * Deep-capture one site and print what was opened, what was not, and the
 * facts that came out. For debugging a single site and for the human test.
 *
 *   npx tsx scripts/website-audit-eval/capture-url.ts <url> [--json out.json]
 *
 * Never touches the database or Redis.
 */
import { writeFileSync } from "node:fs";
import { closeBrowser } from "@/lib/crawler";
import { crawlWebsiteDeep } from "@/lib/site-capture/deep";
import { summarizeLedger } from "@/lib/site-capture/ledger";

async function main() {
  const url = process.argv[2];
  if (!url) throw new Error("usage: capture-url.ts <url> [--json out.json]");
  const t0 = Date.now();
  const { features, capture } = await crawlWebsiteDeep(url, "restaurant");
  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`reachable=${features.reachable} crawlError=${features.crawlError ?? "-"} in ${seconds} s`);

  if (capture) {
    const s = summarizeLedger(capture.ledger);
    console.log(`capture: ${capture.status}; opened ${s.opened}, skipped ${s.skipped}, failed ${s.failed}; sitemap listed ${capture.sitemapUrlCount}`);
    for (const e of capture.ledger) {
      const landed = e.finalUrl && e.finalUrl !== e.url ? ` -> ${e.finalUrl}` : "";
      console.log(`  ${e.outcome.padEnd(7)} ${e.type.padEnd(11)} ${(e.reason ?? "").padEnd(15)} ${e.url}${landed}`);
    }
    for (const p of capture.pages) {
      if (p.thirdPartyRequests.length > 0) console.log(`  requests on ${p.url}: ${p.thirdPartyRequests.slice(0, 12).join(", ")}`);
    }
  }

  const sf = features.siteFacts;
  if (sf) {
    const facts: Array<[string, unknown]> = [
      ["bookingProvider", sf.bookingProvider],
      ["hasPrepayment", sf.hasPrepayment],
      ["tastingMenu", sf.tastingMenu],
      ["qrMenuTool", sf.qrMenuTool],
      ["directOrdering", sf.directOrdering],
      ["deliveryPlatforms", sf.deliveryPlatforms],
      ["languageCount", sf.languageCount],
      ["locationCount", sf.locationCount],
      ["locationHints", sf.locationHints],
      ["hotelOperator", sf.hotelOperator],
      ["menuPdfUrl", sf.menuPdfUrl],
    ];
    console.log("facts:");
    for (const [name, fact] of facts) console.log(`  ${name.padEnd(18)} ${fact == null ? "-" : JSON.stringify(fact)}`);
    console.log(`  bookingChecked=${sf.bookingChecked} menuPageSeen=${sf.menuPageSeen} orderPageSeen=${sf.orderPageSeen}`);
  }

  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt > 0) {
    const pages =
      capture?.pages.map((p) => {
        const { html, ...rest } = p;
        void html; // raw HTML stays out of the file
        return rest;
      }) ?? [];
    writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ features, capture: capture ? { ...capture, pages } : null }, null, 2));
  }
  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
