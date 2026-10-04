// src/__tests__/lib/site-capture/capture.test.ts
import { describe, expect, it } from "vitest";
import { captureSite, type CaptureInput } from "@/lib/site-capture/capture";
import { missingFromLedger } from "@/lib/site-capture/ledger";
import type { LedgerReason, PageOpener } from "@/lib/site-capture/types";
import { urlKey } from "@/lib/site-capture/url";

const HOME = "https://bistro.test/";
const html = (body: string) => `<html><head><title>Bistro</title></head><body>${body}</body></html>`;
const LONG = "Welcome to Bistro, a neighbourhood restaurant serving seasonal plates. ".repeat(5);

type Fake = string | { html?: string; status?: number; finalUrl?: string; error?: LedgerReason; requests?: string[] };

function fakeOpener(pages: Record<string, Fake>, opts: { fallback?: (url: string) => Fake | null; onOpen?: (url: string) => void } = {}) {
  const opened: string[] = [];
  const opener: PageOpener = {
    async open(url) {
      opened.push(url);
      opts.onOpen?.(url);
      const hit = pages[url] ?? pages[new URL(url).pathname] ?? opts.fallback?.(url) ?? null;
      if (hit === null) {
        return { finalUrl: url, status: 404, html: null, thirdPartyRequests: [], source: "browser", error: "http_error" };
      }
      const f = typeof hit === "string" ? { html: hit } : hit;
      return {
        finalUrl: f.finalUrl ?? url,
        status: f.status ?? 200,
        html: f.error ? null : (f.html ?? html("")),
        thirdPartyRequests: f.requests ?? [],
        source: "browser",
        error: f.error ?? null,
      };
    },
    async close() {},
  };
  return { opener, opened };
}

async function run(
  homeBody: string,
  pages: Record<string, Fake>,
  extra: Partial<CaptureInput> = {},
  fake: Parameters<typeof fakeOpener>[1] = {},
) {
  const f = fakeOpener(pages, fake);
  const result = await captureSite({
    homeUrl: HOME,
    homeHtml: html(homeBody),
    pinned: [],
    opener: f.opener,
    fetchText: async () => null,
    fetchPdf: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
    ...extra,
    // One page at a time keeps the order of `pages` deterministic.
    limits: { concurrency: 1, ...extra.limits },
  });
  return { result, opened: f.opened };
}

const paths = (urls: string[]) => urls.map((u) => new URL(u).pathname);
const entryFor = (ledger: Array<{ url: string }>, path: string) => ledger.find((e) => new URL(e.url).pathname === path);

describe("captureSite", () => {
  it("opens the typed pages linked from the homepage, highest priority first", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/reservations">Book a table</a><a href="/faq">FAQ</a><a href="/privacy-policy">Privacy</a>`,
      { "/menu": html("Starters and mains"), "/reservations": html("Book online"), "/faq": html("Questions") },
    );
    expect(result.pages.map((p) => p.type)).toEqual(["home", "reservation", "menu", "faq"]);
    expect(paths(opened)).not.toContain("/privacy-policy");
    expect(result.status).toBe("complete");
  });

  it("ends with exactly one ledger result for every address it discovered", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>`,
      { "/menu": html("Menu"), "/faq": { error: "timeout" } },
    );
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
    const keys = result.ledger.map((e) => urlKey(e.url));
    expect(new Set(keys).size).toBe(keys.length);
    expect(entryFor(result.ledger, "/faq")).toMatchObject({ outcome: "failed", reason: "timeout" });
    expect(entryFor(result.ledger, "/contact")).toMatchObject({ outcome: "failed", reason: "http_error", httpStatus: 404 });
    for (const e of result.ledger) expect(e.outcome === "opened" ? e.reason === null : e.reason !== null).toBe(true);
  });

  it("obeys robots.txt for discovered pages but still opens the pinned pages", async () => {
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ") },
      {
        pinned: [{ kind: "menu", url: `${HOME}menu` }],
        fetchText: async (url) => (url.endsWith("/robots.txt") ? "User-agent: *\nDisallow: /menu\nDisallow: /faq" : null),
      },
    );
    expect(paths(opened)).toContain("/menu");
    expect(paths(opened)).not.toContain("/faq");
    expect(entryFor(result.ledger, "/faq")).toMatchObject({ outcome: "skipped", reason: "robots_disallow" });
  });

  it("stops at the time budget and says so for every page it did not reach", async () => {
    let t = 0;
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a><a href="/about">About</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/contact": html("Contact"), "/about": html("About") },
      { now: () => t, limits: { budgetMs: 150_000 } },
      { onOpen: () => { t += 100_000; } },
    );
    expect(opened).toHaveLength(2);
    expect(result.status).toBe("partial");
    const left = result.ledger.filter((e) => e.outcome === "skipped");
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((e) => e.reason === "budget")).toBe(true);
  });

  // Review Focus 4: the outer deadline aborts the capture mid-run.
  it("stops when the signal is aborted and marks the rest as aborted", async () => {
    const controller = new AbortController();
    const { result, opened } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/contact">Contact</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/contact": html("Contact") },
      { signal: controller.signal },
      { onOpen: () => controller.abort() },
    );
    expect(opened).toHaveLength(1);
    expect(result.status).toBe("partial");
    expect(result.ledger.filter((e) => e.outcome === "skipped").every((e) => e.reason === "aborted")).toBe(true);
  });

  // Final fix B2: a page with a thousand links does not produce a thousand ledger entries.
  it("admits at most 300 candidates and reports the overflow", async () => {
    const links = Array.from({ length: 1000 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const { result, opened } = await run(links, {});
    // reducePage keeps 400 links of a page: 100 of them, plus the known-path probes, go over the cap.
    expect(result.candidateOverflow).toBeGreaterThanOrEqual(100);
    // The homepage plus one result per admitted address.
    expect(result.ledger.length).toBeLessThanOrEqual(301);
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
  });

  it("reports no overflow on an ordinary site", async () => {
    const { result } = await run(`<a href="/menu">Menu</a>`, { "/menu": html("Menu") });
    expect(result.candidateOverflow).toBe(0);
  });

  // Final fix B1: running out of attempts is not running out of time.
  it("names the attempt cap, not the time budget, when it runs out of navigations", async () => {
    const links = Array.from({ length: 100 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const { result, opened } = await run(links, {});
    expect(opened).toHaveLength(80);
    expect(result.status).toBe("partial");
    const left = result.ledger.filter((e) => e.outcome === "skipped");
    expect(left.length).toBeGreaterThan(0);
    expect(left.some((e) => e.reason === "budget")).toBe(false);
    expect(left.every((e) => e.reason === "limit_total")).toBe(true);
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
  });

  it("stops opening pages after eight navigations in a row are refused", async () => {
    const links = Array.from({ length: 30 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const { result, opened } = await run(
      links,
      {},
      { limits: { concurrency: 3 } },
      { fallback: () => ({ status: 403, error: "blocked" }) },
    );
    expect(opened.length).toBeLessThanOrEqual(8 + 3);
    expect(result.status).toBe("partial");
    const left = result.ledger.filter((e) => e.outcome === "skipped");
    expect(left.length).toBeGreaterThan(0);
    expect(left.every((e) => e.reason === "blocked")).toBe(true);
  });

  it("counts timeouts towards the refusal streak", async () => {
    const links = Array.from({ length: 30 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const { opened } = await run(links, {}, {}, { fallback: () => ({ error: "timeout" }) });
    expect(opened).toHaveLength(8);
  });

  it("does not trip the breaker when a success interrupts the refusals", async () => {
    const links = Array.from({ length: 15 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const { result, opened } = await run(links, { "/menu-7": html("The menu") }, {}, {
      fallback: (url) => (new URL(url).pathname.startsWith("/menu-") ? { status: 403, error: "blocked" } : null),
    });
    for (let i = 0; i < 15; i++) expect(paths(opened)).toContain(`/menu-${i}`);
    expect(result.ledger.some((e) => e.outcome === "skipped" && e.reason === "blocked")).toBe(false);
  });

  // Review Focus 1: a single-page app answers every path with the homepage.
  it("records a page identical to the homepage as a duplicate, not as a typed page", async () => {
    const { result } = await run(LONG, {}, {}, { fallback: () => html(LONG) });
    expect(result.pages.map((p) => p.type)).toEqual(["home"]);
    const probes = result.ledger.filter((e) => e.source === "known_path");
    expect(probes.length).toBeGreaterThan(0);
    expect(probes.every((e) => e.outcome === "skipped" && e.reason === "duplicate")).toBe(true);
  });

  it("keeps a known vendor page a link redirects to, and reports any other off-site landing", async () => {
    const { result } = await run(`<a href="/book">Book a table</a><a href="/order">Order online</a>`, {
      "/book": { finalUrl: "https://www.sevenrooms.com/reservations/bistro", html: html("A deposit is required") },
      "/order": { finalUrl: "https://somewhere-else.test/shop", html: html("Shop") },
    });
    const vendor = result.pages.find((p) => p.type === "external");
    expect(vendor).toMatchObject({ url: `${HOME}book`, finalUrl: "https://www.sevenrooms.com/reservations/bistro" });
    expect(entryFor(result.ledger, "/order")).toMatchObject({
      outcome: "failed",
      reason: "offsite",
      finalUrl: "https://somewhere-else.test/shop",
    });
  });

  it("counts links that redirect to a vendor against the external cap of five", async () => {
    const links = [
      ...Array.from({ length: 3 }, (_, i) => `<a href="/book-${i}">Book a table</a>`),
      ...Array.from({ length: 2 }, (_, i) => `<a href="/menu-${i}">Menu</a>`),
      ...Array.from({ length: 2 }, (_, i) => `<a href="/order-${i}">Order online</a>`),
    ].join("");
    const vendor = (url: string) => {
      const path = new URL(url).pathname;
      return /^\/(book|menu|order)-\d$/.test(path)
        ? { finalUrl: `https://www.sevenrooms.com/reservations${path}`, html: html(`Vendor page ${path}`) }
        : null;
    };
    const { result, opened } = await run(links, {}, {}, { fallback: vendor });
    expect(result.pages.filter((p) => p.type === "external")).toHaveLength(5);
    const over = result.ledger.filter((e) => e.reason === "limit_type");
    expect(over).toHaveLength(2);
    for (const e of over) {
      expect(e.outcome).toBe("skipped");
      expect(e.finalUrl).toMatch(/^https:\/\/www\.sevenrooms\.com\/reservations\//);
      expect(e.httpStatus).toBe(200);
    }
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
    const keys = result.ledger.map((e) => urlKey(e.url));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("still keeps a pinned page that redirects to a vendor when the external cap is full", async () => {
    const links = Array.from({ length: 5 }, (_, i) => `<a href="/book-${i}">Book a table</a>`).join("");
    const vendor = (url: string) => {
      const path = new URL(url).pathname;
      return /^\/(book-\d|reserve)$/.test(path)
        ? { finalUrl: `https://www.sevenrooms.com/reservations${path}`, html: html(`Vendor page ${path}`) }
        : null;
    };
    const { result } = await run(links, {}, { pinned: [{ kind: "reservation", url: `${HOME}reserve` }] }, { fallback: vendor });
    expect(result.pages.find((p) => p.url === `${HOME}reserve`)).toMatchObject({
      type: "external",
      finalUrl: "https://www.sevenrooms.com/reservations/reserve",
    });
    expect(result.pages.filter((p) => p.type === "external")).toHaveLength(5);
    expect(result.ledger.filter((e) => e.reason === "limit_type")).toHaveLength(1);
  });

  it("opens at most six menu pages and lists the rest as over the type limit", async () => {
    const links = Array.from({ length: 10 }, (_, i) => `<a href="/menu-${i}">Menu ${i}</a>`).join("");
    const pages = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`/menu-${i}`, html(`Menu number ${i}`)]));
    const { result } = await run(links, pages);
    expect(result.pages.filter((p) => p.type === "menu")).toHaveLength(6);
    const over = result.ledger.filter((e) => e.reason === "limit_type");
    expect(over).toHaveLength(4);
  });

  it("follows links one level below the homepage's links and no further", async () => {
    const { result, opened } = await run(`<a href="/locations">Locations</a>`, {
      "/locations": html(`<a href="/locations/soho">Soho</a>`),
      "/locations/soho": html(`<a href="/locations/soho/team">Team</a>`),
      "/locations/soho/team": html("Team"),
    });
    expect(paths(opened)).toContain("/locations/soho");
    expect(paths(opened)).not.toContain("/locations/soho/team");
    expect(entryFor(result.ledger, "/locations/soho/team")).toBeUndefined();
  });

  // Review Focus 2: thousands of sitemap addresses must not blow up the ledger.
  it("takes at most 150 sitemap candidates and opens only three untyped pages", async () => {
    const sitemap = `<urlset>${Array.from({ length: 3000 }, (_, i) => `<url><loc>${HOME}dish-${i}</loc></url>`).join("")}</urlset>`;
    const { result, opened } = await run(
      "",
      {},
      { fetchText: async (url) => (url.endsWith("/sitemap.xml") ? sitemap : null) },
      { fallback: (url) => (new URL(url).pathname.startsWith("/dish-") ? html(`Dish page ${url}`) : null) },
    );
    expect(result.sitemapUrlCount).toBe(3000);
    expect(result.pages.filter((p) => p.type === "other")).toHaveLength(3);
    expect(result.ledger.length).toBeLessThanOrEqual(170);
    expect(missingFromLedger(opened, result.ledger)).toEqual([]);
  });

  // Final fix A1: spreading a huge sitemap into push threw RangeError.
  it("completes on a sitemap of 150,000 short URLs and collects at most 10,000", async () => {
    const sitemap = `<urlset>${Array.from({ length: 150_000 }, (_, i) => `<url><loc>${HOME}d${i}</loc></url>`).join("")}</urlset>`;
    const files = ["a", "b", "c"].map((n) => `${HOME}sitemap-${n}.xml`);
    const { result } = await run(
      "",
      {},
      {
        fetchText: async (url) => {
          if (url.endsWith("/robots.txt")) return files.map((f) => `Sitemap: ${f}`).join("\n");
          return files.includes(url) ? sitemap : null;
        },
      },
    );
    expect(result.sitemapUrlCount).toBeLessThanOrEqual(10_000);
    expect(result.sitemapUrlCount).toBeGreaterThan(0);
  });

  it("downloads menu PDFs linked from the homepage, five at most", async () => {
    const links = [
      ...Array.from({ length: 7 }, (_, i) => `<a href="/files/menu-${i}.pdf">Menu ${i}</a>`),
      `<a href="/files/allergens.pdf">Allergens</a>`,
    ].join("");
    const fetched: string[] = [];
    const { result } = await run(links, {}, {
      fetchPdf: async (url) => {
        fetched.push(url);
        return url.endsWith("menu-1.pdf")
          ? { ok: false, reason: "too_large", httpStatus: 200 }
          : { ok: true, text: "Tasting menu 85", pageCount: 1, needsOcr: false };
      },
    });
    expect(fetched).toHaveLength(5);
    expect(fetched.some((u) => u.includes("allergens"))).toBe(false);
    const pdfPages = result.pages.filter((p) => p.source === "pdf");
    expect(pdfPages).toHaveLength(4);
    expect(pdfPages[0]).toMatchObject({ type: "menu", text: "Tasting menu 85", html: null });
    expect(entryFor(result.ledger, "/files/menu-1.pdf")).toMatchObject({ outcome: "failed", reason: "too_large" });
    expect(result.ledger.filter((e) => e.source === "pdf_link" && e.reason === "limit_type")).toHaveLength(2);
  });

  it("fetches the same menu PDF once whatever its fragment or tracking parameter", async () => {
    const links = [
      `<a href="/files/menu.pdf">Menu</a>`,
      `<a href="/files/menu.pdf#page=2">Menu page 2</a>`,
      `<a href="/files/menu.pdf?utm_source=ig">Our menu</a>`,
    ].join("");
    const fetched: string[] = [];
    const { result } = await run(links, {}, {
      fetchPdf: async (url) => {
        fetched.push(url);
        return { ok: true, text: "Tasting menu 85", pageCount: 1, needsOcr: false };
      },
    });
    expect(fetched).toEqual(["https://bistro.test/files/menu.pdf"]);
    expect(result.pages.filter((p) => p.source === "pdf")).toHaveLength(1);
    expect(result.ledger.filter((e) => e.source === "pdf_link")).toHaveLength(1);
  });

  it("keeps going when the opener throws on one page", async () => {
    const f = fakeOpener({ "/faq": html("FAQ") });
    const open = f.opener.open.bind(f.opener);
    f.opener.open = async (url, o) => {
      if (url.endsWith("/menu")) throw new Error("browser crashed");
      return open(url, o);
    };
    const result = await captureSite({
      homeUrl: HOME,
      homeHtml: html(`<a href="/menu">Menu</a><a href="/faq">FAQ</a>`),
      pinned: [],
      opener: f.opener,
      fetchText: async () => null,
      fetchPdf: async () => ({ ok: false, reason: "not_pdf", httpStatus: 200 }),
      limits: { concurrency: 1 },
    });
    expect(entryFor(result.ledger, "/menu")).toMatchObject({ outcome: "failed", reason: "nav_error" });
    expect(result.pages.map((p) => p.type)).toContain("faq");
  });

  it("keeps raw HTML only for the pinned pages and the pages location signals read", async () => {
    const { result } = await run(
      `<a href="/menu">Menu</a><a href="/faq">FAQ</a><a href="/locations">Locations</a>`,
      { "/menu": html("Menu"), "/faq": html("FAQ"), "/locations": html("Soho, Camden") },
      { pinned: [{ kind: "menu", url: `${HOME}menu` }] },
    );
    const byType = Object.fromEntries(result.pages.map((p) => [p.type, p.html !== null]));
    expect(byType).toMatchObject({ home: true, menu: true, locations: true, faq: false });
  });
});
