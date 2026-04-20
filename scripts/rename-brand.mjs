/**
 * One-shot brand rename: Lead Engine -> Leadac AI.
 *
 * UTF-8 in, UTF-8 out, no BOM. Ordered replacements avoid collisions
 * (compound identifiers before bare words, emails before domain).
 *
 *   node scripts/rename-brand.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();

const REPLACEMENTS = [
  ["hello@leadengine.app", "hello@leadac.ai"],
  ["security@leadengine.app", "security@leadac.ai"],
  ["leadengine.app", "leadac.ai"],
  ["leadengine.com.tr", "leadac.com.tr"],
  ["leadengine.io", "leadac.ai"],
  ["LeadEngineBot", "LeadacBot"],
  ["hideLeadEngineCredit", "hideLeadacCredit"],
  ["showLeadEngineCredit", "showLeadacCredit"],
  ["LeadEngine", "Leadac"],
  ["Lead Engine", "Leadac AI"],
  ["lead-engine", "leadac-ai"],
  ["leadengine", "leadac"],
  ["lead_engine", "leadac"],
];

const INCLUDE_EXT = new Set([".tsx", ".ts", ".md", ".mjs", ".js", ".json", ".css", ".html"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".vercel", ".git", "captures", ".cursor"]);
const SKIP_FILES = new Set(["package-lock.json", "tsconfig.tsbuildinfo", "rename-brand.mjs"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (st.isFile()) {
      if (SKIP_FILES.has(name)) continue;
      if (!INCLUDE_EXT.has(extname(name).toLowerCase())) continue;
      yield full;
    }
  }
}

let touched = 0;
for (const file of walk(ROOT)) {
  const original = readFileSync(file, "utf8");
  let next = original;
  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  if (next !== original) {
    writeFileSync(file, next, "utf8");
    touched++;
    console.log(`updated: ${relative(ROOT, file)}`);
  }
}
console.log(`\nDone. Touched ${touched} files.`);
