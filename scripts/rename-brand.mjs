/**
 * One-shot brand rename: LeadAC -> Revint (Phase 1b of the Revint corporate
 * transition).
 *
 * Safe replacements only. The following are PROTECTED (kept as legacy
 * identifiers because they live in persisted data or external contracts):
 *
 *   - `leadac_active_workspace_id`       cookie name; renaming logs everyone out
 *   - `leadac_*` HubSpot custom property keys; renaming orphans CRM data
 *   - `leadac-hero-v1`, `leadac-showcase-v1/v2`  template IDs in `Mockup.templateId`
 *   - `src/lib/mockups/renderers/leadac-showcase.ts` and its sibling files
 *     (renaming would require coordinated import + Prisma default updates)
 *
 * These can be migrated later in a coordinated change with a DB migration
 * and a HubSpot property rename script. The bare lowercase `leadac` slug
 * is intentionally left alone so all of the above survive.
 *
 *   node scripts/rename-brand.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();

/**
 * Ordered replacements. Longer / more specific patterns first so that
 * shorter ones never eat into a token already replaced.
 */
const REPLACEMENTS = [
  // Domains (Phase 1a left a few stragglers in tests, fixtures, html, etc.)
  ["hello@leadacai.com", "hello@revint.dev"],
  ["security@leadacai.com", "security@revint.dev"],
  ["support@leadacai.com", "support@revint.dev"],
  ["mert@leadacai.com", "mert@revint.dev"],
  ["leadacai.com", "revint.dev"],
  ["leadac.com.tr", "revint.dev"],
  ["leadac.ai", "revint.dev"],

  // Identifiers (must precede bare brand strings — they share substrings)
  ["LEADAC_HUE", "REVINT_HUE"],
  ["LEADAC_SATURATION", "REVINT_SATURATION"],
  ["LeadacBot", "RevintBot"],
  ["hideLeadacCredit", "hideRevintCredit"],
  ["showLeadacCredit", "showRevintCredit"],

  // CSS design tokens. `--leadac-` is a unique prefix; safe global replace.
  ["--leadac-", "--revint-"],

  // User-visible brand strings. Order: most specific casing first.
  // "Leadac AI" appears as a display name (footers, emails, page titles).
  // "LeadAC" is the older official casing. "Leadac" is short form.
  ["Leadac AI", "Revint"],
  ["LeadAC", "Revint"],
  ["Leadac", "Revint"],
];

const INCLUDE_EXT = new Set([
  ".tsx",
  ".ts",
  ".md",
  ".mdc",
  ".mjs",
  ".js",
  ".json",
  ".css",
  ".html",
  ".cjs",
]);

/**
 * Top-level directories that hold archive / generated / external content.
 * Brand history in these is intentionally preserved (research reports,
 * PDF exports, captured videos, build output).
 */
const SKIP_TOP_DIRS = new Set([
  "node_modules",
  ".next",
  ".vercel",
  ".git",
  "captures",
  "research",
  "outputs",
  "_archive-docs",
  "video",
  "leadac files",
  "prisma/migrations",
]);

const SKIP_FILES = new Set([
  "package-lock.json",
  "tsconfig.tsbuildinfo",
  "rename-brand.mjs",
]);

/**
 * Files whose entire contents are exempt from replacement because the
 * brand string appears as part of a contract that must not break.
 */
const EXEMPT_FILES = new Set([
  // HubSpot property registry — every key starts with `leadac_` and
  // is persisted on the customer's HubSpot portal. Renaming here
  // requires a coordinated portal-side migration.
  "src/lib/integrations/hubspot/properties.ts",
  // Schema default for `Mockup.templateId` is `"leadac-hero-v1"`.
  // Editing this requires a DB migration that rewrites old rows.
  "prisma/schema.prisma",
]);

/**
 * Per-file line-level skip: if the line contains any of these tokens,
 * the line is left untouched. Catches strings like `"leadac-showcase-v2"`
 * and the cookie name without exempting the whole file. The lookups are
 * substring-based so any line that mentions the protected slug stays
 * verbatim, regardless of how the rest of the line is formatted.
 */
const LINE_PROTECT = [
  "leadac_active_workspace_id",
  "leadac-hero-v",
  "leadac-showcase-v",
  "leadac-showcase.ts",
  "leadac-showcase",
  "/leadac-",        // import paths into the renderer file
  "leadac_temperature",
  "leadac_recommended_angle",
  "leadac_next_best_action",
  "leadac_qualification_status",
  "leadac_qualification_risk",
  "leadac_no_show_risk",
  "leadac_fit_score",
  "leadac_lead_priority",
  "leadac_evidence_summary",
  "leadac_last_analyzed_date",
  "leadac_next_follow_up_date",
  "leadac_*",        // doc/comment references to the HubSpot prop family
];

function shouldSkipDir(rel) {
  for (const top of SKIP_TOP_DIRS) {
    if (rel === top || rel.startsWith(top + "/") || rel.startsWith(top + "\\")) {
      return true;
    }
  }
  return false;
}

function* walk(dir, baseRel = "") {
  for (const name of readdirSync(dir)) {
    const rel = baseRel ? `${baseRel}/${name}` : name;
    if (shouldSkipDir(rel.replace(/\\/g, "/"))) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walk(full, rel);
    } else if (st.isFile()) {
      if (SKIP_FILES.has(name)) continue;
      if (!INCLUDE_EXT.has(extname(name).toLowerCase())) continue;
      yield { full, rel: rel.replace(/\\/g, "/") };
    }
  }
}

function applyReplacements(line) {
  let next = line;
  for (const [from, to] of REPLACEMENTS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

let touched = 0;
let lineEdits = 0;

for (const { full, rel } of walk(ROOT)) {
  if (EXEMPT_FILES.has(rel)) continue;

  const original = readFileSync(full, "utf8");
  if (
    !REPLACEMENTS.some(([from]) => original.includes(from))
  ) {
    continue;
  }

  // Line-level pass so LINE_PROTECT decisions are local. Preserves
  // mixed lines (e.g. a JSX block with a brand mention next to a
  // template ID reference).
  const lines = original.split(/\r?\n/);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  let changed = false;

  const nextLines = lines.map((line) => {
    if (LINE_PROTECT.some((p) => line.includes(p))) return line;
    const updated = applyReplacements(line);
    if (updated !== line) {
      changed = true;
      lineEdits++;
    }
    return updated;
  });

  if (changed) {
    writeFileSync(full, nextLines.join(eol), "utf8");
    touched++;
    console.log(`updated: ${rel}`);
  }
}

console.log(`\nDone. Touched ${touched} files (${lineEdits} line edits).`);
