/**
 * Capture every scene the video needs in a single run.
 *
 * Each scenario spins up its own Steel session (cheap, sub-second) so that
 * a failure in one scene doesn't poison the others. If you only need to
 * re-shoot one scene, run it directly:
 *
 *   pnpm tsx scripts/capture/scenarios/04-audit-morph.ts
 */
import { run as runDiscovery } from "./scenarios/03-discovery";
import { run as runAuditMorph } from "./scenarios/04-audit-morph";
import { run as runMockupFlip } from "./scenarios/05-mockup-flip";
import { run as runOpener } from "./scenarios/06-opener";
import { run as runPipeline } from "./scenarios/07-pipeline";

const SCENES: Array<{ name: string; run: () => Promise<void> }> = [
  { name: "03-discovery", run: runDiscovery },
  { name: "04-audit-morph", run: runAuditMorph },
  { name: "05-mockup-flip", run: runMockupFlip },
  { name: "06-opener", run: runOpener },
  { name: "07-pipeline", run: runPipeline },
];

async function main() {
  console.log(`\n=== Capturing ${SCENES.length} scenes ===\n`);
  for (const [i, scene] of SCENES.entries()) {
    console.log(`\n--- [${i + 1}/${SCENES.length}] ${scene.name} ---`);
    const t0 = Date.now();
    try {
      await scene.run();
      console.log(`    ✓ ${scene.name} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.error(`    ✗ ${scene.name} failed:`, e);
      throw e;
    }
  }
  console.log("\n=== All scenes captured ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
