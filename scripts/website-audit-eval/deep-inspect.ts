// scripts/website-audit-eval/deep-inspect.ts
/**
 * Ground-truth helper for the website-audit eval. Independent of the
 * production extractor: opens the homepage plus up to 8 same-site pages
 * whose link text or path looks like booking / menu / order / locations /
 * terms, records every third-party host the pages load (scripts, iframes,
 * XHR) and every outbound link, and prints evidence snippets a human
 * reviewer reads to decide the truth for each fact.
 *
 *   npx tsx scripts/website-audit-eval/deep-inspect.ts <outDir> [--only id1,id2]
 *
 * Writes only to <outDir>. Never touches the database or Redis.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { chromium, type Page } from "playwright";

interface Site {
  id: string;
  name: string;
  url: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const INTEREST =
  /(book|reserv|rezerv|table|menu|men[uü]|order|sipari|deliver|takeaway|location|restaurants|find-us|visit|terms|policy|faq|private|group)/i;
const EVIDENCE = [
  /deposit[^.]{0,120}/gi,
  /(credit|debit)? ?card (details|guarantee)[^.]{0,120}/gi,
  /(cancellation|no[- ]show) (fee|charge|policy)[^.]{0,120}/gi,
  /pre-?pay[^.]{0,80}/gi,
  /(kapora|ön ödeme)[^.]{0,80}/gi,
  /(tasting menu|d[ée]gustation|omakase|chef'?s table|\d+[- ]course)[^.]{0,60}/gi,
  /(our|all|other) (restaurants|locations|sites|venues)[^.]{0,60}/gi,
];

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function readPage(page: Page, url: string, thirdParty: Set<string>, home: string) {
  const res = await page.goto(url, { waitUntil: "load", timeout: 20_000 });
  await page.waitForTimeout(2500);
  const html = await page.content();
  const frames = page.frames().map((f) => f.url()).filter((u) => u && !u.startsWith("about:"));
  for (const f of frames) {
    const h = hostOf(f);
    if (h && h !== home) thirdParty.add(`iframe:${h}`);
  }
  return { status: res?.status() ?? null, finalUrl: page.url(), html, frames };
}

async function inspect(site: Site) {
  const browser = await chromium.launch({ headless: true });
  const out: Record<string, unknown> = { id: site.id, name: site.name, url: site.url };
  try {
    const page = await browser.newPage({ userAgent: UA, ignoreHTTPSErrors: true, locale: "en-GB" });
    const thirdParty = new Set<string>();
    let homeHost = hostOf(site.url) ?? "";
    page.on("request", (r) => {
      const h = hostOf(r.url());
      if (h && h !== homeHost && !/google|gstatic|facebook|doubleclick|cloudflare|jsdelivr|fonts|typekit|youtube|vimeo|hotjar|cookie|onetrust|cookiebot|clarity|tiktok|pinterest|twitter|linkedin|sentry|newrelic|jquery|bootstrapcdn|unpkg/i.test(h)) {
        thirdParty.add(`${r.resourceType()}:${h}`);
      }
    });
    const home = await readPage(page, site.url, thirdParty, homeHost);
    homeHost = hostOf(home.finalUrl) ?? homeHost;
    const $ = cheerio.load(home.html);
    out.finalUrl = home.finalUrl;
    out.status = home.status;
    out.title = $("title").text().trim();
    out.htmlLang = $("html").attr("lang") ?? null;
    out.hreflang = $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr("hreflang")).get();
    const outbound = new Map<string, string>();
    const candidates: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      let u: URL;
      try {
        u = new URL(href, home.finalUrl);
      } catch {
        return;
      }
      if (!/^https?:$/.test(u.protocol)) return;
      const text = $(el).text().replace(/\s+/g, " ").trim().slice(0, 50);
      const h = hostOf(u.href) ?? "";
      if (h !== homeHost) {
        if (!/instagram|facebook|twitter|tiktok|linkedin|youtube|google|apple\.com|x\.com|pinterest|tripadvisor/i.test(h))
          outbound.set(u.href.split("?")[0].slice(0, 140), text);
      } else if (INTEREST.test(text) || INTEREST.test(u.pathname)) {
        const clean = u.href.split("#")[0];
        if (!candidates.includes(clean) && clean !== home.finalUrl) candidates.push(clean);
      }
    });
    out.langLinks = $("a[hreflang], a[lang], .lang a, .language a, [class*=lang] a, [class*=wpml] a, [class*=weglot] a")
      .map((_, el) => `${$(el).text().trim().slice(0, 20)}=>${$(el).attr("href")}`)
      .get()
      .slice(0, 20);
    const jsonld: unknown[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        jsonld.push(JSON.parse($(el).html() ?? ""));
      } catch {
        // ignore
      }
    });
    out.jsonld = JSON.stringify(jsonld).slice(0, 1500);
    const sub: Array<Record<string, unknown>> = [];
    const evidence = new Set<string>();
    const scan = (url: string, html: string) => {
      const text = cheerio.load(html)("body").text().replace(/\s+/g, " ");
      for (const re of EVIDENCE) for (const m of text.matchAll(re)) evidence.add(`${url} :: ${m[0].slice(0, 160)}`);
    };
    scan(home.finalUrl, home.html);
    for (const c of candidates.slice(0, 8)) {
      try {
        const p = await readPage(page, c, thirdParty, homeHost);
        sub.push({ url: c, status: p.status, final: p.finalUrl });
        scan(c, p.html);
        const $p = cheerio.load(p.html);
        $p("a[href]").each((_, el) => {
          const href = $p(el).attr("href") ?? "";
          try {
            const u = new URL(href, p.finalUrl);
            const h = hostOf(u.href) ?? "";
            if (h !== homeHost && /^https?:$/.test(u.protocol) && !/instagram|facebook|twitter|tiktok|linkedin|youtube|google|apple\.com|x\.com|pinterest|tripadvisor/i.test(h))
              outbound.set(u.href.split("?")[0].slice(0, 140), $p(el).text().replace(/\s+/g, " ").trim().slice(0, 50));
          } catch {
            // ignore
          }
        });
      } catch (err) {
        sub.push({ url: c, error: err instanceof Error ? err.message.slice(0, 80) : String(err) });
      }
    }
    out.candidates = candidates.slice(0, 20);
    out.subpages = sub;
    out.outbound = [...outbound.entries()].map(([u, t]) => `${t} -> ${u}`).slice(0, 60);
    out.thirdParty = [...thirdParty].sort();
    out.evidence = [...evidence].slice(0, 40);
  } catch (err) {
    out.error = err instanceof Error ? err.message.slice(0, 200) : String(err);
  } finally {
    await browser.close();
  }
  return out;
}

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("usage: deep-inspect.ts <outDir> [--only a,b]");
  const onlyAt = process.argv.indexOf("--only");
  const only = onlyAt > 0 ? new Set(process.argv[onlyAt + 1].split(",")) : null;
  mkdirSync(outDir, { recursive: true });
  const sites: Site[] = JSON.parse(readFileSync(path.join(__dirname, "sites.json"), "utf8"));
  for (const site of sites) {
    if (only && !only.has(site.id)) continue;
    const r = await inspect(site);
    writeFileSync(path.join(outDir, `${site.id}.json`), JSON.stringify(r, null, 2));
    console.log(`done ${site.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
