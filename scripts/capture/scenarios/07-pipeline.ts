/**
 * SCENE 07 — "The pipeline lives with the lead."
 *
 * Navigates to the kanban view (rendered on the discovery / dashboard page
 * depending on the project route — adjust the path below to match the
 * actual board URL). The seed's pipeline distribution gives every column
 * at least one card so the board reads as "in motion" without any clicks.
 *
 * For the Bella Vita "NEW → WON" jump shown in the cut, Remotion overlays
 * a synthetic card travelling across the columns using its own motion
 * primitives — the underlying plate just needs to show the empty board.
 */
import path from "path";
import { createSession } from "../steel-session";
import { loginAsTarget } from "../auth";
import { startRecording, sleep } from "../recorder";
import { CAPTURE_BASE_DIR, SCENE_DURATIONS_MS } from "../timing";

const OUT_DIR = path.join(CAPTURE_BASE_DIR, "07-pipeline");
const SCENE_MS = SCENE_DURATIONS_MS.pipeline;

export async function run(): Promise<void> {
  const handle = await createSession({ width: 1920, height: 1080, dpr: 2 });
  try {
    const { page } = handle;

    // Pipeline lives on /app/leads in this codebase. Adjust if a dedicated
    // /app/pipeline view ships later.
    await loginAsTarget(page, "/app/leads");
    await page.waitForLoadState("networkidle");
    await sleep(400);

    // Try to flip the leads view into kanban / pipeline mode if a toggle exists.
    const pipelineToggle = page.getByRole("button", { name: /pipeline|kanban|board/i });
    if (await pipelineToggle.count()) {
      await pipelineToggle.first().click().catch(() => undefined);
      await sleep(400);
    }

    const rec = await startRecording(page, OUT_DIR);
    await sleep(600);

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
