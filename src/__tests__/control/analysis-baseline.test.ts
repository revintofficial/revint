// src/__tests__/control/analysis-baseline.test.ts
import { describe, expect, it } from "vitest";
import {
  aggregateBaseline,
  renderBaselineMarkdown,
  reviewQuotesOf,
  stepState,
  summarizeLead,
  type BaselineLeadInput,
} from "@/lib/control/analysis-baseline";

const finished = new Date("2026-10-02T10:00:00Z");

function input(over: Partial<BaselineLeadInput> = {}): BaselineLeadInput {
  return {
    leadId: "lead_1",
    businessName: "Padella",
    runs: {
      APIFY_GMAPS_DEEP: { id: "r1", status: "SUCCEEDED", outputJson: { reviewsCount: 80 }, finishedAt: finished },
      WEBSITE_AUDITOR: { id: "r2", status: "SUCCEEDED", outputJson: { reachable: true }, finishedAt: finished },
      REVIEW_ANALYST: { id: "r3", status: "SUCCEEDED", outputJson: { skipped: "thin_corpus" }, finishedAt: finished },
      LEAD_INTELLIGENCE_BRIEF: {
        id: "r4",
        status: "SUCCEEDED",
        finishedAt: finished,
        outputJson: {
          briefMode: "head-agent",
          missingSources: ["reviews"],
          headAgent: {
            wedge: "bill_wait",
            recommendedPackage: "starter",
            roomTwo: { status: "attached" },
            roomOne: { evidence: ['yorum: "waited ages for the bill"', "site — menü PDF"] },
          },
        },
      },
    },
    roomOneAudit: { bookingProvider: "OpenTable", hasPrepayment: null, deliveryPlatforms: [], tableCount: null },
    reviewTexts: ["Lovely pasta but we waited ages for the bill."],
    nextActionCreatedAt: null,
    hubspotProps: { revint_recommended_angle: "Hesap bekleme → Starter", revint_next_best_action: "" },
    ...over,
  };
}

describe("stepState", () => {
  it("separates skipped, failed and missing from ok", () => {
    expect(stepState(null)).toBe("missing");
    expect(stepState({ id: "x", status: "FAILED", outputJson: null, finishedAt: null })).toBe("failed");
    expect(stepState({ id: "x", status: "SUCCEEDED", outputJson: { skipped: true }, finishedAt: null })).toBe("skipped");
    expect(stepState({ id: "x", status: "SUCCEEDED_NO_MEMORY", outputJson: {}, finishedAt: null })).toBe("ok");
  });
});

describe("reviewQuotesOf", () => {
  it("reads both evidence shapes and ignores site evidence", () => {
    expect(reviewQuotesOf(['yorum: "a b c"', 'yorum (3/80): "d e f"', "site — x"])).toEqual(["a b c", "d e f"]);
  });
});

describe("summarizeLead", () => {
  it("reports step states, known rule inputs and verified review quotes", () => {
    const s = summarizeLead(input());
    expect(s.steps.REVIEW_ANALYST).toBe("skipped");
    expect(s.known.bookingProvider).toBe(true);
    expect(s.known.hasPrepayment).toBe(false);
    expect(s.known.deliveryPlatforms).toBe(false); // empty array is not knowledge
    expect(s.brief).toMatchObject({ mode: "head-agent", wedge: "bill_wait", plan: "starter", roomTwo: "attached" });
    expect(s.reviewQuotes).toEqual({ total: 1, verified: 1 });
    expect(s.hubspotFilled).toEqual(["revint_recommended_angle"]);
  });

  it("counts a quote that is in no review as unverified", () => {
    const s = summarizeLead(input({ reviewTexts: ["Great food."] }));
    expect(s.reviewQuotes).toEqual({ total: 1, verified: 0 });
  });

  it("flags a skipped brief that would still write an angle to HubSpot", () => {
    const runs = input().runs;
    const s = summarizeLead(
      input({
        runs: { ...runs, LEAD_INTELLIGENCE_BRIEF: { id: "r4", status: "SUCCEEDED", outputJson: { skipped: "head_agent_off" }, finishedAt: finished } },
      }),
    );
    expect(s.flags.skippedBriefWritesHubspot).toBe(true);
  });

  it("flags an open next action that is older than the brief", () => {
    const s = summarizeLead(input({ nextActionCreatedAt: new Date("2026-06-21T00:00:00Z") }));
    expect(s.flags.staleNextAction).toBe(true);
  });
});

describe("aggregateBaseline", () => {
  it("turns per-lead rows into rates and a markdown report", () => {
    const report = aggregateBaseline([summarizeLead(input()), summarizeLead(input({ leadId: "lead_2", roomOneAudit: null }))]);
    expect(report.leads).toBe(2);
    expect(report.knownRate.bookingProvider).toBe(50);
    expect(report.knownRate.hasPrepayment).toBe(0);
    expect(report.wedges).toEqual({ bill_wait: 2 });
    expect(report.reviewQuotes).toEqual({ total: 2, verified: 2 });
    expect(renderBaselineMarkdown(report)).toContain("| hasPrepayment | 0% |");
  });
});
