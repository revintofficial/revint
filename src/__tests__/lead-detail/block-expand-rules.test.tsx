/**
 * Phase 1 — stage-driven expand/collapse contract.
 *
 * For each pipeline stage in `LEAD_DETAIL_V2_EXPAND_RULES` the
 * corresponding `Block` should mount in the right state:
 *   - "expanded" rule  → Block renders the body
 *   - "stub" rule      → Block renders the collapsed-stub button
 *
 * Asserts the COLD case explicitly per the PLAN test surface
 * (`given pipelineStage = COLD, WHO is expanded, DISCOVERY is a
 * stub`) and walks the full table for each block as a contract.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Block } from "@/components/app/lead-detail-v2/Block";
import {
  LEAD_DETAIL_V2_EXPAND_RULES,
  type LeadDetailV2BlockKey,
  type LeadDetailV2Stage,
} from "@/lib/lead-detail/use-pipeline-stage";

const STAGES: LeadDetailV2Stage[] = [
  "COLD",
  "CONTACTED",
  "REPLIED",
  "MEETING_BOOKED",
  "PROPOSAL",
  "NEGOTIATING",
  "WON",
  "LOST",
];

const BLOCK_KEYS: LeadDetailV2BlockKey[] = [
  "WHY_NOW",
  "NEXT_GESTURE",
  "WHO",
  "DISCOVERY",
  "QUALIFICATION",
  "HISTORY",
  "ACCOUNT",
];

function renderBlock(rule: "expanded" | "stub", id: string) {
  const state = rule === "expanded" ? "expanded" : "collapsed-stub";
  return render(
    <Block
      id={id}
      title="Test"
      state={state}
      stub={<span data-testid={`${id}-stub-content`}>stub</span>}
    >
      <span data-testid={`${id}-expanded-content`}>body</span>
    </Block>,
  );
}

describe("Stage-driven expand rules — per stage matrix", () => {
  for (const stage of STAGES) {
    for (const block of BLOCK_KEYS) {
      const rule = LEAD_DETAIL_V2_EXPAND_RULES[stage][block];
      it(`stage=${stage} block=${block} rule=${rule}`, () => {
        const { queryByTestId } = renderBlock(rule, `${stage}-${block}`);
        const expandedNode = queryByTestId(`${stage}-${block}-expanded-content`);
        const stubNode = queryByTestId(`${stage}-${block}-stub-content`);
        if (rule === "expanded") {
          expect(expandedNode).not.toBeNull();
          expect(stubNode).toBeNull();
        } else {
          expect(expandedNode).toBeNull();
          expect(stubNode).not.toBeNull();
        }
      });
    }
  }
});

describe("Stage-driven expand rules — COLD canonical sample", () => {
  it("WHO is expanded on COLD; DISCOVERY is a stub", () => {
    expect(LEAD_DETAIL_V2_EXPAND_RULES.COLD.WHO).toBe("expanded");
    expect(LEAD_DETAIL_V2_EXPAND_RULES.COLD.DISCOVERY).toBe("stub");
  });
});
