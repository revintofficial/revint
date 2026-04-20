/**
 * SCENE 06 — "The opener writes itself."
 *
 * Navigates to the Bella Vita lead detail and (a) shows the AI-drafted
 * opener already populated from the seed (`personalizedFirstMessage`) or
 * (b) clicks the "regenerate" button to record a fresh draft. We default
 * to (a) — the seeded copy is deterministic; (b) would call Gemini live
 * and produce different text every shoot.
 */
import path from "path";
import { createSession } from "../steel-session";
import { loginAsTarget } from "../auth";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, HERO_LEAD_ID, SCENE_DURATIONS_MS } from "../timing";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "06-opener");
const SCENE_MS = SCENE_DURATIONS_MS.opener;

export async function run(): Promise<void> {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    await loginAsTarget(page, `/app/leads/${HERO_LEAD_ID}`);
    await page.waitForLoadState("networkidle");
    await sleep(400);

    // Scroll to the opener / personalized message section.
    const opener = page.getByText(/personalized first message|opener|cold email/i).first();
    if (await opener.count()) {
      await opener.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
      await sleep(400);
    }

    const rec = await startRecording(page, OUT_DIR);
    await sleep(600);

    // Optional: simulate a re-draft click for movement.
    // const redraft = page.getByRole("button", { name: /re-?draft|regenerate/i });
    // if (await redraft.count()) await redraft.first().click().catch(() => undefined);

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
