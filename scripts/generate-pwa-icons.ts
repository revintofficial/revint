/**
 * Rasterize the Leadac AI brand logo (public/logo.png) into PWA icon PNGs.
 *
 * iOS Safari and several Android launchers ignore SVG manifest icons, so we
 * pre-render PNG fallbacks at 192 and 512, plus a maskable 512 with a 20%
 * safe zone so launchers can round/crop without clipping the mark.
 *
 * Run with:   npx tsx scripts/generate-pwa-icons.ts
 * Output:     public/icon-192.png, public/icon-512.png,
 *             public/icon-maskable-512.png, src/app/favicon.ico
 *
 * Re-run any time public/logo.png changes. Commit the PNGs.
 */

import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const PUBLIC_DIR = resolve(process.cwd(), "public");
const SOURCE = resolve(PUBLIC_DIR, "logo.png");

const BG_TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 } as const;

async function renderIcon(size: number, maskable: boolean): Promise<Buffer> {
  // Maskable icons reserve a 20% safe zone so system launchers can round or
  // crop the mark without clipping detail. Regular icons still breathe a
  // little (~4%) so the logo doesn't kiss the viewport edge.
  const safeZone = maskable ? 0.2 : 0.04;
  const inner = Math.round(size * (1 - safeZone));

  const src = await readFile(SOURCE);
  const resized = await sharp(src)
    .resize(inner, inner, { fit: "contain", background: BG_TRANSPARENT })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_TRANSPARENT,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  const targets: Array<{ out: string; size: number; maskable: boolean }> = [
    { out: "icon-192.png", size: 192, maskable: false },
    { out: "icon-512.png", size: 512, maskable: false },
    { out: "icon-maskable-512.png", size: 512, maskable: true },
  ];

  for (const t of targets) {
    const buf = await renderIcon(t.size, t.maskable);
    const outPath = resolve(PUBLIC_DIR, t.out);
    await writeFile(outPath, buf);
    // eslint-disable-next-line no-console
    console.log(`wrote ${t.out} (${buf.length} bytes)`);
  }

  // Browsers accept a PNG payload served from favicon.ico, which saves us
  // from pulling in a separate ICO encoder just for one slot.
  const faviconBuf = await sharp(await readFile(SOURCE))
    .resize(32, 32, { fit: "contain", background: BG_TRANSPARENT })
    .png()
    .toBuffer();
  await writeFile(resolve(process.cwd(), "src/app/favicon.ico"), faviconBuf);
  // eslint-disable-next-line no-console
  console.log(`wrote src/app/favicon.ico (${faviconBuf.length} bytes)`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
