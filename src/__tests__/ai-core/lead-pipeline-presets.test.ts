/**
 * Tests for `getDefaultChain(preset, plan)` — the lead_created chain
 * resolver used by `planner.ts:resolveLeadCreatedChain`.
 *
 * 2026-09-29 — the default chain is three evidence collectors plus one
 * decision. See `docs/admin-paneli-son-karar.md` §5 (Çelişki 1) and
 * `docs/analiz-ve-playbook.md` §3. The interpreting workers (score,
 * dossier, ICP, why-now, trigger) no longer run automatically: the
 * only decision lives inside LEAD_INTELLIGENCE_BRIEF's head agent.
 * They stay in the enum and still run when an SDR clicks
 * (`user_one_click_pitch`, `user_deep_research`).
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
 * Workers that must never appear in an automatic chain. The first
 * five are the V2 enterprise residue; the rest were retired on
 * 2026-09-29 because they wrote a second sales narrative on top of
 * the brief, or produced empty output on real FineDine accounts.
 */
const REMOVED_V2_WORKERS: AgentWorkerKind[] = [
  "ACCOUNT_TIER_RANKER",
  "BANT_INFERRER",
  "COMMERCIAL_INSIGHT_MATCHER",
  "BUYING_COMMITTEE_MAPPER",
  "OBJECTION_PREDICTOR",
  "SALES_OPPORTUNITY_SCORER",
  "LEAD_DOSSIER_GENERATOR",
  "ICP_SCORER",
  "TRIGGER_DETECTOR",
  "WHY_NOW_SYNTHESIZER",
  "APIFY_WEB_CRAWL_DEEP",
  "GOOGLE_PLACES_REVIEWS",
  "SOCIAL_SCRAPER",
  "APIFY_SERP_RANK",
  "EMAIL_VERIFIER",
  "SUBVERTICAL_CLASSIFIER",
  "OPENER_WRITER",
  "WEBSITE_MOCKUP_GENERATOR",
];

describe("getDefaultChain — BALANCED is map, site, reviews, decision", () => {
  const balanced = getDefaultChainForUi("BALANCED", "AGENCY");

  it("is exactly the four-step chain in order", () => {
    expect(stepIdsIn(balanced)).toEqual([
      "apify_gmaps",
      "audit",
      "review_refresh",
      "intelligence_brief",
    ]);
  });

  it("maps each step to its worker", () => {
    expect(kindsIn(balanced)).toEqual([
      "APIFY_GMAPS_DEEP",
      "WEBSITE_AUDITOR",
      "REVIEW_ANALYST",
      "LEAD_INTELLIGENCE_BRIEF",
    ]);
  });

  it("the brief waits for every data step", () => {
    const brief = stepById(balanced, "intelligence_brief");
    expect(brief).toBeDefined();
    expect(brief!.dependsOn.slice().sort()).toEqual(
      ["apify_gmaps", "audit", "review_refresh"].sort(),
    );
  });

  it("reviews wait for the map corpus", () => {
    const review = stepByKind(balanced, "REVIEW_ANALYST");
    expect(review!.dependsOn).toEqual(["apify_gmaps"]);
  });

  it("every step is optional so one dead source never stalls the brief", () => {
    for (const step of balanced) {
      expect(step.optional, `${step.stepId} must be optional`).toBe(true);
    }
  });

  it("AGGRESSIVE matches BALANCED", () => {
    expect(stepIdsIn(getDefaultChainForUi("AGGRESSIVE", "AGENCY"))).toEqual(
      stepIdsIn(balanced),
    );
  });
});

describe("getDefaultChain — LITE keeps site and decision", () => {
  const lite = getDefaultChainForUi("LITE", "FREE");

  it("is audit plus the brief", () => {
    expect(stepIdsIn(lite)).toEqual(["audit", "intelligence_brief"]);
  });

  it("does not reach for Apify", () => {
    const kinds = new Set(kindsIn(lite));
    expect(kinds.has("APIFY_GMAPS_DEEP")).toBe(false);
  });

  it("does not analyse reviews it has no corpus for", () => {
    expect(new Set(kindsIn(lite)).has("REVIEW_ANALYST")).toBe(false);
  });

  it("the brief waits for the audit", () => {
    expect(stepById(lite, "intelligence_brief")!.dependsOn).toEqual(["audit"]);
  });
});

describe("getDefaultChain — a FREE workspace on BALANCED degrades cleanly", () => {
  const free = getDefaultChainForUi("BALANCED", "FREE");

  it("drops the plan-gated map pull but keeps the rest", () => {
    expect(stepIdsIn(free)).toEqual(["audit", "review_refresh", "intelligence_brief"]);
  });

  it("does not leave a dangling dependency on the dropped step", () => {
    const ids = new Set(stepIdsIn(free));
    for (const step of free) {
      for (const dep of step.dependsOn) {
        expect(ids.has(dep), `${step.stepId} depends on missing ${dep}`).toBe(true);
      }
    }
  });
});

describe("getDefaultChain — retired workers stay retired", () => {
  const presets: PipelinePreset[] = ["LITE", "BALANCED", "AGGRESSIVE"];
  const plans: Plan[] = ["FREE", "PRO", "PRO_TEAM", "AGENCY"];

  it("no preset x plan combination resurrects a retired worker", () => {
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

  it("LEAD_PIPELINE_ALLOWED_WORKERS is exactly the four chain workers", () => {
    expect([...LEAD_PIPELINE_ALLOWED_WORKERS].sort()).toEqual(
      [
        "APIFY_GMAPS_DEEP",
        "LEAD_INTELLIGENCE_BRIEF",
        "REVIEW_ANALYST",
        "WEBSITE_AUDITOR",
      ].sort(),
    );
  });

  it("every emitted worker is whitelisted", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        for (const kind of kindsIn(getDefaultChainForUi(preset, plan))) {
          expect(
            LEAD_PIPELINE_ALLOWED_WORKERS.has(kind),
            `${kind} missing from LEAD_PIPELINE_ALLOWED_WORKERS`,
          ).toBe(true);
        }
      }
    }
  });
});

describe("getDefaultChain — preset matrix sanity", () => {
  const presets: PipelinePreset[] = ["LITE", "BALANCED", "AGGRESSIVE"];
  const plans: Plan[] = ["FREE", "PRO", "PRO_TEAM", "AGENCY"];

  it("every preset x plan combination produces a non-empty chain", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        expect(
          getDefaultChainForUi(preset, plan).length,
          `${preset}/${plan} should produce at least one step`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("every preset ends on the brief — the single rep-facing artifact", () => {
    for (const preset of presets) {
      for (const plan of plans) {
        const chain = getDefaultChainForUi(preset, plan);
        expect(
          stepIdsIn(chain).at(-1),
          `${preset}/${plan} does not end on intelligence_brief`,
        ).toBe("intelligence_brief");
      }
    }
  });
});
