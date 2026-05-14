/**
 * Truth Layer v1 / T-E — orchestrator tests for
 * `src/lib/agent-workers/website-multi-verify.ts`.
 *
 * The orchestrator is a pure function: every test injects a stub
 * `WebsiteMultiVerifyRunners` bag rather than mocking the real Apify
 * wrappers. We assert on three axes:
 *   1. Status fan-out — does the result match the canonical
 *      contract deriver for the given source mix?
 *   2. Short-circuit — when source 1 (or 2) returns `present` the
 *      orchestrator stops calling subsequent runners.
 *   3. Companies-House skip behaviour — non-GB leads must reach the
 *      runner (which itself short-circuits to "error") so the
 *      negative-count tally on a non-GB lead caps at 2 absents.
 *
 * Fixture coverage (tests/fixtures/leads):
 *   - greenwich-morning  — GB, websiteUrl null. Triggers the full
 *     3-source fan-out path.
 *   - casa-polanco       — websiteUrl set. Triggers the
 *     google_business_field short-circuit path.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  multiVerifyWebsite,
  type WebsiteMultiVerifyInput,
  type WebsiteMultiVerifyRunners,
} from "@/lib/agent-workers/website-multi-verify";
import type { WebsiteVerificationSourceCheck } from "@/lib/sdr-brain/contracts";

// Inline fixtures (mirrors the relevant slice of
// `tests/fixtures/leads/{greenwich-morning,casa-polanco}.json`).
// We don't import the JSON directly because `tsconfig.json` excludes
// `src/__tests__/**` from the compile graph and vitest occasionally
// chokes on relative JSON paths under `resolveJsonModule` — keeping
// the inputs inline makes the test deterministic.

function check(
  name: WebsiteVerificationSourceCheck["name"],
  result: WebsiteVerificationSourceCheck["result"],
  url: string | null = null,
): WebsiteVerificationSourceCheck {
  return { name, result, url, checkedAt: new Date().toISOString() };
}

interface RunnerSpies {
  bing: ReturnType<typeof vi.fn>;
  ch: ReturnType<typeof vi.fn>;
  ig: ReturnType<typeof vi.fn>;
}

function makeRunners(
  responses: Partial<{
    bing: WebsiteVerificationSourceCheck;
    ch: WebsiteVerificationSourceCheck;
    ig: WebsiteVerificationSourceCheck;
  }>,
): { runners: WebsiteMultiVerifyRunners; spies: RunnerSpies } {
  const spies: RunnerSpies = {
    bing: vi
      .fn()
      .mockResolvedValue(responses.bing ?? check("bing_brand_search", "absent")),
    ch: vi
      .fn()
      .mockResolvedValue(responses.ch ?? check("companies_house", "absent")),
    ig: vi.fn().mockResolvedValue(responses.ig ?? check("instagram_bio", "absent")),
  };
  return {
    runners: {
      bingBrandSearch: spies.bing,
      companiesHouse: spies.ch,
      instagramBio: spies.ig,
    },
    spies,
  };
}

const greenwichInput: WebsiteMultiVerifyInput = {
  businessName: "Greenwich Morning",
  formattedAddress: "12 Greenwich High Rd, London SE10 8JL, United Kingdom",
  country: "GB",
  websiteUrl: null,
};

const casaInput: WebsiteMultiVerifyInput = {
  businessName: "Casa Polanco",
  formattedAddress:
    "Av. Presidente Masaryk 421, Polanco, 11550 Ciudad de México, México",
  country: "MX",
  websiteUrl: "https://casapolanco.example",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("multiVerifyWebsite — Source 1 short-circuit (Casa Polanco)", () => {
  it("returns confirmed_present without calling any Apify runner when lead.websiteUrl is set", async () => {
    const { runners, spies } = makeRunners({});
    const result = await multiVerifyWebsite(casaInput, runners);

    expect(result.status).toBe("confirmed_present");
    expect(result.resolvedUrl).toBe(casaInput.websiteUrl);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({
      name: "google_business_field",
      result: "present",
      url: casaInput.websiteUrl,
    });
    expect(spies.bing).not.toHaveBeenCalled();
    expect(spies.ch).not.toHaveBeenCalled();
    expect(spies.ig).not.toHaveBeenCalled();
  });
});

describe("multiVerifyWebsite — Source 2 (Bing) short-circuit", () => {
  it("returns confirmed_present and skips Companies House + Instagram when Bing finds an owned domain", async () => {
    const { runners, spies } = makeRunners({
      bing: check("bing_brand_search", "present", "https://greenwichmorning.test"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);

    expect(result.status).toBe("confirmed_present");
    expect(result.resolvedUrl).toBe("https://greenwichmorning.test");
    expect(spies.bing).toHaveBeenCalledTimes(1);
    expect(spies.ch).not.toHaveBeenCalled();
    expect(spies.ig).not.toHaveBeenCalled();
    expect(result.sources.map((s) => s.name)).toEqual(["bing_brand_search"]);
  });
});

describe("multiVerifyWebsite — Greenwich GB (websiteUrl null)", () => {
  it("runs all 3 non-Google sources and returns confirmed_absent when all 3 return absent", async () => {
    const { runners, spies } = makeRunners({});
    const result = await multiVerifyWebsite(greenwichInput, runners);

    expect(spies.bing).toHaveBeenCalledTimes(1);
    expect(spies.ch).toHaveBeenCalledTimes(1);
    expect(spies.ig).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("confirmed_absent");
    expect(result.sources).toHaveLength(3);
    expect(result.resolvedUrl).toBeNull();
  });

  it("returns uncertain when 2 sources return absent + 1 errors", async () => {
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "absent"),
      ch: check("companies_house", "error"),
      ig: check("instagram_bio", "absent"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("uncertain");
    const negatives = result.sources.filter((s) => s.result === "absent").length;
    expect(negatives).toBe(2);
  });

  it("returns uncertain when only 1 source returns absent (Bing) and others error", async () => {
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "absent"),
      ch: check("companies_house", "error"),
      ig: check("instagram_bio", "error"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("uncertain");
  });
});

describe("multiVerifyWebsite — Companies House non-GB skip", () => {
  it("orchestrator still calls the Companies House runner; runner is responsible for the country gate", async () => {
    // Mexico (non-GB). Casa Polanco fixture has websiteUrl set so we
    // construct a synthetic non-GB websiteUrl-less lead instead.
    const input: WebsiteMultiVerifyInput = {
      businessName: "Casa Polanco",
      formattedAddress: "Av. Presidente Masaryk 421, Polanco, México",
      country: "MX",
      websiteUrl: null,
    };
    const { runners, spies } = makeRunners({
      ch: check("companies_house", "error"),
    });
    const result = await multiVerifyWebsite(input, runners);

    expect(spies.bing).toHaveBeenCalledTimes(1);
    expect(spies.ch).toHaveBeenCalledTimes(1);
    expect(spies.ig).toHaveBeenCalledTimes(1);
    // 2 absent (bing + ig) + 1 error (ch) → uncertain.
    expect(result.status).toBe("uncertain");
    const errors = result.sources.filter((s) => s.result === "error").length;
    expect(errors).toBe(1);
  });
});

describe("multiVerifyWebsite — Apify rate-limit / actor failure resilience", () => {
  it("does not let an 'error' source push the result to confirmed_absent", async () => {
    // 1 absent + 2 errors → 1 negative → uncertain (not absent).
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "absent"),
      ch: check("companies_house", "error"),
      ig: check("instagram_bio", "error"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("uncertain");
  });

  it("Source 4 returning present still wins after sources 2 + 3 errored", async () => {
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "error"),
      ch: check("companies_house", "error"),
      ig: check("instagram_bio", "present", "https://instagram-bio.test"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("confirmed_present");
    expect(result.resolvedUrl).toBe("https://instagram-bio.test");
  });
});

describe("multiVerifyWebsite — single-negative deriver semantics", () => {
  it("single negative source returns uncertain (≥3 negatives required for confirmed_absent)", async () => {
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "absent"),
      ch: check("companies_house", "error"),
      ig: check("instagram_bio", "error"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("uncertain");
    const negatives = result.sources.filter((s) => s.result === "absent").length;
    expect(negatives).toBe(1);
  });

  it("3 absent sources → confirmed_absent", async () => {
    const { runners } = makeRunners({
      bing: check("bing_brand_search", "absent"),
      ch: check("companies_house", "absent"),
      ig: check("instagram_bio", "absent"),
    });
    const result = await multiVerifyWebsite(greenwichInput, runners);
    expect(result.status).toBe("confirmed_absent");
    const negatives = result.sources.filter((s) => s.result === "absent").length;
    expect(negatives).toBe(3);
  });
});
