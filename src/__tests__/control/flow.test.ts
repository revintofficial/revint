// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/control/audit", () => ({ writeAdminAudit: vi.fn() }));
vi.mock("@/lib/control/roles", () => ({ resolveControlLens: vi.fn(), roleAtLeast: () => true }));
import { buildFlowStages, flowHeadline, type FlowInput } from "@/lib/control/flow";
import { isSkippedBrief } from "@/lib/control/review";

const empty: FlowInput = { lens: "TECHNICAL", briefs: [], latestSkip: null, caseSourceRunIds: [], lastBaseline: null, lastCandidate: null };
const states = (input: FlowInput) => buildFlowStages(input).map((stage) => stage.state);

it("with no brief, the brief stage is next and everything after it is locked", () => {
  expect(states(empty)).toEqual(["next", "locked", "locked", "locked", "locked"]);
});

it("says why there is no brief when the newest one stopped before deciding", () => {
  const stages = buildFlowStages({ ...empty, latestSkip: "head_agent_off" });
  expect(stages[0].detail).toContain("Head agent kapalı");
  expect(flowHeadline(stages)).toContain("Sıradaki adım: Brief.");
});

it("points the reviewer at the briefs waiting on their own lens", () => {
  const stages = buildFlowStages({
    ...empty,
    briefs: [
      { agentRunId: "a", missingLenses: ["TECHNICAL", "SALES"] },
      { agentRunId: "b", missingLenses: ["SALES"] },
      { agentRunId: "c", missingLenses: [] },
    ],
  });
  expect(stages.map((stage) => stage.state)).toEqual(["done", "next", "open", "locked", "locked"]);
  expect(stages[1].count).toBe("1/3");
  expect(stages[1].detail).toContain("1 brief senin merceğini (Teknik) bekliyor.");
  // One brief has all three lenses and is not a reference case yet.
  expect(stages[2].detail).toContain("1 brief üç merceği tamamladı");
});

it("tells a viewer without a lens that they cannot write a verdict", () => {
  const stages = buildFlowStages({ ...empty, lens: null, briefs: [{ agentRunId: "a", missingLenses: ["SALES"] }] });
  expect(stages[1].detail).toContain("Sana mercek atanmadı");
});

it("a promoted brief no longer waits; the baseline count becomes the next step", () => {
  const input: FlowInput = { ...empty, briefs: [{ agentRunId: "c", missingLenses: [] }], caseSourceRunIds: ["c"] };
  expect(states(input)).toEqual(["done", "done", "done", "next", "locked"]);
  expect(states({ ...input, lastBaseline: { passed: 1, total: 1 } })).toEqual(["done", "done", "done", "done", "next"]);
  const done = buildFlowStages({ ...input, lastBaseline: { passed: 1, total: 1 }, lastCandidate: { passed: 1, total: 1 } });
  expect(done.every((stage) => stage.state === "done")).toBe(true);
  expect(flowHeadline(done)).toContain("bütün adımları tamam");
});

it("treats a brief with a skip reason and no brief mode as nothing to review", () => {
  expect(isSkippedBrief({ skipped: "head_agent_off" })).toBe(true);
  expect(isSkippedBrief({ skipped: true, reason: "x" })).toBe(true);
  expect(isSkippedBrief({ briefMode: "head-agent", headAgent: {} })).toBe(false);
  expect(isSkippedBrief({ briefMode: "legacy" })).toBe(false);
  expect(isSkippedBrief({})).toBe(false);
  expect(isSkippedBrief(null)).toBe(false);
});
