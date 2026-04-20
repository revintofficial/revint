/**
 * SCENE NN — "<title>"
 *
 * Copy this file to scenarios/<NN>-<slug>.ts, then:
 *   1. Update OUT_DIR + SCENE_MS to reference the matching `timing.ts` entry.
 *   2. Replace the `loginAsTarget` redirect path with the page you want.
 *   3. Script the user actions between `startRecording` and `stop`.
 *   4. Remember every action that triggers an animation should be followed
 *      by `sleep(durationOfAnimationMs)` so the screencast captures it.
 *   5. Add an entry to `run-all.ts` so `pnpm capture:all` picks it up.
 *
 * Selector strategy (Playwright auto-tries each):
 *   - getByRole("button", { name: /pattern/i })   ← preferred, most stable
 *   - getByText(/pattern/i)                       ← good for headings
 *   - getByTestId("...")                          ← if the page exposes them
 *   - locator("[data-something]")                 ← fallback
 *
 * If a selector fails, do `page.pause()` once locally and use Playwright
 * Inspector to pick the correct one.
 */
import path from "path";
import { createSession } from "../steel-session";
import { loginAsTarget } from "../auth";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, SCENE_DURATIONS_MS } from "../timing";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "NN-slug");
const SCENE_MS = SCENE_DURATIONS_MS.coldOpen; // change this

export async function run(): Promise<void> {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    await loginAsTarget(page, "/app/discovery"); // change this

    await page.waitForLoadState("networkidle");
    await sleep(400);

    const rec = await startRecording(page, OUT_DIR);

    await sleep(600); // pre-roll

    // ── scripted user actions ──
    // await page.getByRole("button", { name: /run discovery/i }).click();
    // await sleep(1200);
    // ── end scripted actions ──

    const remaining = SCENE_MS - 600 - 200;
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
