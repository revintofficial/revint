/**
 * Operator detection: single venue, owner-run small group, chain,
 * hotel restaurant. Pure, no I/O.
 */
import { describe, expect, it } from "vitest";
import { CHAIN_MIN_LOCATIONS, detectOperator, ownSiteHost } from "@/lib/ai-core/agent/operator";

describe("detectOperator — hotel restaurants", () => {
  it("reads the Google type", () => {
    const r = detectOperator({ businessName: "Lobby Lounge", primaryType: "hotel" });
    expect(r).toMatchObject({ operator: "hotel_fnb", evidence: "harita — Google tipi: hotel" });
  });

  it("reads a hotel brand domain", () => {
    const r = detectOperator({
      businessName: "Tuğra Restaurant",
      primaryType: "restaurant",
      websiteUrl: "https://www.kempinski.com/en/ciragan-palace/restaurants-bars/tugra",
    });
    expect(r).toMatchObject({ operator: "hotel_fnb", evidence: "kempinski.com — otel alan adı" });
  });

  it("reads a hotel brand or the word hotel in the name", () => {
    expect(detectOperator({ businessName: "Tuğra Restaurant - Çırağan Palace Kempinski" }).operator).toBe("hotel_fnb");
    expect(detectOperator({ businessName: "The Grill at The Dorchester Hotel" }).operator).toBe("hotel_fnb");
    expect(detectOperator({ businessName: "Bosphorus Oteli Teras" }).operator).toBe("hotel_fnb");
  });

  it("reads a hotel in the address", () => {
    const r = detectOperator({ businessName: "Aqua", address: "Hilton Istanbul Bomonti Hotel, Silahşör Cd. 42, Şişli" });
    expect(r.operator).toBe("hotel_fnb");
    expect(r.evidence).toContain("adres");
  });

  it("takes the site audit's hotel hint", () => {
    const r = detectOperator({ businessName: "Azur", siteHotelHint: "https://x.example/rooms — \"Book a room\"" });
    expect(r.operator).toBe("hotel_fnb");
  });

  it("reads a hotel's own site from its path", () => {
    const stRegis = detectOperator({ businessName: "Spago", websiteUrl: "https://stay.example/en-us/hotels/istxr/dining/" });
    expect(stRegis.operator).toBe("hotel_fnb");
    // Two venues under /dining/ on one site: a hotel's restaurants.
    const ic = detectOperator({ businessName: "Kinaara", websiteUrl: "https://iclondon-theo2.com/dining/kinaara-london", sameSiteLocations: 2 });
    expect(ic).toMatchObject({ operator: "hotel_fnb", evidence: "iclondon-theo2.com/dining/kinaara-london — otel yemek sayfası" });
    // One venue with a /dining/ page of its own is not enough.
    expect(detectOperator({ businessName: "Azur", websiteUrl: "https://azur.example/dining/private-room" }).operator).toBe("single");
    // A restaurant group's /restaurants/<branch> page is not a hotel path.
    expect(detectOperator({ businessName: "Brasserie X", websiteUrl: "https://brasseriex.com/restaurants/soho", sameSiteLocations: 3 }).operator).toBe("small_group");
  });

  it("does not call a venue a hotel because a brand is inside another word", () => {
    expect(detectOperator({ businessName: "Hiltonia Kebab" }).operator).toBe("single");
    expect(detectOperator({ businessName: "Mother's Kitchen" }).operator).toBe("single");
  });
});

describe("detectOperator — chains and groups", () => {
  it("knows a centrally run brand by the start of the name", () => {
    expect(detectOperator({ businessName: "Gaucho Piccadilly" })).toMatchObject({ operator: "chain" });
    expect(detectOperator({ businessName: "Nando's Soho" }).operator).toBe("chain");
    expect(detectOperator({ businessName: "Dominos Pizza Kadıköy" }).operator).toBe("chain");
    expect(detectOperator({ businessName: "The Ivy Chelsea Garden" }).operator).toBe("chain");
  });

  it("leaves a namesake alone when the brand is not at the start", () => {
    expect(detectOperator({ businessName: "El Gaucho Steakhouse" }).operator).toBe("single");
    expect(detectOperator({ businessName: "Madonna Pizza" }).operator).toBe("single");
  });

  it("counts locations: 2-5 is a small group, 6 or more a chain", () => {
    const group = detectOperator({ businessName: "Brasserie X", websiteUrl: "https://brasseriex.co.uk", sameSiteLocations: 3 });
    expect(group).toMatchObject({ operator: "small_group", locationCount: 3, evidence: "brasseriex.co.uk — aynı alan adında 3 şube" });
    const chain = detectOperator({ businessName: "Brasserie X", accountLocations: CHAIN_MIN_LOCATIONS });
    expect(chain).toMatchObject({ operator: "chain", locationCount: CHAIN_MIN_LOCATIONS });
    expect(chain.evidence).toBe(`harita — aynı hesapta ${CHAIN_MIN_LOCATIONS} şube`);
  });

  it("uses the largest count and names where it was seen", () => {
    const r = detectOperator({
      businessName: "Trattoria Y",
      websiteUrl: "https://trattoriay.com",
      accountLocations: 1,
      sameSiteLocations: 2,
      siteLocations: 4,
      siteLocationsUrl: "https://trattoriay.com/locations",
    });
    expect(r).toMatchObject({ operator: "small_group", locationCount: 4, evidence: "https://trattoriay.com/locations — sitede 4 lokasyon" });
  });

  it("a venue with nothing else known is single, with one location and no evidence", () => {
    expect(detectOperator({ businessName: "Lokanta Z" })).toEqual({ operator: "single", evidence: null, locationCount: 1 });
  });
});

describe("ownSiteHost", () => {
  it("returns the bare host of the venue's own site", () => {
    expect(ownSiteHost("https://www.Brasserie-X.co.uk/menu")).toBe("brasserie-x.co.uk");
    expect(ownSiteHost("brasseriex.com")).toBe("brasseriex.com");
  });

  it("never treats a shared host as the venue's own", () => {
    for (const url of [
      "https://www.instagram.com/lokantaz",
      "https://facebook.com/lokantaz",
      "https://linktr.ee/lokantaz",
      "https://lokantaz.wixsite.com/home",
      "https://www.opentable.co.uk/r/lokanta-z",
    ]) {
      expect(ownSiteHost(url)).toBeNull();
    }
    expect(ownSiteHost(null)).toBeNull();
    expect(ownSiteHost("not a url")).toBeNull();
  });
});
