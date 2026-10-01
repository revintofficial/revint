/**
 * Live public evidence for the FineDine London demo seed.
 * Places (rating, map link, up to 5 reviews) and a single HTML fetch
 * of the venue's own page. Nothing here is invented: a failed fetch
 * comes back null and the seed keeps the curated copy.
 */
const PLACES = "https://places.googleapis.com/v1";

const NAME_NEEDLE: Record<string, string> = {
  "demo-padella-soho": "padella",
  "demo-honest-burgers-dalston": "honest",
  "demo-the-wolseley": "wolseley",
  "demo-flat-iron-covent-garden": "flat iron",
  "demo-andrew-edmunds": "andrew edmunds",
  "demo-dishoom-covent-garden": "dishoom",
  "demo-pizza-pilgrims-soho": "pizza pilgrim",
  "demo-hawksmoor-seven-dials": "hawksmoor",
};

export interface DemoReview {
  authorName: string;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: Date;
}

export interface DemoPage {
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  emails: string[];
  navItems: { text: string; href: string }[];
  ctaLinks: { text: string; href: string }[];
  socials: {
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    tiktok: string | null;
    youtube: string | null;
    twitter: string | null;
    whatsapp: string | null;
  };
  hasContactForm: boolean;
  hasWhatsapp: boolean;
  hasOpenGraph: boolean;
  hasTwitterCards: boolean;
  hasFavicon: boolean;
  hasCookieConsent: boolean;
  hasGoogleAnalytics: boolean;
  structuredDataPresent: boolean;
  schemaTypes: string[];
  https: boolean;
}

export interface PublicEvidence {
  rating: number | null;
  reviewCount: number | null;
  googleMapsUri: string | null;
  lat: number | null;
  lng: number | null;
  googlePhone: string | null;
  placeName: string | null;
  reviews: DemoReview[];
  page: DemoPage | null;
}

export async function gatherEvidence(
  placeKey: string,
  query: string,
  websiteUrl: string,
): Promise<PublicEvidence> {
  const [place, page] = await Promise.all([
    lookupPlace(placeKey, query),
    fetchPage(websiteUrl),
  ]);
  return {
    rating: place?.rating ?? null,
    reviewCount: place?.reviewCount ?? null,
    googleMapsUri: place?.googleMapsUri ?? null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
    googlePhone: place?.phone ?? null,
    placeName: place?.name ?? null,
    reviews: place?.reviews ?? [],
    page,
  };
}

async function lookupPlace(placeKey: string, query: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.warn("GOOGLE_PLACES_API_KEY missing — skipping Places.");
    return null;
  }
  const needle = NAME_NEEDLE[placeKey];
  const search = await placesFetch(
    `${PLACES}/places:searchText`,
    key,
    "places.id,places.displayName",
    {
      method: "POST",
      body: JSON.stringify({
        textQuery: query,
        languageCode: "en",
        maxResultCount: 3,
        locationBias: {
          circle: {
            center: { latitude: 51.5074, longitude: -0.1278 },
            radius: 8000,
          },
        },
      }),
    },
  );
  const places = (search?.places ?? []) as Array<{ id?: string; displayName?: { text?: string } }>;
  const hit = places.find((p) => (p.displayName?.text ?? "").toLowerCase().includes(needle ?? ""));
  if (!hit?.id) {
    console.warn(`Places: no name match for ${query}`);
    return null;
  }
  const detail = await placesFetch(
    `${PLACES}/places/${hit.id}`,
    key,
    [
      "id",
      "displayName",
      "rating",
      "userRatingCount",
      "googleMapsUri",
      "nationalPhoneNumber",
      "location",
      "reviews",
    ].join(","),
    { method: "GET" },
  );
  if (!detail) return null;
  const name = String(detail.displayName?.text ?? "");
  if (needle && !name.toLowerCase().includes(needle)) return null;
  const reviews = Array.isArray(detail.reviews) ? detail.reviews : [];
  return {
    name,
    rating: typeof detail.rating === "number" ? detail.rating : null,
    reviewCount: typeof detail.userRatingCount === "number" ? detail.userRatingCount : null,
    googleMapsUri: typeof detail.googleMapsUri === "string" ? detail.googleMapsUri : null,
    phone: typeof detail.nationalPhoneNumber === "string" ? detail.nationalPhoneNumber : null,
    lat: typeof detail.location?.latitude === "number" ? detail.location.latitude : null,
    lng: typeof detail.location?.longitude === "number" ? detail.location.longitude : null,
    reviews: reviews.slice(0, 5).map(mapReview).filter((r): r is DemoReview => r !== null),
  };
}

function mapReview(raw: {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: { displayName?: string };
}): DemoReview | null {
  const rating = typeof raw.rating === "number" ? Math.round(raw.rating) : null;
  if (!rating || rating < 1 || rating > 5) return null;
  const text = raw.text?.text || raw.originalText?.text || null;
  const published = raw.publishTime ? new Date(raw.publishTime) : new Date();
  return {
    authorName: raw.authorAttribution?.displayName?.slice(0, 80) || "Google reviewer",
    rating,
    text: text ? text.slice(0, 1200) : null,
    relativeTime: raw.relativePublishTimeDescription || "On Google",
    publishTime: Number.isNaN(published.getTime()) ? new Date() : published,
  };
}

async function placesFetch(
  url: string,
  key: string,
  fieldMask: string,
  init: { method: string; body?: string },
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- one-off script over untyped Places JSON
): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": fieldMask,
      },
      body: init.body,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`Places ${res.status} for ${url}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await res.json()) as Record<string, any>;
  } catch (err) {
    console.warn(`Places request failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function fetchPage(url: string): Promise<DemoPage | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RevintDemo/1.0; +https://leadac.com)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    if (!html || html.length < 200) return null;
    return parsePage(html, res.status, url.startsWith("https://"));
  } catch (err) {
    console.warn(`Page fetch failed ${url}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function parsePage(html: string, httpStatus: number, https: boolean): DemoPage {
  const title = decode(matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const metaDescription = decode(
    attr(html, /<meta[^>]+name=["']description["'][^>]*>/i, "content") ||
      attr(html, /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i, "content"),
  );
  const h1 = decode(stripTags(matchOne(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || ""));
  const emails = uniqueEmails(html);
  const anchors = extractAnchors(html);
  const navItems = anchors.filter((a) => a.text.length > 1 && a.text.length < 32).slice(0, 8);
  const ctaLinks = anchors
    .filter((a) => /book|reserv|menu|order|collect/i.test(a.text))
    .slice(0, 6);
  const hrefs = anchors.map((a) => a.href);
  const social = (re: RegExp) => hrefs.find((h) => re.test(h)) ?? null;
  const schemaTypes = schemaTypeNames(html);
  return {
    httpStatus,
    title: title || null,
    metaDescription: metaDescription || null,
    h1: h1 || null,
    emails,
    navItems,
    ctaLinks,
    socials: {
      instagram: social(/instagram\.com\//i),
      facebook: social(/facebook\.com\//i),
      linkedin: social(/linkedin\.com\//i),
      tiktok: social(/tiktok\.com\//i),
      youtube: social(/youtube\.com\//i),
      twitter: social(/twitter\.com\/|x\.com\//i),
      whatsapp: social(/wa\.me\/|api\.whatsapp\.com/i),
    },
    hasContactForm: /<form[\s>]/i.test(html),
    hasWhatsapp: /wa\.me\/|api\.whatsapp\.com/i.test(html),
    hasOpenGraph: /property=["']og:/i.test(html),
    hasTwitterCards: /name=["']twitter:card["']/i.test(html),
    hasFavicon: /rel=["'][^"']*icon[^"']*["']/i.test(html),
    hasCookieConsent: /cookiebot|onetrust|cookieconsent|cookie-consent/i.test(html),
    hasGoogleAnalytics: /gtag\(|googletagmanager|google-analytics/i.test(html),
    structuredDataPresent: /application\/ld\+json/i.test(html),
    schemaTypes,
    https,
  };
}

function extractAnchors(html: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 40) {
    const text = decode(stripTags(m[2] || "")).replace(/\s+/g, " ").trim();
    const href = m[1];
    if (!text || text.length > 40 || href.startsWith("#") || href.startsWith("javascript:")) continue;
    if (out.some((a) => a.text.toLowerCase() === text.toLowerCase())) continue;
    out.push({ text, href });
  }
  return out;
}

function uniqueEmails(html: string): string[] {
  const found = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const skip = /sentry|wixpress|example\.|png|webp|@2x|schema\.org|googleapis/i;
  return [...new Set(found.map((e) => e.toLowerCase()))].filter((e) => !skip.test(e)).slice(0, 4);
}

function schemaTypeNames(html: string): string[] {
  const types = new Set<string>();
  const re = /"@type"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] && m[1].length < 40) types.add(m[1]);
  }
  return [...types].slice(0, 6);
}

function matchOne(html: string, re: RegExp): string {
  const m = html.match(re);
  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

function attr(html: string, tagRe: RegExp, name: string): string {
  const tag = html.match(tagRe)?.[0] ?? "";
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m?.[1] ?? "";
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}
