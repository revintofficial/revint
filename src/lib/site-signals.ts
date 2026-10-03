// src/lib/site-signals.ts
/**
 * Operator-shape signals read from a venue's own pages: how many
 * languages the site offers, whether it is one of several locations,
 * and whether the restaurant sits inside a hotel. Each finding carries
 * the URL and the quote it came from; `null` means "not seen", never
 * "single venue" / "not a hotel".
 */
import * as cheerio from "cheerio";

export interface SignalFact<T> {
  value: T;
  url: string;
  quote: string | null;
}
export interface SignalPage {
  url: string;
  html: string;
  /** Homepage and booking/menu/order pages; policy pages are never passed. */
  kind: string;
}

type Root = ReturnType<typeof cheerio.load>;

/**
 * Text a visitor can read: no script / style / template bodies (Wix ships
 * "DepositeOrFullAmount" flags and ResDiary ships "Card details are
 * required" strings inside scripts), and a space at every tag boundary so
 * "SE3 0AX</p><p>Copyright" does not fuse into one token.
 */
export function visibleText(html: string): string {
  const stripped = html
    .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return cheerio.load(`<body>${stripped}</body>`)("body").text().replace(/\s+/g, " ").trim();
}

function bare(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}
/** Last two labels, or three for `co.uk`-style second levels. */
export function siteKey(host: string): string {
  const parts = bare(host).split(".");
  const n = parts.length >= 3 && /^(co|com|org|net|gov|ac|gen|web)$/.test(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-n).join(".");
}

function absLinks($: Root, pageUrl: string): Array<{ el: unknown; text: string; url: URL }> {
  const out: Array<{ el: unknown; text: string; url: URL }> = [];
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    try {
      const url = new URL(href, pageUrl);
      if (/^https?:$/.test(url.protocol)) out.push({ el, text: $(el).text().replace(/\s+/g, " ").trim(), url });
    } catch {
      // malformed href
    }
  });
  return out;
}

// ---------------------------------------------------------------- languages

const LANG_NAMES: Record<string, string> = {
  english: "en", türkçe: "tr", turkce: "tr", turkish: "tr", türk: "tr", deutsch: "de", german: "de",
  français: "fr", francais: "fr", french: "fr", español: "es", espanol: "es", spanish: "es",
  italiano: "it", italian: "it", русский: "ru", russian: "ru", العربية: "ar", arabic: "ar",
  中文: "zh", 简体中文: "zh", 繁體中文: "zh", chinese: "zh", 日本語: "ja", japanese: "ja",
  nederlands: "nl", dutch: "nl", português: "pt", portuguese: "pt", polski: "pl", ελληνικά: "el",
  한국어: "ko", korean: "ko",
};
const CODES = new Set(["en", "tr", "de", "fr", "es", "it", "ru", "ar", "zh", "ja", "nl", "pt", "pl", "el", "ko", "fa", "he", "uk", "sv", "da", "no", "fi", "cs", "hu", "ro"]);
const TRANSLATE_WIDGET = /(weglot|gtranslate|translate\.google\.com\/translate_a|google_translate_element|conveythis|localizejs|cdn\.linguise)/i;

function codeFromLinkText(text: string): string | null {
  const t = text.toLowerCase().replace(/[()|]/g, " ").trim();
  if (!t || t.length > 24) return null;
  for (const word of t.split(/\s+/)) {
    if (LANG_NAMES[word]) return LANG_NAMES[word];
  }
  if (CODES.has(t)) return t;
  const m = /^([a-z]{2})(?:\s|$)/.exec(t);
  return m && CODES.has(m[1]) && t.split(/\s+/).length <= 3 ? m[1] : null;
}
function codeFromUrl(url: URL): string | null {
  const seg = /^\/([a-z]{2})(?:[-_][a-z]{2})?(?:\/|$)/i.exec(url.pathname)?.[1]?.toLowerCase();
  if (seg && CODES.has(seg)) return seg;
  const sub = /^([a-z]{2})\./i.exec(url.hostname)?.[1]?.toLowerCase();
  return sub && CODES.has(sub) ? sub : null;
}

/**
 * Number of languages the homepage offers: hreflang alternates, else a
 * language switcher (links whose label is a language and whose target is
 * the same site under another language), else `1` when the page declares
 * one `lang` and shows no switcher or translation widget.
 */
export function detectLanguageCount(homeUrl: string, html: string): SignalFact<number> | null {
  const $ = cheerio.load(html);
  const hreflang = new Set<string>();
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const code = ($(el).attr("hreflang") ?? "").toLowerCase().split("-")[0];
    if (code && code !== "x") hreflang.add(code);
  });
  if (hreflang.size > 0) return { value: hreflang.size, url: homeUrl, quote: `hreflang: ${[...hreflang].join(", ")}` };

  // Translation plugins name their languages in markup or settings
  // (WPML wpml-ls-item-xx, Polylang lang-item-xx, GTranslate settings,
  // Google Website Translator includedLanguages).
  const plugin = new Set<string>();
  let pluginName: string | null = null;
  $('[class*="wpml-ls-item-"], li[class*="lang-item-"]').each((_, el) => {
    for (const m of ($(el).attr("class") ?? "").matchAll(/\b(?:wpml-ls-item|lang-item)-([a-z]{2})(?:-[a-z]+)?\b/g)) {
      plugin.add(m[1]);
      pluginName ??= /wpml/.test($(el).attr("class") ?? "") ? "WPML" : "Polylang";
    }
  });
  const gt = /gtranslateSettings\s*=\s*\{[\s\S]{0,400}?["']?languages["']?\s*:\s*\[([^\]]+)\]/.exec(html);
  const gte = /includedLanguages\s*:\s*["']([a-z,\s-]+)["']/i.exec(html);
  for (const [m, name] of [[gt, "GTranslate"], [gte, "Google Website Translator"]] as const) {
    if (!m) continue;
    for (const c of m[1].split(",")) {
      const code = c.replace(/["'\s]/g, "").toLowerCase().split("-")[0];
      if (/^[a-z]{2}$/.test(code)) plugin.add(code);
    }
    pluginName ??= name;
  }
  if (plugin.size >= 2) return { value: plugin.size, url: homeUrl, quote: `${pluginName}: ${[...plugin].join(", ")}` };

  const home = new URL(homeUrl);
  const pageLang =($("html").attr("lang") ?? "").toLowerCase().split(/[-_]/)[0] || null;
  const codes = new Set<string>();
  const labels: string[] = [];
  let pointsElsewhere = false;
  for (const l of absLinks($, homeUrl)) {
    if (siteKey(l.url.hostname) !== siteKey(home.hostname)) continue;
    const attr = ($(l.el as never).attr("hreflang") ?? "").toLowerCase().split("-")[0];
    const fromText = codeFromLinkText(l.text);
    const fromUrl = codeFromUrl(l.url);
    const code = (attr && CODES.has(attr) ? attr : null) ?? (fromText && (fromUrl === fromText || fromUrl !== null || l.text.length <= 3) ? fromText : null);
    if (!code) continue;
    codes.add(code);
    labels.push(`${l.text || code} -> ${l.url.href}`);
    if (l.url.href.split("#")[0] !== homeUrl.split("#")[0]) pointsElsewhere = true;
  }
  if (codes.size > 0) {
    if (pageLang && CODES.has(pageLang)) codes.add(pageLang);
    // "TR" on an English page whose <html lang> also says tr still means two versions.
    const value = Math.max(codes.size, pointsElsewhere ? 2 : 1);
    if (value >= 2) return { value, url: homeUrl, quote: `language switcher: ${labels.slice(0, 6).join("; ")}` };
  }
  if (TRANSLATE_WIDGET.test(html)) return null; // a widget switches languages client-side: count unknown
  if (pageLang && CODES.has(pageLang)) {
    return { value: 1, url: homeUrl, quote: `<html lang="${$("html").attr("lang")}">; no hreflang, no language switcher` };
  }
  return null;
}

// ---------------------------------------------------------------- locations

const PLACE_TYPES = /^(Restaurant|FoodEstablishment|CafeOrCoffeeShop|BarOrPub|Bakery|FastFoodRestaurant|IceCreamShop|Winery|Brewery|LocalBusiness)$/i;
/** Plural parents list sibling venues; singular ones need 3+ children (a lone /restaurant/about is not a chain). */
const LOCATION_SEG_PLURAL = /(^|-)(locations|restaurants|venues|sites|branches|pizzerias|cafes|our-restaurants)$/i;
const LOCATION_SEG_SINGULAR = /(^|-)(location|restaurant|venue|branch|pizzeria)$/i;
const NOT_A_LOCATION =
  /^(index|all|map|near-me|search|page|category|tag|book|booking|bookings|book-a-table|reservations?|menu|menus|careers|jobs|gift-cards?|vouchers?|private-dining|events|news|faq|faqs|about|about-us|gallery|contact|story|team|press|reviews|blog)$/i;
const COUNT_NOUN = "(?:[Rr]estaurants|[Ll]ocations|[Ss]ites|[Vv]enues|[Bb]ranches|[Cc]af[ée]s|[Pp]izzerias|[Oo]utlets|şube(?:si|miz|ler)?)";
/** "over 130 restaurants", "11 Gaucho restaurants across London", "our 3 cafés". */
const COUNT_TEXT = new RegExp(
  `(?<lead>\\b(?:[Oo]ver|[Mm]ore than|[Aa]cross|[Oo]ur|[Ww]ith|[Aa]ll)\\s+)?\\b(?<n>\\d{1,4})\\+?\\s+(?<brand>(?:[A-Z][\\w'’&.-]*\\s+){0,2})${COUNT_NOUN}\\b(?<tail>.{0,30})`,
  "g",
);
const GROUP_TEXT =
  /\b(?:[Pp]art of|[Aa] member of|[Ff]rom the team behind|[Bb]rought to you by)\s+(?:[Tt]he\s+)?([A-Z][\w&'’.-]*(?:\s+[A-Z][\w&'’.-]*){0,4}\s+(?:Group|Collection|Hospitality(?:\s+Group)?|Restaurants))\b/;
const NAV_LOCATIONS = /^(our|all|view all|find our|other|see all)\s+(locations|restaurants|sites|venues|cafes|cafés|branches|shops|pizzerias)$/i;
const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/g;
const REGISTERED = /(registered (office|address)|company (no|number|reg)|vat (no|number|reg)|incorporated)/i;

function jsonLdNodes($: Root): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const visit = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(visit);
    const r = o as Record<string, unknown>;
    out.push(r);
    for (const k of ["@graph", "department", "subOrganization", "location", "hasPart", "itemListElement", "item"]) visit(r[k]);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).html() ?? ""));
    } catch {
      // malformed JSON-LD
    }
  });
  return out;
}
function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}
/** Address key for de-duplication: the postcode when there is one (the same venue is often written two ways). */
function streetOf(node: Record<string, unknown>): string | null {
  const a = node.address;
  let s: string | null = null;
  if (typeof a === "string") s = a.trim();
  else if (a && typeof a === "object") {
    const r = a as Record<string, unknown>;
    if (typeof r.postalCode === "string" && r.postalCode.trim()) return r.postalCode.replace(/\s+/g, "").toUpperCase();
    s = [r.streetAddress, r.addressLocality].filter((x) => typeof x === "string").join(" ").trim();
  }
  if (!s) return null;
  const pc = /\b([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})\b/.exec(s.toUpperCase());
  return pc ? `${pc[1]}${pc[2]}` : s.toLowerCase();
}

export interface LocationSignals {
  locationCount: SignalFact<number> | null;
  locationHints: SignalFact<string[]> | null;
}

/**
 * Evidence that the venue is one of several sites. `locationCount` is the
 * largest count read (distinct JSON-LD venue addresses, distinct location
 * pages, distinct UK postcodes, or a "N restaurants" claim) and is only
 * set at 2+. `locationHints` collects weaker cues ("Our Locations" nav,
 * "Part of the Bull Group", a group-company link).
 */
export function detectLocations(pages: SignalPage[]): LocationSignals {
  let best: SignalFact<number> | null = null;
  const hints: string[] = [];
  let hintUrl: string | null = null;
  const consider = (value: number, url: string, quote: string) => {
    if (value >= 2 && value <= 2000 && (!best || value > best.value)) best = { value, url, quote };
  };
  const hint = (h: string, url: string) => {
    if (!hints.includes(h)) hints.push(h);
    hintUrl ??= url;
  };

  for (const p of pages) {
    const $ = cheerio.load(p.html);
    const page = new URL(p.url);

    // 1. JSON-LD venues with distinct addresses.
    const addrs = new Set<string>();
    for (const n of jsonLdNodes($)) {
      if (!typesOf(n).some((t) => PLACE_TYPES.test(t))) continue;
      const s = streetOf(n);
      if (s) addrs.add(s);
    }
    if (addrs.size >= 2) consider(addrs.size, p.url, `JSON-LD venues: ${[...addrs].slice(0, 4).join(" | ")}`);

    // 2. Same-site location pages: /locations/<slug>, /pizzerias/<slug>, ...
    const byParent = new Map<string, Set<string>>();
    const currentSegs = page.pathname.split("/").filter(Boolean);
    const addLoc = (segs: string[]) => {
      const i = segs.findIndex((s) => LOCATION_SEG_PLURAL.test(s) || LOCATION_SEG_SINGULAR.test(s));
      if (i < 0 || i === segs.length - 1) return;
      const slug = segs[i + 1].toLowerCase();
      if (NOT_A_LOCATION.test(slug) || !/^[\p{L}\d][\p{L}\d-]*$/u.test(slug)) return;
      const parent = segs.slice(0, i + 1).join("/").toLowerCase() + (LOCATION_SEG_PLURAL.test(segs[i]) ? "" : "|singular");
      if (!byParent.has(parent)) byParent.set(parent, new Set());
      byParent.get(parent)!.add(slug);
    };
    addLoc(currentSegs);
    for (const l of absLinks($, p.url)) {
      if (siteKey(l.url.hostname) !== siteKey(page.hostname)) {
        // The operator's group site: thebullgroup.com, thewolseleyhospitalitygroup.com.
        if (/(group|hospitality)\.[a-z.]+$/i.test(siteKey(l.url.hostname)) && !/careers|jobs/i.test(l.url.hostname)) {
          hint(`${l.text || "link"} -> ${l.url.origin}`, p.url);
        }
        continue;
      }
      addLoc(l.url.pathname.split("/").filter(Boolean));
      const t = l.text.replace(/\s+/g, " ").trim();
      if (NAV_LOCATIONS.test(t)) hint(`"${t}" -> ${l.url.href}`, p.url);
    }
    for (const [key, slugs] of byParent) {
      const singular = key.endsWith("|singular");
      const parent = key.replace(/\|singular$/, "");
      if (slugs.size >= (singular ? 3 : 2)) consider(slugs.size, p.url, `location pages under /${parent}/: ${[...slugs].slice(0, 5).join(", ")}`);
    }

    // 3. Visible text: "11 Gaucho restaurants across London", postcodes, group phrases, headings.
    const text = visibleText(p.html);
    for (const m of text.matchAll(COUNT_TEXT)) {
      const { lead, n, brand, tail } = m.groups as Record<string, string | undefined>;
      const count = Number(n);
      if (count >= 1900 && count <= 2100) continue; // a year, not a count
      // A bare "2 cafes" is not a claim: it needs a lead word, a brand name or a spread ("across London").
      if (!lead && !brand && !/^\s*(across|nationwide|throughout|around|in the uk)/i.test(tail ?? "")) continue;
      consider(count, p.url, m[0].slice(0, m[0].length - (tail ?? "").length).trim());
    }
    const postcodes = new Set<string>();
    for (const m of text.matchAll(UK_POSTCODE)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 120), m.index ?? 0);
      if (REGISTERED.test(before)) continue;
      postcodes.add(`${m[1]} ${m[2]}`.toUpperCase());
    }
    if (postcodes.size >= 2) consider(postcodes.size, p.url, `addresses: ${[...postcodes].slice(0, 5).join(", ")}`);
    const g = GROUP_TEXT.exec(text);
    if (g) hint(g[0], p.url);
    $("h1, h2, h3, h4, nav a, header a, footer a").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (NAV_LOCATIONS.test(t)) hint(t, p.url);
    });
  }

  const finalBest = best as SignalFact<number> | null;
  return {
    locationCount: finalBest,
    locationHints: hints.length > 0 ? { value: hints.slice(0, 5), url: hintUrl!, quote: hints[0] } : null,
  };
}

// ---------------------------------------------------------------- hotels

const HOTEL_BRANDS: Array<[RegExp, string]> = [
  [/(^|\.)ritzcarlton\.com$/, "The Ritz-Carlton (Marriott)"],
  [/(^|\.)marriott\.com$/, "Marriott"],
  [/(^|\.)fourseasons\.com$/, "Four Seasons"],
  [/(^|\.)peninsula\.com$/, "The Peninsula"],
  [/(^|\.)hilton\.com$/, "Hilton"],
  [/(^|\.)hyatt\.com$/, "Hyatt"],
  [/(^|\.)ihg\.com$/, "IHG"],
  [/(^|\.)(all\.)?accor\.com$/, "Accor"],
  [/(^|\.)rosewoodhotels\.com$/, "Rosewood"],
  [/(^|\.)mandarinoriental\.com$/, "Mandarin Oriental"],
  [/(^|\.)shangri-la\.com$/, "Shangri-La"],
  [/(^|\.)kempinski\.com$/, "Kempinski"],
  [/(^|\.)radissonhotels\.com$/, "Radisson"],
  [/(^|\.)wyndhamhotels\.com$/, "Wyndham"],
  [/(^|\.)belmond\.com$/, "Belmond"],
  [/(^|\.)aman\.com$/, "Aman"],
  [/(^|\.)dorchestercollection\.com$/, "Dorchester Collection"],
  [/(^|\.)jumeirah\.com$/, "Jumeirah"],
  [/(^|\.)sixsenses\.com$/, "Six Senses"],
  [/(^|\.)langhamhotels\.com$/, "Langham"],
  [/(^|\.)edwardian\.com$/, "Edwardian Hotels"],
  [/(^|\.)sofitel\.com$/, "Sofitel (Accor)"],
  [/(^|\.)fairmont\.com$/, "Fairmont (Accor)"],
  [/(^|\.)raffles\.com$/, "Raffles (Accor)"],
];
/** Room-booking engines and OTAs: a site that sells rooms is a hotel. */
const ROOM_ENGINES =
  /(^|\.)(istbooking\.com|booking\.com|book-directonline\.com|siteminder\.com|cloudbeds\.com|synxis\.com|hotelrunner\.com|simplebooking\.it|mews\.li|mews\.com|guestline\.net|elinapp\.com|hotel-spider\.com|reservations\.travelclick\.com|secure-hotel-booking\.com|webhotelier\.net)$/;
const ROOM_TEXT = /\b(book (a|your) room|rooms? (&|and) suites|our rooms|odalar(ımız)?|oda rezervasyonu)\b/i;
const LODGING_TYPES = /^(Hotel|LodgingBusiness|Resort|BedAndBreakfast|Hostel|Motel)$/i;

/**
 * The restaurant sits inside (or is run by) a hotel: a hotel-brand host or
 * link, LodgingBusiness JSON-LD, or a room-booking engine link. The value
 * names the operator when known, else "independent hotel".
 */
export function detectHotelOperator(pages: SignalPage[]): SignalFact<string> | null {
  for (const p of pages) {
    const own = bare(new URL(p.url).hostname);
    const brand = HOTEL_BRANDS.find(([re]) => re.test(own));
    if (brand) return { value: brand[1], url: p.url, quote: `site is on ${own}` };
  }
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    for (const l of absLinks($, p.url)) {
      const h = bare(l.url.hostname);
      const brand = HOTEL_BRANDS.find(([re]) => re.test(h));
      if (brand) return { value: brand[1], url: p.url, quote: `${l.text || "link"} -> ${l.url.href}` };
    }
  }
  for (const p of pages) {
    const $ = cheerio.load(p.html);
    for (const n of jsonLdNodes($)) {
      const t = typesOf(n).find((x) => LODGING_TYPES.test(x));
      if (t) return { value: typeof n.name === "string" ? `independent hotel (${n.name})` : "independent hotel", url: p.url, quote: `JSON-LD @type ${t}` };
    }
    for (const l of absLinks($, p.url)) {
      if (ROOM_ENGINES.test(bare(l.url.hostname)) || (ROOM_TEXT.test(l.text) && l.text.length < 40)) {
        return { value: "independent hotel", url: p.url, quote: `${l.text || "link"} -> ${l.url.href}` };
      }
    }
  }
  return null;
}
