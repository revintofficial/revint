// @vitest-environment node
import { expect, it, vi } from "vitest";
const { call, loop, update } = vi.hoisted(() => ({ call: vi.fn(), loop: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/ai-core/agent/claude", () => ({ callClaudeJson: call, runClaudeToolLoop: loop, parseClaudeJson: vi.fn(), isAnthropicConfigured: () => true, getHeadAgentModel: () => "mock" }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { update }, agentRun: { update } } }));
import { replayHeadAgentDecision } from "@/lib/ai-core/agent/head-agent";

it("uses only frozen input, no tools and no source writes, through the brief contract", async () => {
 call.mockResolvedValue({ data: { package: "premium", wedge: "multi_location", primaryAngle: "One panel for both venues", sentences: [{ text: "Both venues on this account run separate menus and prices.", evidence: ["E1"] }] }, usage: { totalTokens: 1 } });
 const snapshot = { businessName: "Burger House", rating: 4.8, reviewCount: 200, locationCount: 2, audit: { reachable: true }, briefContext: { salesConfidence: 87, headline: "old" }, evidenceRefs: [], excludedModules: [] };
 const output = await replayHeadAgentDecision(snapshot);
 expect(output.briefMode).toBe("head-agent");
 expect(output.headAgent).toMatchObject({ recommendedPackage: "premium", wedge: "multi_location" });
 expect(output.headAgent.roomTwo.status).toBe("attached");
 // salesConfidence is the package fit score, not the frozen brief value.
 expect(output.salesConfidence).toBe(output.headAgent.confidence);
 expect(output.headline).toBe("old");
 expect(call).toHaveBeenCalledOnce();
 expect(call.mock.calls[0][0]).not.toHaveProperty("tools");
 expect(call.mock.calls[0][0].user).toContain("Burger House");
 expect(loop).not.toHaveBeenCalled();
 expect(update).not.toHaveBeenCalled();
});

it("a replay whose talk breaks QA becomes a plain card instead of throwing", async () => {
 call.mockReset();
 call.mockResolvedValue({ data: { package: "premium", wedge: "multi_location", sentences: [{ text: "Help guests come back with a loyalty program.", evidence: ["E1"] }] }, usage: { totalTokens: 1 } });
 const output = await replayHeadAgentDecision({ businessName: "Burger House", locationCount: 2, audit: { reachable: true } });
 expect(output.headAgent.talkTrack).toBe("");
 expect(output.headAgent.recommendedPackage).toBe("premium");
 expect(output.headAgent.roomTwo.status).toBe("qa_failed");
 expect(call).toHaveBeenCalledOnce();
});
