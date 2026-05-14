/**
 * Truth Layer v1 — T-D Brief Truth-Grounding: website-claim gate.
 *
 * Master plan §3 T-D bullet 3: `whyGoodTarget` MUST NOT contain
 * "no website" / "without a website" / "lack of website" / similar
 * phrasings unless `Lead.websiteVerificationStatus === "confirmed_absent"`.
 * The gate strips offending sentences (sentence-granular redaction —
 * never the whole paragraph) and emits
 * `truth.brief.website_claim_blocked`.
 *
 * Greenwich Morning is the central debugging case the master plan
 * pins: GB cafe, websiteUrl=null at the Place row, but the
 * multi-source verifier returned `uncertain` (only 1 of 4 sources
 * said "absent" — far below the 3-source floor). Pre-T-D the brief
 * writer surfaced "no website" as fact; T-D blocks that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLeadFixture } from "../../../tests/fixtures/load-lead-fixture";
import {
  gateWebsiteClaim,
  computeGroundableMissingFields,
  runBriefV2Pipeline,
  WEBSITE_ABSENCE_PATTERNS,
  type BriefPromptInput,
} from "@/lib/agent-workers/lead-intelligence-brief";

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

function geminiResponse(payload: Record<string, unknown>) {
  return {
    response: {
      text: () => JSON.stringify(payload),
      candidates: [{ finishReason: "STOP" }],
    },
  };
}

function greenwichPromptInput(
  overrides: Partial<BriefPromptInput> = {},
): BriefPromptInput {
  const fx = loadLeadFixture("greenwich-morning");
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
    auditChecklistText: "Audit summary: 0/8 checks passed (no website).",
    reviewAnalysis: fx.reviewAnalysis as unknown as Record<string, unknown>,
    salesOpportunity: null,
    socialProfiles: null,
    voiceNotes: [],
    dossierMarkdown: null,
    memorySnippets: [],
    agentRunSummaries: [],
    nicheLabel: "Cafe",
    nichePitchAngle: "Online ordering + table mgmt",
    preComputedConfidence: 38,
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

describe("gateWebsiteClaim — pure validator semantics", () => {
  it("strips a 'no website' sentence when status === 'uncertain'", () => {
    const input =
      "Greenwich Morning has no website. Reviews mention long brunch queues.";
    const result = gateWebsiteClaim(input, "uncertain");
    expect(result.blocked).toBe(true);
    expect(result.sanitized).toBe("Reviews mention long brunch queues.");
    expect(result.sanitized).not.toMatch(/no\s+website/i);
  });

  it("preserves a 'no website' sentence when status === 'confirmed_absent'", () => {
    const input =
      "Greenwich Morning has no website. Reviews mention long brunch queues.";
    const result = gateWebsiteClaim(input, "confirmed_absent");
    expect(result.blocked).toBe(false);
    expect(result.sanitized).toBe(input);
  });

  it("strips a 'without a website' sentence on uncertain", () => {
    const result = gateWebsiteClaim(
      "Operating without a website limits their growth. Strong customer base though.",
      "uncertain",
    );
    expect(result.blocked).toBe(true);
    expect(result.sanitized).toBe("Strong customer base though.");
  });

  it("strips 'lack of website', 'lacks a website', 'doesn't have a website' phrasings", () => {
    for (const sentence of [
      "Their lack of website hurts conversions.",
      "Greenwich Morning lacks a website.",
      "The cafe doesn't have a website.",
      "The cafe does not have a website.",
      "Missing a website caps the upper funnel.",
    ]) {
      const result = gateWebsiteClaim(`${sentence} Brunch demand is real.`, "uncertain");
      expect(result.blocked, `"${sentence}" should be stripped`).toBe(true);
      expect(result.sanitized).toBe("Brunch demand is real.");
    }
  });

  it("returns sanitized=null + blocked=true when EVERY sentence offended", () => {
    const result = gateWebsiteClaim(
      "Greenwich Morning has no website. They lack a website. Without a website growth stalls.",
      "uncertain",
    );
    expect(result.blocked).toBe(true);
    expect(result.sanitized).toBeNull();
  });

  it("does nothing on null/empty input", () => {
    expect(gateWebsiteClaim(null, "uncertain")).toEqual({
      sanitized: null,
      blocked: false,
    });
    expect(gateWebsiteClaim("", "uncertain")).toEqual({
      sanitized: null,
      blocked: false,
    });
  });

  it("treats a null/unknown verification status conservatively (gate fires)", () => {
    // T-E never ran for this lead (legacy ingest). T-D contract: do
    // NOT let the brief assert website absence on unverified leads.
    const result = gateWebsiteClaim(
      "The cafe has no website. Strong reviews though.",
      null,
    );
    expect(result.blocked).toBe(true);
    expect(result.sanitized).toBe("Strong reviews though.");
  });

  it("preserves sentences mentioning 'website' generically (not absence claims)", () => {
    const result = gateWebsiteClaim(
      "Their website loads slowly. Reviews mention long queues.",
      "uncertain",
    );
    // No absence claim — generic "website" mentions are fine.
    expect(result.blocked).toBe(false);
    expect(result.sanitized).toBe(result.sanitized);
    expect(result.sanitized).toContain("website loads slowly");
  });

  it("ships a non-trivial absence pattern set (regression net for the regex list)", () => {
    // The regex list is the contract surface; if a future tightening
    // accidentally drops one, this test catches the gap immediately.
    expect(WEBSITE_ABSENCE_PATTERNS.length).toBeGreaterThanOrEqual(8);
  });
});

describe("runBriefV2Pipeline — Greenwich Morning fixture (websiteVerificationStatus=uncertain)", () => {
  it("strips 'no website' from whyGoodTarget AND emits truth.brief.website_claim_blocked", async () => {
    // Simulated Gemini output containing the exact failure mode the
    // master plan describes: model surfaces a "no website" claim
    // even though T-E flagged the lead as uncertain.
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 38,
        confidenceBreakdown: { audit: 0, reviews: 38, opportunity: 0, weight: 1 },
        headline: "Greenwich Morning — busy cafe, weak online presence",
        // The offending paragraph: contains a "no website" sentence
        // AND a legitimate sentence about review pain. Gate must
        // strip the first and keep the second.
        whyGoodTarget:
          "Greenwich Morning has no website. The cafe receives consistent complaints about brunch wait times that the rep can address with a digital ordering pilot.",
        talkingPoints: [
          "Wait time is the dominant complaint",
          "Brunch is the high-ticket window",
          "Owner has not engaged on Google replies",
        ],
        openerSeed:
          "Saw the brunch queue keeps coming up in your reviews — quick idea.",
        bestTimeToCall: "Mid-afternoon, after the lunch rush.",
        dnc: false,
        nextAction: {
          kind: "EMAIL_FIRST",
          due: "",
          note: "Reach out about wait time pilot.",
        },
        replyObjections: ["We don't have time for new tools."],
        redFlags: [],
        evidence: [
          { source: "review_analysis", note: "11/397 negs cite wait time" },
        ],
        confirmedPainPoints: ["wait time at brunch"],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "wait time at brunch",
            source: "review_quote",
            severity: 3,
            evidenceRef: {
              kind: "review",
              reviewId: "greenwich_rev_1",
              quote: "slow service at brunch — waited 25 minutes",
            },
          },
        ],
        hypotheses: [],
      }),
    );

    const out = await runBriefV2Pipeline({
      input: greenwichPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_greenwich_morning",
      workspaceId: "fixture_workspace_tr",
    });

    // The whyGoodTarget MUST NOT contain any of the absence phrasings
    // listed in the master plan §3 T-D DoD.
    expect(out.whyGoodTarget).not.toBeNull();
    expect(out.whyGoodTarget).not.toMatch(/no\s+website/i);
    expect(out.whyGoodTarget).not.toMatch(/without\s+a?\s*website/i);
    expect(out.whyGoodTarget).not.toMatch(/lack\s+of\s+website/i);
    expect(out.whyGoodTarget).not.toMatch(/lacks?\s+a?\s*website/i);
    // The legitimate sentence about wait times survives the gate.
    expect(out.whyGoodTarget).toContain("wait times");

    // websiteClaimBlocked is the structural flag the dashboard reads.
    expect(out.websiteClaimBlocked).toBe(true);

    // Telemetry: `truth.brief.website_claim_blocked` was emitted with
    // the right scope (leadId + workspaceId derived from the lead row).
    const truthEvents = infoSpy.mock.calls.filter(
      (c) => c[0] === "[truth-telemetry]",
    );
    const blocked = truthEvents.find(
      (c) =>
        (c[1] as Record<string, unknown>).event ===
        "truth.brief.website_claim_blocked",
    );
    expect(blocked).toBeDefined();
    expect((blocked![1] as Record<string, unknown>).leadId).toBe(
      "fixture_greenwich_morning",
    );
    expect((blocked![1] as Record<string, unknown>).workspaceId).toBe(
      "fixture_workspace_tr",
    );
  });

  it("does NOT emit truth.brief.website_claim_blocked when whyGoodTarget never made the claim", async () => {
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 38,
        confidenceBreakdown: { audit: 0, reviews: 38, opportunity: 0, weight: 1 },
        headline: "Greenwich Morning — wait times are the wedge",
        whyGoodTarget:
          "Reviews consistently flag brunch wait times — a digital ordering pilot fits cleanly.",
        talkingPoints: ["wait time is the wedge"],
        openerSeed: "Saw the wait-time pattern — quick idea.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "CALL_NOW", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: ["wait time at brunch"],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "wait time at brunch",
            source: "review_quote",
            severity: 3,
            evidenceRef: {
              kind: "review",
              reviewId: "greenwich_rev_1",
              quote: "slow service at brunch",
            },
          },
        ],
        hypotheses: [],
      }),
    );
    const out = await runBriefV2Pipeline({
      input: greenwichPromptInput(),
      intelligenceVersion: 1,
      leadId: "fixture_greenwich_morning",
      workspaceId: "fixture_workspace_tr",
    });
    expect(out.websiteClaimBlocked).toBe(false);
    const blocked = infoSpy.mock.calls
      .filter((c) => c[0] === "[truth-telemetry]")
      .find(
        (c) =>
          (c[1] as Record<string, unknown>).event ===
          "truth.brief.website_claim_blocked",
      );
    expect(blocked).toBeUndefined();
  });

  it("PRESERVES 'no website' when websiteVerificationStatus === 'confirmed_absent' (3+ sources said absent)", async () => {
    // This is the legitimate case — when T-E confirmed absence we
    // want the brief to make the claim. The gate should pass through.
    generateContentSpy.mockResolvedValueOnce(
      geminiResponse({
        salesConfidence: 38,
        confidenceBreakdown: { audit: 0, reviews: 38, opportunity: 0, weight: 1 },
        headline: "Confirmed no website",
        whyGoodTarget:
          "Greenwich Morning has no website. Reviews mention queues.",
        talkingPoints: ["a"],
        openerSeed: "Hi.",
        bestTimeToCall: null,
        dnc: false,
        nextAction: { kind: "EMAIL_FIRST", due: "", note: "" },
        replyObjections: [],
        redFlags: [],
        evidence: [],
        confirmedPainPoints: [],
        confirmedMissingFeatures: [],
        painPoints: [
          {
            claim: "no website at all",
            source: "missing_field",
            severity: 4,
            evidenceRef: { kind: "missing_field", field: "websiteUrl" },
          },
        ],
        hypotheses: [],
      }),
    );
    const out = await runBriefV2Pipeline({
      input: greenwichPromptInput({
        websiteVerificationStatus: "confirmed_absent",
        groundableMissingFields: ["phone", "websiteUrl"],
      }),
      intelligenceVersion: 1,
      leadId: "fixture_greenwich_morning",
      workspaceId: "fixture_workspace_tr",
    });
    expect(out.whyGoodTarget).toContain("no website");
    expect(out.websiteClaimBlocked).toBe(false);
    // The websiteUrl missing_field claim is also accepted because
    // groundableMissingFields includes it (only on confirmed_absent).
    expect(out.painPoints).toHaveLength(1);
    expect(out.painPoints?.[0].evidenceRef).toEqual({
      kind: "missing_field",
      field: "websiteUrl",
    });
  });
});
