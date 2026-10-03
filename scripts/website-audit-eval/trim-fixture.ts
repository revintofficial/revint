// scripts/website-audit-eval/trim-fixture.ts
/**
 * Cut a small, real HTML fixture out of a saved page snapshot: the
 * <html lang>, hreflang/preconnect <link>s, JSON-LD, every <a> whose href
 * or text matches one of the patterns, and every short text block that
 * matches. Scripts other than JSON-LD are dropped unless --keep-script
 * names a pattern they must contain.
 *
 *   npx tsx scripts/website-audit-eval/trim-fixture.ts <snapshot.html> <out.html> <regex> [<regex> ...] [--keep-script <regex>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as cheerio from "cheerio";

function main() {
  const [inPath, outPath, ...rest] = process.argv.slice(2);
  const keepAt = rest.indexOf("--keep-script");
  const keepScript = keepAt >= 0 ? new RegExp(rest[keepAt + 1], "i") : null;
  const patterns = (keepAt >= 0 ? rest.slice(0, keepAt) : rest).map((p) => new RegExp(p, "i"));
  const raw = readFileSync(inPath, "utf8");
  const source = /^<!-- (\S+) -->/.exec(raw)?.[1] ?? "unknown";
  const $ = cheerio.load(raw);
  const parts: string[] = [];

  $('link[rel="alternate"][hreflang], link[rel="preconnect"], link[rel="dns-prefetch"]').each((_, el) => {
    parts.push($.html(el));
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).html() ?? "";
    if (txt.length < 6000) parts.push($.html(el));
  });
  if (keepScript) {
    $("script:not([type='application/ld+json'])").each((_, el) => {
      const txt = $(el).html() ?? "";
      const m = keepScript.exec(txt);
      if (m) parts.push(`<script>${txt.slice(Math.max(0, m.index - 200), m.index + 200)}</script>`);
    });
  }
  const seen = new Set<string>();
  $("a[href], iframe[src], script[src]").each((_, el) => {
    const attr = $(el).attr("href") ?? $(el).attr("src") ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!patterns.some((p) => p.test(attr) || p.test(text))) return;
    const clone = $(el).clone();
    clone.find("svg, img, picture").remove();
    for (const a of Object.keys(clone.attr() ?? {})) if (!["href", "src", "hreflang", "lang", "title", "aria-label"].includes(a)) clone.removeAttr(a);
    const html = $.html(clone).replace(/\s+/g, " ");
    if (!seen.has(html)) {
      seen.add(html);
      parts.push(html);
    }
  });
  $("script, style, noscript, template").remove();
  $("p, h1, h2, h3, h4, li, span, div").each((_, el) => {
    if ($(el).children("p, div, ul, section").length > 0) return;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text || text.length > 700) return;
    if (!patterns.some((p) => p.test(text))) return;
    const html = `<p>${text.replace(/</g, "&lt;")}</p>`;
    if (!seen.has(html)) {
      seen.add(html);
      parts.push(html);
    }
  });
  const lang = $("html").attr("lang");
  const title = $("title").first().text().trim().replace(/</g, "&lt;");
  const out = `<!-- Trimmed from ${source} (rendered ${new Date().toISOString().slice(0, 10)}). Real markup, cut to the elements under test. -->
<html${lang ? ` lang="${lang}"` : ""}><head><title>${title}</title>
${parts.filter((p) => /^<(link|script)/.test(p)).join("\n")}
</head><body>
${parts.filter((p) => !/^<(link|script type="application\/ld\+json")/.test(p)).join("\n")}
</body></html>
`;
  writeFileSync(outPath, out);
  console.log(`${outPath}: ${out.length} bytes, ${parts.length} parts`);
}

main();
