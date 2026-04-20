/**
 * SCENE 03 — "Type a postcode. Get the list."
 *
 * Lands on /app/discovery, types a city + niche into the discovery form
 * (or simulates result population using the seeded leads), then holds for
 * the remainder of the scene budget so the grid is visible to the camera.
 *
 * Note: the production discovery page calls Google Places live. To keep
 * the recording deterministic we either (a) navigate to a discovery URL
 * with a query that matches our seeded leads' source_query, or (b) skip
 * straight to the leads list view which is already populated by the seed.
 */
import path from "path";
import { createSession } from "../steel-session";
import { loginAsTarget } from "../auth";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, SCENE_DURATIONS_MS } from "../timing";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "03-discovery");
const SCENE_MS = SCENE_DURATIONS_MS.discovery;

export async function run(): Promise<void> {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    await loginAsTarget(page, "/app/leads"); // already-populated grid avoids a live Google call
    await page.waitForLoadState("networkidle");
    await sleep(400);

    const rec = await startRecording(page, OUT_DIR);

    await sleep(600);

    // Optional: scroll the grid one row to add subtle motion under the camera dolly.
    await page.evaluate(() => window.scrollBy({ top: 240, behavior: "smooth" }));
    await sleep(1200);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));

    const remaining = SCENE_MS - 600 - 1200 - 200;
    await sleep(Math.max(remaining, 0));

    await rec.stop();
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
