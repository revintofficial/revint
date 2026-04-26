#!/usr/bin/env node
/**
 * Mechanical sweep that rewrites legacy color literals in /src to the leadac
 * indigo token system. Usage:
 *   node scripts/leadac-color-sweep.cjs <file1> <file2> ...
 *
 * Designed to be safe to re-run; it only rewrites known patterns and never
 * touches values it doesn't recognise. Always inspect the diff before commit.
 */
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node leadac-color-sweep.cjs <file-or-dir...>");
  process.exit(1);
}

const SKIP = new Set([
  path.normalize("src/lib/colors.ts"),
  path.normalize("src/app/globals.css"),
]);
const EXTS = new Set([".tsx", ".ts", ".css"]);

function expand(arg) {
  const stat = fs.existsSync(arg) ? fs.statSync(arg) : null;
  if (!stat) return [];
  if (stat.isFile()) return [arg];
  const out = [];
  for (const e of fs.readdirSync(arg, { withFileTypes: true })) {
    const p = path.join(arg, e.name);
    if (e.isDirectory()) out.push(...expand(p));
    else if (EXTS.has(path.extname(e.name))) out.push(p);
  }
  return out;
}

const files = args.flatMap(expand).filter((p) => !SKIP.has(path.normalize(p)));
if (files.length === 0) {
  console.error("no files matched");
  process.exit(1);
}

// Order matters: replace longer/more-specific patterns first.
const replacements = [
  // Tailwind arbitrary class syntax: bg-[#XXXXXX], text-[#XXXXXX], etc.
  // Map all known indigo/blue/purple variants to the leadac scale.
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#0A84FF\]/g, "$1-(--leadac-500)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#007AFF\]/g, "$1-(--leadac-500)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#3B82F6\]/g, "$1-(--leadac-500)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#0070f3\]/gi, "$1-(--leadac-400)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#64D2FF\]/g, "$1-(--leadac-300)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#BF5AF2\]/g, "$1-(--leadac-400)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#A855F7\]/g, "$1-(--leadac-400)"],
  // Linear-style legacy indigos (used for default Button + sparkle accents)
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#5E6AD2\]/g, "$1-(--leadac-500)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#4F5BD6\]/g, "$1-(--leadac-500)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#3730A3\]/g, "$1-(--leadac-700)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#A5B4FC\]/g, "$1-(--leadac-300)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#C7CCFF\]/g, "$1-(--leadac-200)"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow|caret|decoration|divide|placeholder|accent)-\[#C49AFF\]/g, "$1-(--leadac-300)"],
  // Semantic colors
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#30D158\]/g, "$1-[hsl(152_48%_50%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#22C55E\]/g, "$1-[hsl(152_48%_50%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#34D399\]/g, "$1-[hsl(152_48%_50%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FF453A\]/g, "$1-[hsl(4_62%_54%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FF6961\]/g, "$1-[hsl(4_42%_72%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FF9F0A\]/g, "$1-[hsl(38_70%_52%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FF9500\]/g, "$1-[hsl(38_70%_52%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#F97316\]/g, "$1-[hsl(38_70%_52%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FFD60A\]/g, "$1-[hsl(38_70%_52%)]"],
  [/(bg|text|border|from|to|via|ring|outline|fill|stroke|shadow)-\[#FBBF24\]/g, "$1-[hsl(38_70%_52%)]"],

  // Quoted hex literals (in style={{ color: "#XXXXXX" }} etc.)
  [/(["'`])#0A84FF\1/g, "$1var(--leadac-500)$1"],
  [/(["'`])#007AFF\1/g, "$1var(--leadac-500)$1"],
  [/(["'`])#3B82F6\1/g, "$1var(--leadac-500)$1"],
  [/(["'`])#0070f3\1/gi, "$1var(--leadac-400)$1"],
  [/(["'`])#64D2FF\1/g, "$1var(--leadac-300)$1"],
  [/(["'`])#BF5AF2\1/g, "$1var(--leadac-400)$1"],
  [/(["'`])#A855F7\1/g, "$1var(--leadac-400)$1"],
  [/(["'`])#5E6AD2\1/g, "$1var(--leadac-500)$1"],
  [/(["'`])#4F5BD6\1/g, "$1var(--leadac-500)$1"],
  [/(["'`])#3730A3\1/g, "$1var(--leadac-700)$1"],
  [/(["'`])#A5B4FC\1/g, "$1var(--leadac-300)$1"],
  [/(["'`])#C7CCFF\1/g, "$1var(--leadac-200)$1"],
  [/(["'`])#C49AFF\1/g, "$1var(--leadac-300)$1"],
  [/(["'`])#30D158\1/g, "$1hsl(152 48% 50%)$1"],
  [/(["'`])#22C55E\1/g, "$1hsl(152 48% 50%)$1"],
  [/(["'`])#34D399\1/g, "$1hsl(152 48% 50%)$1"],
  [/(["'`])#5EE6A1\1/g, "$1hsl(152 28% 70%)$1"],
  [/(["'`])#FF453A\1/g, "$1hsl(4 62% 54%)$1"],
  [/(["'`])#FF6961\1/g, "$1hsl(4 42% 72%)$1"],
  [/(["'`])#FF9F0A\1/g, "$1hsl(38 70% 52%)$1"],
  [/(["'`])#FF9500\1/g, "$1hsl(38 70% 52%)$1"],
  [/(["'`])#F97316\1/g, "$1hsl(38 70% 52%)$1"],
  [/(["'`])#FFD60A\1/g, "$1hsl(38 70% 52%)$1"],
  [/(["'`])#FBBF24\1/g, "$1hsl(38 70% 52%)$1"],
  [/(["'`])#FFD37A\1/g, "$1hsl(38 50% 70%)$1"],

  // rgba ios colors
  [/rgba\(\s*10,\s*132,\s*255,\s*([\d.]+)\s*\)/g, "hsl(248 62% 50% / $1)"],
  [/rgba\(\s*168,\s*85,\s*247,\s*([\d.]+)\s*\)/g, "hsl(248 62% 50% / $1)"],
  [/rgba\(\s*124,\s*58,\s*237,\s*([\d.]+)\s*\)/g, "hsl(248 62% 42% / $1)"],
  [/rgba\(\s*139,\s*92,\s*246,\s*([\d.]+)\s*\)/g, "hsl(248 62% 50% / $1)"],
  [/rgba\(\s*191,\s*90,\s*242,\s*([\d.]+)\s*\)/g, "hsl(248 62% 58% / $1)"],
  [/rgba\(\s*48,\s*209,\s*88,\s*([\d.]+)\s*\)/g, "hsl(152 48% 50% / $1)"],
  [/rgba\(\s*255,\s*69,\s*58,\s*([\d.]+)\s*\)/g, "hsl(4 62% 54% / $1)"],
  [/rgba\(\s*255,\s*159,\s*10,\s*([\d.]+)\s*\)/g, "hsl(38 70% 52% / $1)"],
  // Linear-style indigos for shadows
  [/rgba\(\s*49,\s*46,\s*129,\s*([\d.]+)\s*\)/g, "hsl(248 62% 34% / $1)"],
  [/rgba\(\s*67,\s*56,\s*202,\s*([\d.]+)\s*\)/g, "hsl(248 62% 50% / $1)"],
  [/rgba\(\s*94,\s*106,\s*210,\s*([\d.]+)\s*\)/g, "hsl(248 62% 60% / $1)"],
  [/rgba\(\s*248,\s*113,\s*113,\s*([\d.]+)\s*\)/g, "hsl(4 62% 70% / $1)"],
  [/rgba\(\s*52,\s*211,\s*153,\s*([\d.]+)\s*\)/g, "hsl(152 48% 50% / $1)"],
  [/rgba\(\s*239,\s*68,\s*68,\s*([\d.]+)\s*\)/g, "hsl(4 62% 54% / $1)"],
  [/rgba\(\s*245,\s*158,\s*11,\s*([\d.]+)\s*\)/g, "hsl(38 70% 52% / $1)"],
  [/rgba\(\s*251,\s*191,\s*36,\s*([\d.]+)\s*\)/g, "hsl(38 70% 60% / $1)"],
  [/rgba\(\s*99,\s*102,\s*241,\s*([\d.]+)\s*\)/g, "hsl(248 62% 58% / $1)"],
  // Landing deep purple glows (harmonize to indigo while preserving glow)
  [/rgba\(\s*94,\s*35,\s*201,\s*([\d.]+)\s*\)/g, "hsl(248 62% 42% / $1)"],
  [/rgba\(\s*196,\s*154,\s*255,\s*([\d.]+)\s*\)/g, "hsl(248 62% 78% / $1)"],
  [/rgba\(\s*199,\s*120,\s*255,\s*([\d.]+)\s*\)/g, "hsl(248 62% 68% / $1)"],
  [/rgba\(\s*168,\s*117,\s*255,\s*([\d.]+)\s*\)/g, "hsl(248 62% 60% / $1)"],

  // Common dark backgrounds and labels (iOS gray tokens). Catch-all rule
  // maps any rgba(235,235,245,X) -> hsl(248 10% 92% / X), which is the
  // leadac-text-1 base hue/saturation. This shifts the muted greys very
  // slightly toward indigo for warmth without affecting perceived contrast.
  [/rgba\(\s*235,\s*235,\s*245,\s*([\d.]+)\s*\)/g, "hsl(248 10% 92% / $1)"],
  [/rgba\(\s*84,\s*84,\s*88,\s*([\d.]+)\s*\)/g, "hsl(248 7% 35% / $1)"],
  [/rgba\(\s*44,\s*44,\s*46,\s*([\d.]+)\s*\)/g, "hsl(248 7% 14% / $1)"],
  [/rgba\(\s*28,\s*28,\s*30,\s*([\d.]+)\s*\)/g, "hsl(248 7% 11% / $1)"],
  [/rgba\(\s*20,\s*20,\s*22,\s*([\d.]+)\s*\)/g, "hsl(248 7% 8% / $1)"],


  // Bare hex literals in props (e.g. fill="#0A84FF" used by Recharts).
  // Use HSL directly so JS still has a string the chart lib can parse.
  [/=\s*"#0A84FF"/g, "=\"hsl(248 62% 50%)\""],
  [/=\s*"#007AFF"/g, "=\"hsl(248 62% 50%)\""],
  [/=\s*"#3B82F6"/g, "=\"hsl(248 62% 50%)\""],
  [/=\s*"#0070f3"/gi, "=\"hsl(248 62% 58%)\""],
  [/=\s*"#64D2FF"/g, "=\"hsl(248 62% 68%)\""],
  [/=\s*"#BF5AF2"/g, "=\"hsl(248 62% 58%)\""],
  [/=\s*"#A855F7"/g, "=\"hsl(248 62% 58%)\""],
  [/=\s*"#30D158"/g, "=\"hsl(152 48% 50%)\""],
  [/=\s*"#22C55E"/g, "=\"hsl(152 48% 50%)\""],
  [/=\s*"#FF453A"/g, "=\"hsl(4 62% 54%)\""],
  [/=\s*"#FF9F0A"/g, "=\"hsl(38 70% 52%)\""],
  [/=\s*"#F97316"/g, "=\"hsl(38 70% 52%)\""],
  [/=\s*"#FFD60A"/g, "=\"hsl(38 70% 52%)\""],

  // Indigo / purple hex anywhere in string body (e.g. inside linear-gradient(...) literals).
  // Word-boundary anchored to avoid clobbering longer hex sequences.
  [/#0A84FF\b/g, "hsl(248 62% 50%)"],
  [/#007AFF\b/g, "hsl(248 62% 50%)"],
  [/#3B82F6\b/g, "hsl(248 62% 50%)"],
  [/#5E6AD2\b/gi, "hsl(248 62% 50%)"],
  [/#4F5BD6\b/gi, "hsl(248 62% 50%)"],
  [/#3730A3\b/gi, "hsl(248 62% 34%)"],
  [/#4338CA\b/gi, "hsl(248 62% 50%)"],
  [/#A5B4FC\b/gi, "hsl(248 62% 78%)"],
  [/#C7CCFF\b/gi, "hsl(248 62% 88%)"],
  [/#C49AFF\b/gi, "hsl(248 62% 78%)"],
  [/#C4B5FD\b/gi, "hsl(248 62% 78%)"],
  [/#A875FF\b/gi, "hsl(248 62% 60%)"],
  [/#7C3AED\b/gi, "hsl(248 62% 42%)"],
  [/#8B5CF6\b/gi, "hsl(248 62% 50%)"],
  [/#5E23C9\b/gi, "hsl(248 62% 42%)"],
  [/#9EC9FF\b/gi, "hsl(248 62% 78%)"],
  [/#86EFAC\b/gi, "hsl(152 28% 70%)"],
  [/#FCA5A5\b/gi, "hsl(4 42% 72%)"],
  [/#F87171\b/gi, "hsl(4 62% 70%)"],
  [/#FCD34D\b/gi, "hsl(38 70% 60%)"],

  // Final pass: convert hardcoded `hsl(248 62% X%)` and `hsl(248 62% X% / Y)`
  // literals to CSS-variable form so a single change to --leadac-h / --leadac-s
  // in globals.css re-skins every consumer. Skipped for files that need a JS
  // string the browser can't resolve (Recharts uses src/lib/colors.ts).
  [/hsl\(248\s+62%\s+(\d+)%\s*\/\s*([\d.]+)\)/g, "hsl(var(--leadac-h) var(--leadac-s) $1% / $2)"],
  [/hsl\(248\s+62%\s+(\d+)%\)/g, "hsl(var(--leadac-h) var(--leadac-s) $1%)"],
  [/hsl\(248\s+7%\s+(\d+)%\s*\/\s*([\d.]+)\)/g, "hsl(var(--leadac-h) var(--leadac-ns) $1% / $2)"],
  [/hsl\(248\s+7%\s+(\d+)%\)/g, "hsl(var(--leadac-h) var(--leadac-ns) $1%)"],
  [/hsl\(248\s+10%\s+(\d+)%\s*\/\s*([\d.]+)\)/g, "hsl(var(--leadac-h) var(--leadac-nts) $1% / $2)"],
  [/hsl\(248\s+10%\s+(\d+)%\)/g, "hsl(var(--leadac-h) var(--leadac-nts) $1%)"],
];

let touched = 0;
for (const path of files) {
  if (!fs.existsSync(path)) {
    console.warn(`skip: ${path} (not found)`);
    continue;
  }
  const original = fs.readFileSync(path, "utf8");
  let next = original;
  for (const [pattern, sub] of replacements) {
    next = next.replace(pattern, sub);
  }
  if (next !== original) {
    fs.writeFileSync(path, next);
    touched++;
    console.log(`✓ ${path}`);
  } else {
    console.log(`- ${path} (no change)`);
  }
}
console.log(`\n${touched} file(s) modified.`);
