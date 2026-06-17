/**
 * One-shot env loader for the new Vercel account.
 *
 *   1. Reads `.env.vercel-new-production` line by line.
 *   2. Strips comments, blank lines, and quotes.
 *   3. Pipes each `KEY=VALUE` pair into `vercel env add KEY production`.
 *   4. Skips vars that already exist (Vercel CLI returns nonzero) so
 *      reruns are idempotent.
 *
 * Run AFTER `vercel link` has bound this directory to the new project.
 *
 *   node scripts/push-vercel-env.mjs
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const FILE = ".env.vercel-new-production";
const ENV_TARGET = "production";

const raw = readFileSync(FILE, "utf8");
const lines = raw.split(/\r?\n/);

let pushed = 0;
let skipped = 0;
let failed = 0;
let buffer = "";

function flush(pair) {
  if (!pair) return;
  const eq = pair.indexOf("=");
  if (eq < 0) return;
  const key = pair.slice(0, eq).trim();
  let value = pair.slice(eq + 1);
  // Strip surrounding quotes (Vercel pull wraps every value)
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  // Reverse the literal-`\n` artifact that `vercel env pull` sometimes
  // appends to multi-line values.
  value = value.replace(/\\r\\n$/, "").replace(/\\n$/, "");
  if (!key || !value) {
    console.log(`skip (empty value): ${key}`);
    skipped++;
    return;
  }
  // `vercel env add` reads the value from stdin when the value arg
  // is omitted. Piping avoids any shell-quoting headache.
  const r = spawnSync(
    "vercel",
    ["env", "add", key, ENV_TARGET],
    { input: value, shell: true, encoding: "utf8" },
  );
  const stderr = (r.stderr || "").toString();
  if (r.status === 0) {
    console.log(`+ pushed: ${key}`);
    pushed++;
    return;
  }
  if (stderr.includes("already exists") || stderr.includes("already added")) {
    console.log(`= exists: ${key}`);
    skipped++;
    return;
  }
  console.log(`! failed: ${key}\n  ${stderr.trim()}`);
  failed++;
}

for (const line of lines) {
  if (!line.trim()) continue;
  if (line.startsWith("#")) continue;
  // Vercel's pull format uses a single line per var; no need for
  // line-continuation logic, but keep `buffer` plumbing in case the
  // future format changes.
  flush(buffer + line);
  buffer = "";
}

console.log(
  `\nDone. pushed=${pushed} exists=${skipped} failed=${failed}`,
);
