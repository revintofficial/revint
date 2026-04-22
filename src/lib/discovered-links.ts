// Extracts social / directory / registry URLs from agent-run output JSON.
//
// The SERP rank worker, competitor ads actor, reddit mentions, gmaps deep
// scraper, and the web crawler all emit URLs inside their output payloads.
// Instead of teaching every consumer to crawl each shape individually we
// recursively walk the JSON, pull out every http(s) URL, and classify it
// against a known-hostname table. Anything we recognise is surfaced as a
// hero-band badge so the sales user can immediately see every business
// directory / social presence for the lead without opening the runs tab.

export type DiscoveredCategory =
  | "social"
  | "directory"
  | "review"
  | "registry"
  | "maps";

export type DiscoveredPlatform =
  // social
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "pinterest"
  | "reddit"
  // directory
  | "yell"
  | "bark"
  | "checkatrade"
  | "trustatrader"
  | "yellowpages"
  | "foursquare"
  // review
  | "trustpilot"
  | "yelp"
  | "glassdoor"
  | "bbb"
  // registry
  | "companies_house"
  // maps
  | "google_maps";

export interface DiscoveredLink {
  platform: DiscoveredPlatform;
  category: DiscoveredCategory;
  url: string;
  title: string | null;
  sources: string[];
}

const PLATFORM_META: Record<
  DiscoveredPlatform,
  { category: DiscoveredCategory; label: string }
> = {
  instagram: { category: "social", label: "Instagram" },
  facebook: { category: "social", label: "Facebook" },
  linkedin: { category: "social", label: "LinkedIn" },
  twitter: { category: "social", label: "X" },
  youtube: { category: "social", label: "YouTube" },
  tiktok: { category: "social", label: "TikTok" },
  whatsapp: { category: "social", label: "WhatsApp" },
  pinterest: { category: "social", label: "Pinterest" },
  reddit: { category: "social", label: "Reddit" },
  yell: { category: "directory", label: "Yell" },
  bark: { category: "directory", label: "Bark" },
  checkatrade: { category: "directory", label: "Checkatrade" },
  trustatrader: { category: "directory", label: "TrustATrader" },
  yellowpages: { category: "directory", label: "Yellow Pages" },
  foursquare: { category: "directory", label: "Foursquare" },
  trustpilot: { category: "review", label: "Trustpilot" },
  yelp: { category: "review", label: "Yelp" },
  glassdoor: { category: "review", label: "Glassdoor" },
  bbb: { category: "review", label: "BBB" },
  companies_house: { category: "registry", label: "Companies House" },
  google_maps: { category: "maps", label: "Google Maps" },
};

export function getPlatformLabel(platform: DiscoveredPlatform): string {
  return PLATFORM_META[platform].label;
}

export function getPlatformCategory(
  platform: DiscoveredPlatform,
): DiscoveredCategory {
  return PLATFORM_META[platform].category;
}

// Hostname → platform. We match on "endsWith" so subdomain variants like
// uk.linkedin.com, www.instagram.com, m.facebook.com all map correctly.
const HOST_RULES: Array<{ match: (host: string) => boolean; platform: DiscoveredPlatform }> = [
  { platform: "instagram", match: (h) => h === "instagram.com" || h.endsWith(".instagram.com") },
  { platform: "facebook", match: (h) => h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com" || h.endsWith(".fb.com") },
  { platform: "linkedin", match: (h) => h === "linkedin.com" || h.endsWith(".linkedin.com") || h === "lnkd.in" },
  { platform: "twitter", match: (h) => h === "twitter.com" || h.endsWith(".twitter.com") || h === "x.com" || h.endsWith(".x.com") || h === "t.co" },
  { platform: "youtube", match: (h) => h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be" },
  { platform: "tiktok", match: (h) => h === "tiktok.com" || h.endsWith(".tiktok.com") || h === "vm.tiktok.com" },
  { platform: "whatsapp", match: (h) => h === "wa.me" || h === "whatsapp.com" || h.endsWith(".whatsapp.com") },
  { platform: "pinterest", match: (h) => h === "pinterest.com" || h.endsWith(".pinterest.com") || h === "pin.it" },
  { platform: "reddit", match: (h) => h === "reddit.com" || h.endsWith(".reddit.com") || h === "redd.it" },
  { platform: "yell", match: (h) => h === "yell.com" || h.endsWith(".yell.com") },
  { platform: "bark", match: (h) => h === "bark.com" || h.endsWith(".bark.com") },
  { platform: "checkatrade", match: (h) => h === "checkatrade.com" || h.endsWith(".checkatrade.com") },
  { platform: "trustatrader", match: (h) => h === "trustatrader.com" || h.endsWith(".trustatrader.com") },
  { platform: "yellowpages", match: (h) => h === "yellowpages.com" || h.endsWith(".yellowpages.com") || h === "yellowpages.co.uk" || h.endsWith(".yellowpages.co.uk") },
  { platform: "foursquare", match: (h) => h === "foursquare.com" || h.endsWith(".foursquare.com") },
  { platform: "trustpilot", match: (h) => h === "trustpilot.com" || h.endsWith(".trustpilot.com") },
  { platform: "yelp", match: (h) => h === "yelp.com" || h.endsWith(".yelp.com") || h === "yelp.co.uk" || h.endsWith(".yelp.co.uk") },
  { platform: "glassdoor", match: (h) => h === "glassdoor.com" || h.endsWith(".glassdoor.com") || h === "glassdoor.co.uk" || h.endsWith(".glassdoor.co.uk") },
  { platform: "bbb", match: (h) => h === "bbb.org" || h.endsWith(".bbb.org") },
  { platform: "companies_house", match: (h) => h === "find-and-update.company-information.service.gov.uk" || h === "company-information.service.gov.uk" || h === "companieshouse.gov.uk" || h.endsWith(".companieshouse.gov.uk") },
  { platform: "google_maps", match: (h) => h === "maps.google.com" || h === "maps.app.goo.gl" || h === "goo.gl" || (h === "google.com" /* path check handled elsewhere */) },
];

export function classifyUrl(raw: string): DiscoveredPlatform | null {
  if (!raw || typeof raw !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "google.com" || host.endsWith(".google.com")) {
    if (parsed.pathname.startsWith("/maps")) return "google_maps";
    return null;
  }

  for (const rule of HOST_RULES) {
    if (rule.match(host)) return rule.platform;
  }
  return null;
}

// Normalise URL so near-duplicates collapse (trailing slash, utm_*, hash).
function canonicalize(u: string): string {
  try {
    const parsed = new URL(u);
    parsed.hash = "";
    const stripPrefixes = ["utm_", "gclid", "fbclid", "mc_"];
    const keep: Array<[string, string]> = [];
    for (const [k, v] of parsed.searchParams.entries()) {
      if (stripPrefixes.some((p) => k.toLowerCase().startsWith(p))) continue;
      keep.push([k, v]);
    }
    parsed.search = "";
    for (const [k, v] of keep) parsed.searchParams.append(k, v);
    let out = parsed.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return u;
  }
}

interface FoundRef {
  url: string;
  title: string | null;
}

// Structural walk: prefers {url, title} object shapes (SERP topResults,
// competitor ads creatives) so we keep the human-readable title. Falls back
// to any string that parses as an http(s) URL.
function walkJson(value: unknown, depth: number, out: FoundRef[]): void {
  if (value == null || depth <= 0) return;

  if (typeof value === "string") {
    if (/^https?:\/\/\S+$/i.test(value)) {
      out.push({ url: value, title: null });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, depth - 1, out);
    return;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    const urlVal = obj.url ?? obj.link ?? obj.href ?? obj.profileUrl ?? obj.permalink;
    const titleVal = obj.title ?? obj.name ?? obj.text ?? obj.heading;
    if (typeof urlVal === "string" && /^https?:\/\/\S+$/i.test(urlVal)) {
      out.push({
        url: urlVal,
        title: typeof titleVal === "string" ? titleVal : null,
      });
    }

    for (const [k, v] of Object.entries(obj)) {
      if (k === "url" || k === "link" || k === "href" || k === "profileUrl" || k === "permalink") continue;
      walkJson(v, depth - 1, out);
    }
  }
}

export interface AgentRunForLinks {
  workerKind: string;
  outputJson: unknown;
}

export function extractDiscoveredLinks(params: {
  agentRuns: AgentRunForLinks[];
  // URLs we should skip (e.g. the lead's own website / existing social
  // profiles from the website audit).
  ignoreUrls?: string[];
  maxPerPlatform?: number;
}): DiscoveredLink[] {
  const ignoreCanon = new Set(
    (params.ignoreUrls ?? [])
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .map((u) => canonicalize(u).toLowerCase()),
  );

  // Map keyed by canonical URL so we can merge duplicate hits across runs.
  const byCanon = new Map<
    string,
    { link: DiscoveredLink; sourceSet: Set<string> }
  >();

  for (const run of params.agentRuns) {
    if (!run || run.outputJson == null) continue;
    const found: FoundRef[] = [];
    walkJson(run.outputJson, 8, found);

    for (const { url, title } of found) {
      const platform = classifyUrl(url);
      if (!platform) continue;
      const canon = canonicalize(url);
      const canonLower = canon.toLowerCase();
      if (ignoreCanon.has(canonLower)) continue;

      const existing = byCanon.get(canonLower);
      if (existing) {
        existing.sourceSet.add(run.workerKind);
        if (!existing.link.title && title) existing.link.title = title;
        continue;
      }
      byCanon.set(canonLower, {
        link: {
          platform,
          category: PLATFORM_META[platform].category,
          url: canon,
          title: title ?? null,
          sources: [],
        },
        sourceSet: new Set([run.workerKind]),
      });
    }
  }

  const all = Array.from(byCanon.values()).map(({ link, sourceSet }) => ({
    ...link,
    sources: Array.from(sourceSet).sort(),
  }));

  const max = params.maxPerPlatform ?? 3;
  const perPlatform = new Map<DiscoveredPlatform, DiscoveredLink[]>();
  for (const link of all) {
    const list = perPlatform.get(link.platform) ?? [];
    if (list.length < max) list.push(link);
    perPlatform.set(link.platform, list);
  }

  const CATEGORY_ORDER: DiscoveredCategory[] = ["social", "directory", "review", "registry", "maps"];
  const PLATFORM_ORDER: DiscoveredPlatform[] = [
    "instagram", "facebook", "linkedin", "twitter", "youtube", "tiktok", "whatsapp", "pinterest", "reddit",
    "yell", "bark", "checkatrade", "trustatrader", "yellowpages", "foursquare",
    "trustpilot", "yelp", "glassdoor", "bbb",
    "companies_house",
    "google_maps",
  ];

  const flat: DiscoveredLink[] = [];
  for (const cat of CATEGORY_ORDER) {
    for (const platform of PLATFORM_ORDER) {
      if (PLATFORM_META[platform].category !== cat) continue;
      const list = perPlatform.get(platform) ?? [];
      flat.push(...list);
    }
  }
  return flat;
}
