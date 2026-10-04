// src/lib/site-capture/classify.ts
/**
 * Assigns an address to a page type, or to nothing at all. Noise pages
 * (privacy, cart, login, blog posts, careers) and files never become
 * candidates; a page off the venue's site is a candidate only when it is
 * a known booking / ordering / menu vendor (one hop).
 */
import { detectBookingProviderEvidence } from "@/lib/audit/booking-detection";
import { isDirectOrderingHost } from "@/lib/delivery-platforms";
import { menuVendorFor } from "@/lib/restaurant-vendors";
import { bare, MENU_PATH, MENU_TEXT, ORDER_PATH, ORDER_TEXT, RES_PATH, RES_TEXT } from "@/lib/site-facts";
import { siteKey } from "@/lib/site-signals";
import type { PageType } from "./types";

/** Whole-word match that also works for words starting or ending with a non-ASCII letter. */
function word(alts: string): RegExp {
  return new RegExp(`(^|[^\\p{L}])(${alts})($|[^\\p{L}])`, "iu");
}

const FILE =
  /\.(pdf|png|jpe?g|gif|webp|avif|svg|ico|css|js|mjs|json|xml|txt|zip|mp4|mp3|mov|woff2?|ttf|eot|ics|vcf|docx?|xlsx?)$/i;

/** Never opened, whatever the link text says. */
const HARD_NOISE =
  /(^|\/)(privacy|terms|cookies?|legal|gdpr|accessibility|cart|basket|checkout|login|log-in|signin|sign-in|register|account|my-account|wp-admin|wp-login|wp-json|feed|search|unsubscribe|modern-slavery)(\/|$|\.|-)/i;

/** Not a guest surface; only checked after the positive types. */
const SOFT_NOISE =
  /(^|\/)(blog|news|journal|stories|press|media|careers?|jobs|vacancies|recruitment|gift-?cards?|gift-?vouchers?|vouchers?|shop|store|merch|products?|newsletter|subscribe|tags?|category|author|allergens?)(\/|$|\.|-)/i;

/** The same words as the FIRST path segment: a whole shop / blog section, never a candidate. */
const NOISE_SECTION =
  /^\/(blog|news|journal|stories|press|media|careers?|jobs|vacancies|recruitment|gift-?cards?|gift-?vouchers?|vouchers?|shop|store|merch|products?|newsletter|subscribe|tags?|category|author|allergens?)(\/|$|\.)/i;
/** A segment or link text about books (a cookbook, a book shop): "book" here is not a booking. */
const BOOKS_SEGMENT = /^(books|bookshop|bookstore|cookbook[\w-]*|cookery-book[\w-]*)(\.\w+)?$/i;
const BOOKS_TEXT = /^(books|our book|cook ?books?|cookery books?)$/i;

/** RES_PATH / RES_TEXT, minus segments and link texts that are about books. */
function isReservation(path: string, text: string): boolean {
  if (RES_TEXT.test(text) && !BOOKS_TEXT.test(text)) return true;
  return path.split("/").some((s) => s !== "" && !BOOKS_SEGMENT.test(s) && RES_PATH.test(`/${s}`));
}

const EVENTS_PATH =
  /(^|\/)(private-[\w-]+|group-[\w-]+|events?|parties|celebrations?|functions?|weddings?|christmas[\w-]*|feasts?|ozel-[\w-]+|grup-[\w-]+)(\/|$|\.)/i;
const EVENTS_TEXT = word(
  "private (dining|hire|events?|parties)|group (bookings?|dining|feasts?|reservations?)|large (parties|groups)|events?|parties|celebrations?|weddings?|özel (etkinlik|davet)\\p{L}*|grup\\p{L}*",
);
const FAQ_PATH = /(^|\/)(faqs?|frequently-asked[\w-]*|help|sss|sikca-sorulan[\w-]*)(\/|$|\.)/i;
const FAQ_TEXT = word("faqs?|frequently asked( questions)?|sıkça sorulan\\p{L}*( sorular)?|sss");
const LOC_PATH =
  /(^|\/)(locations?|restaurants|our-restaurants|find-us|find-a-restaurant|store-locator|branches|venues|subeler|subelerimiz|restoranlar)(\/|$|\.)/i;
/** A path segment that names several venues (not a singular "location", "find-us" or "contact"). */
const VENUE_LIST_SEGMENT =
  /^(locations|restaurants|our-restaurants|find-a-restaurant|store-locator|branches|venues|subeler|subelerimiz|restoranlar)$/i;

/** A page whose path lists venues: the only kind the deep path reads location and hotel signals from. */
export function isVenueListUrl(href: string): boolean {
  try {
    return pathOf(new URL(href)).split("/").some((s) => VENUE_LIST_SEGMENT.test(s));
  } catch {
    return false;
  }
}

const LOC_TEXT = word("locations?|our restaurants|find us|find a restaurant|branches|venues|şubeler\\p{L}*|restoranlarımız");
const CONTACT_PATH = /(^|\/)(contact|contact-us|get-in-touch|iletisim|bize-ulasin)(\/|$|\.)/i;
const CONTACT_TEXT = word("contact( us)?|get in touch|[iİ]letişim|bize ulaşın");
const ABOUT_PATH = /(^|\/)(about|about-us|our-story|story|hakkimizda|hikayemiz)(\/|$|\.)/i;
const ABOUT_TEXT = word("about( us)?|our story|hakkımızda|hikayemiz");

const BOOKING_SUBDOMAIN = /^(book|booking|bookings|reservations?|reserve)$/i;
const ORDER_SUBDOMAIN = /^(order|orders|ordering|delivery|takeaway)$/i;
/** A same-site subdomain that is not a guest surface: its pages never take a page slot. */
const NOISE_SUBDOMAIN =
  /^(careers|career|jobs|work|recruitment|shop|store|gifts|giftcards|vouchers|blog|news|press|media|investors|corporate|staff|team|intranet|mail|webmail|email|cdn|static|assets|img|images|status|support|help|docs|developers|dev|api|account|accounts|login|auth)$/i;

function pathOf(url: URL): string {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return url.pathname;
  }
}

const DRINKS_WORD = word(
  "wines?|drinks?|cocktails?|bar|beverages?|spirits|beers?|whiske?y|champagne|şarap\\p{L}*|içecek\\p{L}*|kokteyl\\p{L}*",
);
const FOOD_WORD = word(
  "food|lunch|dinner|brunch|breakfast|kitchen|[aà][ _-]la[ _-]carte|set[ _-]menus?|tasting|desserts?|kids|sunday|yemek\\p{L}*|kahvaltı\\p{L}*",
);

/**
 * A PDF whose file name or link text names drinks and no food (a wine list, a
 * cocktail card). It is never read as the menu PDF; `menuPdf()` in site-facts
 * is the shared predicate and stays as it is.
 */
export function isDrinksOnlyPdf(linkText: string, url: URL): boolean {
  const file = pathOf(url).split("/").pop() ?? "";
  const said = `${linkText} ${file}`;
  return DRINKS_WORD.test(said) && !FOOD_WORD.test(said);
}

/** A booking, white-label ordering or digital-menu vendor (delivery marketplaces are not opened). */
export function isKnownVendorUrl(url: URL): boolean {
  return (
    menuVendorFor(url.hostname) !== null ||
    isDirectOrderingHost(url.hostname) ||
    detectBookingProviderEvidence({ html: "", links: [{ href: url.href }] }) !== null
  );
}

export function classifyUrl(url: URL, linkText: string | null, home: URL): PageType | null {
  if (!/^https?:$/.test(url.protocol)) return null;
  const path = pathOf(url);
  const text = (linkText ?? "").replace(/\s+/g, " ").trim();
  if (FILE.test(path)) return null;
  if (HARD_NOISE.test(path)) return null;

  if (siteKey(url.hostname) !== siteKey(home.hostname)) return isKnownVendorUrl(url) ? "external" : null;

  const sameHost = bare(url.hostname) === bare(home.hostname);
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : "/") || "/";
  if (sameHost && trim(url.pathname) === trim(home.pathname) && !url.search) return "home";
  if (!sameHost) {
    const label = bare(url.hostname).split(".")[0];
    if (BOOKING_SUBDOMAIN.test(label)) return "reservation";
    if (ORDER_SUBDOMAIN.test(label)) return "order";
    if (NOISE_SUBDOMAIN.test(label)) return null;
  }

  // A shop or blog section stays out whatever its later segments or link text say.
  if (NOISE_SECTION.test(path)) return null;
  if (EVENTS_PATH.test(path) || EVENTS_TEXT.test(text)) return "events";
  if (isReservation(path, text)) return "reservation";
  if (MENU_PATH.test(path) || MENU_TEXT.test(text)) return "menu";
  if (ORDER_PATH.test(path) || ORDER_TEXT.test(text)) return "order";
  if (FAQ_PATH.test(path) || FAQ_TEXT.test(text)) return "faq";
  if (LOC_PATH.test(path) || LOC_TEXT.test(text)) return "locations";
  if (CONTACT_PATH.test(path) || CONTACT_TEXT.test(text)) return "contact";
  if (SOFT_NOISE.test(path)) return null;
  if (ABOUT_PATH.test(path) || ABOUT_TEXT.test(text)) return "about";
  return "other";
}
