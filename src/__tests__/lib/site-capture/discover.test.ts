// src/__tests__/lib/site-capture/discover.test.ts
import { describe, expect, it } from "vitest";
import {
  Frontier,
  isDisallowed,
  knownPathCandidates,
  MAX_SITEMAP_CANDIDATES,
  parseRobots,
  parseSitemap,
  sitemapCandidates,
} from "@/lib/site-capture/discover";
import type { Candidate, PageType } from "@/lib/site-capture/types";

const HOME = new URL("https://bistro.test/");
const cand = (path: string, type: PageType, extra: Partial<Candidate> = {}): Candidate => ({
  url: `https://bistro.test${path}`,
  type,
  source: "home_link",
  depth: 1,
  linkText: null,
  ...extra,
});

describe("parseRobots / isDisallowed", () => {
  const rules = parseRobots(
    [
      "User-agent: Googlebot",
      "Disallow: /google-only",
      "",
      "User-agent: *",
      "Disallow: /private/",
      "Disallow: /*.json$",
      "Allow: /private/menu",
      "# a comment",
      "Sitemap: https://bistro.test/sitemap.xml",
    ].join("\n"),
  );

  it("reads only the * group and every Sitemap line", () => {
    expect(rules.disallow).toEqual(["/private/", "/*.json$"]);
    expect(rules.allow).toEqual(["/private/menu"]);
    expect(rules.sitemaps).toEqual(["https://bistro.test/sitemap.xml"]);
  });

  it("applies prefix rules, wildcards and end anchors; the longest match wins", () => {
    expect(isDisallowed("/private/staff", rules)).toBe(true);
    expect(isDisallowed("/private/menu", rules)).toBe(false);
    expect(isDisallowed("/data/feed.json", rules)).toBe(true);
    expect(isDisallowed("/data/feed.json?x=1", rules)).toBe(false);
    expect(isDisallowed("/google-only", rules)).toBe(false);
    expect(isDisallowed("/menu", rules)).toBe(false);
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(isDisallowed("/menu", parseRobots("User-agent: *\nDisallow:"))).toBe(false);
  });
});

describe("parseSitemap", () => {
  it("reads <loc> entries from a url set, including CDATA and &amp;", () => {
    const xml = `<urlset><url><loc>https://bistro.test/menu</loc></url>
      <url><loc><![CDATA[https://bistro.test/faq?a=1&b=2]]></loc></url>
      <url><loc> https://bistro.test/x?a=1&amp;b=2 </loc></url></urlset>`;
    expect(parseSitemap(xml)).toEqual({
      urls: ["https://bistro.test/menu", "https://bistro.test/faq?a=1&b=2", "https://bistro.test/x?a=1&b=2"],
      sitemaps: [],
    });
  });
  it("returns nested sitemaps from an index", () => {
    const xml = `<sitemapindex><sitemap><loc>https://bistro.test/pages.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemap(xml)).toEqual({ urls: [], sitemaps: ["https://bistro.test/pages.xml"] });
  });
});

describe("sitemapCandidates", () => {
  it("keeps typed same-site pages, drops noise and foreign hosts", () => {
    const out = sitemapCandidates(
      ["https://bistro.test/faq", "https://bistro.test/blog/post", "https://other.test/menu", "https://bistro.test/"],
      HOME,
    );
    expect(out.map((c) => [c.url, c.type, c.source])).toEqual([["https://bistro.test/faq", "faq", "sitemap"]]);
  });

  // Review Focus 2: a chain's sitemap lists thousands of addresses.
  it("admits at most 150 candidates, highest-priority types first", () => {
    const urls = [
      ...Array.from({ length: 3000 }, (_, i) => `https://bistro.test/dish-${i}`),
      "https://bistro.test/reservations",
    ];
    const out = sitemapCandidates(urls, HOME);
    expect(out).toHaveLength(MAX_SITEMAP_CANDIDATES);
    expect(out[0].type).toBe("reservation");
  });
});

describe("knownPathCandidates", () => {
  it("probes only the types nothing was found for", () => {
    const out = knownPathCandidates(HOME, (t) => t === "menu" || t === "reservation");
    expect(out.every((c) => c.source === "known_path")).toBe(true);
    expect(out.map((c) => c.type)).not.toContain("menu");
    expect(out.map((c) => c.type)).not.toContain("reservation");
    expect(out.map((c) => new URL(c.url).pathname)).toEqual(
      expect.arrayContaining(["/faq", "/private-dining", "/locations", "/contact"]),
    );
  });
});

describe("Frontier", () => {
  it("hands out pinned pages first, then by type priority, depth and source", () => {
    const f = new Frontier(39);
    f.add([
      cand("/about", "about"),
      cand("/menu", "menu", { pinned: true }),
      cand("/faq", "faq"),
      cand("/book", "reservation", { depth: 2, source: "page_link" }),
      cand("/reserve", "reservation"),
    ]);
    const order = [f.next(), f.next(), f.next(), f.next(), f.next()].map((c) => new URL(c!.url).pathname);
    expect(order).toEqual(["/menu", "/reserve", "/book", "/faq", "/about"]);
    expect(f.next()).toBeNull();
  });

  it("drops an address it has already seen, whatever its scheme or trailing slash", () => {
    const f = new Frontier(39);
    f.markSeen("https://bistro.test/");
    const added = f.add([cand("/", "other"), cand("/faq", "faq"), cand("/faq/", "faq")]);
    expect(added.map((c) => c.url)).toEqual(["https://bistro.test/faq"]);
  });

  it("enforces the per-type cap and reports why the rest was left", () => {
    const f = new Frontier(39);
    f.add(Array.from({ length: 10 }, (_, i) => cand(`/menu-${i}`, "menu")));
    const taken: Candidate[] = [];
    for (let c = f.next(); c; c = f.next()) taken.push(c);
    expect(taken).toHaveLength(6);
    const rest = f.rest();
    expect(rest).toHaveLength(4);
    expect(rest.every((r) => r.reason === "limit_type")).toBe(true);
  });

  it("stops at the total cap and gives a slot back on refund", () => {
    const f = new Frontier(2);
    f.add([cand("/a", "faq"), cand("/b", "faq"), cand("/c", "faq")]);
    const first = f.next()!;
    f.next();
    expect(f.next()).toBeNull();
    f.refund(first);
    expect(new URL(f.next()!.url).pathname).toBe("/c");
    expect(f.rest()).toEqual([]);
  });

  it("labels leftovers as limit_total once the total cap is reached", () => {
    const f = new Frontier(1);
    f.add([cand("/a", "faq"), cand("/b", "contact")]);
    f.next();
    expect(f.rest().map((r) => r.reason)).toEqual(["limit_total"]);
  });

  describe("retype", () => {
    it("moves the slot to the new type and relabels the candidate", () => {
      const f = new Frontier(39);
      f.add([cand("/book", "reservation")]);
      const c = f.next()!;
      expect(f.retype(c, "external")).toBe(true);
      expect(c.type).toBe("external");
      expect(f.hasType("external")).toBe(true);
      expect(f.hasType("reservation")).toBe(false);
    });

    it("refuses at the new type's cap and changes nothing", () => {
      const f = new Frontier(39);
      f.add([...Array.from({ length: 5 }, (_, i) => cand(`/v-${i}`, "external")), cand("/book", "reservation")]);
      // Reservation outranks external, so it is handed out first; then the five vendor pages fill the cap.
      const c = f.next()!;
      expect(c.type).toBe("reservation");
      for (let i = 0; i < 5; i++) expect(f.next()!.type).toBe("external");
      expect(f.retype(c, "external")).toBe(false);
      expect(c.type).toBe("reservation");
      // The reservation slot is still charged: three more fit under its cap of 4, not four.
      f.add(Array.from({ length: 4 }, (_, i) => cand(`/res-${i}`, "reservation")));
      const more: Candidate[] = [];
      for (let n = f.next(); n; n = f.next()) more.push(n);
      expect(more).toHaveLength(3);
    });

    it("gives the original type's cap room again after a successful retype", () => {
      const f = new Frontier(39);
      f.add(Array.from({ length: 4 }, (_, i) => cand(`/res-${i}`, "reservation")));
      const taken = [f.next()!, f.next()!, f.next()!, f.next()!];
      f.add([cand("/res-extra", "reservation")]);
      expect(f.next()).toBeNull();
      expect(f.retype(taken[0], "external")).toBe(true);
      expect(new URL(f.next()!.url).pathname).toBe("/res-extra");
    });

    it("always lets a pinned candidate through and keeps its refund balanced", () => {
      const f = new Frontier(39);
      f.add([...Array.from({ length: 5 }, (_, i) => cand(`/v-${i}`, "external")), cand("/menu", "menu", { pinned: true })]);
      const pinned = f.next()!;
      expect(pinned.pinned).toBe(true);
      const vendors = [f.next()!, f.next()!, f.next()!, f.next()!, f.next()!];
      expect(f.retype(pinned, "external")).toBe(true);
      f.refund(pinned);
      // The refund gave back exactly the pinned page's slot: external is at its cap of 5 again, not below.
      f.add([cand("/v-extra", "external")]);
      expect(f.next()).toBeNull();
      f.refund(vendors[0]);
      expect(new URL(f.next()!.url).pathname).toBe("/v-extra");
    });
  });
});
