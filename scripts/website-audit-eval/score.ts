// scripts/website-audit-eval/score.ts
/**
 * Score an eval run (results.json from run-eval.ts) against the
 * hand-built ground truth (truth.json). Facts are read through
 * `buildRoomOneAudit`, i.e. exactly what Room 1 sees.
 *
 *   npx tsx scripts/website-audit-eval/score.ts <results.json> <truth.json> [--rows]
 *
 * Per field: correct (asserted and right), wrong (asserted and wrong,
 * including a `false` where the truth is present), unknown (null).
 * `missed` counts the unknowns where the truth is positive.
 */
import { readFileSync } from "node:fs";
import { buildRoomOneAudit } from "@/lib/ai-core/agent/room-one-audit";

type Verdict = "correct" | "wrong" | "unknown" | "na";

interface Truth {
  reachable: boolean;
  /** Provider name, "none" (no third-party provider), or null (could not establish). */
  bookingProvider: string | null;
  prepayment: boolean | null;
  /** Vendor name, "none", or null. */
  qrMenuTool: string | null;
  pdfMenu: boolean | null;
  directOrdering: boolean | null;
  /** [] = none. null = could not establish. */
  deliveryPlatforms: string[] | null;
  languageCount: number | null;
  tastingMenu: boolean | null;
  multiLocation: boolean | null;
  hotel: boolean | null;
  notes?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function tri(out: boolean | null | undefined, truth: boolean | null): Verdict {
  if (truth === null) return "na";
  if (out === null || out === undefined) return "unknown";
  return out === truth ? "correct" : "wrong";
}

function scoreSite(r: Record<string, unknown>, t: Truth): Record<string, Verdict> {
  const sf = (r.siteFacts ?? null) as Record<string, unknown> | null;
  const audit = buildRoomOneAudit({
    hasWebsite: true,
    websiteUrl: r.url as string,
    audit: {
      reachable: r.reachable as boolean,
      url: r.url as string,
      hasBookingSystem: r.hasBookingSystem as boolean,
      bookingProvider: (r.bookingProvider as string | null) ?? null,
      rawFeaturesJson: r,
    },
    mapFacts: null,
    venueType: null,
  })!;
  const v: Record<string, Verdict> = {};
  v.reachable = audit.reachable === t.reachable ? "correct" : "wrong";
  if (!t.reachable) return v;

  // Booking provider.
  if (t.bookingProvider === null) v.bookingProvider = "na";
  else if (audit.bookingProvider) {
    const got = norm(audit.bookingProvider);
    const ok = t.bookingProvider !== "none" && t.bookingProvider.split("|").some((alt) => got.includes(norm(alt).slice(0, 6)));
    v.bookingProvider = ok ? "correct" : "wrong";
  } else if (audit.hasBookingSystem === false) v.bookingProvider = t.bookingProvider === "none" ? "correct" : "wrong";
  else v.bookingProvider = "unknown";

  v.prepayment = tri(audit.hasPrepayment, t.prepayment);

  if (t.qrMenuTool === null) v.qrMenuTool = "na";
  else if (audit.detectedMenuTool) v.qrMenuTool = t.qrMenuTool !== "none" && norm(audit.detectedMenuTool) === norm(t.qrMenuTool) ? "correct" : "wrong";
  else if (audit.hasQrMenu === false) v.qrMenuTool = t.qrMenuTool === "none" ? "correct" : "wrong";
  else v.qrMenuTool = "unknown";

  v.pdfMenu = tri(audit.pdfMenu, t.pdfMenu);
  v.directOrdering = tri(audit.hasOnlineOrdering, t.directOrdering);

  if (t.deliveryPlatforms === null) v.deliveryPlatforms = "na";
  else if (!audit.deliveryPlatforms) v.deliveryPlatforms = "unknown";
  else {
    const a = new Set(audit.deliveryPlatforms.map(norm));
    const b = new Set(t.deliveryPlatforms.map(norm));
    v.deliveryPlatforms = a.size === b.size && [...a].every((x) => b.has(x)) ? "correct" : "wrong";
  }

  if (t.languageCount === null) v.languageCount = "na";
  else if (audit.languageCount == null) v.languageCount = "unknown";
  else v.languageCount = audit.languageCount === t.languageCount ? "correct" : "wrong";

  v.tastingMenu = tri(audit.tastingMenu, t.tastingMenu);

  // New facts (not in RoomOneAudit): read straight from siteFacts.
  // Multi-site is asserted by a count of 2+ or by a hint ("Our Locations", "Part of X Group");
  // the extractor never asserts "single venue".
  const loc = sf?.locationCount as { value: number } | null | undefined;
  const hints = sf?.locationHints as { value: string[] } | null | undefined;
  const multi = (loc != null && loc.value >= 2) || hints != null;
  v.multiLocation = t.multiLocation === null ? "na" : !multi ? "unknown" : t.multiLocation ? "correct" : "wrong";
  const hotel = sf?.hotelOperator as { value: string } | null | undefined;
  v.hotel = t.hotel === null ? "na" : hotel == null ? "unknown" : t.hotel ? "correct" : "wrong";
  return v;
}

function main() {
  const [resultsPath, truthPath] = process.argv.slice(2);
  const results = JSON.parse(readFileSync(resultsPath, "utf8")) as Record<string, Record<string, unknown>>;
  const truth = JSON.parse(readFileSync(truthPath, "utf8")) as Record<string, Truth>;
  const fields = [
    "reachable",
    "bookingProvider",
    "prepayment",
    "qrMenuTool",
    "pdfMenu",
    "directOrdering",
    "deliveryPlatforms",
    "languageCount",
    "tastingMenu",
    "multiLocation",
    "hotel",
  ];
  const totals: Record<string, Record<Verdict | "missed", number>> = {};
  for (const f of fields) totals[f] = { correct: 0, wrong: 0, unknown: 0, na: 0, missed: 0 };
  const rows: string[] = [];
  for (const [id, t] of Object.entries(truth)) {
    const r = results[id];
    if (!r) continue;
    const v = scoreSite(r, t);
    for (const f of fields) {
      const x = v[f] ?? "na";
      totals[f][x]++;
      if (x === "unknown") {
        const tv = (t as unknown as Record<string, unknown>)[f === "directOrdering" ? "directOrdering" : f];
        const positive = tv === true || (typeof tv === "string" && tv !== "none") || (Array.isArray(tv) && tv.length > 0) || (typeof tv === "number" && tv > 1);
        if (positive) totals[f].missed++;
      }
    }
    rows.push(`| ${id} | ${fields.map((f) => ({ correct: "ok", wrong: "WRONG", unknown: "?", na: "" })[v[f] ?? "na"]).join(" | ")} |`);
  }
  console.log(`| field | correct | wrong | unknown (of which missed positives) | n/a |`);
  console.log(`|---|---|---|---|---|`);
  for (const f of fields) {
    const t = totals[f];
    console.log(`| ${f} | ${t.correct} | ${t.wrong} | ${t.unknown} (${t.missed}) | ${t.na} |`);
  }
  if (process.argv.includes("--rows")) {
    console.log(`\n| site | ${fields.join(" | ")} |`);
    console.log(`|---|${fields.map(() => "---").join("|")}|`);
    for (const r of rows) console.log(r);
  }
}

main();
