// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyApprovedClaimGate } from "@/lib/control/claim-gate";

function decision(talkTrack = "18% upsell") {
  return {
    primaryAngle: "faster turns",
    talkTrack,
    reasoning: "Open on faster turns.",
    recommendedPackage: null,
    recommendedModules: [{ why: "18% upsell" }],
    excludedModules: [],
    sourceConflicts: [{ claim: "18% upsell", sources: ["seed"], note: "seed claim" }],
  };
}

describe("applyApprovedClaimGate", () => {
  it("drops an unapproved upsell string", () => {
    const warnings: string[] = [];
    const next = applyApprovedClaimGate(decision(), ["faster turns"], warnings);
    expect(JSON.stringify(next)).not.toContain("18% upsell");
    expect(warnings).toContain("unapproved claim dropped");
    expect(next.reasoning).toContain("faster turns");
    expect(next.primaryAngle).toBe("faster turns");
  });

  it("leaves the decision unchanged when no claim is approved", () => {
    const original = decision();
    const next = applyApprovedClaimGate(original, [], []);
    expect(next.talkTrack).toBe("18% upsell");
    expect(next.sourceConflicts).toHaveLength(1);
  });
});
