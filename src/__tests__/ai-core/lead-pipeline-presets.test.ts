/**
 * Tests for `getDefaultChain(preset, plan)` — the lead_created chain
 * resolver used by `planner.ts:resolveLeadCreatedChain`.
 *
 * Phase 1 of the SDR-Brain-v2 sentez plan extends the LITE preset
 * with the SDR-Brain substrate (TRIGGER_DETECTOR, BANT_INFERRER,
 * ICP_SCORER, BUYING_COMMITTEE_MAPPER, REVIEW_ANALYST). These tests
 * lock in the new shape so a future "let's slim down LITE" PR can't
 * silently drop the brain substrate again.
 *
 * No DB, no network — pure structural assertions on the resolved
 * chain definition.
 */
import { describe, it, expect } from "vitest";
import { LEAD_PIPELINE_ALLOWED_WORKERS, type Chain } from "@/lib/ai-core/chains";
import { getDefaultChainForUi } from "@/lib/ai-core/planner";
import type {
  AgentWorkerKind,
  PipelinePreset,
  Plan,
} from "@/generated/prisma/client";

function kindsIn(chain: Chain): AgentWorkerKind[] {
  return chain.map((s) => s.workerKind);
}

function stepIdsIn(chain: Chain): string[] {
  return chain.map((s) => s.stepId);
}

function stepByKind(chain: Chain, kind: AgentWorkerKind) {
  return chain.find((s) => s.workerKind === kind);
}

function stepById(chain: Chain, id: string) {
  return chain.find((s) => s.stepId === id);
}

describe("getDefaultChain — LITE preset (SDR Brain Phase 1 substrate)", () => {
  // FREE plan is the most representative LITE workspace — design
  // partners default here. PRO_TEAM matrix would just unlock more
  // quota; the chain composition itself does not change.
  const lite = getDefaultChainForUi("LITE", "FREE");

  it("includes the SDR-Brain substrate workers", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("ICP_SCORER"), "ICP_SCORER missing from LITE").toBe(true);
    expect(kinds.has("ACCOUNT_TIER_RANKER"), "ACCOUNT_TIER_RANKER missing from LITE").toBe(true);
    expect(kinds.has("BANT_INFERRER"), "BANT_INFERRER missing from LITE").toBe(true);
    expect(kinds.has("TRIGGER_DETECTOR"), "TRIGGER_DETECTOR missing from LITE").toBe(true);
    expect(kinds.has("BUYING_COMMITTEE_MAPPER"), "BUYING_COMMITTEE_MAPPER missing from LITE").toBe(true);
    expect(kinds.has("REVIEW_ANALYST"), "REVIEW_ANALYST missing from LITE").toBe(true);
  });

  it("does NOT include BALANCED-only T2 reasoners", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("WHY_NOW_SYNTHESIZER")).toBe(false);
    expect(kinds.has("COMMERCIAL_INSIGHT_MATCHER")).toBe(false);
    expect(kinds.has("OBJECTION_PREDICTOR")).toBe(false);
  });

  it("does NOT include Apify enrichment", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("APIFY_GMAPS_DEEP")).toBe(false);
    expect(kinds.has("APIFY_WEB_CRAWL_DEEP")).toBe(false);
    expect(kinds.has("SOCIAL_SCRAPER")).toBe(false);
    expect(kinds.has("LEAD_DOSSIER_GENERATOR")).toBe(false);
  });

  it("LITE TRIGGER_DETECTOR step depends only on score (no apify_webcrawl)", () => {
    const triggers = stepByKind(lite, "TRIGGER_DETECTOR");
    expect(triggers).toBeDefined();
    expect(triggers!.dependsOn).toEqual(["score"]);
    expect(triggers!.optional).toBe(true);
  });

  it("LITE REVIEW_ANALYST step depends only on score (no apify_gmaps)", () => {
    const review = stepByKind(lite, "REVIEW_ANALYST");
    expect(review).toBeDefined();
    expect(review!.dependsOn).toEqual(["score"]);
    expect(review!.optional).toBe(true);
  });

  it("every SDR-Brain substrate step is optional (chain doesn't stall on any failure)", () => {
    const substrate: AgentWorkerKind[] = [
      "ICP_SCORER",
      "ACCOUNT_TIER_RANKER",
      "BANT_INFERRER",
      "TRIGGER_DETECTOR",
      "BUYING_COMMITTEE_MAPPER",
      "REVIEW_ANALYST",
    ];
    for (const kind of substrate) {
      const step = stepByKind(lite, kind);
      expect(step?.optional, `${kind} must be optional in LITE`).toBe(true);
    }
  });

  it("intelligence_brief waits for the full LITE substrate (not just score+embed)", () => {
    const brief = stepById(lite, "intelligence_brief");
    expect(brief).toBeDefined();
    expect(brief!.workerKind).toBe("LEAD_INTELLIGENCE_BRIEF");
    // Must depend on every substrate step so the T3 brain pass has
    // the full T2 snapshot when it runs.
    expect(brief!.dependsOn).toEqual(
      expect.arrayContaining([
        "score",
        "embed_profile",
        "icp_scorer",
        "account_tier",
        "bant",
        "triggers",
        "review_refresh",
        "committee",
      ]),
    );
  });

  it("intelligence_brief is the last step of the LITE chain", () => {
    expect(stepIdsIn(lite).at(-1)).toBe("intelligence_brief");
  });

  it("every LITE worker is whitelisted in LEAD_PIPELINE_ALLOWED_WORKERS", () => {
    for (const kind of kindsIn(lite)) {
      // The sentinel embed_profile step reuses SALES_OPPORTUNITY_SCORER
      // as a placeholder workerKind; both must be in the allowed set.
      expect(
        LEAD_PIPELINE_ALLOWED_WORKERS.has(kind),
        `${kind} missing from LEAD_PIPELINE_ALLOWED_WORKERS`,
      ).toBe(true);
    }
  });
});

describe("getDefaultChain — BALANCED preset unchanged by Phase 1", () => {
  // Phase 1 must not regress BALANCED behaviour. BALANCED keeps its
  // existing T2 reasoners, dossier, and Apify enrichment.
  const balanced = getDefaultChainForUi("BALANCED", "PRO");

  it("retains the BALANCED-only T2 reasoners", () => {
    const kinds = new Set(kindsIn(balanced));
    expect(kinds.has("WHY_NOW_SYNTHESIZER")).toBe(true);
    expect(kinds.has("COMMERCIAL_INSIGHT_MATCHER")).toBe(true);
    expect(kinds.has("OBJECTION_PREDICTOR")).toBe(true);
    expect(kinds.has("LEAD_DOSSIER_GENERATOR")).toBe(true);
  });

  it("BALANCED TRIGGER_DETECTOR still waits for apify_webcrawl", () => {
    const triggers = stepByKind(balanced, "TRIGGER_DETECTOR");
    expect(triggers).toBeDefined();
    expect(triggers!.dependsOn.sort()).toEqual(["apify_webcrawl", "score"].sort());
  });

  it("BALANCED REVIEW_ANALYST still waits for apify_gmaps", () => {
    const review = stepByKind(balanced, "REVIEW_ANALYST");
    expect(review).toBeDefined();
    expect(review!.dependsOn).toEqual(["apify_gmaps"]);
  });
});

describe("getDefaultChain — preset matrix sanity", () => {
  const presets: PipelinePreset[] = ["LITE", "BALANCED", "AGGRESSIVE"];
  const plans: Plan[] = ["FREE", "PRO", "PRO_TEAM", "AGENCY"];

  it("every preset × plan combination produces a non-empty chain", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        const chain = getDefaultChainForUi(preset, plan);
        expect(
          chain.length,
          `${preset}/${plan} should produce at least one step`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("every preset has intelligence_brief as a step (canonical artifact)", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        const chain = getDefaultChainForUi(preset, plan);
        const brief = chain.find((s) => s.workerKind === "LEAD_INTELLIGENCE_BRIEF");
        expect(
          brief,
          `${preset}/${plan} chain is missing LEAD_INTELLIGENCE_BRIEF`,
        ).toBeDefined();
      }
    }
  });

  it("LITE on FREE includes SDR-Brain substrate (regression guard for design partners)", () => {
    const liteFree = getDefaultChainForUi("LITE", "FREE");
    const kinds = new Set(kindsIn(liteFree));
    // Sanity: the exact set that was missing pre-Phase-1.
    expect(kinds.has("TRIGGER_DETECTOR")).toBe(true);
    expect(kinds.has("BANT_INFERRER")).toBe(true);
    expect(kinds.has("ICP_SCORER")).toBe(true);
    expect(kinds.has("BUYING_COMMITTEE_MAPPER")).toBe(true);
    expect(kinds.has("REVIEW_ANALYST")).toBe(true);
  });
});
