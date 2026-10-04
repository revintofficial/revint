// src/lib/site-capture/discover.ts
/**
 * Where candidate pages come from (robots.txt + sitemap, known paths) and
 * the order they are opened in. Pure: fetching happens in capture.ts.
 */
import { siteKey } from "@/lib/site-signals";
import { classifyUrl } from "./classify";
import type { Candidate, CandidateSource, PageType } from "./types";
import { urlKey } from "./url";

export interface RobotsRules {
  sitemaps: string[];
  disallow: string[];
  allow: string[];
}
export const EMPTY_ROBOTS: RobotsRules = { sitemaps: [], disallow: [], allow: [] };

/** Rules of the `User-agent: *` group, plus every `Sitemap:` line. */
export function parseRobots(txt: string): RobotsRules {
  const rules: RobotsRules = { sitemaps: [], disallow: [], allow: [] };
  let applies = false;
  let inAgentBlock = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "sitemap") {
      if (value) rules.sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      // Consecutive User-agent lines share one group.
      applies = inAgentBlock ? applies || value === "*" : value === "*";
      inAgentBlock = true;
      continue;
    }
    inAgentBlock = false;
    if (!applies || !value) continue;
    if (key === "disallow") rules.disallow.push(value);
    else if (key === "allow") rules.allow.push(value);
  }
  return rules;
}

function ruleRegex(rule: string): RegExp {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; a tie goes to Allow. */
export function isDisallowed(pathAndQuery: string, rules: RobotsRules): boolean {
  const longest = (list: string[]) =>
    list.reduce((best, r) => (r.length > best && ruleRegex(r).test(pathAndQuery) ? r.length : best), -1);
  const d = longest(rules.disallow);
  return d >= 0 && d > longest(rules.allow);
}

export function parseSitemap(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  return /<sitemapindex[\s>]/i.test(xml) ? { urls: [], sitemaps: locs } : { urls: locs, sitemaps: [] };
}

/** Opening order. `external` sits right after reservation: a booking vendor page states the deposit policy. */
export const TYPE_PRIORITY: PageType[] = [
  "reservation",
  "external",
  "menu",
  "order",
  "events",
  "faq",
  "locations",
  "contact",
  "about",
  "other",
];

export const TYPE_CAPS: Record<string, number> = {
  reservation: 4,
  external: 5,
  menu: 6,
  order: 3,
  events: 3,
  faq: 3,
  locations: 6,
  contact: 2,
  about: 2,
  other: 3,
};

export const MAX_SITEMAP_CANDIDATES = 150;

export function sitemapCandidates(urls: string[], home: URL, max = MAX_SITEMAP_CANDIDATES): Candidate[] {
  const out: Candidate[] = [];
  for (const raw of urls) {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    if (siteKey(u.hostname) !== siteKey(home.hostname)) continue;
    const type = classifyUrl(u, null, home);
    if (!type || type === "home" || type === "external") continue;
    out.push({ url: u.href, type, source: "sitemap", depth: 1, linkText: null });
  }
  out.sort((a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type));
  return out.slice(0, max);
}

const KNOWN_PATHS: Array<[PageType, string[]]> = [
  ["reservation", ["/reservations", "/book"]],
  ["menu", ["/menu", "/menus"]],
  ["faq", ["/faq", "/faqs"]],
  ["events", ["/private-dining", "/group-bookings"]],
  ["locations", ["/locations"]],
  ["contact", ["/contact"]],
];

/** Probe the usual paths, but only for types no link or sitemap entry was found for. */
export function knownPathCandidates(home: URL, hasType: (t: PageType) => boolean): Candidate[] {
  const out: Candidate[] = [];
  for (const [type, paths] of KNOWN_PATHS) {
    if (hasType(type)) continue;
    for (const p of paths) out.push({ url: new URL(p, home).href, type, source: "known_path", depth: 1, linkText: null });
  }
  return out;
}

const SOURCE_RANK: Record<CandidateSource, number> = { home_link: 0, page_link: 1, sitemap: 2, known_path: 3 };

function rank(c: Candidate): number {
  const type = TYPE_PRIORITY.indexOf(c.type);
  return (c.pinned ? 0 : 1) * 1_000_000 + (type === -1 ? 99 : type) * 10_000 + c.depth * 100 + SOURCE_RANK[c.source];
}

/** The queue of addresses still to open, with the per-type and total caps. */
export class Frontier {
  private readonly queue: Candidate[] = [];
  private readonly seen = new Set<string>();
  private readonly taken = new Map<PageType, number>();
  private total = 0;

  /** `maxPages` excludes the homepage (the caller already has it). */
  constructor(private readonly maxPages: number) {}

  markSeen(url: string): void {
    const k = urlKey(url);
    if (k) this.seen.add(k);
  }

  /** Queues the candidates not seen before and returns them. */
  add(candidates: Candidate[]): Candidate[] {
    const added: Candidate[] = [];
    for (const c of candidates) {
      const k = urlKey(c.url);
      if (!k || this.seen.has(k)) continue;
      this.seen.add(k);
      this.queue.push(c);
      added.push(c);
    }
    return added;
  }

  hasType(type: PageType): boolean {
    return (this.taken.get(type) ?? 0) > 0 || this.queue.some((c) => c.type === type);
  }

  private capReached(c: Candidate): boolean {
    return !c.pinned && (this.taken.get(c.type) ?? 0) >= (TYPE_CAPS[c.type] ?? 0);
  }

  next(): Candidate | null {
    if (this.total >= this.maxPages) return null;
    let best = -1;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.capReached(this.queue[i])) continue;
      if (best === -1 || rank(this.queue[i]) < rank(this.queue[best])) best = i;
    }
    if (best === -1) return null;
    const [c] = this.queue.splice(best, 1);
    this.taken.set(c.type, (this.taken.get(c.type) ?? 0) + 1);
    this.total++;
    return c;
  }

  /**
   * A handed-out candidate turned out to be another type (a link that
   * redirected to a vendor page): moves its slot from `c.type` to `to` and
   * sets `c.type = to`, so a later `refund(c)` gives back the right slot.
   * Refuses (changes nothing, returns false) when `to` is at its cap; a
   * pinned candidate is exempt from type caps, as in `next()`.
   */
  retype(c: Candidate, to: PageType): boolean {
    if (c.type === to) return true;
    if (!c.pinned && (this.taken.get(to) ?? 0) >= (TYPE_CAPS[to] ?? 0)) return false;
    this.taken.set(c.type, Math.max(0, (this.taken.get(c.type) ?? 0) - 1));
    this.taken.set(to, (this.taken.get(to) ?? 0) + 1);
    c.type = to;
    return true;
  }

  /** A page that was not read (failed, duplicate, disallowed) does not use up a slot. */
  refund(c: Candidate): void {
    this.taken.set(c.type, Math.max(0, (this.taken.get(c.type) ?? 0) - 1));
    this.total = Math.max(0, this.total - 1);
  }

  /** Empties the queue; every leftover gets the reason it was not opened. */
  rest(): Array<{ candidate: Candidate; reason: "limit_total" | "limit_type" | "budget" }> {
    const out = this.queue.map((candidate) => ({
      candidate,
      reason:
        this.total >= this.maxPages
          ? ("limit_total" as const)
          : this.capReached(candidate)
            ? ("limit_type" as const)
            : ("budget" as const),
    }));
    this.queue.length = 0;
    return out;
  }
}
