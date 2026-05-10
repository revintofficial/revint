/**
 * Phase 1 unit — `deriveLeadDetailStage` 8-stage matrix.
 *
 * Covers every DealStage + PipelineStage cell, the watchlist-absent
 * path, and the lastContactedAt fallback.
 */
import { describe, expect, it } from "vitest";

import {
  deriveLeadDetailStage,
  type DealStageInput,
  type PipelineStageInput,
} from "@/lib/lead-detail/derive-stage";
import type { LeadDetailV2Stage } from "@/lib/lead-detail/use-pipeline-stage";

const DEAL_CASES: Array<[DealStageInput, LeadDetailV2Stage]> = [
  ["PROSPECTING", "COLD"],
  ["PREPARATION", "COLD"],
  ["APPROACH", "CONTACTED"],
  ["DISCOVERY", "REPLIED"],
  ["PRESENTATION", "MEETING_BOOKED"],
  ["OBJECTION_HANDLING", "NEGOTIATING"],
  ["NEGOTIATION", "NEGOTIATING"],
  ["CLOSING", "PROPOSAL"],
  ["WON", "WON"],
  ["LOST", "LOST"],
  ["FOLLOWUP", "CONTACTED"],
];

const PIPELINE_CASES: Array<[PipelineStageInput, LeadDetailV2Stage]> = [
  ["NEW", "COLD"],
  ["REACHED_OUT", "CONTACTED"],
  ["IN_TALKS", "REPLIED"],
  ["WON", "WON"],
  ["LOST", "LOST"],
];

describe("deriveLeadDetailStage — DealStage matrix", () => {
  it.each(DEAL_CASES)(
    "dealStage=%s maps to %s when pipelineStage is the default NEW",
    (deal, expected) => {
      const stage = deriveLeadDetailStage(
        { lastContactedAt: null },
        { dealStage: deal, pipelineStage: "NEW" },
      );
      expect(stage).toBe(expected);
    },
  );
});

describe("deriveLeadDetailStage — PipelineStage fallback", () => {
  it.each(PIPELINE_CASES)(
    "pipelineStage=%s maps to %s when dealStage is the default PROSPECTING",
    (pipeline, expected) => {
      const stage = deriveLeadDetailStage(
        { lastContactedAt: null },
        { dealStage: "PROSPECTING", pipelineStage: pipeline },
      );
      expect(stage).toBe(expected);
    },
  );
});

describe("deriveLeadDetailStage — fallbacks", () => {
  it("returns COLD when no watchlistItem and no lastContactedAt", () => {
    expect(
      deriveLeadDetailStage({ lastContactedAt: null }, null),
    ).toBe("COLD");
  });

  it("returns CONTACTED when no watchlistItem but lastContactedAt is set", () => {
    expect(
      deriveLeadDetailStage(
        { lastContactedAt: new Date("2026-01-01T00:00:00Z") },
        null,
      ),
    ).toBe("CONTACTED");
  });

  it("prefers dealStage over pipelineStage when both are non-default", () => {
    expect(
      deriveLeadDetailStage(
        { lastContactedAt: null },
        { dealStage: "PRESENTATION", pipelineStage: "REACHED_OUT" },
      ),
    ).toBe("MEETING_BOOKED");
  });

  it("returns COLD for an empty watchlist row (default values both)", () => {
    expect(
      deriveLeadDetailStage(
        { lastContactedAt: null },
        { dealStage: "PROSPECTING", pipelineStage: "NEW" },
      ),
    ).toBe("COLD");
  });

  it("treats null/undefined inputs safely", () => {
    expect(deriveLeadDetailStage(null, null)).toBe("COLD");
    expect(deriveLeadDetailStage(undefined, undefined)).toBe("COLD");
  });
});
