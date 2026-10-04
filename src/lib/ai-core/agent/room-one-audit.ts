/**
 * Maps what the collectors saw onto Room 1's tri-state audit.
 * `false` is written only when the surface was actually read
 * (`siteFacts.bookingChecked`, `menuPageSeen`, `orderPageSeen`);
 * otherwise the field stays `null`.
 */
import { deliveryPlatformFor } from "@/lib/delivery-platforms";
import type { MapFacts } from "@/lib/agent-workers/apify/map-facts";
import type { SiteFacts } from "@/lib/site-facts";
import type { RoomOneAudit, VenueType } from "./head-agent";

export interface RoomOneAuditSource {
  hasWebsite: boolean | null;
  websiteUrl: string | null;
  audit: {
    reachable: boolean | null;
    url: string | null;
    hasBookingSystem: boolean | null;
    bookingProvider: string | null;
    rawFeaturesJson: unknown;
  } | null;
  mapFacts: MapFacts | null;
  venueType: VenueType | null;
}

function nonEmpty(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
function isPdf(url: string | null): boolean {
  return url !== null && /\.pdf(\?|#|$)/i.test(url);
}

export function buildRoomOneAudit(src: RoomOneAuditSource): RoomOneAudit | null {
  const map = src.mapFacts;
  const mapBooking = map?.reservationLinks[0] ?? null;
  const mapProvider = mapBooking ? (mapBooking.name ?? hostOf(mapBooking.url)) : null;
  const mapPlatforms = map?.deliveryPlatforms ?? [];
  const mapOwnOrdering = (map?.orderLinks ?? []).some((l) => deliveryPlatformFor(l.url) === null && !(l.name && deliveryPlatformFor(l.name)));

  const wa = src.audit;
  if (!wa) {
    const base: RoomOneAudit | null = src.hasWebsite === false ? { hasWebsite: false, websiteBroken: false } : null;
    if (!map) return base;
    return {
      ...(base ?? { hasWebsite: src.hasWebsite }),
      bookingProvider: mapProvider,
      hasBookingSystem: mapProvider ? true : null,
      hasOnlineReservation: mapProvider ? true : null,
      acceptsReservations: map.acceptsReservations,
      deliveryPlatforms: mapPlatforms.length > 0 ? mapPlatforms : null,
      marketplaceOrdering: mapPlatforms.length > 0 ? true : null,
      // Google adds third-party order links to a profile by itself.
      marketplaceSource: mapPlatforms.length > 0 ? "map" : null,
      hasOnlineOrdering: mapOwnOrdering ? true : null,
      menuUrl: map.menuUrl,
      pdfMenu: map.menuUrl ? isPdf(map.menuUrl) : null,
      venueType: src.venueType,
    };
  }

  const f = (wa.rawFeaturesJson && typeof wa.rawFeaturesJson === "object" ? wa.rawFeaturesJson : {}) as Record<string, unknown>;
  const sf = (f.siteFacts && typeof f.siteFacts === "object" ? f.siteFacts : null) as SiteFacts | null;

  const provider =
    nonEmpty(wa.bookingProvider) ?? nonEmpty(f.bookingProvider) ?? sf?.bookingProvider?.value ?? mapProvider;
  const sawBooking = wa.hasBookingSystem === true || f.hasOnlineReservation === true || provider !== null;
  const bookingChecked = sf?.bookingChecked === true;

  const sitePlatforms = sf?.deliveryPlatforms?.value ?? [];
  const platforms = [...new Set([...sitePlatforms, ...mapPlatforms])];
  const ownOrdering = sf?.directOrdering != null || mapOwnOrdering;
  const orderingChecked = sf != null && (sf.menuPageSeen || sf.orderPageSeen);

  const detectedMenuTool = nonEmpty(f.detectedMenuTool) ?? sf?.qrMenuTool?.value ?? null;
  const menuUrl = nonEmpty(f.menuUrl) ?? sf?.menuPdfUrl ?? map?.menuUrl ?? null;
  const hasQr = f.hasQrMenu === true || sf?.qrMenuTool != null;

  return {
    reachable: wa.reachable,
    websiteUrl: src.websiteUrl ?? wa.url ?? null,
    hasWebsite: src.hasWebsite ?? true,
    websiteBroken: src.hasWebsite !== false && wa.reachable === false ? true : wa.reachable === true ? false : null,
    hasBookingSystem: sawBooking ? true : bookingChecked ? false : null,
    hasOnlineReservation: sawBooking ? true : bookingChecked ? false : null,
    bookingProvider: provider,
    acceptsReservations: map?.acceptsReservations ?? null,
    // A deposit stated only for groups / private events is evidence, not a
    // general "this venue takes deposits" signal.
    hasPrepayment: sf?.hasPrepayment && sf.hasPrepayment.scope !== "group_or_event" ? true : null,
    tableCount: finiteNumber(f.tableCount),
    hasQrMenu: hasQr ? true : sf?.menuPageSeen ? false : null,
    pdfMenu: menuUrl ? isPdf(menuUrl) && !detectedMenuTool : null,
    menuUrl,
    detectedMenuTool,
    hasOnlineOrdering: ownOrdering ? true : orderingChecked ? false : null,
    marketplaceOrdering: platforms.length > 0 ? true : null,
    deliveryPlatforms: platforms.length > 0 ? platforms : null,
    // Seen on the venue's own site, or only on the Google profile (not evidence of dependence).
    marketplaceSource: sitePlatforms.length > 0 ? "site" : mapPlatforms.length > 0 ? "map" : null,
    languageCount: sf?.languageCount?.value ?? finiteNumber(f.languageCount),
    tastingMenu: sf?.tastingMenu ? true : null,
    venueType: src.venueType,
  };
}
