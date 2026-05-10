/**
 * SDR Brain v2 — reasoning graph builder unit tests.
 *
 * The builder is a thin Json-shape factory used by SDR_BRAIN T3 +
 * helpers. Tests guarantee:
 *   1. The output JSON conforms to ReasoningGraph (nodes/edges/etc.).
 *   2. `addContradiction` mirrors a CONTRADICTS edge into the edge list.
 *   3. `assertGraphIntegrity` rejects dangling edge references.
 */
import { describe, it, expect } from "vitest";
import {
  ReasoningGraphBuilder,
  assertGraphIntegrity,
  type ReasoningGraph,
  type ContradictionRecord,
} from "@/lib/sdr-brain/reasoning-graph";

describe("ReasoningGraphBuilder", () => {
  it("builds an empty graph with the model version + ISO timestamp", () => {
    const g = new ReasoningGraphBuilder("sdr-brain-v2-test").build();
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.contradictions).toEqual([]);
    expect(g.modelVersion).toBe("sdr-brain-v2-test");
    expect(() => new Date(g.generatedAt).toISOString()).not.toThrow();
  });

  it("adds EVIDENCE/INFERENCE/DECISION nodes with the correct kind", () => {
    const g = new ReasoningGraphBuilder("v2")
      .addEvidence("ev.review.1", "rating dropped 0.6 in 60d", 0.8, 0.9)
      .addInference("inf.bant.timing", "timing is high", 0.7, 0.8)
      .addDecision("decision", "CALL_NOW", 1, 0.85)
      .build();
    expect(g.nodes).toHaveLength(3);
    const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
    expect(byId["ev.review.1"].kind).toBe("EVIDENCE");
    expect(byId["inf.bant.timing"].kind).toBe("INFERENCE");
    expect(byId["decision"].kind).toBe("DECISION");
  });

  it("link() appends an edge with the requested type", () => {
    const g = new ReasoningGraphBuilder("v2")
      .addEvidence("ev.a", "evidence a", 0.5, 0.9)
      .addInference("inf.b", "inference b", 0.6, 0.8)
      .link("ev.a", "inf.b", "DERIVES")
      .build();
    expect(g.edges).toEqual([{ from: "ev.a", to: "inf.b", type: "DERIVES" }]);
  });

  it("last-write-wins for nodes with the same id", () => {
    const g = new ReasoningGraphBuilder("v2")
      .addEvidence("ev.dup", "v1", 0.1, 0.5)
      .addEvidence("ev.dup", "v2", 0.4, 0.7)
      .build();
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0].content).toBe("v2");
  });

  it("addContradiction also writes a CONTRADICTS edge into the edge list", () => {
    const record: ContradictionRecord = {
      code: "BANT_TIMING_VS_WHY_NOW_URGENCY",
      fromNodeId: "inf.bant.timing",
      toNodeId: "inf.why_now",
      reason: "BANT timing high but why-now urgency low",
      resolution: "PREFER_FIRST",
      resolverNote: "favor BANT timing — recent triggers",
    };
    const g = new ReasoningGraphBuilder("v2")
      .addInference("inf.bant.timing", "timing high", 0.7, 0.8)
      .addInference("inf.why_now", "no urgency", 0.4, 0.6)
      .addContradiction(record)
      .build();
    expect(g.contradictions).toHaveLength(1);
    expect(g.contradictions[0]).toEqual(record);
    expect(g.edges).toEqual([
      { from: "inf.bant.timing", to: "inf.why_now", type: "CONTRADICTS" },
    ]);
  });

  it("preserves insertion order in the edges array", () => {
    const g = new ReasoningGraphBuilder("v2")
      .addEvidence("a", "", 1, 1)
      .addEvidence("b", "", 1, 1)
      .addEvidence("c", "", 1, 1)
      .link("a", "b", "DERIVES")
      .link("b", "c", "SUPPORTS")
      .link("a", "c", "OVERRIDES")
      .build();
    expect(g.edges.map((e) => e.type)).toEqual(["DERIVES", "SUPPORTS", "OVERRIDES"]);
  });

  it("supports source metadata on evidence nodes", () => {
    const g = new ReasoningGraphBuilder("v2")
      .addEvidence("ev.audit", "no booking", 0.6, 0.9, {
        workerKind: "WEBSITE_AUDITOR",
        refType: "WebsiteAudit",
        refId: "audit-123",
      })
      .build();
    expect(g.nodes[0].source).toEqual({
      workerKind: "WEBSITE_AUDITOR",
      refType: "WebsiteAudit",
      refId: "audit-123",
    });
  });
});

describe("assertGraphIntegrity", () => {
  function buildValid(): ReasoningGraph {
    return new ReasoningGraphBuilder("v2")
      .addEvidence("a", "", 1, 1)
      .addEvidence("b", "", 1, 1)
      .link("a", "b", "DERIVES")
      .build();
  }

  it("passes a well-formed graph", () => {
    expect(() => assertGraphIntegrity(buildValid())).not.toThrow();
  });

  it("throws when an edge points to an undeclared node", () => {
    const g = buildValid();
    g.edges.push({ from: "a", to: "ghost", type: "SUPPORTS" });
    expect(() => assertGraphIntegrity(g)).toThrow(/unknown node "ghost"/);
  });

  it("throws when an edge originates at an undeclared node", () => {
    const g = buildValid();
    g.edges.push({ from: "ghost", to: "a", type: "SUPPORTS" });
    expect(() => assertGraphIntegrity(g)).toThrow(/unknown node "ghost"/);
  });

  it("throws when a contradiction record references an undeclared node", () => {
    const g = buildValid();
    g.contradictions.push({
      code: "BOGUS",
      fromNodeId: "a",
      toNodeId: "ghost",
      reason: "x",
      resolution: "PREFER_FIRST",
      resolverNote: "n",
    });
    expect(() => assertGraphIntegrity(g)).toThrow(/unknown node "ghost"/);
  });
});
