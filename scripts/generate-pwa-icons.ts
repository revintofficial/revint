/**
 * Rasterize the brand SVG into PWA PNG icons.
 *
 * Why this exists: iOS Safari and several Android launchers ignore SVG
 * manifest icons. `DECISIONS.md` flagged that we need PNG fallbacks; this
 * is the one-shot script that produces them.
 *
 * Run with:   npx tsx scripts/generate-pwa-icons.ts
 * Output:     public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png
 *
 * Re-run any time public/icon.svg changes. Commit the PNGs.
 */

import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PUBLIC_DIR = resolve(process.cwd(), "public");

async function renderIcon(svg: string, size: number, maskable: boolean): Promise<Buffer> {
  // Maskable icons need a 20% safe zone around the logo so the system
  // launcher can round, crop, or mask it without clipping key detail.
  const safeZone = maskable ? 0.2 : 0;
  const innerScale = 1 - safeZone;

  const html = `<!doctype html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .frame { width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; }
  .inner { width: ${Math.round(size * innerScale)}px; height: ${Math.round(size * innerScale)}px; }
  .inner > svg { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>
  <div class="frame"><div class="inner">${svg}</div></div>
</body>
</html>`;

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: false,
      type: "png",
    });
    await browser.close();
    return buf;
  } finally {
    if (browser.isConnected()) await browser.close();
  }
}

async function main() {
  const svgPath = resolve(PUBLIC_DIR, "icon.svg");
  const svg = await readFile(svgPath, "utf8");

  const targets: Array<{ out: string; size: number; maskable: boolean }> = [
    { out: "icon-192.png", size: 192, maskable: false },
    { out: "icon-512.png", size: 512, maskable: false },
    { out: "icon-maskable-512.png", size: 512, maskable: true },
  ];

  for (const t of targets) {
    const buf = await renderIcon(svg, t.size, t.maskable);
    const outPath = resolve(PUBLIC_DIR, t.out);
    await writeFile(outPath, buf);
    // eslint-disable-next-line no-console
    console.log(`wrote ${t.out} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
