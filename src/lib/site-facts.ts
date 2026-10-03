// src/lib/site-facts.ts
/**
 * Facts read from the pages a guest would open: menu, reservations,
 * ordering. The homepage alone cannot say "no QR menu" or "no deposit";
 * every fact here carries the URL it was read on. `null` = not seen.
 */
import * as cheerio from "cheerio";
import { extractFeatures } from "@/lib/extractor";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";

export type SubpageKind = "menu" | "reservation" | "order";
export interface SubpageTarget {
  kind: SubpageKind;
  url: string;
}
export interface VisitedPage extends SubpageTarget {
  /** `null` = the page could not be opened. */
  html: string | null;
}
export interface SubpagePick {
  targets: SubpageTarget[];
  menuPdfUrl: string | null;
  /** The homepage links to a booking surface (own page or external). */
  hasBookingLink: boolean;
}
export interface SiteFact<T> {
  value: T;
  url: string;
  quote: string | null;
}
export interface SiteFacts {
  pagesVisited: Array<{ kind: SubpageKind; url: string; ok: boolean }>;
  /** True when there is no booking link to follow, or the booking page was read. */
  bookingChecked: boolean;
  menuPageSeen: boolean;
  orderPageSeen: boolean;
  bookingProvider: SiteFact<string> | null;
  hasPrepayment: SiteFact<true> | null;
  tastingMenu: SiteFact<true> | null;
  languageCount: SiteFact<number> | null;
  deliveryPlatforms: SiteFact<string[]> | null;
  directOrdering: SiteFact<true> | null;
  qrMenuTool: SiteFact<string> | null;
  menuPdfUrl: string | null;
}

const RES_TEXT = /\b(reserv\w*|book(ing|ings)?|book a table|rezervasyon)\b/i;
const RES_PATH = /(^|\/)(reserv[\w-]*|book[\w-]*|rezervasyon)(\/|$|\.)/i;
const MENU_TEXT = /(^|[^\p{L}])(menu|menus|menü)($|[^\p{L}])/iu;
const MENU_PATH = /(^|\/)(menu|menus|our-menu|food-menu)(\/|$|\.|-)/i;
const ORDER_TEXT = /\border (online|now)\b/i;
const ORDER_PATH = /(^|\/)(order|order-online|online-order|ordering|order-now)(\/|$|\.)/i;
const PREPAY =
  /((?<!\bno[- ])(?<!\bwithout )deposit|card details (are |will be )?(required|needed|taken)|credit card (is )?required|pre-?pay(ment)?|kapora|ön ödeme)/i;
const TASTING = /(tasting menu|d[ée]gustation|omakase|chef'?s table|\b(?:[5-9]|1\d|2\d)[- ]course\b|tadım menüsü)/i;

interface Link {
  text: string;
  url: URL;
}

function linksOf(html: string, pageUrl: string): Link[] {
  const $ = cheerio.load(html);
  const out: Link[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      if (/^https?:$/.test(url.protocol)) out.push({ text: $(el).text().replace(/\s+/g, " ").trim(), url });
    } catch {
      // malformed href: not a link we can follow
    }
  });
  return out;
}

export function bare(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}
function pathOf(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}
function bodyText(html: string): string {
  return cheerio.load(html)("body").text().replace(/\s+/g, " ").trim();
}
function snippet(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (!m) return null;
  return text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).trim();
}

/** Choose at most one same-host page per kind from the homepage links. */
export function pickSubpages(homeHtml: string, homeUrl: string): SubpagePick {
  const home = new URL(homeUrl);
  const byKind = new Map<SubpageKind, string>();
  let menuPdfUrl: string | null = null;
  let hasBookingLink = false;

  for (const l of linksOf(homeHtml, homeUrl)) {
    const path = pathOf(l.url);
    const isRes = RES_TEXT.test(l.text) || RES_PATH.test(path);
    const isMenu = MENU_TEXT.test(l.text) || MENU_PATH.test(path);
    const isOrder = ORDER_TEXT.test(l.text) || ORDER_PATH.test(path);
    if (isRes) hasBookingLink = true;
    if (bare(l.url.hostname) !== bare(home.hostname)) continue;
    if (/\.pdf$/i.test(path)) {
      // A PDF is never a page to open; keep it only as the menu document.
      if (isMenu) menuPdfUrl ??= l.url.href;
      continue;
    }
    if (l.url.pathname === home.pathname && !l.url.search) continue; // the homepage itself
    const kind: SubpageKind | null = isRes ? "reservation" : isMenu ? "menu" : isOrder ? "order" : null;
    if (kind && !byKind.has(kind)) byKind.set(kind, l.url.href.split("#")[0]);
  }

  const order: SubpageKind[] = ["reservation", "menu", "order"];
  return {
    targets: order.filter((k) => byKind.has(k)).map((k) => ({ kind: k, url: byKind.get(k)! })),
    menuPdfUrl,
    hasBookingLink,
  };
}

/** Merge the homepage and the opened subpages into one evidence-carrying record. */
export function mergeSiteFacts(
  home: { url: string; html: string },
  pages: VisitedPage[],
  pick: SubpagePick,
): SiteFacts {
  const opened = pages.filter((p): p is VisitedPage & { html: string } => p.html !== null);
  const all: Array<{ kind: SubpageKind | "home"; url: string; html: string }> = [
    { kind: "home", url: home.url, html: home.html },
    ...opened,
  ];
  const homeHost = bare(new URL(home.url).hostname);

  let bookingProvider: SiteFact<string> | null = null;
  let hasPrepayment: SiteFact<true> | null = null;
  let tastingMenu: SiteFact<true> | null = null;
  let directOrdering: SiteFact<true> | null = null;
  let qrMenuTool: SiteFact<string> | null = null;
  const platforms: string[] = [];
  let platformsUrl: string | null = null;

  for (const p of all) {
    const f = extractFeatures(p.html, p.url);
    if (!bookingProvider && f.bookingProvider) bookingProvider = { value: f.bookingProvider, url: p.url, quote: null };
    if (!qrMenuTool && f.detectedMenuTool) qrMenuTool = { value: f.detectedMenuTool, url: p.url, quote: null };

    for (const l of linksOf(p.html, p.url)) {
      const platform = deliveryPlatformFor(l.url.hostname);
      if (platform) {
        if (!platforms.includes(platform)) platforms.push(platform);
        platformsUrl ??= p.url;
        continue;
      }
      const ownOrder =
        isDirectOrderingHost(l.url.hostname) ||
        (bare(l.url.hostname) === homeHost && (ORDER_PATH.test(pathOf(l.url)) || ORDER_TEXT.test(l.text)));
      if (!directOrdering && ownOrder) directOrdering = { value: true, url: p.url, quote: l.text || l.url.href };
    }

    const text = bodyText(p.html);
    if (!hasPrepayment && (p.kind === "reservation" || p.kind === "home")) {
      const quote = snippet(text, PREPAY);
      if (quote) hasPrepayment = { value: true, url: p.url, quote };
    }
    if (!tastingMenu && (p.kind === "menu" || p.kind === "home")) {
      const quote = snippet(text, TASTING);
      if (quote) tastingMenu = { value: true, url: p.url, quote };
    }
  }

  const langs = new Set<string>();
  const $home = cheerio.load(home.html);
  $home('link[rel="alternate"][hreflang]')
    .each((_, el) => {
      const code = ($home(el).attr("hreflang") ?? "").toLowerCase().split("-")[0];
      if (code && code !== "x") langs.add(code);
    });

  return {
    pagesVisited: pages.map((p) => ({ kind: p.kind, url: p.url, ok: p.html !== null })),
    bookingChecked: !pick.hasBookingLink || opened.some((p) => p.kind === "reservation"),
    menuPageSeen: opened.some((p) => p.kind === "menu"),
    orderPageSeen: opened.some((p) => p.kind === "order"),
    bookingProvider,
    hasPrepayment,
    tastingMenu,
    languageCount: langs.size > 0 ? { value: langs.size, url: home.url, quote: [...langs].join(", ") } : null,
    deliveryPlatforms: platforms.length > 0 ? { value: platforms, url: platformsUrl ?? home.url, quote: null } : null,
    directOrdering,
    qrMenuTool,
    menuPdfUrl: pick.menuPdfUrl,
  };
}
