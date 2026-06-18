/**
 * ICP draft sanitization + mapping into the IdealCustomerProfile shape.
 */
import { describe, expect, it } from "vitest";
import {
  sanitizeIcpDraft,
  mapIcpDraftToProfile,
  buildIcpSourceJson,
} from "@/lib/onboarding/icp";

describe("sanitizeIcpDraft", () => {
  it("clamps numbers and coerces arrays", () => {
    const draft = sanitizeIcpDraft({
      description: "  Best fit  ",
      minRating: 9,
      priceLevelMin: -2,
      priceLevelMax: 7,
      minReviewCount: 1.7,
      highValueSignals: ["multi-location", 5, "", "ok"],
      negativeSignals: "nope",
      confidence: 2,
    });
    expect(draft.description).toBe("Best fit");
    expect(draft.minRating).toBe(5);
    expect(draft.priceLevelMin).toBe(0);
    expect(draft.priceLevelMax).toBe(4);
    expect(draft.minReviewCount).toBe(2);
    expect(draft.highValueSignals).toEqual(["multi-location", "ok"]);
    expect(draft.negativeSignals).toEqual([]);
    expect(draft.confidence).toBe(1);
  });

  it("defaults missing fields safely", () => {
    const draft = sanitizeIcpDraft(null);
    expect(draft.description).toBe("");
    expect(draft.industryWeights).toEqual({});
    expect(draft.highValueSignals).toEqual([]);
    expect(draft.minRating).toBeNull();
    expect(draft.sources).toBeUndefined();
  });

  it("keeps well-formed sources only", () => {
    const draft = sanitizeIcpDraft({
      description: "x",
      sources: [
        { url: "https://a.com", evidence: "hello" },
        { evidence: "no url" },
        { url: "https://b.com" },
      ],
    });
    expect(draft.sources).toEqual([
      { url: "https://a.com", evidence: "hello" },
      { url: "https://b.com", evidence: "" },
    ]);
  });
});

describe("mapIcpDraftToProfile", () => {
  it("maps description to null when empty and excludes draft-only fields", () => {
    const profile = mapIcpDraftToProfile(sanitizeIcpDraft({ description: "" }));
    expect(profile.description).toBeNull();
    expect(profile).not.toHaveProperty("confidence");
    expect(profile).not.toHaveProperty("sources");
  });
});

describe("buildIcpSourceJson", () => {
  it("captures confidence + sources provenance", () => {
    const draft = sanitizeIcpDraft({
      description: "x",
      confidence: 0.8,
      sources: [{ url: "https://a.com", evidence: "e" }],
    });
    const json = buildIcpSourceJson(draft) as {
      confidence: number;
      sources: unknown[];
      extractedAt: string;
    };
    expect(json.confidence).toBe(0.8);
    expect(json.sources).toHaveLength(1);
    expect(typeof json.extractedAt).toBe("string");
  });
});
