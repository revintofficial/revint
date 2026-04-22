/**
 * Unit tests for AI Core chain definitions.
 *
 * Covers structural invariants every CHAIN entry must satisfy so typos
 * or regressions are caught at CI rather than failing at runtime inside
 * the orchestrator. No DB, no network.
 */
import { describe, it, expect } from "vitest";
import { CHAINS, SENTINEL_STEPS, type Chain } from "@/lib/ai-core/chains";

function topoSort(chain: Chain): string[] {
  const remaining = new Map(chain.map((s) => [s.stepId, new Set(s.dependsOn)]));
  const order: string[] = [];
  while (remaining.size > 0) {
    const readyIds: string[] = [];
    for (const [id, deps] of remaining) {
      if (deps.size === 0) readyIds.push(id);
    }
    if (readyIds.length === 0) {
      throw new Error(
        `Cycle detected in chain: remaining=${Array.from(remaining.keys()).join(",")}`,
      );
    }
    for (const id of readyIds) {
      order.push(id);
      remaining.delete(id);
    }
    for (const deps of remaining.values()) {
      for (const id of readyIds) deps.delete(id);
    }
  }
  return order;
}

describe("ai-core chains - structural invariants", () => {
  it("every chain has unique stepIds and valid dependsOn references", () => {
    for (const [event, chain] of Object.entries(CHAINS)) {
      if (!chain) continue;
      const ids = new Set<string>();
      for (const step of chain) {
        expect(ids.has(step.stepId), `${event}: duplicate stepId ${step.stepId}`).toBe(false);
        ids.add(step.stepId);
      }
      for (const step of chain) {
        for (const dep of step.dependsOn) {
          expect(ids.has(dep), `${event}: step ${step.stepId} depends on unknown ${dep}`).toBe(true);
        }
      }
    }
  });

  it("every chain is acyclic (topo-sort yields an ordering that covers all steps)", () => {
    for (const [event, chain] of Object.entries(CHAINS)) {
      if (!chain) continue;
      const order = topoSort(chain);
      expect(order, `${event}: topo order count mismatch`).toHaveLength(chain.length);
      expect(new Set(order).size).toBe(chain.length);
    }
  });
});

describe("ai-core chains - lead_created", () => {
  const chain = CHAINS.lead_created!;

  it("has the embed_profile sentinel as its last step", () => {
    const last = chain[chain.length - 1];
    expect(last.inputs?.__sentinel).toBe(SENTINEL_STEPS.EMBED_LEAD_PROFILE);
  });

  it("score depends on audit and review", () => {
    const score = chain.find((s) => s.stepId === "score");
    expect(score).toBeDefined();
    expect(score!.dependsOn.sort()).toEqual(["audit", "review"].sort());
  });

  it("includes APIFY_SERP_RANK as an optional step that runs after audit", () => {
    const serp = chain.find((s) => s.stepId === "serp");
    expect(serp).toBeDefined();
    expect(serp!.workerKind).toBe("APIFY_SERP_RANK");
    expect(serp!.optional).toBe(true);
    expect(serp!.dependsOn).toEqual(["audit"]);
  });

  it("social depends on audit AND serp so SERP-harvested profiles are included", () => {
    const social = chain.find((s) => s.stepId === "social");
    expect(social).toBeDefined();
    expect(social!.dependsOn.sort()).toEqual(["audit", "serp"].sort());
  });

  it("score does NOT depend on the optional serp step (free tier must still score)", () => {
    const score = chain.find((s) => s.stepId === "score");
    expect(score!.dependsOn).not.toContain("serp");
  });
});

describe("ai-core chains - inbox_reply_received", () => {
  const chain = CHAINS.inbox_reply_received!;

  it("has the write_outcome sentinel as its last step", () => {
    const last = chain[chain.length - 1];
    expect(last.inputs?.__sentinel).toBe(SENTINEL_STEPS.WRITE_OPENER_OUTCOME);
  });

  it("write_outcome depends on attribute", () => {
    const outcome = chain.find((s) => s.stepId === "write_outcome");
    expect(outcome!.dependsOn).toEqual(["attribute"]);
  });
});

describe("ai-core chains - user_deep_research", () => {
  const chain = CHAINS.user_deep_research!;

  it("has exactly 5 APIFY_* root steps with no dependencies", () => {
    const apifyRoots = chain.filter(
      (s) =>
        typeof s.workerKind === "string" &&
        s.workerKind.startsWith("APIFY_") &&
        s.dependsOn.length === 0,
    );
    const rootKinds = apifyRoots.map((s) => s.workerKind).sort();
    expect(rootKinds).toEqual(
      [
        "APIFY_GMAPS_DEEP",
        "APIFY_WEB_CRAWL_DEEP",
        "APIFY_INSTAGRAM_DEEP",
        "APIFY_FACEBOOK_DEEP",
        "APIFY_SERP_RANK",
      ].sort(),
    );
  });

  it("score_refresh depends on review_refresh", () => {
    const scoreRefresh = chain.find((s) => s.stepId === "score_refresh");
    expect(scoreRefresh!.dependsOn).toEqual(["review_refresh"]);
  });

  it("competitor_ads depends on serp", () => {
    const competitorAds = chain.find((s) => s.stepId === "competitor_ads");
    expect(competitorAds!.dependsOn).toEqual(["serp"]);
  });
});

describe("ai-core chains - user_receptionist_with_kb", () => {
  const chain = CHAINS.user_receptionist_with_kb!;

  it("receptionist depends on webcrawl", () => {
    const receptionist = chain.find((s) => s.stepId === "receptionist");
    expect(receptionist!.dependsOn).toEqual(["webcrawl"]);
  });
});
