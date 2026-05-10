/**
 * SDR Brain v2 — preliminary NBA derivation from BANT.
 *
 * The `BANT_INFERRER` worker (T1) calls this immediately after the
 * audit + ICP_SCORER outputs land so the lead detail page can render
 * an NBA card within ~3-5s of `lead_created` emit, before the full
 * T3 SDR_BRAIN run finishes (~15-25s later).
 *
 * The output is intentionally a low-confidence (40%), short-window
 * recommendation. T3 SDR_BRAIN upserts a `isPreliminary = false` row
 * later that supersedes this one. Storing the preliminary row lets us:
 *   - render the UI optimistically
 *   - measure "did the rep act on the preliminary that turned out to
 *     be wrong vs the final NBA" via the OUTCOME_ATTRIBUTOR rollup
 */
import type { NextActionKind, Channel } from "@/generated/prisma/client";
import type { BuyingReadiness } from "./buying-readiness";

export interface PreliminaryNbaInput {
  bant: BuyingReadiness;
  /** Lead-level priors. */
  lead: {
    icpFitScore: number | null;
    dnc: boolean;
    optedOutAt: Date | null;
    timezone: string | null;
    hasWebsite: boolean;
    websiteUrl: string | null;
  };
  triggerCount: number;
}

export interface PreliminaryNbaOutput {
  actionKind: NextActionKind;
  channel: Channel | null;
  timingWindowStart: Date | null;
  timingWindowEnd: Date | null;
  confidence: number; // always 40 for preliminary
  reasoning: string;
  triggerIds: string[]; // empty here — T3 SDR_BRAIN populates real cite list
  qualificationGap: string[];
  isPreliminary: true;
}

export function derivePreliminaryNba(input: PreliminaryNbaInput): PreliminaryNbaOutput {
  const { bant, lead } = input;

  // Hard guards — DNC / opt-out trumps everything.
  if (lead.dnc || lead.optedOutAt) {
    return {
      actionKind: "DROP_LEAD",
      channel: null,
      timingWindowStart: null,
      timingWindowEnd: null,
      confidence: 40,
      reasoning: "DNC flag set — outbound forbidden until consent restored.",
      triggerIds: [],
      qualificationGap: [],
      isPreliminary: true,
    };
  }

  const qualificationGap: string[] = [];
  if (bant.budget < 30) qualificationGap.push("budget");
  if (bant.authority < 30) qualificationGap.push("authority");
  if (bant.need < 30) qualificationGap.push("need");
  if (bant.timing < 30) qualificationGap.push("timing");

  // Decision tree — coarse, deterministic. T3 SDR_BRAIN refines.
  const overall = bant.overall;

  // Strong overall + at least one trigger → call now.
  if (overall >= 70 && input.triggerCount > 0) {
    return {
      actionKind: "CALL_NOW",
      channel: "PHONE",
      timingWindowStart: new Date(),
      timingWindowEnd: nextBusinessHourEnd(lead.timezone),
      confidence: 40,
      reasoning: `BANT overall ${overall} with ${input.triggerCount} active trigger(s) — preliminary CALL_NOW; T3 may downgrade.`,
      triggerIds: [],
      qualificationGap,
      isPreliminary: true,
    };
  }

  // Strong overall + no triggers → schedule for next window so we
  // don't burn outbound capacity on something we have no story for.
  if (overall >= 70) {
    return {
      actionKind: "CALL_AT_WINDOW",
      channel: "PHONE",
      timingWindowStart: nextBusinessHourStart(lead.timezone),
      timingWindowEnd: nextBusinessHourEnd(lead.timezone),
      confidence: 40,
      reasoning: `BANT overall ${overall} but no fresh triggers — preliminary CALL_AT_WINDOW.`,
      triggerIds: [],
      qualificationGap,
      isPreliminary: true,
    };
  }

  // Mid-tier — email-first.
  if (overall >= 45) {
    return {
      actionKind: "EMAIL_FIRST",
      channel: "EMAIL",
      timingWindowStart: new Date(),
      timingWindowEnd: nextBusinessHourEnd(lead.timezone),
      confidence: 40,
      reasoning: `BANT overall ${overall} (mid-tier) — preliminary EMAIL_FIRST. Refine after T3.`,
      triggerIds: [],
      qualificationGap,
      isPreliminary: true,
    };
  }

  // Low overall — research more before reaching out.
  if (overall < 25) {
    return {
      actionKind: "WAIT_FOR_REPLY",
      channel: null,
      timingWindowStart: null,
      timingWindowEnd: null,
      confidence: 40,
      reasoning: `BANT overall ${overall} too low for outbound — preliminary WAIT_FOR_REPLY pending T3 enrichment.`,
      triggerIds: [],
      qualificationGap,
      isPreliminary: true,
    };
  }

  // Anything in 25..45 — re-engage cold.
  return {
    actionKind: "RE_ENGAGE",
    channel: "EMAIL",
    timingWindowStart: nextBusinessHourStart(lead.timezone),
    timingWindowEnd: addDays(new Date(), 7),
    confidence: 40,
    reasoning: `BANT overall ${overall} (cold) — preliminary RE_ENGAGE; T3 may reclassify.`,
    triggerIds: [],
    qualificationGap,
    isPreliminary: true,
  };
}

function nextBusinessHourStart(timezone: string | null): Date {
  // Naive: just round to the next 9am UTC. The T3 SDR_BRAIN does
  // proper local-time aware scheduling; this is a placeholder for the
  // preliminary card which the rep is not expected to dial on directly.
  void timezone;
  const d = new Date();
  d.setUTCHours(9, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function nextBusinessHourEnd(timezone: string | null): Date {
  void timezone;
  const d = new Date();
  d.setUTCHours(17, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
