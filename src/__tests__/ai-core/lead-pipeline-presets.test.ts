/**
 * Tests for `getDefaultChain(preset, plan)` — the lead_created chain
 * resolver used by `planner.ts:resolveLeadCreatedChain`.
 *
 * Post-V2-cleanup — the SDR-Brain substrate was trimmed to the
 * workers that produce restaurant-tech-relevant output:
 * ICP_SCORER (T1) + TRIGGER_DETECTOR (T2) + WHY_NOW_SYNTHESIZER (T2,
 * BALANCED+ only). The dropped enterprise-residue workers
 * (ACCOUNT_TIER_RANKER, BANT_INFERRER, COMMERCIAL_INSIGHT_MATCHER,
 * BUYING_COMMITTEE_MAPPER, OBJECTION_PREDICTOR) must NOT reappear in
 * any preset.
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

/**
 * Workers that were removed in the V2 enterprise cleanup. None of
 * them should appear in any preset — keep this list in sync with
 * `LEAD_PIPELINE_ALLOWED_WORKERS` in `chains.ts`.
 */
const REMOVED_V2_WORKERS: AgentWorkerKind[] = [
  "ACCOUNT_TIER_RANKER",
  "BANT_INFERRER",
  "COMMERCIAL_INSIGHT_MATCHER",
  "BUYING_COMMITTEE_MAPPER",
  "OBJECTION_PREDICTOR",
];

describe("getDefaultChain — LITE preset (post-V2-cleanup substrate)", () => {
  // FREE plan is the most representative LITE workspace — design
  // partners default here. PRO_TEAM matrix would just unlock more
  // quota; the chain composition itself does not change.
  const lite = getDefaultChainForUi("LITE", "FREE");

  it("includes the surviving SDR-Brain substrate workers", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("ICP_SCORER"), "ICP_SCORER missing from LITE").toBe(true);
    expect(kinds.has("TRIGGER_DETECTOR"), "TRIGGER_DETECTOR missing from LITE").toBe(true);
    expect(kinds.has("REVIEW_ANALYST"), "REVIEW_ANALYST missing from LITE").toBe(true);
  });

  it("does NOT include the removed V2 enterprise residue workers", () => {
    const kinds = new Set(kindsIn(lite));
    for (const removed of REMOVED_V2_WORKERS) {
      expect(kinds.has(removed), `${removed} should not appear in LITE (V2 residue)`).toBe(false);
    }
  });

  it("does NOT include BALANCED-only enrichment", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("WHY_NOW_SYNTHESIZER")).toBe(false);
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
      "TRIGGER_DETECTOR",
      "REVIEW_ANALYST",
    ];
    for (const kind of substrate) {
      const step = stepByKind(lite, kind);
      expect(step?.optional, `${kind} must be optional in LITE`).toBe(true);
    }
  });

  it("intelligence_brief waits for the LITE substrate", () => {
    const brief = stepById(lite, "intelligence_brief");
    expect(brief).toBeDefined();
    expect(brief!.workerKind).toBe("LEAD_INTELLIGENCE_BRIEF");
    expect(brief!.dependsOn).toEqual(
      expect.arrayContaining([
        "score",
        "embed_profile",
        "icp_scorer",
        "triggers",
        "review_refresh",
      ]),
    );
  });

  it("intelligence_brief is the last step of the LITE chain", () => {
    expect(stepIdsIn(lite).at(-1)).toBe("intelligence_brief");
  });

  it("every LITE worker is whitelisted in LEAD_PIPELINE_ALLOWED_WORKERS", () => {
    for (const kind of kindsIn(lite)) {
      expect(
        LEAD_PIPELINE_ALLOWED_WORKERS.has(kind),
        `${kind} missing from LEAD_PIPELINE_ALLOWED_WORKERS`,
      ).toBe(true);
    }
  });

  it("LEAD_PIPELINE_ALLOWED_WORKERS does not whitelist any removed V2 workers", () => {
    for (const removed of REMOVED_V2_WORKERS) {
      expect(
        LEAD_PIPELINE_ALLOWED_WORKERS.has(removed),
        `${removed} should not be whitelisted (V2 residue)`,
      ).toBe(false);
    }
  });
});

describe("getDefaultChain — BALANCED preset (post-V2-cleanup)", () => {
  const balanced = getDefaultChainForUi("BALANCED", "PRO");

  it("retains WHY_NOW_SYNTHESIZER and dossier in BALANCED", () => {
    const kinds = new Set(kindsIn(balanced));
    expect(kinds.has("WHY_NOW_SYNTHESIZER")).toBe(true);
    expect(kinds.has("LEAD_DOSSIER_GENERATOR")).toBe(true);
  });

  it("does NOT include the removed V2 enterprise residue workers", () => {
    const kinds = new Set(kindsIn(balanced));
    for (const removed of REMOVED_V2_WORKERS) {
      expect(kinds.has(removed), `${removed} should not appear in BALANCED (V2 residue)`).toBe(false);
    }
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

  it("no preset × plan combination resurrects the removed V2 workers", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        const kinds = new Set(kindsIn(getDefaultChainForUi(preset, plan)));
        for (const removed of REMOVED_V2_WORKERS) {
          expect(
            kinds.has(removed),
            `${preset}/${plan} resurrected ${removed}`,
          ).toBe(false);
        }
      }
    }
  });
});
