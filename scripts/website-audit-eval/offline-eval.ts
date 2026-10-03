// scripts/website-audit-eval/offline-eval.ts
/**
 * Re-run extraction on saved snapshots (run-eval --snapshot) without the
 * network: homepage + the subpages saved for it. Lets the extractor be
 * iterated on quickly; the live run (run-eval.ts) is the real measure.
 *
 *   npx tsx scripts/website-audit-eval/offline-eval.ts <htmlDir> <prevResults.json> <out.json>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractFeatures } from "@/lib/extractor";
import { bare, mergeSiteFacts, pickSubpages, type SubpageKind, type VisitedPage } from "@/lib/site-facts";

function read(file: string): { url: string; html: string } | null {
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const m = /^<!-- (\S+) -->\n/.exec(raw);
  return { url: m?.[1] ?? "", html: m ? raw.slice(m[0].length) : raw };
}

function main() {
  const [dir, prevPath, outPath] = process.argv.slice(2);
  const prev = JSON.parse(readFileSync(prevPath, "utf8")) as Record<string, Record<string, unknown>>;
  const out: Record<string, unknown> = {};
  for (const [id, r] of Object.entries(prev)) {
    const home = read(path.join(dir, `${id}.home.html`));
    if (!home || !r.reachable) {
      out[id] = r;
      continue;
    }
    const f = extractFeatures(home.html, home.url, "restaurant");
    const pick = pickSubpages(home.html, home.url);
    const pages: VisitedPage[] = [];
    for (const kind of ["reservation", "menu", "order"] as SubpageKind[]) {
      const p = read(path.join(dir, `${id}.${kind}.html`));
      if (!p) continue;
      const offHost = bare(new URL(p.url).hostname) !== bare(new URL(home.url).hostname);
      pages.push(offHost ? { kind, url: p.url, html: null, landedUrl: p.url } : { kind, url: p.url, html: p.html });
    }
    out[id] = {
      ...r,
      bookingProvider: f.bookingProvider,
      hasBookingSystem: f.hasBookingSystem,
      detectedMenuTool: f.detectedMenuTool,
      hasQrMenu: f.hasQrMenu,
      hasOnlineOrdering: f.hasOnlineOrdering,
      menuUrl: f.menuUrl,
      siteFacts: mergeSiteFacts(home, pages, pick),
    };
  }
  writeFileSync(outPath, JSON.stringify(out, null, 2));
}

main();
