/**
 * SCENE 05 — "Hand them a draft, not a deck."
 *
 * Captures three plates back-to-back, one per mockup variant, by navigating
 * directly to /m/<slug>. Remotion crossfades or 3D-flips between them in
 * the composition; we don't try to do the flip in-browser because the
 * /m/ pages are individual public mockups.
 *
 * Output: captures/05-mockup-flip/{indigo,emerald,warm}/frame_*.png
 */
import path from "path";
import { createSession } from "../steel-session";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, HERO_MOCKUP_SLUGS, SCENE_DURATIONS_MS } from "../timing";
import { requireEnv } from "../env-check";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "05-mockup-flip");
const PER_VARIANT_MS = Math.floor(SCENE_DURATIONS_MS.mockupFlip / HERO_MOCKUP_SLUGS.length);

export async function run(): Promise<void> {
  const env = requireEnv();
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    for (const slug of HERO_MOCKUP_SLUGS) {
      const url = new URL(`/m/${slug}`, env.appBaseUrl).toString();
      console.log(`[05-mockup-flip] capturing ${slug} → ${url}`);
      await page.goto(url, { waitUntil: "networkidle" });
      await sleep(400);

      const variantDir = path.join(OUT_DIR, slug.replace(/^vid-bv-/, ""));
      const rec = await startRecording(page, variantDir);

      // Slow scroll down then back up so the camera can use the natural motion.
      await sleep(400);
      await page.evaluate(() =>
        window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" }),
      );
      await sleep(1200);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      const remaining = PER_VARIANT_MS - 400 - 1200 - 400;
      await sleep(Math.max(remaining, 0));

      await rec.stop();
    }
  } finally {
    await handle.release();
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
