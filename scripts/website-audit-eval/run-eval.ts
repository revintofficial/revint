// scripts/website-audit-eval/run-eval.ts
/**
 * Local website-audit accuracy run. Calls `crawlWebsite` directly (no
 * queue, no DB) for every site in sites.json, one at a time, and writes
 * a compact per-site record. With --snapshot it also saves the rendered
 * HTML of the homepage and the subpages the crawler would open, so the
 * pages can be re-read offline and trimmed into test fixtures.
 *
 *   npx tsx scripts/website-audit-eval/run-eval.ts <outDir> [--snapshot] [--only id1,id2]
 *
 * Writes only to <outDir>. Never touches the database or Redis.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { closeBrowser, crawlWebsite } from "@/lib/crawler";
import { pickSubpages } from "@/lib/site-facts";

interface Site {
  id: string;
  name: string;
  url: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function snapshot(site: Site, dir: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: UA, ignoreHTTPSErrors: true, locale: "en-US" });
    const res = await page.goto(site.url, { waitUntil: "load", timeout: 25_000 });
    await page.waitForTimeout(2000);
    const finalUrl = res?.url() ?? site.url;
    const html = await page.content();
    writeFileSync(path.join(dir, `${site.id}.home.html`), `<!-- ${finalUrl} -->\n${html}`);
    const pick = pickSubpages(html, finalUrl);
    for (const t of pick.targets) {
      try {
        await page.goto(t.url, { waitUntil: "domcontentloaded", timeout: 8_000 });
        await page.waitForTimeout(800);
        writeFileSync(path.join(dir, `${site.id}.${t.kind}.html`), `<!-- ${page.url()} -->\n${await page.content()}`);
      } catch {
        // subpage not reachable: nothing to save
      }
    }
  } catch (err) {
    console.error(`snapshot ${site.id}:`, err instanceof Error ? err.message : err);
  } finally {
    await browser.close();
  }
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("usage: run-eval.ts <outDir> [--snapshot] [--only a,b]");
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt > 0 ? new Set(process.argv[onlyAt + 1].split(",")) : null;
  const doSnap = process.argv.includes("--snapshot");
  mkdirSync(outDir, { recursive: true });
  const htmlDir = path.join(outDir, "html");
  if (doSnap) mkdirSync(htmlDir, { recursive: true });

  const sites: Site[] = JSON.parse(readFileSync(path.join(__dirname, "sites.json"), "utf8"));
  // Resume-friendly: keep the records of an earlier (interrupted) run.
  let results: Record<string, unknown> = {};
  try {
    results = JSON.parse(readFileSync(path.join(outDir, "results.json"), "utf8"));
  } catch {
    // first run
  }
  const skipDone = process.argv.includes("--resume");
  for (const site of sites) {
    if (only && !only.has(site.id)) continue;
    if (skipDone && results[site.id]) continue;
    const t0 = Date.now();
    const f = await crawlWebsite(site.url, "restaurant");
    const sf = f.siteFacts ?? null;
    results[site.id] = {
      name: site.name,
      url: site.url,
      reachable: f.reachable,
      crawlError: f.crawlError,
      httpStatus: f.httpStatus,
      bookingProvider: f.bookingProvider,
      hasBookingSystem: f.hasBookingSystem,
      hasOnlineReservation: f.hasOnlineReservation,
      detectedMenuTool: f.detectedMenuTool,
      hasQrMenu: f.hasQrMenu,
      hasOnlineOrdering: f.hasOnlineOrdering,
      menuUrl: f.menuUrl,
      siteFacts: sf,
      ms: Date.now() - t0,
    };
    console.log(
      `${site.id}\treach=${f.reachable}\tprov=${sf?.bookingProvider?.value ?? f.bookingProvider ?? "-"}\tprepay=${sf?.hasPrepayment ? "Y" : "-"}\tqr=${sf?.qrMenuTool?.value ?? "-"}\tdirect=${sf?.directOrdering ? "Y" : "-"}\tdeliv=${sf?.deliveryPlatforms?.value.join("+") ?? "-"}\tlang=${sf?.languageCount?.value ?? "-"}\tpages=${sf?.pagesVisited.map((p) => p.kind + (p.ok ? "" : "!")).join(",") ?? "-"}`,
    );
    if (doSnap) await snapshot(site, htmlDir);
    writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  }
  await closeBrowser();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
