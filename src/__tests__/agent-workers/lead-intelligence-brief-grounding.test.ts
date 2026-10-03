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
  buildBriefDecision,
  run as runBrief,
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

// ---------------------------------------------------------------------
// Head agent (Task 3) mocks — Claude, the DB and the flag are fakes so
// the restaurant brief path runs without a model or a database.
// ---------------------------------------------------------------------
const ha = vi.hoisted(() => ({
  configured: { value: false },
  loop: vi.fn(),
  call: vi.fn(),
  mode: vi.fn(() => "live"),
  db: {
    lead: { count: vi.fn(), updateMany: vi.fn() },
    salesOpportunity: { upsert: vi.fn() },
    servicePackage: { findMany: vi.fn() },
    leadTrigger: { findMany: vi.fn() },
    semanticMemory: { findMany: vi.fn() },
    agentRun: { findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/ai-core/agent/claude", () => ({
  isAnthropicConfigured: () => ha.configured.value,
  runClaudeToolLoop: ha.loop,
  callClaudeJson: ha.call,
  parseClaudeJson: (text: string) => JSON.parse(text),
  getHeadAgentModel: () => "claude-test",
}));
vi.mock("@/lib/prisma", () => ({ prisma: ha.db }));
vi.mock("@/lib/control/claims", () => ({ listApprovedClaims: vi.fn(async () => []) }));
vi.mock("@/lib/feature-flags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/feature-flags")>()),
  getHeadAgentMode: ha.mode,
}));
vi.mock("@/lib/playbook/resolve", () => ({
  getPlaybook: vi.fn(async () => ({ stages: [] })),
  deriveLeadTemperature: vi.fn(() => "WARM"),
}));
vi.mock("@/lib/integrations/hubspot/writeback", () => ({
  enqueueCrmWriteback: vi.fn(async () => undefined),
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

// =====================================================================
// Task 3 — restaurant briefs come from the head agent
// =====================================================================

function resetHeadAgentMocks() {
  ha.configured.value = false;
  ha.loop.mockReset();
  ha.call.mockReset();
  ha.mode.mockReset();
  ha.mode.mockReturnValue("live");
  ha.db.lead.count.mockReset().mockResolvedValue(1);
  ha.db.lead.updateMany.mockReset().mockResolvedValue({ count: 1 });
  ha.db.salesOpportunity.upsert.mockReset().mockResolvedValue({});
  ha.db.servicePackage.findMany.mockReset().mockResolvedValue([
    { id: "pkg_starter", name: "FineDine Starter" },
    { id: "pkg_growth", name: "FineDine Growth" },
  ]);
  ha.db.leadTrigger.findMany.mockReset().mockResolvedValue([]);
  ha.db.semanticMemory.findMany.mockReset().mockResolvedValue([]);
  ha.db.$transaction.mockReset().mockImplementation(async (ops: unknown[]) => Promise.all(ops));
}

const THEFORK_AUDIT = {
  websiteUrl: "https://brasserie.example",
  reachable: true,
  hasBookingSystem: true,
  bookingProvider: "TheFork",
  hasPrepayment: false,
  tableCount: 40,
};

function claudeTalk(payload: Record<string, unknown>) {
  return {
    finalText: JSON.stringify(payload),
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    rounds: 2,
    toolCalls: ["get_full_reviews"],
  };
}

describe("buildBriefDecision — plan snippets", () => {
  beforeEach(resetHeadAgentMocks);

  it("excludes reservation when a booking provider is already present", async () => {
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      audit: { hasBookingSystem: true, bookingProvider: "Dishoom reservations", hasQrMenu: null, hasOnlineOrdering: null },
      reviewCount: 29744,
      reviewAnalysis: null,
    });
    expect(out.briefMode).toBe("head-agent");
    expect(out.headAgent.excludedModules.map((m) => m.module)).toContain("reservation");
    expect(out.headAgent.evidenceRefs.length).toBeGreaterThan(0);
    expect(out.headAgent.recommendedModules.map((m) => m.module)).not.toContain("reservation");
  });

  it("does not pitch a website rebuild from a thin five-review sample", async () => {
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      audit: { hasQrMenu: null, websiteBroken: false },
      reviewCount: 5,
      reviewAnalysis: null,
    });
    expect(out.headAgent.recommendedModules).not.toContain("website");
    expect(out.headAgent.recommendedModules.map((m) => m.module)).not.toContain("website");
    expect(out.missingSources).toContain("reviews");
  });

  it("writes a plain card when QA fails instead of falling back to the legacy brief", async () => {
    const out = await buildBriefDecision({ niche: "RESTAURANT_TECH", forceQaFailure: true });
    expect(out.briefMode).toBe("head-agent");
    expect(out.headAgent.talkTrack).toBe("");
    expect(out.headAgent.recommendedPackage).toBeTruthy();
    expect(generateContentSpy).not.toHaveBeenCalled();
  });
});

describe("buildBriefDecision — rooms 2 and 3", () => {
  beforeEach(resetHeadAgentMocks);

  it("forced QA failure on a real wedge keeps the package and three evidence refs, no model call", async () => {
    ha.configured.value = true;
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      audit: THEFORK_AUDIT,
      reviewCount: 300,
      rating: 4.5,
      reviewAnalysis: {
        reviewsAnalyzedCount: 300,
        painPhrases: [
          { text: "we waited 20 minutes for the bill", sellable: true },
          { text: "no-show deposit was never asked", sellable: true },
        ],
      },
      forceQaFailure: true,
    });
    expect(out.headAgent).toMatchObject({ recommendedPackage: "growth", wedge: "reservation", talkTrack: "" });
    expect(out.headAgent.evidenceRefs).toHaveLength(3);
    expect(out.headAgent.roomTwo.status).toBe("qa_failed");
    expect(ha.loop).not.toHaveBeenCalled();
    expect(ha.call).not.toHaveBeenCalled();
  });

  it("attaches Claude's talk only for the Room 1 package, with raw-evidence tools only", async () => {
    ha.configured.value = true;
    ha.loop.mockResolvedValueOnce(
      claudeTalk({
        package: "growth",
        wedge: "reservation",
        primaryAngle: "Direct booking + deposit",
        sentences: [
          { text: "Your bookings come through TheFork and no deposit is visible.", evidence: ["E1"] },
          { text: "Direct booking with prepayment could cut no-shows; a quick look will tell.", evidence: ["E1"] },
        ],
        recommendedModules: [{ module: "crm_loyalty", why: "invented" }],
        sourceConflicts: [],
        reasoning: "Deposit gap on marketplace bookings.",
      }),
    );
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      workspaceId: "ws_1",
      leadId: "lead_1",
      audit: THEFORK_AUDIT,
      reviewCount: 400,
      rating: 4.4,
      reviewAnalysis: { reviewsAnalyzedCount: 400, painPhrases: [] },
    });
    expect(ha.loop).toHaveBeenCalledOnce();
    const toolNames = ha.loop.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
    expect(toolNames).not.toContain("get_dossier");
    expect(toolNames).not.toContain("get_sales_opportunity");
    expect(out.headAgent.roomTwo.status).toBe("attached");
    expect(out.headAgent.talkTrack).toMatch(/TheFork/);
    expect(out.headAgent.recommendedPackage).toBe("growth");
    expect(out.headAgent.wedge).toBe("reservation");
    // Invented module outside the shortlist is dropped.
    expect(out.headAgent.recommendedModules.map((m) => m.module)).not.toContain("crm_loyalty");
    expect(out.salesConfidence).toBe(out.headAgent.confidence);
  });

  it("QA failure (talk sells outside the wedge) gives a plain card with no second attempt", async () => {
    ha.configured.value = true;
    ha.loop.mockResolvedValueOnce(
      claudeTalk({
        package: "growth",
        wedge: "reservation",
        primaryAngle: "Loyalty",
        sentences: [{ text: "Start a loyalty programme so your guests come back more often.", evidence: ["E1"] }],
        recommendedModules: [],
        sourceConflicts: [],
        reasoning: "",
      }),
    );
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      workspaceId: "ws_1",
      leadId: "lead_1",
      audit: THEFORK_AUDIT,
      reviewCount: 400,
      rating: 4.4,
      reviewAnalysis: { reviewsAnalyzedCount: 400, painPhrases: [] },
    });
    expect(ha.loop).toHaveBeenCalledOnce();
    expect(ha.call).not.toHaveBeenCalled();
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(out.headAgent.talkTrack).toBe("");
    expect(out.headAgent.recommendedPackage).toBe("growth");
    expect(out.headAgent.roomTwo.status).toBe("qa_failed");
    expect(out.headAgent.roomTwo.qaIssues.join(" ")).toMatch(/sells_outside_wedge|not_linked_to_wedge/);
  });

  it("QA fails a Starter talk that sells prepayment and a sentence without evidence", async () => {
    ha.configured.value = true;
    ha.loop.mockResolvedValueOnce(
      claudeTalk({
        package: "starter",
        wedge: "bill_wait",
        primaryAngle: "Bill",
        sentences: [
          { text: "Guests wait for the bill at peak.", evidence: ["E1"] },
          { text: "Add a deposit and prepayment for every table.", evidence: [] },
        ],
      }),
    );
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      workspaceId: "ws_1",
      leadId: "lead_1",
      audit: { reachable: true },
      reviewCount: 200,
      rating: 4.1,
      reviewAnalysis: {
        reviewsAnalyzedCount: 200,
        painPhrases: [{ text: "waited ages for the bill", sellable: true, category: "bill", mentions: 2, quotes: ["waited ages for the bill"] }],
      },
    });
    expect(out.headAgent.recommendedPackage).toBe("starter");
    expect(out.headAgent.roomTwo.qaIssues).toEqual(
      expect.arrayContaining(["sentence_without_evidence", "sells_outside_package"]),
    );
    expect(out.headAgent.talkTrack).toBe("");
  });

  it("shadow mode runs Claude but keeps the card plain", async () => {
    ha.configured.value = true;
    ha.loop.mockResolvedValueOnce(
      claudeTalk({
        package: "growth",
        wedge: "reservation",
        primaryAngle: "Direct booking",
        sentences: [{ text: "Bookings arrive via TheFork with no deposit visible.", evidence: ["E1"] }],
      }),
    );
    const out = await buildBriefDecision(
      { niche: "RESTAURANT_TECH", workspaceId: "ws_1", leadId: "lead_1", audit: THEFORK_AUDIT, reviewCount: 400, rating: 4.4 },
      { mode: "shadow" },
    );
    expect(out.headAgent.talkTrack).toBe("");
    expect(out.headAgent.roomTwo.status).toBe("shadow");
    expect(out.headAgent.roomTwo.draftTalkTrack).toMatch(/TheFork/);
  });

  it("Claude failure gives a plain card, never a Gemini retry", async () => {
    ha.configured.value = true;
    ha.loop.mockRejectedValueOnce(new Error("timeout"));
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      workspaceId: "ws_1",
      leadId: "lead_1",
      audit: THEFORK_AUDIT,
      reviewCount: 400,
      rating: 4.4,
    });
    expect(out.headAgent.roomTwo.status).toBe("unavailable");
    expect(out.headAgent.talkTrack).toBe("");
    expect(out.headAgent.recommendedPackage).toBe("growth");
    expect(generateContentSpy).not.toHaveBeenCalled();
  });

  it("still writes a brief when every upstream step was skipped", async () => {
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      audit: null,
      reviewCount: null,
      rating: null,
      reviewAnalysis: { skipped: "thin_corpus", count: 4 },
    });
    expect(out.briefMode).toBe("head-agent");
    expect(out.headAgent.recommendedModules).toEqual([]);
    expect(out.salesConfidence).toBeLessThan(20);
    expect(out.missingSources).toEqual(expect.arrayContaining(["map", "website", "reviews"]));
  });

  it("reads review phrases whether they are strings or objects with sellable", async () => {
    const out = await buildBriefDecision({
      niche: "RESTAURANT_TECH",
      audit: { reachable: true },
      reviewCount: 120,
      rating: 4.2,
      // Legacy rows carry no verified count, so each phrase is one medium signal: two make the wedge.
      reviewAnalysis: {
        reviewsAnalyzedCount: 120,
        painPhrases: ["waited 25 minutes to pay the bill", { text: "card machine never came", sellable: true }],
      },
    });
    expect(out.headAgent.wedge).toBe("bill_wait");
    expect(out.headAgent.recommendedPackage).toBe("starter");
  });
});

describe("run — restaurant workspace", () => {
  beforeEach(resetHeadAgentMocks);

  function restaurantCtx(overrides: Record<string, unknown> = {}) {
    const emit = vi.fn();
    return {
      workspaceId: "ws_1",
      leadId: "lead_1",
      workspace: { id: "ws_1", niche: "RESTAURANT_TECH", language: "en" },
      emit,
      lead: {
        id: "lead_1",
        businessName: "Brasserie Example",
        formattedAddress: "1 High St, London",
        websiteUrl: "https://brasserie.example",
        hasWebsite: true,
        rating: 4.4,
        reviewCount: 420,
        priceLevel: 2,
        accountId: null,
        subNicheSlug: null,
        nicheSlug: "restaurant",
        primaryType: "restaurant",
        intelligenceVersion: 2,
        dnc: false,
        playbookStageKey: null,
        inboundReceivedAt: null,
        lastDisposition: null,
        icpFitScore: null,
        websiteAudit: {
          url: "https://brasserie.example",
          reachable: true,
          hasBookingSystem: true,
          bookingProvider: "TheFork",
          hasEcommerce: false,
          rawFeaturesJson: { hasQrMenu: null, hasOnlineOrdering: null },
        },
        reviewAnalysis: null,
        salesOpportunity: { opportunityScore: 99 },
        ...overrides,
      },
    } as unknown as Parameters<typeof runBrief>[0];
  }

  it("returns head_agent_off and writes nothing when the mode is off", async () => {
    ha.mode.mockReturnValue("off");
    const res = await runBrief(restaurantCtx());
    expect(res.output).toEqual({ skipped: "head_agent_off" });
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(ha.db.$transaction).not.toHaveBeenCalled();
    expect(ha.db.salesOpportunity.upsert).not.toHaveBeenCalled();
  });

  it("never calls the legacy generator and projects SalesOpportunity once, in the brief transaction", async () => {
    const res = await runBrief(restaurantCtx());
    const out = res.output as Record<string, unknown> & {
      headAgent: { wedge: string; recommendedPackage: string; roomOne: { evidence: string[] } };
      salesConfidence: number;
    };
    expect(generateContentSpy).not.toHaveBeenCalled();
    expect(out.briefMode).toBe("head-agent");
    expect(out.headAgent.wedge).toBe("reservation");
    expect(out.headAgent.recommendedPackage).toBe("growth");
    expect(out.missingSources).toContain("reviews");
    // salesConfidence is the package fit score — the stale scorer row (99) is not read.
    expect(out.salesConfidence).not.toBe(99);

    expect(ha.db.$transaction).toHaveBeenCalledOnce();
    expect(ha.db.salesOpportunity.upsert).toHaveBeenCalledOnce();
    const upsert = ha.db.salesOpportunity.upsert.mock.calls[0][0];
    expect(upsert.where).toMatchObject({ leadId: "lead_1", lead: { workspaceId: "ws_1" } });
    expect(upsert.update.bestSalesAngle).toBe(out.headAgent.wedge);
    expect(upsert.create.bestSalesAngle).toBe(out.headAgent.wedge);
    expect(upsert.update.opportunityScore).toBe(out.salesConfidence);
    expect(upsert.update.reasonCodes).toEqual(out.headAgent.roomOne.evidence);
    expect(upsert.update.recommendedPackageId).toBe("pkg_growth");
    expect(upsert.update.suggestedOffer).toBe("GROWTH");
    expect(ha.db.servicePackage.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws_1" });

    const leadWrite = ha.db.lead.updateMany.mock.calls[0][0];
    expect(leadWrite.where).toEqual({ id: "lead_1", workspaceId: "ws_1" });
    expect(leadWrite.data.salesConfidence).toBe(out.salesConfidence);
  });

  it("still counts the uncrawled website as missing when only map facts built the audit", async () => {
    ha.db.agentRun.findFirst.mockResolvedValueOnce({
      outputJson: {
        mapFacts: {
          reservationLinks: [{ name: "OpenTable", url: "https://www.opentable.co.uk/r/x" }],
          orderLinks: [],
          deliveryPlatforms: [],
        },
      },
    });
    const res = await runBrief(restaurantCtx({ websiteAudit: null }));
    const out = res.output as Record<string, unknown> & { missingSources: string[]; redFlags: string[] };
    expect(out.missingSources.filter((s) => s === "website")).toHaveLength(1);
    expect(out.redFlags).toContain("missing_source:website");
  });
});
