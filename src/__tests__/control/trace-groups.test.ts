import { describe, expect, it } from "vitest";
import { TRACE_GROUPS, groupForKind } from "@/lib/control/trace-groups";

describe("TRACE_GROUPS", () => {
  it("matches the four-step chain, in chain order", () => {
    expect(TRACE_GROUPS.map((g) => g.label)).toEqual([
      "Harita",
      "Site",
      "Yorum",
      "Karar",
    ]);
    expect(TRACE_GROUPS.flatMap((g) => g.kinds)).toEqual([
      "APIFY_GMAPS_DEEP",
      "WEBSITE_AUDITOR",
      "REVIEW_ANALYST",
      "LEAD_INTELLIGENCE_BRIEF",
    ]);
  });

  it("does not carry the retired score worker", () => {
    expect(TRACE_GROUPS.flatMap((g) => g.kinds)).not.toContain(
      "SALES_OPPORTUNITY_SCORER",
    );
  });

  it("resolves a kind to its group label", () => {
    expect(groupForKind("REVIEW_ANALYST")).toBe("Yorum");
    expect(groupForKind("LEAD_INTELLIGENCE_BRIEF")).toBe("Karar");
  });

  it("returns null for a worker that is not part of the automatic chain", () => {
    expect(groupForKind("OPENER_WRITER")).toBeNull();
  });
});
