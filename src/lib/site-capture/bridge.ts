// src/lib/site-capture/bridge.ts
/**
 * From a capture to SiteFacts. mergeSiteFacts runs on the same three pages
 * it reads today; the bridge then fills only what is still `null` from the
 * other captured pages, third-party requests and menu PDFs. It never
 * replaces an answer and never turns "not read" into "read and absent".
 * The one exception is the deposit: the deep path always re-judges
 * `hasPrepayment` with the sentence-level rule (homepage and pinned pages
 * included), whatever mergeSiteFacts said; the shallow path (crawlWebsite)
 * keeps mergeSiteFacts' own answer.
 */
import { detectBookingProviderEvidence } from "@/lib/audit/booking-detection";
import { deliveryPlatformFor, isDirectOrderingHost } from "@/lib/delivery-platforms";
import { menuVendorFor } from "@/lib/restaurant-vendors";
import {
  bare,
  menuPdf,
  mergeSiteFacts,
  PREPAY,
  TASTING,
  type SiteFact,
  type SiteFacts,
  type SubpagePick,
  type VisitedPage,
} from "@/lib/site-facts";
import { detectHotelOperator, detectLocations, type SignalPage } from "@/lib/site-signals";
import { isDrinksOnlyPdf } from "./classify";
import { summarizeLedger } from "./ledger";
import type { CapturedPage, PageType, SiteCaptureResult, SiteCoverage } from "./types";
import { urlKey } from "./url";

/**
 * A card guarantee is a prepayment commitment even when the word "deposit" is absent.
 * Negation is decided per sentence (NEGATION), not here.
 */
const CARD_GUARANTEE =
  /((no[- ]show|late cancellation|cancellation) (fee|charge)s?\b|card details (are |will be )?(requested|required|needed|taken))/i;
/**
 * Negations and "no fee" phrasings: "no" (but not "no-show"), "not", "n't", "never",
 * "without", "cannot", "none", "nor", "free of charge", "waive(d)", "optional",
 * "deposit-free", "fee-free", "not required", "no need", "zero", "scrapped", "stopped",
 * "no longer", "unnecessary", "don't need", "do not need".
 */
const NEGATION =
  /(\bno\b(?![- ]show)|\bnot\b|n['’]t\b|\bnever\b|\bwithout\b|\bcannot\b|\bnone\b|\bnor\b|\bfree of charge\b|\bwaived?\b|\boptional\b|\bdeposit-free\b|\bfee-free\b|\bnot required\b|\bno need\b|\bzero\b|\bscrapped\b|\bstopped\b|\bno longer\b|\bunnecessary\b|\bdon['’]t need\b|\bdo not need\b)/i;
/** Gift cards, shop and ordering checkouts take card details too; that is not a booking deposit. */
const COMMERCE =
  /\b(gifts?|vouchers?|shops?|checkout|basket|merchandise|takeaway|delivery|collection|click\s*(&|and)\s*collect|online order(s|ing)?)\b/i;
/**
 * Group / private-event wording. Plural "groups" counts anywhere; a singular
 * "group" only before a booking noun, so a company name ("the Hawksmoor Group") does not.
 */
const GROUP_WORDING =
  /\b(groups|group (of|over|larger|bigger)|group (bookings?|dining|reservations?|menus?|sizes?|tables?|enquiry|enquiries)|party|parties|(larger|bigger|large|big) (bookings?|tables?|parties|groups|reservations?)|private (dining|hire|events?)|exclusive hire|kalabalık)\b/i;
/**
 * The statement holds only in some cases ("only on Fridays", "unless", "depending on"),
 * or is uncertain ("may", "might", "can be", "sometimes", "in some cases").
 */
const RESTRICTION_MARKER = /\b(only|solely|except|unless|depending|may|might|can be|sometimes|in some cases)\b/i;
const PARTY_NUM =
  "(?:[2-9]|[1-9]\\d|[1-9]\\d\\d|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)";
/** A number that is not money (no currency sign before it) and not a time or a percentage. */
const PARTY_COUNT =
  `(?<![£$€₺\\d.,])${PARTY_NUM}(?!\\d|\\s*(%|hours?\\b|hrs?\\b|days?\\b|minutes?\\b|mins?\\b|weeks?\\b|months?\\b|am\\b|pm\\b))`;
/** A party-size threshold: "8+", "eight or more", "tables of 5", "above 8", "for 8", "10 guests". */
const PARTY_SIZE = new RegExp(
  `(\\b${PARTY_COUNT}(\\s*\\+|\\s+(or more|or larger|or above|and above|and over|and more|plus|guests|people|persons|diners|covers|kişi)\\b)` +
    `|\\b(more than|over|above|exceeding|larger than|bigger than|tables? of|bookings of|parties of|for|of)\\s+${PARTY_COUNT}\\b)`,
  "i",
);
/** Seasonal, special-occasion, event, day and peak-time statements. */
const OCCASION =
  /\b(christmas|festive|new year|valentine|mother['’]?s day|father['’]?s day|easter|bank holidays?|special (events?|occasions?)|set menus?|tasting|afternoon tea|brunch|sunday roast|experiences?|masterclass(es)?|events?|functions?|birthdays?|celebrations?|weddings?|exclusive (use|hire)|venue hire|whole venue|private (room|use)|corporate|larger numbers|hen|stag|nye|new year['’]?s eve|buffet|chef['’]?s table|peak|weekends?|(mon|tues|wednes|thurs|fri|satur|sun)days?|january|february|march|april|may|june|july|august|september|october|november|december|during)\b/i;
/** Determiners and the like before "booking(s)": "all bookings", "your booking" say nothing restrictive. */
const UNQUALIFIED_BEFORE_BOOKING = new Set([
  "all", "any", "every", "each", "your", "our", "the", "a", "an", "online", "table", "new", "standard", "normal",
  "regular", "most", "these", "those", "and", "or", "of", "for", "to", "with", "when", "on", "at", "in", "per",
]);
/** Anchored at a word start, so a long run of letters is not rescanned from every character. */
const WORD_BEFORE_BOOKING = /(?<![\p{L}'’-])([\p{L}'’-]+)\s+(bookings?|reservations?)\b/giu;
/** "bookings in December", "bookings for larger numbers", "bookings of 100" (but not "at the time of booking"). */
const BOOKING_QUALIFIED_AFTER = /\b(bookings?|reservations?)\s+(for|of|in|during|on|over|above|at)\b(?!\s+the time\b)/i;

/** A qualifier directly before or after "booking(s)" / "reservation(s)" restricts the statement. */
function qualifiedBooking(context: string): boolean {
  if (BOOKING_QUALIFIED_AFTER.test(context)) return true;
  for (const m of context.matchAll(WORD_BEFORE_BOOKING)) {
    if (!UNQUALIFIED_BEFORE_BOOKING.has(m[1].toLowerCase())) return true;
  }
  return false;
}
/** An FAQ statement is about bookings only when it says so. */
const BOOKING_WORDING = /\b(book(s|ed|ing|ings)?|reserv(e|ed|ation|ations)|tables?|rezervasyon\w*|masa\w*)\b/i;
/** A hotel's room-booking terms ("first night", "check-in", "Hotel may request prepayment") are not a table deposit. */
const ROOM_CONTEXT = /\b(rooms?|stays?|nights?|check-?in|check-?out|accommodation|suites?|guest rooms?|hotels?)\b/i;
/** Longer than this is a blob (an i18n string table, a JSON dump), not a statement. */
const MAX_DEPOSIT_SENTENCE = 400;
const QUOTE_MAX = 240;

/**
 * Sentences with their terminators. Whitespace (line breaks included) is collapsed
 * first, as visibleText() does in production: a heading stays fused with the
 * sentence after it, an unpunctuated question with its answer.
 */
function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const NOT_OPENED_MAX = 15;

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname;
  } catch {
    return null;
  }
}

function matchWindow(text: string, re: RegExp, radius: number): { quote: string; window: string } | null {
  const m = re.exec(text);
  if (!m) return null;
  const end = m.index + m[0].length;
  return {
    quote: text.slice(Math.max(0, m.index - 80), end + 80).trim(),
    window: text.slice(Math.max(0, m.index - radius), end + radius),
  };
}

/** Captured pages of the given types, in that type order (the homepage is mergeSiteFacts' job). */
function ofTypes(pages: CapturedPage[], types: PageType[]): CapturedPage[] {
  return types.flatMap((t) => pages.filter((p) => p.type === t));
}

function isBookingVendorPage(p: CapturedPage): boolean {
  return detectBookingProviderEvidence({ html: "", links: [{ href: p.finalUrl }] }) !== null;
}

/** Every address a page points at or talks to. */
function hrefsOf(p: CapturedPage, withRequests: boolean): string[] {
  return [
    ...p.links.map((l) => l.href),
    ...p.embeds,
    ...(withRequests ? p.thirdPartyRequests : []),
    ...(p.type === "external" ? [p.finalUrl] : []),
  ];
}

/** Rebuilds mergeSiteFacts' input for today's three subpages from the capture. */
export function visitedFromCapture(pick: SubpagePick, capture: SiteCaptureResult, homeUrl: string): VisitedPage[] {
  const homeHost = bare(new URL(homeUrl).hostname);
  return pick.targets.map((t) => {
    const key = urlKey(t.url);
    const page = capture.pages.find((p) => p.source !== "pdf" && urlKey(p.url) === key);
    const entry = capture.ledger.find((e) => urlKey(e.url) === key);
    const finalUrl = page?.finalUrl ?? entry?.finalUrl ?? null;
    const landedHost = finalUrl ? hostOf(finalUrl) : null;
    // A redirect to another host is not the venue's page; the landing host is still evidence.
    if (finalUrl && landedHost && bare(landedHost) !== homeHost) return { ...t, html: null, landedUrl: finalUrl };
    if (!page || page.html === null) return { ...t, html: null };
    return { ...t, html: page.html };
  });
}

export function coverageOf(capture: SiteCaptureResult): SiteCoverage {
  const s = summarizeLedger(capture.ledger);
  const unread = capture.ledger.filter((e) => e.outcome !== "opened" && e.reason !== "limit_type" && e.reason !== "duplicate");
  const failuresFirst = [...unread.filter((e) => e.outcome === "failed"), ...unread.filter((e) => e.outcome === "skipped")];
  return {
    status: capture.status,
    opened: s.opened,
    skipped: s.skipped,
    failed: s.failed,
    durationMs: capture.durationMs,
    overflow: capture.candidateOverflow,
    notOpened: failuresFirst.slice(0, NOT_OPENED_MAX).map((e) => ({ url: e.url, type: e.type, reason: e.reason ?? "budget" })),
  };
}

function bridgeBooking(pages: CapturedPage[]): SiteFact<string> | null {
  const ordered = ofTypes(pages, ["reservation", "external", "events", "locations", "contact", "faq", "menu", "order"]);
  for (const p of ordered) {
    const ev = detectBookingProviderEvidence({
      html: p.embeds.join("\n"),
      links: hrefsOf(p, false).map((href) => ({ href })),
    });
    if (ev) return { value: ev.provider, url: p.url, quote: ev.evidence, source: "page" };
  }
  // A widget that loads late shows up only as a request to the provider's host.
  for (const p of [...pages.filter((x) => x.type === "home"), ...ordered]) {
    if (p.thirdPartyRequests.length === 0) continue;
    const ev = detectBookingProviderEvidence({ html: "", links: p.thirdPartyRequests.map((href) => ({ href })) });
    if (ev) return { value: ev.provider, url: p.url, quote: `request to ${ev.evidence}`, source: "network" };
  }
  return null;
}

/**
 * One deposit statement on a page: skipped (null), general / scoped with its quote, or
 * "negated_restricted": skipped for a negation while naming a restriction. That hit is
 * never a fact itself (it may be a true negation), but it may equally be an affirmative
 * group statement with an incidental negation word, so its page can no longer be general.
 */
function classifyPrepaymentHit(
  type: PageType,
  sentences: string[],
  i: number,
): { scope: "general" | "group_or_event"; quote: string } | { scope: "negated_restricted" } | null {
  const sentence = sentences[i];
  if (sentence.length > MAX_DEPOSIT_SENTENCE) return null;
  if (!PREPAY.test(sentence) && !CARD_GUARANTEE.test(sentence)) return null;
  const question = sentence.endsWith("?");
  // A question is answered by the sentence after it ("Do I need a deposit? No.").
  // Negation, commerce, room and the FAQ / homepage booking-wording checks read only this context.
  const context = sentences.slice(i, question ? i + 2 : i + 1).join(" ");
  if (COMMERCE.test(context) || ROOM_CONTEXT.test(context)) return null;
  const negated = NEGATION.test(context);
  // A restriction is often stated in the next sentence ("… is required. This applies to
  // parties of 8 or more."); after a question, in the two sentences that answer it.
  const scopeContext = sentences.slice(i, question ? i + 3 : i + 2).join(" ");
  const restricted =
    type === "events" ||
    GROUP_WORDING.test(scopeContext) ||
    PARTY_SIZE.test(scopeContext) ||
    OCCASION.test(scopeContext) ||
    RESTRICTION_MARKER.test(scopeContext) ||
    qualifiedBooking(scopeContext);
  if (negated) return restricted ? { scope: "negated_restricted" } : null;
  // The homepage is read like an FAQ page: a general claim needs booking wording.
  if (!restricted && (type === "faq" || type === "home") && !BOOKING_WORDING.test(context)) return null;
  return { scope: restricted ? "group_or_event" : "general", quote: (restricted ? scopeContext : context).slice(0, QUOTE_MAX).trim() };
}

/**
 * A deposit is "general" only on an unrestricted, un-negated statement about
 * bookings. Anything doubtful is skipped (unknown) or scoped to groups/events.
 * The decision is per page: one scoped statement makes the whole page scoped
 * ("Card details are requested for groups over four. A no-show fee ... applies."
 * in either order). A negated statement that names a restriction keeps the page from
 * being general. Across pages the first general page wins, else the first scoped one.
 * Page order: reservation, booking vendor, homepage, FAQ, events.
 */
function bridgePrepayment(pages: CapturedPage[]): SiteFact<true> | null {
  let scoped: SiteFact<true> | null = null;
  for (const p of ofTypes(pages, ["reservation", "external", "home", "faq", "events"])) {
    if (p.source === "pdf") continue;
    if (p.type === "external" && !isBookingVendorPage(p)) continue;
    const sentences = sentencesOf(p.text);
    let pageScoped: string | null = null;
    let pageGeneral: string | null = null;
    let pageNoGeneral = false;
    for (let i = 0; i < sentences.length; i++) {
      const hit = classifyPrepaymentHit(p.type, sentences, i);
      if (!hit) continue;
      if (hit.scope === "negated_restricted") pageNoGeneral = true;
      else if (hit.scope === "group_or_event") pageScoped ??= hit.quote;
      else pageGeneral ??= hit.quote;
    }
    if (pageScoped !== null) {
      scoped ??= { value: true, url: p.url, quote: pageScoped, source: "page", scope: "group_or_event" };
    } else if (pageGeneral !== null && !pageNoGeneral) {
      return { value: true, url: p.url, quote: pageGeneral, source: "page", scope: "general" };
    }
  }
  return scoped;
}

function bridgeTasting(pages: CapturedPage[]): SiteFact<true> | null {
  for (const p of ofTypes(pages, ["menu"])) {
    if (p.needsOcr) continue;
    const hit = matchWindow(p.text, TASTING, 0);
    if (hit) return { value: true, url: p.url, quote: hit.quote, source: p.source === "pdf" ? "pdf" : "page" };
  }
  return null;
}

function bridgeMenuVendor(pages: CapturedPage[]): SiteFact<string> | null {
  for (const p of ofTypes(pages, ["menu", "external"])) {
    for (const href of hrefsOf(p, true)) {
      const host = hostOf(href);
      const vendor = host ? menuVendorFor(host) : null;
      if (vendor) return { value: vendor, url: p.url, quote: href, source: p.thirdPartyRequests.includes(href) ? "network" : "page" };
    }
  }
  return null;
}

function bridgeDirectOrdering(pages: CapturedPage[]): SiteFact<true> | null {
  for (const p of ofTypes(pages, ["order", "menu", "external"])) {
    for (const href of hrefsOf(p, true)) {
      const host = hostOf(href);
      if (host && isDirectOrderingHost(host)) {
        return { value: true, url: p.url, quote: href, source: p.thirdPartyRequests.includes(href) ? "network" : "page" };
      }
    }
  }
  return null;
}

function bridgeDelivery(pages: CapturedPage[]): SiteFact<string[]> | null {
  const names: string[] = [];
  let url: string | null = null;
  let quote: string | null = null;
  for (const p of ofTypes(pages, ["order", "menu", "contact", "locations"])) {
    for (const l of p.links) {
      const host = hostOf(l.href);
      const platform = host ? deliveryPlatformFor(host) : null;
      if (!platform) continue;
      if (!names.includes(platform)) names.push(platform);
      url ??= p.url;
      quote ??= l.href;
    }
  }
  return names.length > 0 && url ? { value: names, url, quote, source: "page" } : null;
}

/** A drinks-only PDF (a wine list) is never the menu PDF; the capture does not even fetch one. */
function bridgeMenuPdf(pages: CapturedPage[]): string | null {
  const pdf = pages.find((p) => p.source === "pdf" && p.type === "menu" && !isDrinksOnlyPdf("", new URL(p.url)));
  if (pdf) return pdf.url;
  for (const p of ofTypes(pages, ["menu"])) {
    for (const l of p.links) {
      try {
        const u = new URL(l.href);
        if (menuPdf({ text: l.text, url: u }) && !isDrinksOnlyPdf(l.text, u)) return u.href;
      } catch {
        // malformed href
      }
    }
  }
  return null;
}

/**
 * Fills only what is still `null`, except the deposit, which the sentence rule
 * always decides. Language facts and the "page seen" flags are left alone.
 */
export function bridgeSiteFacts(base: SiteFacts, capture: SiteCaptureResult): SiteFacts {
  const pages = capture.pages;
  const out: SiteFacts = { ...base, coverage: coverageOf(capture) };

  out.bookingProvider ??= bridgeBooking(pages);
  out.hasPrepayment = bridgePrepayment(pages);
  out.tastingMenu ??= bridgeTasting(pages);
  out.qrMenuTool ??= bridgeMenuVendor(pages);
  out.directOrdering ??= bridgeDirectOrdering(pages);
  out.deliveryPlatforms ??= bridgeDelivery(pages);
  out.menuPdfUrl ??= bridgeMenuPdf(pages);

  // Location and hotel signals read raw HTML; it is kept for these page types only.
  const signalPages: SignalPage[] = pages
    .filter((p) => p.html !== null && (p.type === "home" || p.type === "locations" || p.type === "contact" || p.type === "about"))
    .map((p) => ({ url: p.finalUrl, html: p.html as string, kind: p.type }));
  if (signalPages.length > 1) {
    if (!out.locationCount || !out.locationHints) {
      const loc = detectLocations(signalPages);
      out.locationCount ??= loc.locationCount;
      out.locationHints ??= loc.locationHints;
    }
    out.hotelOperator ??= detectHotelOperator(signalPages);
  }
  return out;
}

export function siteFactsFromCapture(
  home: { url: string; html: string },
  capture: SiteCaptureResult,
  pick: SubpagePick,
): SiteFacts {
  return bridgeSiteFacts(mergeSiteFacts(home, visitedFromCapture(pick, capture, home.url), pick), capture);
}
