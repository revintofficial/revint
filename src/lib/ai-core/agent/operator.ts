/**
 * Who runs the venue: an owner (`single`), an owner-run small group
 * (`small_group`, 2–5 venues: the best Premium prospect), a centrally
 * run chain (`chain`) or a hotel's restaurant (`hotel_fnb`). The last
 * two do not buy at the branch, so Room 1 stops the call.
 *
 * Pure: every input is a public fact someone already collected (Google
 * type, address, website host, how many of our own leads share the
 * account or the site, what the site audit saw). `evidence` is the one
 * fact the card shows.
 */
import type { OperatorKind } from "./head-agent";

/** From this many locations a brand is treated as centrally run. */
export const CHAIN_MIN_LOCATIONS = 6;

export interface OperatorInput {
  businessName?: string | null;
  address?: string | null;
  /** Google primary type ("restaurant", "hotel", "lodging"…). */
  primaryType?: string | null;
  websiteUrl?: string | null;
  /** Leads on the same account (brand rollup) in this workspace, this one included. */
  accountLocations?: number | null;
  /** Leads in this workspace whose website is on the same host, this one included. */
  sameSiteLocations?: number | null;
  /** Locations the venue's own site lists, when the site audit saw them. */
  siteLocations?: number | null;
  /** Where the site audit saw those locations (URL), for the evidence line. */
  siteLocationsUrl?: string | null;
  /** Site audit hint that the page belongs to a hotel (quote or URL). */
  siteHotelHint?: string | null;
}

export interface OperatorResult {
  operator: OperatorKind;
  evidence: string | null;
  /** Best known number of venues under the same owner (at least 1). */
  locationCount: number;
}

const HOTEL_TYPES =
  /^(hotel|lodging|resort_hotel|motel|inn|bed_and_breakfast|guest_house|hostel|extended_stay_hotel|private_guest_room)$/i;

/** Hotel groups whose domains host their restaurants' pages. */
const HOTEL_BRANDS = [
  "kempinski",
  "hilton",
  "marriott",
  "hyatt",
  "accor",
  "ihg",
  "intercontinental",
  "fourseasons",
  "four seasons",
  "ritzcarlton",
  "ritz-carlton",
  "ritz carlton",
  "mandarinoriental",
  "mandarin oriental",
  "shangri-la",
  "shangrila",
  "radisson",
  "swissotel",
  "swissôtel",
  "fairmont",
  "raffles",
  "sofitel",
  "novotel",
  "wyndham",
  "bestwestern",
  "best western",
  "rixos",
  "dedeman",
  "rosewood",
  "corinthia",
  "dorchester",
  "belmond",
  "sheraton",
  "westin",
  "st. regis",
  "stregis",
  "waldorf",
  "doubletree",
  "crowne plaza",
  "holiday inn",
  "mövenpick",
  "movenpick",
  "pullman",
  "the langham",
  "langhamhotels",
  "soho house",
  "the ned",
  "the savoy",
  "claridge",
  "the connaught",
  "the berkeley",
  "çırağan",
  "ciragan",
];

/**
 * Brands known to buy centrally. A short, high-precision list for the
 * markets the beta runs in (UK, Türkiye) plus the global chains; a
 * brand we do not know falls back to the location counts.
 */
const KNOWN_CHAINS = [
  "mcdonald",
  "burger king",
  "kfc",
  "subway",
  "domino",
  "pizza hut",
  "papa john",
  "starbucks",
  "costa coffee",
  "caffè nero",
  "caffe nero",
  "pret a manger",
  "greggs",
  "nando",
  "wagamama",
  "pizzaexpress",
  "pizza express",
  "franco manca",
  "pizza pilgrims",
  "honest burgers",
  "five guys",
  "shake shack",
  "itsu",
  "yo! sushi",
  "yo sushi",
  "zizzi",
  "ask italian",
  "prezzo",
  "bella italia",
  "café rouge",
  "cafe rouge",
  "cote brasserie",
  "côte brasserie",
  "the ivy",
  "gaucho",
  "dishoom",
  "hawksmoor",
  "flat iron",
  "wahaca",
  "gail's",
  "gails bakery",
  "popeyes",
  "morley",
  "tgi friday",
  "harvester",
  "toby carvery",
  "wetherspoon",
  "nusr-et",
  "nusret",
  "big chefs",
  "bigchefs",
  "happy moon",
  "günaydın",
  "gunaydin",
  "köfteci yusuf",
  "kofteci yusuf",
  "simit sarayı",
  "simit sarayi",
  "mado",
  "kahve dünyası",
  "kahve dunyasi",
  "espresso lab",
  "tavuk dünyası",
  "tavuk dunyasi",
  "baydöner",
  "baydoner",
  "hd iskender",
  "sbarro",
  "arby",
  "little caesars",
  "usta dönerci",
  "komagene",
  "çiğköftem",
];

/** Hosts that many unrelated venues share: never proof of a common owner. */
const SHARED_HOSTS =
  /(^|\.)(facebook|instagram|linktr|google|goo|bit|wixsite|business|squarespace|wordpress|blogspot|weebly|godaddysites|yelp|tripadvisor|opentable|thefork|resy|sevenrooms|quandoo|deliveroo|ubereats|just-eat|yemeksepeti|getir|trendyol|finedinemenu|linkin|taplink|beacons|carrd|tiktok|x|twitter|youtube)\./i;

function norm(s: string | null | undefined): string {
  return (s ?? "").toLocaleLowerCase("en").replace(/\s+/g, " ").trim();
}

/** The venue's own website host without "www.", or null for missing, malformed or shared hosts. */
export function ownSiteHost(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    if (!host.includes(".") || SHARED_HOSTS.test(`${host}`)) return null;
    return host;
  } catch {
    return null;
  }
}

const HOTEL_PATH = /\/(hotels?|restaurants?-(and-)?bars?|bars?-(and-)?restaurants?|eat-(and-)?drink)(\/|$)/i;
/** `/dining/<venue>`: a hotel pattern only when several venues share the site. */
const DINING_PATH = /\/dining\/[^/]+/i;

function sitePath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`);
    return u.pathname.replace(/\/+$/, "") || null;
  } catch {
    return null;
  }
}

function positive(n: number | null | undefined): number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

const LETTER = /[a-z0-9çğıöşüâéèô]/i;
/** After a brand: end of text, a non-letter, or a possessive ("Nando's", "Dominos"). */
const BRAND_END = /^(['’]?s)?($|[^a-z0-9çğıöşüâéèô])/i;

/** A brand as a whole word anywhere in the text ("… Palace Kempinski"). */
function brandIn(text: string, brands: readonly string[]): string | null {
  for (const b of brands) {
    const at = text.indexOf(b);
    if (at === -1) continue;
    if (at > 0 && LETTER.test(text[at - 1])) continue;
    if (!BRAND_END.test(text.slice(at + b.length))) continue;
    return b;
  }
  return null;
}

/**
 * A brand at the START of the name ("Gaucho Piccadilly"). Anywhere else
 * it is usually somebody else's venue ("El Gaucho Steakhouse").
 */
function brandLeads(name: string, brands: readonly string[]): string | null {
  for (const b of brands) {
    if (name.startsWith(b) && BRAND_END.test(name.slice(b.length))) return b;
  }
  return null;
}

export function detectOperator(input: OperatorInput): OperatorResult {
  const name = norm(input.businessName);
  const address = norm(input.address);
  const host = ownSiteHost(input.websiteUrl);
  const counts = [
    { n: positive(input.siteLocations), why: `${input.siteLocationsUrl?.trim() || host || "site"} — sitede ${positive(input.siteLocations)} lokasyon` },
    { n: positive(input.accountLocations), why: `harita — aynı hesapta ${positive(input.accountLocations)} şube` },
    { n: positive(input.sameSiteLocations), why: `${host ?? "site"} — aynı alan adında ${positive(input.sameSiteLocations)} şube` },
  ].sort((a, b) => b.n - a.n);
  const locationCount = Math.max(1, counts[0].n);

  // Hotel restaurant: the hotel buys.
  if (input.primaryType && HOTEL_TYPES.test(input.primaryType.trim())) {
    return { operator: "hotel_fnb", evidence: `harita — Google tipi: ${input.primaryType.trim()}`, locationCount };
  }
  if (input.siteHotelHint?.trim()) {
    return { operator: "hotel_fnb", evidence: `site — ${input.siteHotelHint.trim()}`, locationCount };
  }
  const hostBrand = host ? brandIn(host.replace(/[.-]/g, " "), HOTEL_BRANDS) ?? brandIn(host, HOTEL_BRANDS) : null;
  if (host && (hostBrand || /(hotel|resort)/.test(host))) {
    return { operator: "hotel_fnb", evidence: `${host} — otel alan adı`, locationCount };
  }
  const nameBrand = brandIn(name, HOTEL_BRANDS);
  if (nameBrand || /\b(hotel|hotels|oteli?|resort)\b/.test(name)) {
    return { operator: "hotel_fnb", evidence: `ad: "${input.businessName?.trim()}"`, locationCount };
  }
  if (/\b(hotel|oteli?|resort)\b/.test(address) || brandIn(address, HOTEL_BRANDS)) {
    return { operator: "hotel_fnb", evidence: `adres: "${input.address?.trim()}"`, locationCount };
  }
  // A hotel's own site: its venues live under /hotels/…, /restaurants-bars/…,
  // or several of them under /dining/….
  const path = sitePath(input.websiteUrl);
  if (host && path && (HOTEL_PATH.test(path) || (DINING_PATH.test(path) && positive(input.sameSiteLocations) >= 2))) {
    return { operator: "hotel_fnb", evidence: `${host}${path} — otel yemek sayfası`, locationCount };
  }

  // Chain: a brand known to buy centrally, or enough locations to be one.
  const chain = brandLeads(name, KNOWN_CHAINS);
  if (chain) return { operator: "chain", evidence: `ad: "${input.businessName?.trim()}" — bilinen zincir`, locationCount };
  if (locationCount >= CHAIN_MIN_LOCATIONS) return { operator: "chain", evidence: counts[0].why, locationCount };

  if (locationCount >= 2) return { operator: "small_group", evidence: counts[0].why, locationCount };
  return { operator: "single", evidence: null, locationCount: 1 };
}
