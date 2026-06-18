/**
 * Onboarding domain + pricing URL normalization.
 */
import { describe, expect, it } from "vitest";
import {
  extractHostname,
  normalizeCompanyDomain,
  normalizePricingUrl,
} from "@/lib/onboarding/url";

describe("extractHostname", () => {
  it("strips protocol, www, path and lowercases", () => {
    expect(extractHostname("https://www.Example.com/pricing")).toBe("example.com");
    expect(extractHostname("Example.COM")).toBe("example.com");
    expect(extractHostname("  http://sub.example.co.uk/x  ")).toBe("sub.example.co.uk");
  });

  it("rejects hosts without a dot and empty input", () => {
    expect(extractHostname("localhost")).toBeNull();
    expect(extractHostname("")).toBeNull();
    expect(extractHostname("   ")).toBeNull();
  });
});

describe("normalizeCompanyDomain", () => {
  it("returns canonical https origin", () => {
    expect(normalizeCompanyDomain("example.com")).toBe("https://example.com");
    expect(normalizeCompanyDomain("www.example.com/about")).toBe("https://example.com");
  });

  it("returns null for garbage", () => {
    expect(normalizeCompanyDomain("not a domain")).toBeNull();
    expect(normalizeCompanyDomain("")).toBeNull();
  });
});

describe("normalizePricingUrl", () => {
  it("keeps the full path and forces https", () => {
    expect(normalizePricingUrl("example.com/pricing")).toBe("https://example.com/pricing");
    expect(normalizePricingUrl("http://example.com/plans")).toBe("https://example.com/plans");
  });

  it("returns null for unparseable input", () => {
    expect(normalizePricingUrl("")).toBeNull();
    expect(normalizePricingUrl("javascript:alert(1)")).toBeNull();
  });
});
