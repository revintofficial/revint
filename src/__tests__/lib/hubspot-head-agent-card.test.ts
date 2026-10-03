import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/integrations/hubspot/client", () => ({
  getHubspotClient: vi.fn(),
  HubspotNotConnectedError: class extends Error {},
}));
vi.mock("@/lib/playbook/resolve", () => ({ getPlaybook: vi.fn() }));
vi.mock("@/lib/playbook/angle", () => ({
  pickAngle: vi.fn(),
  absenceSignalsFromAudit: vi.fn(),
  hasSlowServiceSignal: vi.fn(),
}));

import { parseHeadAgentOutput } from "@/lib/integrations/hubspot/writeback";
import { headAgentCardDecision } from "@/lib/integrations/hubspot/head-agent-card";

const OUTPUT = {
  briefMode: "head-agent",
  missingSources: ["reviews"],
  headAgent: {
    wedge: "reservation",
    recommendedPackage: "growth",
    primaryAngle: "Rezervasyon → Growth",
    talkTrack: "Bookings run through TheFork with no deposit.",
    confidence: 70,
    evidenceRefs: ["https://x — rezervasyon TheFork üzerinden, depozito görünmüyor"],
    sourceConflicts: [],
    roomOne: { bans: ["Tek şubeye Premium önerme."] },
    roomTwo: { status: "attached" },
    excludedModules: [{ module: "qr_menu", why: "Zaten var." }],
    openQuestions: ["Rezervasyonda depozito veya kart garantisi alıyorlar mı?"],
  },
};

describe("headAgentCardDecision", () => {
  it("builds every decision row from the head agent", () => {
    const d = headAgentCardDecision(parseHeadAgentOutput(OUTPUT))!;
    expect(d.recommendedAngle).toBe("Rezervasyon → Growth");
    expect(d.recommendedAngleKey).toBe("reservation");
    expect(d.pitchThis).toBe("Bookings run through TheFork with no deposit.");
    expect(d.nextBestAction).toBe(d.pitchThis);
    expect(d.whatNotToPitch).toBe("- Tek şubeye Premium önerme.\n- qr_menu: Zaten var.");
    expect(d.evidenceSummary).toContain("TheFork");
    expect(d.openQuestions).toBe("- Rezervasyonda depozito veya kart garantisi alıyorlar mı?\n- Eksik kaynak: reviews");
  });

  it("returns null for a legacy brief so the caller keeps its fallback", () => {
    expect(headAgentCardDecision(parseHeadAgentOutput({ headAgent: { primaryAngle: "QR Menu" } }))).toBeNull();
    expect(headAgentCardDecision(null)).toBeNull();
  });

  it("keeps empty rows null on a plain card", () => {
    const plain = { ...OUTPUT, headAgent: { ...OUTPUT.headAgent, talkTrack: "" } };
    expect(headAgentCardDecision(parseHeadAgentOutput(plain))!.pitchThis).toBeNull();
  });
});
