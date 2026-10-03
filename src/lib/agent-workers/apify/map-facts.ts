/**
 * Facts the Google Maps payload already carries and Room 1 needs:
 * who takes the bookings, which marketplaces deliver, where the menu is.
 * Defensive on purpose: the actor's output shape has changed before.
 */
import { deliveryPlatformFor } from "@/lib/delivery-platforms";

export interface MapLink {
  name: string | null;
  url: string;
}

export interface MapFacts {
  reservationLinks: MapLink[];
  orderLinks: MapLink[];
  /** Marketplace names among the order links. */
  deliveryPlatforms: string[];
  menuUrl: string | null;
  acceptsReservations: boolean | null;
  serviceOptions: string[];
  price: string | null;
}

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
function httpUrl(v: unknown): string | null {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
}
function links(v: unknown, urlKeys: string[]): MapLink[] {
  if (!Array.isArray(v)) return [];
  const out: MapLink[] = [];
  for (const x of v) {
    const o = rec(x);
    if (!o) continue;
    const url = urlKeys.map((k) => httpUrl(o[k])).find((u): u is string => u !== null);
    if (!url || out.some((l) => l.url === url)) continue;
    out.push({ name: typeof o.name === "string" && o.name.trim() ? o.name.trim() : null, url });
  }
  return out;
}

export function extractMapFacts(place: unknown): MapFacts {
  const p = rec(place) ?? {};

  const reservationLinks = links(p.tableReservationLinks, ["url"]);
  for (const b of links(p.bookingLinks, ["url"])) {
    if (!reservationLinks.some((l) => l.url === b.url)) reservationLinks.push(b);
  }
  const reserveUrl = httpUrl(p.reserveTableUrl);
  // The provider name (Resy, OpenTable) lives in restaurantData; the link
  // names are often just the venue's own host.
  const provider = rec(rec(p.restaurantData)?.tableReservationProvider);
  const providerName =
    typeof provider?.name === "string" && provider.name.trim() ? provider.name.trim() : null;
  const providerUrl = httpUrl(provider?.reserveTableUrl) ?? reserveUrl;
  if (providerUrl) {
    const existing = reservationLinks.find((l) => l.url === providerUrl);
    if (existing) {
      if (existing.name === null) existing.name = providerName;
    } else {
      reservationLinks.unshift({ name: providerName, url: providerUrl });
    }
  }

  const orderLinks = links(p.orderBy, ["orderUrl", "url"]);
  const deliveryPlatforms = [
    ...new Set(
      orderLinks
        .map((l) => deliveryPlatformFor(l.url) ?? (l.name ? deliveryPlatformFor(l.name) : null))
        .filter((x): x is string => x !== null),
    ),
  ];

  const serviceOptions: string[] = [];
  let acceptsReservations: boolean | null = null;
  for (const [group, items] of Object.entries(rec(p.additionalInfo) ?? {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      for (const [label, val] of Object.entries(rec(item) ?? {})) {
        if (typeof val !== "boolean") continue;
        if (/service options/i.test(group) && val) serviceOptions.push(label);
        // "Reservations required: false" means walk-ins are fine, not that
        // bookings are refused, so it can only ever confirm `true`.
        if (/accepts reservations/i.test(label) && acceptsReservations !== true) {
          acceptsReservations = val;
        } else if (/reservations required/i.test(label) && val) {
          acceptsReservations = true;
        }
      }
    }
  }

  return {
    reservationLinks,
    orderLinks,
    deliveryPlatforms,
    menuUrl: httpUrl(p.menu),
    acceptsReservations,
    serviceOptions,
    price: typeof p.price === "string" && p.price.trim() ? p.price.trim() : null,
  };
}

/** Re-read `mapFacts` from a stored run output. */
export function parseMapFacts(raw: unknown): MapFacts | null {
  const o = rec(raw);
  if (!o) return null;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    reservationLinks: links(o.reservationLinks, ["url"]),
    orderLinks: links(o.orderLinks, ["url"]),
    deliveryPlatforms: strs(o.deliveryPlatforms),
    menuUrl: httpUrl(o.menuUrl),
    acceptsReservations: typeof o.acceptsReservations === "boolean" ? o.acceptsReservations : null,
    serviceOptions: strs(o.serviceOptions),
    price: typeof o.price === "string" && o.price ? o.price : null,
  };
}

const COUNTRY_ENDINGS: Array<[RegExp, string]> = [
  [/(\buk|united kingdom|england|scotland|wales)$/i, "gb"],
  [/(türkiye|turkiye|turkey)$/i, "tr"],
  [/(\busa|united states)$/i, "us"],
  [/ireland$/i, "ie"],
  [/(germany|deutschland)$/i, "de"],
  [/france$/i, "fr"],
  [/(spain|españa)$/i, "es"],
  [/(italy|italia)$/i, "it"],
  [/netherlands$/i, "nl"],
  [/(united arab emirates|\buae)$/i, "ae"],
];

/** ISO-2 country for the actor's search fallback; `undefined` = let the actor decide. */
export function countryCodeFromAddress(address: string | null | undefined): string | undefined {
  const tail = (address ?? "").trim().replace(/[.\s]+$/, "");
  if (!tail) return undefined;
  for (const [re, code] of COUNTRY_ENDINGS) if (re.test(tail)) return code;
  return undefined;
}
