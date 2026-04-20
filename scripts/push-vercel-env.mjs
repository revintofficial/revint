/**
 * Push every non-empty KEY=VALUE from .env into the linked Vercel project
 * as a `production` environment variable. Idempotent: if a key already
 * exists on Vercel, it removes it first and re-adds the current local value.
 *
 * One-shot script. Run from the repo root:
 *   node scripts/push-vercel-env.mjs
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const raw = readFileSync(".env", "utf8");

const entries = [];
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1);
  // strip surrounding quotes
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!value) continue;
  entries.push({ key, value });
}

console.log(`[push-vercel-env] pushing ${entries.length} keys to Vercel production`);

for (const { key, value } of entries) {
  // Best effort remove (ignore if it doesn't exist)
  spawnSync("vercel", ["env", "rm", key, "production", "--yes"], {
    stdio: "ignore",
    shell: true,
  });

  const add = spawnSync(
    "vercel",
    ["env", "add", key, "production"],
    {
      input: value + "\n",
      shell: true,
      encoding: "utf8",
    },
  );

  if (add.status === 0) {
    console.log(`  + ${key}`);
  } else {
    console.error(`  ! ${key} failed:`, add.stderr?.slice(0, 200));
  }
}

console.log("[push-vercel-env] done");
