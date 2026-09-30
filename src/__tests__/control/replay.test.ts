// @vitest-environment node
import { expect, it, vi } from "vitest";
const { call, loop, update } = vi.hoisted(() => ({ call: vi.fn(), loop: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/ai-core/agent/claude", () => ({ callClaudeJson: call, runClaudeToolLoop: loop, isAnthropicConfigured: () => true, getHeadAgentModel: () => "mock" }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { update }, agentRun: { update } } }));
import { replayHeadAgentDecision } from "@/lib/ai-core/agent/head-agent";
it("uses only frozen input, no tools and no source writes", async () => {
 call.mockResolvedValue({ data: { primaryAngle: "Guest retention", talkTrack: "Help guests come back with a loyalty program.", confidence: 80, recommendedModules: [{ module: "crm_loyalty", readiness: 80, why: "Repeat guests" }] }, usage: { totalTokens: 1 } });
 const snapshot = { businessName: "Burger House", rating: 4.8, reviewCount: 200, locationCount: 2, audit: { reachable: true }, briefContext: { salesConfidence: 87 }, evidenceRefs: [], excludedModules: [] };
 const output = await replayHeadAgentDecision(snapshot);
 expect(output.salesConfidence).toBe(87);
 expect(call).toHaveBeenCalledOnce();
 expect(call.mock.calls[0][0]).not.toHaveProperty("tools");
 expect(call.mock.calls[0][0].user).toContain("Burger House");
 expect(loop).not.toHaveBeenCalled();
 expect(update).not.toHaveBeenCalled();
});
