#!/usr/bin/env tsx
/**
 * Truth Layer contracts CI gate — `npm run check:contracts`.
 *
 * Per master plan §1.3 + §1.4, this script enforces two invariants:
 *
 * 1. Barrel `__contractVersions` map is in sync with the per-file
 *    `__contractVersion` constants. A track that bumps a file's version
 *    without re-exporting it via the barrel will fail this check.
 *
 * 2. Project type-checks cleanly (`tsc --noEmit -p tsconfig.json`). If
 *    a track changes a contract shape without bumping its version,
 *    downstream consumers either fail to compile (blocking the PR) or
 *    remain pinned to the old shape (also caught here when their
 *    pinned import no longer matches).
 *
 * Used by:
 *   - Per-PR CI (`.github/workflows/*` to be added by the Release
 *     Manager — here we ship the script so any pipeline can wire it).
 *   - Master Coordinator's manual Wave-end gate (master plan §4).
 *   - Track Owners' local pre-push hook.
 *
 * Flags:
 *   --skip-full-tsc    Skip step 2 (used by track owners for fast
 *                      iteration; CI must NOT pass this flag).
 *
 * Exit codes:
 *   0 — all green
 *   1 — contract drift / compile error
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

import { __contractVersions } from "../src/lib/sdr-brain/contracts";

const REPO_ROOT = path.resolve(__dirname, "..");

function logHeader(msg: string): void {
  console.log("");
  console.log("─".repeat(72));
  console.log(`  ${msg}`);
  console.log("─".repeat(72));
}

function checkBarrelVersionsInSync(): boolean {
  logHeader("Step 1/2 — Barrel `__contractVersions` map in sync");
  // Expected versions are derived from the per-file constants by way
  // of the barrel re-export — so we don't hardcode them here. We just
  // verify every contract is registered.
  const expectedKeys = [
    "nba-types",
    "pain-point",
    "switch-signal",
    "website-verification",
    "severity",
    "locale-output",
  ];
  let ok = true;
  const actualKeys = Object.keys(__contractVersions);
  for (const key of expectedKeys) {
    if (!(key in __contractVersions)) {
      console.error(`  ✗ Contract "${key}" missing from barrel map`);
      ok = false;
      continue;
    }
    const v = (__contractVersions as Record<string, number>)[key];
    if (typeof v !== "number" || v < 1) {
      console.error(
        `  ✗ Contract "${key}" has invalid __contractVersion: ${String(v)}`,
      );
      ok = false;
      continue;
    }
    console.log(`  ✓ ${key} v${v}`);
  }
  for (const key of actualKeys) {
    if (!expectedKeys.includes(key)) {
      console.error(
        `  ✗ Barrel map exports "${key}" but it isn't in the registered list. Add it to scripts/check-contracts.ts.`,
      );
      ok = false;
    }
  }
  return ok;
}

function checkProjectTypechecks(): boolean {
  logHeader("Step 2/2 — Project type-check (`tsc --noEmit -p tsconfig.json`)");
  const result = spawnSync(
    "npx",
    ["--no-install", "tsc", "--noEmit", "-p", "tsconfig.json"],
    { cwd: REPO_ROOT, encoding: "utf8", shell: true },
  );
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
  if (result.status !== 0) {
    console.error(
      "  ✗ Project type-check failed — likely a downstream consumer is",
    );
    console.error(
      "    pinned to a shape the contract no longer exposes. Either",
    );
    console.error(
      "    update the consumer or revert the contract change.",
    );
    return false;
  }
  console.log("  ✓ All consumers type-check");
  return true;
}

function main(): void {
  const skipFullTsc = process.argv.includes("--skip-full-tsc");
  const steps = [checkBarrelVersionsInSync];
  if (!skipFullTsc) steps.push(checkProjectTypechecks);

  let allOk = true;
  for (const step of steps) {
    if (!step()) allOk = false;
  }

  console.log("");
  if (!allOk) {
    console.error("❌ check:contracts FAILED");
    process.exit(1);
  }
  console.log("✅ check:contracts passed");
  process.exit(0);
}

main();
