/**
 * SCENE 04 — "Open a lead. See exactly what's broken."
 *
 * Plate captured here:
 *   1. Lead detail page lands collapsed for Bella Vita Trattoria.
 *   2. Camera holds for 800ms (Remotion uses these idle frames as the IN-point).
 *   3. We programmatically expand the audit signals panel.
 *   4. Hold for 8 more seconds while signals "score" themselves on screen.
 *   5. Stop screencast.
 *
 * Remotion's 04-audit-morph.tsx scene picks this PNG sequence up, adds:
 *   - dolly-in (scale 1.0 → 1.08)
 *   - rack focus (background blur 0 → 4px)
 *   - "Five signals. One score." title overlay
 *   - per-signal counter overlays that animate over the static "100/100" text
 *
 * To re-shoot:  pnpm capture:audit
 * To preview frames:  open captures/04-audit-morph/frame_00120.png
 */
import path from "path";
import { createSession } from "../steel-session";
import { loginAsTarget } from "../auth";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, HERO_LEAD_ID, SCENE_DURATIONS_MS } from "../timing";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "04-audit-morph");
const SCENE_MS = SCENE_DURATIONS_MS.auditMorph;

export async function run(): Promise<void> {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    // 1. Land on the lead detail with the audit panel ready to be opened.
    await loginAsTarget(page, `/app/leads/${HERO_LEAD_ID}`);

    // Wait for the lead's business name to be rendered into the page (most reliable signal that the lead detail finished loading).
    await page
      .getByText(/bella vita trattoria/i)
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);

    // Make sure the page is at the top of the audit panel.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
    await sleep(400);

    // 2. Start recording.
    const rec = await startRecording(page, OUT_DIR);

    // 3. 800ms idle for the in-point.
    await sleep(800);

    // 4. Expand the audit signals panel. The lead detail page renders the
    // audit signals as a collapsible card; if the structure changes, update
    // the selector list below.
    const expandTrigger = page
      .getByRole("button", { name: /audit signals|details|expand/i })
      .or(page.getByText(/audit signals/i));

    const triggerCount = await expandTrigger.count();
    if (triggerCount > 0) {
      await expandTrigger.first().click({ delay: 60 }).catch(() => undefined);
    }

    // 5. Hold for the rest of the scene budget so Remotion has frames to use
    // for both the morph and the per-signal counter animation.
    const remaining = SCENE_MS - 800 - 200;
    await sleep(Math.max(remaining, 0));

    const total = await rec.stop();
    console.log(`[04-audit-morph] captured ${total} frames`);
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
