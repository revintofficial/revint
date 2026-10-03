// scripts/website-audit-eval/snap-url.ts
/**
 * Save the rendered HTML of one URL (for fixtures / ground truth).
 *   npx tsx scripts/website-audit-eval/snap-url.ts <url> <out.html>
 */
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

async function main() {
  const [url, out] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
      locale: "en-GB",
    });
    const res = await page.goto(url, { waitUntil: "load", timeout: 25_000 });
    await page.waitForTimeout(2500);
    writeFileSync(out, `<!-- ${page.url()} -->\n${await page.content()}`);
    console.log(`${res?.status()} ${page.url()}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
