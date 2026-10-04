// src/lib/site-capture/bridge.ts
/**
 * From a capture to SiteFacts. mergeSiteFacts runs on the same three pages
 * it reads today; the bridge then fills only what is still `null` from the
 * other captured pages, third-party requests and menu PDFs. It never
 * replaces an answer and never turns "not read" into "read and absent".
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
import { summarizeLedger } from "./ledger";
import type { CapturedPage, PageType, SiteCaptureResult, SiteCoverage } from "./types";
import { urlKey } from "./url";

/** A card guarantee is a prepayment commitment even when the word "deposit" is absent. */
const CARD_GUARANTEE =
  /((?<!\bno )(?<!\bwithout (a |any )?)(no[- ]show|late cancellation|cancellation) (fee|charge)s?\b|card details (are |will be )?(requested|required|needed|taken))/i;
/** The statement applies to groups or private events, not to an ordinary booking. */
const GROUP_NEAR =
  /(groups?|parties|party of|large (tables?|bookings?|parties)|private (dining|hire|events?)|exclusive hire|\b(?:[6-9]|[1-9]\d)\s*(\+|or more|guests|people|persons|kişi)|(more than|over) (four|five|six|seven|eight|nine|ten|\d+)|grup|kalabalık)/i;
/** "Do I need a deposit? No." / "we don't take deposits": not a positive statement. */
const NEGATED =
  /((deposit|pre-?payment|card details)[^.!?]{0,80}\?\s*(no\b|we (do not|don't|never))|(don't|do not|never|not) (take|require|ask for|need|charge)[^.!?]{0,40}(deposit|card|pre-?pay))/i;

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

function bridgePrepayment(pages: CapturedPage[]): SiteFact<true> | null {
  let scoped: SiteFact<true> | null = null;
  for (const p of ofTypes(pages, ["reservation", "external", "faq", "events"])) {
    if (p.source === "pdf") continue;
    if (p.type === "external" && !isBookingVendorPage(p)) continue;
    const hit = matchWindow(p.text, PREPAY, 200) ?? matchWindow(p.text, CARD_GUARANTEE, 200);
    if (!hit || NEGATED.test(hit.window)) continue;
    const group = p.type === "events" || GROUP_NEAR.test(hit.window);
    const fact: SiteFact<true> = { value: true, url: p.url, quote: hit.quote, source: "page", scope: group ? "group_or_event" : "general" };
    if (!group) return fact;
    scoped ??= fact;
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

function bridgeMenuPdf(pages: CapturedPage[]): string | null {
  const pdf = pages.find((p) => p.source === "pdf");
  if (pdf) return pdf.url;
  for (const p of ofTypes(pages, ["menu"])) {
    for (const l of p.links) {
      try {
        const u = new URL(l.href);
        if (menuPdf({ text: l.text, url: u })) return u.href;
      } catch {
        // malformed href
      }
    }
  }
  return null;
}

/** Fills only what is still `null`. Language facts and the "page seen" flags are left alone. */
export function bridgeSiteFacts(base: SiteFacts, capture: SiteCaptureResult): SiteFacts {
  const pages = capture.pages;
  const out: SiteFacts = { ...base, coverage: coverageOf(capture) };

  out.bookingProvider ??= bridgeBooking(pages);
  out.hasPrepayment ??= bridgePrepayment(pages);
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
