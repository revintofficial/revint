/**
 * M4 regression - the WEBSITE_MOCKUP_GENERATOR monthly limit used to
 * be hard-coded in `quota.ts` (FREE: 20, PRO: 100, PRO_TEAM: 500,
 * AGENCY: UNLIMITED) while the customer-facing pricing page advertised
 * different numbers via `PLANS[plan].mockupsPerCycle` (3, 50, 150,
 * 300). Users could generate roughly 3x what they paid for. The fix
 * makes PLANS the single source of truth.
 */
import { describe, expect, it } from "vitest";
import { getLimit } from "@/lib/agent-workers/quota";
import { PLANS } from "@/lib/plans";
import type { Plan } from "@/generated/prisma/client";

describe("quota.getLimit - M4 mockup quota source of truth", () => {
  for (const plan of ["FREE", "PRO", "PRO_TEAM", "AGENCY"] as Plan[]) {
    it(`WEBSITE_MOCKUP_GENERATOR limit on ${plan} matches PLANS.mockupsPerCycle`, () => {
      expect(getLimit("WEBSITE_MOCKUP_GENERATOR", plan)).toBe(
        PLANS[plan].mockupsPerCycle,
      );
    });
  }

  it("does not derive other workers from PLANS", () => {
    // Sanity check - only WEBSITE_MOCKUP_GENERATOR is special-cased.
    // OPENER_WRITER stays at the launch-policy table value, NOT
    // mockupsPerCycle.
    expect(getLimit("OPENER_WRITER", "PRO")).not.toBe(PLANS.PRO.mockupsPerCycle);
  });
});
