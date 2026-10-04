// src/lib/site-facts.ts
/**
 * Facts read from the pages a guest would open: menu, reservations,
 * ordering. The homepage alone cannot say "no QR menu" or "no deposit";
 * every fact here carries the URL it was read on. `null` = not seen.
 */
import * as cheerio from "cheerio";
import { extractFeatures } from "@/lib/extractor";
import { detectBookingProviderEvidence } from "@/lib/audit/booking-detection";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";
import { menuVendorFor, orderingVendorFor } from "@/lib/restaurant-vendors";
import {
  detectDeclaredLanguage,
  detectHotelOperator,
  detectLanguageCount,
  detectLocations,
  siteKey,
  visibleText,
  type SignalPage,
} from "@/lib/site-signals";

export type SubpageKind = "menu" | "reservation" | "order";
export interface SubpageTarget {
  kind: SubpageKind;
  url: string;
}
export interface VisitedPage extends SubpageTarget {
  /** `null` = the page could not be opened (or left the venue's site). */
  html: string | null;
  /**
   * Where the navigation ended when it left the venue's site (e.g. /menu
   * redirecting to a digital-menu vendor). The vendor host is evidence
   * even though the page itself is not the venue's.
   */
  landedUrl?: string | null;
}
export interface SubpagePick {
  targets: SubpageTarget[];
  menuPdfUrl: string | null;
  /** The homepage links to a booking surface (own page or external). */
  hasBookingLink: boolean;
  /**
   * The menu lives on another of the venue's own domains (not a vendor,
   * marketplace or PDF): the guest surfaces were not on this site, so
   * "no booking link here" says nothing about booking.
   */
  offsiteMenuUrl?: string | null;
}
export interface SiteFact<T> {
  value: T;
  url: string;
  quote: string | null;
  /** Where a bridged fact was read. Absent on facts read by mergeSiteFacts (always a page). */
  source?: "page" | "network" | "pdf";
  /**
   * "group_or_event": stated only for groups or private events (a group-booking,
   * events or FAQ page), not for an ordinary booking. Absent = general.
   */
  scope?: "general" | "group_or_event";
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
  /**
   * Distinct venues the site shows (JSON-LD addresses, location pages,
   * postcodes, "N restaurants" claims). Only set at 2+; absent = not seen,
   * not "single venue". Optional for rows written before 2026-10.
   */
  locationCount?: SiteFact<number> | null;
  /** Weaker multi-site cues: "Our Locations" nav, "Part of the X Group". */
  locationHints?: SiteFact<string[]> | null;
  /** Hotel operator/brand when the restaurant sits in a hotel ("Four Seasons", "independent hotel"). */
  hotelOperator?: SiteFact<string> | null;
  /**
   * `<html lang>` of the homepage when no second language was found.
   * Context only: it is not a language count (that stays `null`).
   */
  declaredLanguage?: SiteFact<string> | null;
  /** What the deep capture opened and what it could not. Absent on shallow audits and older rows. */
  coverage?: import("./site-capture/types").SiteCoverage;
}

export const RES_TEXT = /\b(reserv\w*|book(ing|ings)?|book a table|rezervasyon)\b/i;
export const RES_PATH = /(^|\/)(reserv[\w-]*|book[\w-]*|rezervasyon)(\/|$|\.)/i;
export const MENU_TEXT = /(^|[^\p{L}])(menu|menus|menü)($|[^\p{L}])/iu;
export const MENU_PATH = /(^|\/)(menu|menus|our-menu|food-menu)(\/|$|\.|-)/i;
const MENU_FILE = /(menu|menü|food|drinks|brunch|lunch|dinner|carta)/i;
const NOT_MENU_FILE =
  /(allergen|kcal|calorie|nutrition|privacy|policy|terms|gender|pay-?gap|report|statement|slavery|sustainab|welfare|careers|cv|tipping)/i;
export const ORDER_TEXT = /\border (online|now)\b/i;
export const ORDER_PATH = /(^|\/)(order|order-online|online-order|ordering|order-now)(\/|$|\.)/i;
/** Food-ordering CTA wording on a link that leaves the site for an ordering vendor. */
const ORDER_CTA =
  /(\b(order (online|now|here|ahead|food|delivery|takeaway|for collection)|click\s*(&|and)\s*collect|place an order|online sipari[sş]|sipari[sş] ver)\b|^(collection|takeaway|delivery (&|and) collection)$)/i;
export const PREPAY =
  /((?<!\bno[- ])(?<!\bwithout (a )?)(?<!\bsafe )(?<!\bsecurity )deposit(?!\s+box)|(credit|debit)( or (credit|debit))? card details (are |will be )?(required|needed|taken|held)|card details (to|in order to) secure|(credit|debit) card (details )?(is |are )?required|pre-?pay(ment)?|prepaid booking|kapora|ön ödeme)/i;
export const TASTING = /(tasting menu|d[ée]gustation|omakase|chef'?s table (menu|experience)|\b(?:[5-9]|1\d|2\d)[- ]course\b|tadım menüsü)/i;

export interface Link {
  text: string;
  url: URL;
}

export function linksOf(html: string, pageUrl: string): Link[] {
  const $ = cheerio.load(html);
  const out: Link[] = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      const text = $(el).text().replace(/\s+/g, " ").trim() || ($(el).attr("aria-label") ?? "").trim();
      if (/^https?:$/.test(url.protocol)) out.push({ text, url });
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
function snippet(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  if (!m) return null;
  return text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 80).trim();
}
/** Same venue site: same host, or a subdomain of the same registrable domain (delivery.dishoom.com). */
function sameSite(a: string, b: string): boolean {
  return siteKey(a) === siteKey(b);
}
/** A PDF whose link text or file name says it is a menu (not allergens or policies). */
export function menuPdf(l: Link): boolean {
  const path = pathOf(l.url);
  if (!/\.pdf$/i.test(path)) return false;
  const file = path.split("/").pop() ?? "";
  if (NOT_MENU_FILE.test(l.text) || NOT_MENU_FILE.test(file)) return false;
  return MENU_TEXT.test(l.text) || MENU_FILE.test(file);
}

/** Choose at most one same-host page per kind from the homepage links. */
export function pickSubpages(homeHtml: string, homeUrl: string): SubpagePick {
  const home = new URL(homeUrl);
  const byKind = new Map<SubpageKind, string>();
  let menuPdfUrl: string | null = null;
  let hasBookingLink = false;
  let offsiteMenuUrl: string | null = null;

  for (const l of linksOf(homeHtml, homeUrl)) {
    const path = pathOf(l.url);
    const isRes = RES_TEXT.test(l.text) || RES_PATH.test(path);
    const isMenu = MENU_TEXT.test(l.text) || MENU_PATH.test(path);
    const isOrder = ORDER_TEXT.test(l.text) || ORDER_PATH.test(path);
    if (isRes) hasBookingLink = true;
    // A menu PDF may sit on a CDN host (Wix usrfiles, DatoCMS, Zyro assets).
    if (/\.pdf$/i.test(path)) {
      if (menuPdf(l)) menuPdfUrl ??= l.url.href;
      continue;
    }
    if (bare(l.url.hostname) !== bare(home.hostname)) {
      const foreign = !sameSite(l.url.hostname, home.hostname);
      const known =
        menuVendorFor(l.url.hostname) !== null ||
        orderingVendorFor(l.url.hostname) !== null ||
        deliveryPlatformFor(l.url.hostname) !== null ||
        detectBookingProviderEvidence({ html: "", links: [{ href: l.url.href }] }) !== null;
      if (foreign && !known && MENU_TEXT.test(l.text) && !/allergen/i.test(l.text)) offsiteMenuUrl ??= l.url.href;
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
    offsiteMenuUrl,
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
  let menuPdfUrl = pick.menuPdfUrl;
  const platforms: string[] = [];
  let platformsUrl: string | null = null;
  let platformsQuote: string | null = null;

  // A subpage that redirected off the site still tells us which vendor runs it.
  for (const p of pages) {
    if (p.html !== null || !p.landedUrl) continue;
    let landed: URL;
    try {
      landed = new URL(p.landedUrl);
    } catch {
      continue;
    }
    const quote = `${p.url} redirects to ${landed.href}`;
    const menuVendor = menuVendorFor(landed.hostname);
    if (menuVendor && !qrMenuTool) qrMenuTool = { value: menuVendor, url: p.url, quote };
    const booking = detectBookingProviderEvidence({ html: "", links: [{ href: landed.href }] });
    if (booking && !bookingProvider) bookingProvider = { value: booking.provider, url: p.url, quote };
    const platform = deliveryPlatformFor(landed.hostname);
    if (platform && !platforms.includes(platform)) {
      platforms.push(platform);
      platformsUrl ??= p.url;
      platformsQuote ??= quote;
    } else if (!platform && p.kind === "order" && isDirectOrderingHost(landed.hostname) && !directOrdering) {
      directOrdering = { value: true, url: p.url, quote };
    }
  }

  for (const p of all) {
    const f = extractFeatures(p.html, p.url);
    const links = linksOf(p.html, p.url);
    if (!bookingProvider && f.bookingProvider) {
      const ev = detectBookingProviderEvidence({ html: p.html, links: links.map((l) => ({ href: l.url.href })) });
      bookingProvider = { value: f.bookingProvider, url: p.url, quote: ev?.evidence ?? null };
    }
    if (!qrMenuTool && f.detectedMenuTool) qrMenuTool = { value: f.detectedMenuTool, url: p.url, quote: f.menuUrl ?? null };

    for (const l of links) {
      const platform = deliveryPlatformFor(l.url.hostname);
      if (platform) {
        if (!platforms.includes(platform)) platforms.push(platform);
        platformsUrl ??= p.url;
        platformsQuote ??= l.url.href;
        continue;
      }
      if (!qrMenuTool) {
        const vendor = menuVendorFor(l.url.hostname);
        if (vendor) qrMenuTool = { value: vendor, url: p.url, quote: `${l.text || "link"} -> ${l.url.href}` };
      }
      if (p.kind === "home" || p.kind === "menu") {
        if (menuPdf(l)) menuPdfUrl ??= l.url.href;
      }
      const ownSite = sameSite(l.url.hostname, homeHost);
      const ownOrder =
        isDirectOrderingHost(l.url.hostname) ||
        (orderingVendorFor(l.url.hostname) === null && !ownSite && ORDER_CTA.test(l.text) && !/gift|voucher|shop|merch|wine/i.test(l.text + l.url.hostname)) ||
        (ownSite && (ORDER_PATH.test(pathOf(l.url)) || ORDER_TEXT.test(l.text) || (bare(l.url.hostname) !== homeHost && ORDER_CTA.test(l.text))));
      if (!directOrdering && ownOrder) directOrdering = { value: true, url: p.url, quote: `${l.text || "link"} -> ${l.url.href}` };
    }

    const text = visibleText(p.html);
    if (!hasPrepayment && (p.kind === "reservation" || p.kind === "home")) {
      const quote = snippet(text, PREPAY);
      if (quote) hasPrepayment = { value: true, url: p.url, quote };
    }
    if (!tastingMenu && (p.kind === "menu" || p.kind === "home")) {
      const quote = snippet(text, TASTING);
      if (quote) tastingMenu = { value: true, url: p.url, quote };
    }
  }

  const signalPages: SignalPage[] = all.map((p) => ({ url: p.url, html: p.html, kind: p.kind }));
  const locations = detectLocations(signalPages);
  const languageCount = detectLanguageCount(home.url, home.html);

  return {
    pagesVisited: pages.map((p) => ({ kind: p.kind, url: p.url, ok: p.html !== null })),
    bookingChecked:
      bookingProvider !== null ||
      opened.some((p) => p.kind === "reservation") ||
      (!pick.hasBookingLink && !pick.offsiteMenuUrl),
    menuPageSeen: opened.some((p) => p.kind === "menu"),
    orderPageSeen: opened.some((p) => p.kind === "order"),
    bookingProvider,
    hasPrepayment,
    tastingMenu,
    languageCount,
    deliveryPlatforms: platforms.length > 0 ? { value: platforms, url: platformsUrl ?? home.url, quote: platformsQuote } : null,
    directOrdering,
    qrMenuTool,
    menuPdfUrl,
    locationCount: locations.locationCount,
    locationHints: locations.locationHints,
    hotelOperator: detectHotelOperator(signalPages),
    declaredLanguage: languageCount ? null : detectDeclaredLanguage(home.url, home.html),
  };
}
