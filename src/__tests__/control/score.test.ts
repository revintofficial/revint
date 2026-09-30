// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toDecisionCard } from "@/lib/control/decision";
import { parseExpected, scoreClaims, scoreOutput } from "@/lib/control/score";
const brief = { salesConfidence: 87, headline: "Burger House", headAgent: { confidence: 82, recommendedModules: [{ module: "order_and_pay" }, { module: "crm_loyalty" }], primaryAngle: "Improve repeat customer conversion", talkTrack: "Expect 18% upsell. Guaranteed revenue increase today.", reasoning: "Customer retention", sourceConflicts: [{ claim: "Old source" }], evidenceRefs: ["reviews"] } };
const rules = { forbiddenClaims: [], forbiddenAngles: [] };
describe("brief decision", () => {
  it("reads the real brief and preserves module order", () => {
    expect(toDecisionCard(brief, { finishedAt: "2026-09-28", locationCount: 3 })).toMatchObject({ salesConfidence: 87, confidence: 82, primaryModule: "order_and_pay", recommendedModules: ["order_and_pay", "crm_loyalty"], primaryAngle: brief.headAgent.primaryAngle, locationCount: 3 });
  });
  it("ignores legacy fields and handles a missing head agent", () => {
    expect(toDecisionCard({ salesConfidence: 87, icpFitScore: 99, modules: ["qr_menu"], claims: ["old"], angle: "old" })).toMatchObject({ salesConfidence: 87, hasHeadAgent: false, recommendedModules: [], primaryAngle: null, claimSentences: [] });
  });
});
describe("scoreOutput", () => {
  it("fails when only a secondary module is allowed", () => {
    expect(scoreOutput(brief, { ...rules, allowedModules: ["crm_loyalty"] }).failures).toContainEqual(expect.objectContaining({ code: "MODULE" }));
  });
  it("allows later modules outside the set", () => {
    expect(scoreOutput(brief, { ...rules, allowedModules: ["order_and_pay"] }).passed).toBe(true);
  });
  it("fails a missing primary module", () => {
    expect(scoreOutput({}, { ...rules, allowedModules: ["qr_menu"] }).passed).toBe(false);
  });
  it("matches forbidden substrings in talk track, reasoning, conflicts and angle", () => {
    for (const text of ["GUARANTEED REVENUE", "retention", "old source"]) expect(scoreOutput(brief, { ...rules, forbiddenClaims: [text] }).failures[0].code).toBe("FORBIDDEN_CLAIM");
    expect(scoreOutput(brief, { ...rules, forbiddenAngles: ["REPEAT CUSTOMER"] }).failures[0].code).toBe("FORBIDDEN_ANGLE");
  });
  it("uses salesConfidence and requires an integer within the band", () => {
    expect(scoreOutput(brief, { ...rules, icpMin: 70, icpMax: 100 }).passed).toBe(true);
    for (const output of [{ icpFitScore: 87 }, { salesConfidence: 87.5 }, {}]) expect(scoreOutput(output, { ...rules, icpMin: 70 }).failures[0].code).toBe("ICP_BAND");
  });
  it("validates module IDs and ordered score limits", () => {
    expect(() => parseExpected({ ...rules, allowedModules: ["QR_MENU"] })).toThrow();
    expect(() => parseExpected({ ...rules, icpMin: 90, icpMax: 70 })).toThrow();
  });
});
describe("scoreClaims", () => {
  it("drops provisional and expired claims", () => {
    const kept = scoreClaims(
      [
        { id: "1", text: "faster turns", source: "owner", expiresOn: "2026-12-01", provisional: false },
        { id: "2", text: "18% upsell", source: "seed", expiresOn: "2026-12-01", provisional: true },
        { id: "3", text: "old", source: "owner", expiresOn: "2025-01-01", provisional: false },
      ],
      new Date("2026-09-26T00:00:00Z"),
    );
    expect(kept.map((claim) => claim.id)).toEqual(["1"]);
  });
});
