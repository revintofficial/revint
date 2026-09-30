// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toDecisionCard } from "@/lib/control/decision";
import { parseExpected, previewScore, readPackageAndWedge, scoreClaims, scoreOutput } from "@/lib/control/score";
import { failureLabel } from "@/lib/control/labels";
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
function cardJson(fields: { recommendedPackage?: unknown; wedge?: unknown; salesConfidence?: number }) {
  return { briefMode: "head-agent", salesConfidence: fields.salesConfidence ?? 60, headAgent: { recommendedModules: [{ module: "reservation" }], primaryAngle: "Rezervasyon → Growth", talkTrack: "", reasoning: "", recommendedPackage: fields.recommendedPackage ?? null, wedge: fields.wedge ?? null } };
}
describe("package and wedge", () => {
  it("fails when the card sells premium to a single venue", () => {
    const r = scoreOutput(cardJson({ recommendedPackage: "premium", wedge: "menu_surface" }),
      parseExpected({ expectedPackage: "starter", forbiddenClaims: [], forbiddenAngles: [] }));
    expect(r.failures.map((f) => f.code)).toContain("PACKAGE");
  });
  it("fails when the wedge is not the one the reviewers agreed on", () => {
    const r = scoreOutput(cardJson({ wedge: "guest_repeat" }),
      parseExpected({ expectedWedge: "reservation", forbiddenClaims: [], forbiddenAngles: [] }));
    expect(r.failures.map((f) => f.code)).toContain("WEDGE");
  });
  it("passes a card that matches the package and the wedge", () => {
    const r = scoreOutput(cardJson({ recommendedPackage: "growth", wedge: "reservation", salesConfidence: 80 }),
      parseExpected({ expectedPackage: "growth", expectedWedge: "reservation", icpMin: 70, icpMax: 100, forbiddenClaims: [], forbiddenAngles: [] }));
    expect(r.passed).toBe(true);
  });
  it("rejects an unknown package or wedge in expected rules", () => {
    expect(() => parseExpected({ expectedPackage: "enterprise", forbiddenClaims: [], forbiddenAngles: [] })).toThrow("invalid expected");
    expect(() => parseExpected({ expectedWedge: "delivery", forbiddenClaims: [], forbiddenAngles: [] })).toThrow("invalid expected");
    expect(() => parseExpected({ expectedPackage: 3, forbiddenClaims: [], forbiddenAngles: [] })).toThrow("invalid expected");
  });
  it("fails an expected package when the card has none, and treats an empty card as 'none'", () => {
    expect(scoreOutput(cardJson({}), parseExpected({ expectedPackage: "growth", forbiddenClaims: [], forbiddenAngles: [] })).failures[0].code).toBe("PACKAGE");
    expect(scoreOutput(cardJson({}), parseExpected({ expectedPackage: "none", expectedWedge: "none", forbiddenClaims: [], forbiddenAngles: [] })).passed).toBe(true);
  });
  it("reads catalog-style names, roomOne fallback, and object wedges defensively", () => {
    expect(readPackageAndWedge(cardJson({ recommendedPackage: "FineDine Growth", wedge: "Bill Wait" }))).toEqual({ recommendedPackage: "growth", wedge: "bill_wait" });
    expect(readPackageAndWedge({ headAgent: { roomOne: { plan: "starter", wedge: "reservation" } } })).toEqual({ recommendedPackage: "starter", wedge: "reservation" });
    expect(readPackageAndWedge(cardJson({ wedge: { id: "marketplace" } })).wedge).toBe("marketplace");
    expect(readPackageAndWedge(cardJson({ recommendedPackage: "Enterprise" })).recommendedPackage).toBe("unknown");
    expect(readPackageAndWedge({})).toEqual({ recommendedPackage: null, wedge: null });
  });
  it("still applies the module rule when allowedModules is set", () => {
    const r = scoreOutput(cardJson({ recommendedPackage: "growth", wedge: "reservation" }),
      parseExpected({ expectedPackage: "growth", expectedWedge: "reservation", allowedModules: ["qr_menu"], forbiddenClaims: [], forbiddenAngles: [] }));
    expect(r.failures.map(f => f.code)).toEqual(["MODULE"]);
  });
});
describe("previewScore", () => {
  it("returns Turkish stay reasons without saving anything", () => {
    const r = previewScore(cardJson({ recommendedPackage: "premium", wedge: "guest_repeat" }), { expectedPackage: "starter", expectedWedge: "reservation", forbiddenClaims: [], forbiddenAngles: [] });
    expect(r.passed).toBe(false);
    expect(r.failures).toEqual([
      { code: "PACKAGE", message: "Kalır, çünkü paket yanlış: Kart: Premium · Beklenen: Starter" },
      { code: "WEDGE", message: "Kalır, çünkü kaçak yanlış: Kart: Tekrar gelen misafir · Beklenen: Rezervasyon" },
    ]);
  });
  it("passes a matching snapshot and rejects invalid rules", () => {
    expect(previewScore(cardJson({ recommendedPackage: "growth", wedge: "reservation" }), { expectedPackage: "growth", forbiddenClaims: [], forbiddenAngles: [] })).toEqual({ passed: true, failures: [] });
    expect(() => previewScore({}, { expectedPackage: "gold" })).toThrow("invalid expected");
  });
  it("labels the new codes", () => {
    expect(failureLabel("PACKAGE")).toBe("Paket yanlış");
    expect(failureLabel("WEDGE")).toBe("Kaçak yanlış");
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
