// scripts/website-audit-eval/human-sheet.ts
/**
 * Turn a deep eval run into a sheet a person fills in while opening each
 * site: every asserted fact with its evidence, every page the capture says
 * it read, every page it could not read.
 *
 *   npx tsx scripts/website-audit-eval/human-sheet.ts <results.json> <out.md>
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Fact {
  value: unknown;
  url?: string;
  quote?: string | null;
  scope?: string;
  source?: string;
}
interface LedgerRow {
  url: string;
  finalUrl: string | null;
  type: string;
  outcome: string;
  reason: string | null;
}
interface SiteResult {
  name: string;
  url: string;
  reachable: boolean;
  crawlError: string | null;
  ms: number;
  siteFacts: Record<string, unknown> | null;
  capture: { status: string; ledger: LedgerRow[] } | null;
}

const FACTS: Array<[string, string]> = [
  ["bookingProvider", "Rezervasyon sağlayıcısı"],
  ["hasPrepayment", "Kapora / kart güvencesi"],
  ["tastingMenu", "Tadım menüsü"],
  ["qrMenuTool", "Dijital / QR menü aracı"],
  ["directOrdering", "Kendi online siparişi"],
  ["deliveryPlatforms", "Teslimat platformları"],
  ["languageCount", "Dil sayısı"],
  ["locationCount", "Şube sayısı"],
  ["locationHints", "Çok şube ipucu"],
  ["hotelOperator", "Otel işletmecisi"],
];

const cell = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

function main() {
  const [resultsPath, outPath] = process.argv.slice(2);
  if (!resultsPath || !outPath) throw new Error("usage: human-sheet.ts <results.json> <out.md>");
  const results = JSON.parse(readFileSync(resultsPath, "utf8")) as Record<string, SiteResult>;
  const out: string[] = [
    "# Site yakalama — insan testi kağıdı",
    "",
    "Her site için: siteyi tarayıcıda aç, her satırı kontrol et, son sütuna `D` (doğru), `Y` (yanlış) ya da `?` (karar veremedim) yaz. Yönerge: `docs/research/2026-10-04-site-yakalama-insan-testi.md`.",
    "",
  ];

  for (const [id, r] of Object.entries(results)) {
    out.push(`## ${cell(r.name)} (${id})`, "", `Adres: ${r.url} · erişim: ${r.reachable ? "var" : `yok (${r.crawlError ?? "neden yok"})`} · süre: ${Math.round(r.ms / 1000)} sn · yakalama: ${r.capture?.status ?? "yok"}`, "");

    out.push("**Bulgular** (sistem bunları iddia ediyor)", "", "| Bulgu | Değer | Kapsam | Kaynak | Kanıt adresi | Alıntı | D / Y / ? |", "|---|---|---|---|---|---|---|");
    const sf = r.siteFacts ?? {};
    let asserted = 0;
    for (const [key, label] of FACTS) {
      const fact = sf[key] as Fact | null | undefined;
      if (fact == null) continue;
      asserted++;
      const value = Array.isArray(fact.value) ? fact.value.join(", ") : fact.value === true ? "var" : fact.value;
      const scope = fact.scope === "group_or_event" ? "kısıtlı (grup, etkinlik ya da özel gün)" : "genel";
      out.push(`| ${label} | ${cell(value)} | ${scope} | ${fact.source ?? "sayfa"} | ${cell(fact.url)} | ${cell(fact.quote).slice(0, 220)} | |`);
    }
    if (typeof sf.menuPdfUrl === "string") {
      asserted++;
      out.push(`| Menü PDF'i | var | genel | sayfa | ${cell(sf.menuPdfUrl)} | | |`);
    }
    if (asserted === 0) out.push("| (iddia edilen bulgu yok) | | | | | | |");

    out.push("", "**Sistemin bilmediği** (boş bıraktığı; sitede açıkça varsa `KAÇAK` yaz)", "", "| Bulgu | Sitede var mı? |", "|---|---|");
    for (const [key, label] of FACTS) if (sf[key] == null) out.push(`| ${label} | |`);

    const ledger = r.capture?.ledger ?? [];
    out.push("", "**Okunan sayfalar** (tür doğru mu?)", "", "| Tür | Adres | D / Y |", "|---|---|---|");
    for (const e of ledger.filter((x) => x.outcome === "opened")) {
      const landed = e.finalUrl && e.finalUrl !== e.url ? ` → ${e.finalUrl}` : "";
      out.push(`| ${e.type} | ${cell(e.url + landed)} | |`);
    }
    const unread = ledger.filter((x) => x.outcome !== "opened" && x.reason !== "limit_type" && x.reason !== "duplicate");
    out.push("", "**Okunamayan sayfalar** (önemli bir sayfa kaçmış mı?)", "", "| Tür | Adres | Neden | Önemli mi? |", "|---|---|---|---|");
    if (unread.length === 0) out.push("| (yok) | | | |");
    for (const e of unread.slice(0, 25)) out.push(`| ${e.type} | ${cell(e.url)} | ${e.reason ?? ""} | |`);
    out.push("");
  }

  writeFileSync(outPath, `${out.join("\n")}\n`);
  console.log(`wrote ${outPath} (${Object.keys(results).length} sites)`);
}

main();
