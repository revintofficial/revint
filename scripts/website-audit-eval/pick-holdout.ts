// scripts/website-audit-eval/pick-holdout.ts
/**
 * Pick hold-out sites for the human test: real leads whose site is not in
 * sites.json (the 40 sites the extractor was tuned on).
 *
 *   npx tsx scripts/website-audit-eval/pick-holdout.ts <leads.json> [more.json ...] [--count 12]
 *
 * Input files are pull-leads.ts outputs. Writes sites-holdout.json next to
 * this script. Reads no database.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isSocialUrl } from "@/lib/control/evidence-shelf";

interface PulledLead {
  id: string;
  name: string;
  url: string | null;
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function main() {
  const args = process.argv.slice(2);
  const countAt = args.indexOf("--count");
  const count = countAt >= 0 ? Number(args[countAt + 1]) : 12;
  const files = args.filter((a, i) => !a.startsWith("--") && (countAt < 0 || i !== countAt + 1));
  if (files.length === 0) throw new Error("usage: pick-holdout.ts <leads.json> [more.json ...] [--count 12]");

  const tuned = JSON.parse(readFileSync(path.join(__dirname, "sites.json"), "utf8")) as Array<{ url: string }>;
  const taken = new Set(tuned.map((s) => host(s.url)).filter((h): h is string => h !== null));
  const picked: Array<{ id: string; name: string; url: string }> = [];

  for (const file of files) {
    const { leads } = JSON.parse(readFileSync(file, "utf8")) as { leads: PulledLead[] };
    for (const lead of leads) {
      if (picked.length >= count) break;
      if (!lead.url || isSocialUrl(lead.url)) continue;
      const h = host(lead.url);
      if (!h || taken.has(h)) continue;
      taken.add(h);
      const id = h.replace(/\.(co\.uk|com\.tr|com|net|org|co)$/i, "").replace(/[^a-z0-9]+/g, "-");
      picked.push({ id, name: lead.name, url: lead.url });
    }
  }

  writeFileSync(path.join(__dirname, "sites-holdout.json"), `${JSON.stringify(picked, null, 2)}\n`);
  console.log(`picked ${picked.length} of ${count}: ${picked.map((p) => p.id).join(", ")}`);
  if (picked.length < count) process.exitCode = 1;
}

main();
