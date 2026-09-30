// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toDecisionCard } from "@/lib/control/decision";

const HEAD_AGENT_BRIEF = {
  briefMode: "head-agent",
  salesConfidence: 70,
  headline: "Brasserie — Rezervasyon · Growth",
  missingSources: ["reviews"],
  headAgent: {
    recommendedPackage: "growth",
    wedge: "reservation",
    primaryAngle: "Rezervasyon → Growth",
    talkTrack: "",
    confidence: 70,
    recommendedModules: [],
    excludedModules: [{ module: "reservation", why: "TheFork var" }],
    evidenceRefs: ["https://b.example — rezervasyon TheFork üzerinden, depozito görünmüyor"],
    sourceConflicts: [],
    reasoning: "Oda 1",
    roomOne: {
      plan: "growth",
      wedge: "reservation",
      evidence: ["https://b.example — rezervasyon TheFork üzerinden, depozito görünmüyor"],
      bans: ["Tek şubeye Premium önerme."],
      backup: "bill_wait",
    },
    roomTwo: { status: "qa_failed", qaIssues: ["sells_outside_wedge:guest_repeat"] },
  },
};

describe("toDecisionCard — head agent package + wedge", () => {
  it("exposes wedge, recommended package and room one", () => {
    const card = toDecisionCard(HEAD_AGENT_BRIEF);
    expect(card.wedge).toBe("reservation");
    expect(card.recommendedPackage).toBe("growth");
    expect(card.roomOne).toEqual(HEAD_AGENT_BRIEF.headAgent.roomOne);
    expect(card.missingSources).toEqual(["reviews"]);
    expect(card.roomTwoStatus).toBe("qa_failed");
    // Existing fields are unchanged.
    expect(card.briefMode).toBe("head-agent");
    expect(card.salesConfidence).toBe(70);
    expect(card.talkTrack).toBeNull();
    expect(card.excludedModules).toEqual([{ module: "reservation", why: "TheFork var" }]);
    expect(card.evidenceRefs).toHaveLength(1);
  });

  it("falls back to room one's wedge and tolerates legacy briefs", () => {
    const fromRoomOne = toDecisionCard({ headAgent: { roomOne: { plan: "starter", wedge: "bill_wait", evidence: [], bans: [], backup: null } } });
    expect(fromRoomOne.wedge).toBe("bill_wait");
    const legacy = toDecisionCard({ briefMode: "legacy", salesConfidence: 40 });
    expect(legacy.wedge).toBeNull();
    expect(legacy.roomOne).toBeNull();
    expect(legacy.recommendedPackage).toBeNull();
    expect(legacy.missingSources).toEqual([]);
  });

  it("rejects an unknown wedge or plan instead of passing it through", () => {
    const card = toDecisionCard({ headAgent: { wedge: "ai_upsell", roomOne: { plan: "enterprise", wedge: "reservation" } } });
    expect(card.wedge).toBeNull();
    expect(card.roomOne).toBeNull();
  });
});
