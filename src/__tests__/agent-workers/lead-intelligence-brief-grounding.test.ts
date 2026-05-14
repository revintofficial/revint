/**
 * Truth Layer v1 — T-D Brief Truth-Grounding: pain-point grounding tests.
 *
 * Master plan §3 T-D bullet 1: every `painPoints[i]` produced by the
 * brief writer MUST be source-grounded — `source` ∈
 * `"review_quote" | "owner_reply" | "missing_field"`. The prompt tells
 * Gemini to skip an item it cannot ground; the post-validator inside
 * `runBriefV2Pipeline` rejects (or promotes) anything that comes back
 * with `source === "inferred"` or with an evidenceRef shape that
 * doesn't match the discriminant.
 *
 * Test surface (per the dispatch prompt + master plan §3 T-D DoD):
 *   - Pure validator semantics on every branch of the discriminated
 *     union (review_quote / owner_reply / missing_field / inferred).
 *   - Casa Polanco fixture: 2 grounded painPoints (one review_quote,
 *     one owner_reply) + 1 model-inferred hypothesis. Worker output
 *     keeps the grounded shape and promotes the inferred item to
 *     `hypotheses[]`.
 *   - Re-prompt path: when EVERY first-pass painPoint fails grounding,
 *     the worker re-prompts ONCE with the unsatisfied claims called
 *     out. The second-pass response (with grounded items) wins.
 *   - `truth.brief.pain_quoted` + `truth.brief.hypothesis_count`
 *     telemetry fires with the right counts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";
import {
  validateAndPromotePainPoints,
  computeGroundableMissingFields,
  runBriefV2Pipeline,
  clampSeverity,
  clampConfidence,
  type BriefPromptInput,
} from "@/lib/agent-workers/lead-intelligence-brief";

// ---------------------------------------------------------------------
// Gemini SDK mock — every test re-uses the same hoisted spy so we can
// assert call counts (re-prompt path) and queue distinct responses per
// test via `mockResolvedValueOnce`.
// ---------------------------------------------------------------------
const { generateContentSpy, infoSpy, warnSpy } = vi.hoisted(() => ({
  generateContentSpy: vi.fn(),
  infoSpy: vi.fn(),
  warnSpy: vi.fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return {
      getGenerativeModel: () => ({ generateContent: generateContentSpy }),
    };
  }),
  SchemaType: {
    OBJECT: "OBJECT",
    STRING: "STRING",
    NUMBER: "NUMBER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: infoSpy,
    warn: warnSpy,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// `gemini-keys` reads env at module load and caches a key pool — reset
// it between tests so we don't carry a stale key across runs.
beforeEach(async () => {
  process.env.GEMINI_API_KEY = "test-key";
  const { _resetGeminiKeysForTests } = await import("@/lib/gemini-keys");
  _resetGeminiKeysForTests();
  generateContentSpy.mockReset();
  infoSpy.mockReset();
  warnSpy.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Build a `text()`-bearing fake Gemini response. Every spec fixture
 * needs the same shape; this helper keeps each `mockResolvedValueOnce`
 * line readable.
 */
function geminiResponse(payload: Record<string, unknown>): {
  response: { text: () => string; candidates: Array<{ finishReason: string }> };
} {
  return {
    response: {
      text: () => JSON.stringify(payload),
      candidates: [{ finishReason: "STOP" }],
    },
  };
}

/**
 * Minimal-but-realistic `BriefPromptInput` derived from the Casa
 * Polanco fixture. Tests append per-case overrides.
 */
function casaPromptInput(
  overrides: Partial<BriefPromptInput> = {},
): BriefPromptInput {
  const fx = loadLeadFixture("casa-polanco");
  return {
    businessName: fx.lead.businessName,
    niche: fx.workspace.niche,
    subNiche: fx.lead.subNicheSlug,
    address: fx.lead.formattedAddress,
    rating: fx.lead.rating,
    reviewCount: fx.lead.reviewCount,
    websiteUrl: fx.lead.websiteUrl,
    workspaceLanguage: "en",
    workspaceOffer: "FineDine F&B Suite",
    workspaceValueProp: "Online reservations + table mgmt",
    workspaceObjective: null,
    workspaceTone: null,
    workspaceOfferHook: null,
    workspaceSocialProof: null,
    workspaceSenderName: "Sam",
    activeCampaigns: [],
    matchedCampaignId: null,
    audit: null,
    auditChecklistText: "Audit summary: 6/8 checks passed (75%).",
    reviewAnalysis: fx.reviewAnalysis as unknown as Record<string, unknown>,
    salesOpportunity: null,
    socialProfiles: null,
    voiceNotes: [],
    dossierMarkdown: null,
    memorySnippets: [],
    agentRunSummaries: [],
    nicheLabel: "Fine dining",
    nichePitchAngle: "Reservation flow + table mgmt",
    preComputedConfidence: 71,
    websiteVerificationStatus: fx.lead
      .websiteVerificationStatus as BriefPromptInput["websiteVerificationStatus"],
    groundableMissingFields: computeGroundableMissingFields({
      phone: fx.lead.phone,
      websiteUrl: fx.lead.websiteUrl,
      websiteVerificationStatus: fx.lead
        .websiteVerificationStatus as BriefPromptInput["websiteVerificationStatus"],
      googleMapsUri: fx.lead.googleMapsUri,
      rating: fx.lead.rating,
      reviewCount: fx.lead.reviewCount,
      businessStatus: fx.lead.businessStatus,
    }),
    ...overrides,
  };
}

describe("validateAndPromotePainPoints — pure validator semantics", () => {
  it("accepts a valid review_quote pain point and preserves the typed shape", () => {
    const result = validateAndPromotePainPoints(
      [
        {
          claim: "reservations are hard to make",
          source: "review_quote",
          severity: 4,
          evidenceRef: {
            kind: "review",
            reviewId: "rev_42",
            quote: "we had to call 4 times to book a table",
          },
        },
      ],
      [],
    );
    expect(result.grounded).toHaveLength(1);
    const pp = result.grounded[0];
    expect(pp.source).toBe("review_quote");
    expect(pp.evidenceRef).toEqual({
      kind: "review",
      reviewId: "rev_42",
      quote: "we had to call 4 times to book a table",
    });
    expect(pp.severity).toBe(4);
    expect(result.promoted).toEqual([]);
  });

  it("accepts a valid owner_reply pain point", () => {
    const result = validateAndPromotePainPoints(
      [
        {
          claim: "owner publicly admits booking gap",
          source: "owner_reply",
          severity: 5,
          evidenceRef: {
            kind: "owner_reply",
            replyId: "rep_1",
            quote: "we are improving our reservation system",
          },
        },
      ],
      [],
    );
    expect(result.grounded).toHaveLength(1);
    expect(result.grounded[0].source).toBe("owner_reply");
    expect(result.grounded[0].evidenceRef).toMatchObject({
      kind: "owner_reply",
      replyId: "rep_1",
    });
  });

  it("accepts a missing_field pain point ONLY for fields in the groundable set", () => {
    const goodResult = validateAndPromotePainPoints(
      [
        {
          claim: "no published phone number on Google",
          source: "missing_field",
          severity: 3,
          evidenceRef: { kind: "missing_field", field: "phone" },
        },
      ],
      ["phone"],
    );
    expect(goodResult.grounded).toHaveLength(1);
    expect(goodResult.grounded[0].evidenceRef).toEqual({
      kind: "missing_field",
      field: "phone",
    });

    // Same claim but `phone` was never marked groundable (lead has a
    // phone) — the validator must reject the evidenceRef and promote
    // the claim to a hypothesis.
    const badResult = validateAndPromotePainPoints(
      [
        {
          claim: "no published phone number on Google",
          source: "missing_field",
          severity: 3,
          evidenceRef: { kind: "missing_field", field: "phone" },
        },
      ],
      [],
    );
    expect(badResult.grounded).toHaveLength(0);
    expect(badResult.promoted).toHaveLength(1);
    expect(badResult.promoted[0].claim).toBe(
      "no published phone number on Google",
    );
  });

  it("rejects review_quote with the WRONG evidenceRef.kind discriminant", () => {
    const result = validateAndPromotePainPoints(
      [
        {
          claim: "queue is too long at brunch",
          source: "review_quote",
          severity: 3,
          // owner_reply kind on a review_quote source — discriminant
          // mismatch. Validator must reject + promote.
          evidenceRef: {
            kind: "owner_reply",
            replyId: "rep_x",
            quote: "we are working on staffing",
          },
        },
      ],
      [],
    );
    expect(result.grounded).toEqual([]);
    expect(result.promoted).toHaveLength(1);
  });

  it("rejects review_quote with a missing reviewId or quote", () => {
    const result = validateAndPromotePainPoints(
      [
        {
          claim: "service is slow",
          source: "review_quote",
          severity: 3,
          evidenceRef: { kind: "review", reviewId: "", quote: "slow service" },
        },
        {
          claim: "service is slow #2",
          source: "review_quote",
          severity: 3,
          evidenceRef: { kind: "review", reviewId: "rev_1", quote: "" },
        },
      ],
      [],
    );
    expect(result.grounded).toHaveLength(0);
    expect(result.promoted).toHaveLength(2);
  });

  it("promotes inferred painPoints to hypotheses[] (the central T-D contract)", () => {
    const result = validateAndPromotePainPoints(
      [
        {
          claim: "rating is dropping suggests churn risk",
          source: "inferred",
          severity: 3,
          reasoning: "Quarter-over-quarter rating fell 0.4 stars",
          confidence: 0.6,
        },
      ],
      [],
    );
    expect(result.grounded).toEqual([]);
    expect(result.promoted).toHaveLength(1);
    expect(result.promoted[0]).toEqual({
      claim: "rating is dropping suggests churn risk",
      reasoning: "Quarter-over-quarter rating fell 0.4 stars",
      confidence: 0.6,
    });
  });

  it("drops items with empty / missing claims entirely (no silent garbage)", () => {
    const result = validateAndPromotePainPoints(
      [
        { claim: "", source: "review_quote", severity: 3 },
        { source: "review_quote", severity: 3 },
        null as unknown as Record<string, unknown>,
      ],
      [],
    );
    expect(result.grounded).toEqual([]);
    expect(result.promoted).toEqual([]);
    expect(result.dropped).toBe(3);
  });

  it("clamps severity to 1..5 and confidence to 0..1 on the output shape", () => {
    expect(clampSeverity(0)).toBe(1);
    expect(clampSeverity(99)).toBe(5);
    expect(clampSeverity(3.7)).toBe(4);
    expect(clampSeverity("not-a-number")).toBe(3);
    expect(clampConfidence(-0.2)).toBe(0);
    expect(clampConfidence(1.5)).toBe(1);
    expect(clampConfidence("nan")).toBe(0.5);
  });

  it("INVARIANT: no grounded painPoint can ever have source === 'inferred'", () => {
    // Property-style assertion across a wide raw input. Even when an
    // 'inferred' item slips into the responseSchema-validated payload,
    // the post-validator MUST move it out of `grounded`. This is the
    // exact invariant the master plan §3 T-D pins.
    const mixed = [
      {
        claim: "real grounded a",
        source: "review_quote",
        severity: 3,
        evidenceRef: {
          kind: "review",
          reviewId: "r1",
          quote: "verbatim quote",
        },
      },
      {
        claim: "inferred a",
        source: "inferred",
        severity: 4,
        reasoning: "model guess",
        confidence: 0.8,
      },
      {
        claim: "real grounded b",
        source: "owner_reply",
        severity: 2,
        evidenceRef: {
          kind: "owner_reply",
          replyId: "rep_2",
          quote: "we hear you",
        },
      },
      {
        claim: "inferred b",
        source: "inferred",
        severity: 1,
        reasoning: "vibes",
        confidence: 0.5,
      },
    ];
    const result = validateAndPromotePainPoints(mixed, []);
    for (const p of result.grounded) {
      expect(p.source).not.toBe("inferred");
    }
    expect(result.grounded.map((p) => p.claim)).toEqual([
      "real grounded a",
      "real grounded b",
    ]);
    expect(result.promoted.map((h) => h.claim)).toEqual([
      "inferred a",
      "inferred b",
    ]);
  });
});

describe("computeGroundableMissingFields — Lead column projection", () => {
  it("Greenwich Morning fixture (uncertain website): does NOT include websiteUrl as missing", () => {
    // T-D contract: a missing websiteUrl ONLY counts as evidence when
    // websiteVerificationStatus === "confirmed_absent". Greenwich's
    // status is "uncertain" → websiteUrl must NOT appear in the
    // groundable set, even though `lead.websiteUrl` is null.
    const fx = loadLeadFixture("greenwich-morning");
    const groundable = computeGroundableMissingFields({
      phone: fx.lead.phone,
      websiteUrl: fx.lead.websiteUrl,
      websiteVerificationStatus: fx.lead
        .websiteVerificationStatus as never,
      googleMapsUri: fx.lead.googleMapsUri,
      rating: fx.lead.rating,
      reviewCount: fx.lead.reviewCount,
      businessStatus: fx.lead.businessStatus,
    });
    expect(groundable).toContain("phone"); // null in fixture
    expect(groundable).not.toContain("websiteUrl"); // uncertain != confirmed_absent
  });

  it("includes websiteUrl when websiteUrl is null AND status is confirmed_absent", () => {
    const groundable = computeGroundableMissingFields({
      phone: "+44 20 1234 5678",
      websiteUrl: null,
      websiteVerificationStatus: "confirmed_absent",
      googleMapsUri: "https://example.com",
      rating: 4,
      reviewCount: 100,
      businessStatus: "OPERATIONAL",
    });
    expect(groundable).toEqual(["websiteUrl"]);
  });
});

describe("runBriefV2Pipeline — Casa Polanco fixture (grounded + inferred)", () => {
  it("keeps 2 grounded painPoints and promotes the model-inferred one to hypotheses[]", async () => {
    // Casa Polanco fixture purpose statement:
    //   T-D: 2 quoted painPoints + 1 hypothesis (model-inferred from
    //   rating drop).
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 71,
        confidenceBreakdown: { audit: 80, reviews: 64, opportunity: 70, weight: 1 },
        headline: "Booking friction + rating drop — strong target.",
        whyGoodTarget:
          "Casa Polanco has clear booking friction in recent reviews. The rating dipped 0.2 last quarter.",
        talkingPoints: [
          "Booking gap surfaces in reviews",
          "Owner already plans an OpenTable swap",
          "Rating dipped — momentum window is short",
        ],
        openerSeed: "Saw a few diners struggled to book — quick idea.",
        bestTimeToCall: "Mid-afternoon local time, after lunch service.",
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "Call lead now." },
        replyObjections: ["We already use OpenTable."],
        redFlags: [],
        evidence: [{ source: "review_analysis", note: "6/200 negs cite booking" }],
        confirmedPainPoints: [
          "reservations are hard to make",
          "owner publicly admits booking gap",
        ],
        confirmedMissingFeatures: ["online_reservations"],
        painPoints: [
          {
            claim: "reservations are hard to make",
            source: "review_quote",
            severity: 4,
            evidenceRef: {
              kind: "review",
              reviewId: "casa_rev_1",
              quote: "tuvimos que llamar 4 veces para reservar una mesa",
            },
          },
          {
            claim: "owner publicly admits booking gap",
            source: "owner_reply",
            severity: 4,
            evidenceRef: {
              kind: "owner_reply",
              replyId: "casa_reply_1",
              quote:
                "Estamos trabajando en mejorar nuestro sistema de reservas — pronto integraremos OpenTable.",
            },
          },
          {
            claim: "rating drop signals churn risk",
            source: "inferred",
            severity: 3,
            reasoning: "Rating dipped 0.2 stars QoQ; review velocity flat.",
            confidence: 0.6,
          },
        ],
        hypotheses: [],
      }),
    );

    const out = await runBriefV2Pipeline({
      input: casaPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_casa_polanco",
      workspaceId: "fixture_workspace_en",
    });

    // Two grounded painPoints — one review_quote, one owner_reply.
    expect(out.painPoints).toHaveLength(2);
    expect(out.painPoints?.[0]).toMatchObject({
      claim: "reservations are hard to make",
      source: "review_quote",
    });
    expect(out.painPoints?.[1]).toMatchObject({
      claim: "owner publicly admits booking gap",
      source: "owner_reply",
    });
    // The INVARIANT: no grounded painPoint may have source === "inferred".
    for (const p of out.painPoints ?? []) {
      expect(p.source).not.toBe("inferred");
    }
    // The inferred item was promoted to hypotheses[].
    expect(out.hypotheses).toHaveLength(1);
    expect(out.hypotheses?.[0]).toMatchObject({
      claim: "rating drop signals churn risk",
      reasoning: "Rating dipped 0.2 stars QoQ; review velocity flat.",
    });
    // Each grounded painPoint carries a non-null evidenceRef matching
    // the contract shape.
    for (const p of out.painPoints ?? []) {
      expect(p.evidenceRef).not.toBeNull();
      expect(typeof p.evidenceRef).toBe("object");
    }
    // briefMode is "v2" so downstream telemetry can split shadow runs.
    expect(out.briefMode).toBe("v2");
  });

  it("emits truth.brief.pain_quoted + truth.brief.hypothesis_count with the right counts", async () => {
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 71,
        confidenceBreakdown: { audit: 80, reviews: 64, opportunity: 70, weight: 1 },
        headline: "OK",
        whyGoodTarget: "OK reasoning.",
        talkingPoints: ["a", "b", "c"],
        openerSeed: "Hi.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: [],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "grounded a",
            source: "review_quote",
            severity: 3,
            evidenceRef: { kind: "review", reviewId: "r1", quote: "q" },
          },
          {
            claim: "inferred a",
            source: "inferred",
            severity: 2,
            reasoning: "guess",
            confidence: 0.7,
          },
          {
            claim: "inferred b",
            source: "inferred",
            severity: 2,
            reasoning: "guess 2",
            confidence: 0.6,
          },
        ],
        hypotheses: [],
      }),
    );

    await runBriefV2Pipeline({
      input: casaPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_casa_polanco",
      workspaceId: "fixture_workspace_en",
    });

    const truthEvents = infoSpy.mock.calls.filter(
      (c) => c[0] === "[truth-telemetry]",
    );
    const painQuoted = truthEvents.find(
      (c) => (c[1] as Record<string, unknown>).event === "truth.brief.pain_quoted",
    );
    const hypoCount = truthEvents.find(
      (c) =>
        (c[1] as Record<string, unknown>).event ===
        "truth.brief.hypothesis_count",
    );
    expect(painQuoted).toBeDefined();
    expect((painQuoted![1] as Record<string, unknown>).count).toBe(1);
    expect(hypoCount).toBeDefined();
    expect((hypoCount![1] as Record<string, unknown>).count).toBe(2);
    // workspaceId is derived from the lead row per multi-tenant rule.
    expect((painQuoted![1] as Record<string, unknown>).workspaceId).toBe(
      "fixture_workspace_en",
    );
  });
});

describe("runBriefV2Pipeline — re-prompt path (every first pass painPoint failed grounding)", () => {
  it("calls Gemini twice and adopts the second response when it contains grounded items", async () => {
    // First pass: every painPoint inferred → all promoted, none grounded.
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 71,
        confidenceBreakdown: { audit: 80, reviews: 64, opportunity: 70, weight: 1 },
        headline: "Plausible target",
        whyGoodTarget: "Some reasoning.",
        talkingPoints: ["a", "b"],
        openerSeed: "Hi.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: [],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "ungrounded a",
            source: "inferred",
            severity: 3,
            reasoning: "guess",
            confidence: 0.6,
          },
          {
            claim: "ungrounded b",
            source: "inferred",
            severity: 2,
            reasoning: "vibes",
            confidence: 0.5,
          },
        ],
        hypotheses: [],
      }),
    );
    // Second pass: model produces a grounded item. Validator adopts it.
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 71,
        confidenceBreakdown: { audit: 80, reviews: 64, opportunity: 70, weight: 1 },
        headline: "Plausible target (re-prompt)",
        whyGoodTarget: "Re-grounded reasoning.",
        talkingPoints: ["a", "b"],
        openerSeed: "Hi.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: ["booking is hard"],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "booking is hard",
            source: "review_quote",
            severity: 4,
            evidenceRef: { kind: "review", reviewId: "r9", quote: "imposible reservar" },
          },
        ],
        hypotheses: [],
      }),
    );

    const out = await runBriefV2Pipeline({
      input: casaPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_casa_polanco",
      workspaceId: "fixture_workspace_en",
    });
    expect(generateContentSpy).toHaveBeenCalledTimes(2);
    expect(out.painPoints).toHaveLength(1);
    expect(out.painPoints?.[0].claim).toBe("booking is hard");
    expect(out.headline).toBe("Plausible target (re-prompt)");
  });

  it("does NOT re-prompt when the first pass already produced at least one grounded item", async () => {
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 71,
        confidenceBreakdown: { audit: 80, reviews: 64, opportunity: 70, weight: 1 },
        headline: "First-pass good",
        whyGoodTarget: "Solid reasoning.",
        talkingPoints: ["a"],
        openerSeed: "Hi.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: [],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "grounded keep",
            source: "review_quote",
            severity: 3,
            evidenceRef: { kind: "review", reviewId: "r1", quote: "q" },
          },
          {
            claim: "inferred drop",
            source: "inferred",
            severity: 1,
            reasoning: "guess",
            confidence: 0.4,
          },
        ],
        hypotheses: [],
      }),
    );
    const out = await runBriefV2Pipeline({
      input: casaPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_casa_polanco",
      workspaceId: "fixture_workspace_en",
    });
    expect(generateContentSpy).toHaveBeenCalledTimes(1);
    expect(out.painPoints).toHaveLength(1);
    expect(out.hypotheses).toHaveLength(1);
  });
});
