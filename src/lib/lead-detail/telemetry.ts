/**
 * lead-detail/telemetry — Phase 7 typed event catalog.
 *
 * Single source of truth for every PostHog event the Lead Detail v2
 * surface emits. PLAN §5.5 lists the catalog; this module enforces
 * it at the type level so `track(event, props)` cannot send an
 * unknown event name or a payload that drifts from the schema.
 *
 * Why this exists:
 *   - Phases 1–6 sprinkled `posthog.capture(...)` calls across many
 *     surfaces. With no central catalog, dashboards silently rotted
 *     when a key was renamed and bugs slipped in (e.g. `kind: '1d'`
 *     vs `kind: 'one_day'`).
 *   - Phase 7 mandates every emit goes through `track()` and a
 *     compile-time check (`telemetry-catalog.test.ts`) keeps every
 *     consumer honest.
 *
 * Conventions:
 *   - All event names are kebab-cased namespaces under
 *     `lead_detail.*`. Sub-namespaces use dots (`v2.viewed`,
 *     `closest_win.shown`).
 *   - All event property values are locale-independent; user-facing
 *     strings live in `t()` and never make it into PostHog.
 *   - `safeTrack()` wraps every emit so a missing `posthog.__loaded`
 *     flag, a thrown adblocker, or an SSR call cannot break the
 *     page (PLAN §6 risk #3 — telemetry must never block UI).
 */

import posthog from "posthog-js";

export type LeadDetailEventCatalog = {
  "lead_detail.v2.viewed": {
    leadId: string;
    workspaceId: string;
    pipelineStage?: string;
    planTier?: string;
  };
  "lead_detail.v2.preliminary_received": {
    leadId: string;
    workspaceId: string;
    latencyMs?: number;
  };
  "lead_detail.v2.final_received": {
    leadId: string;
    workspaceId: string;
    latencyMs: number | null;
  };
  "lead_detail.block.expanded": {
    leadId: string;
    workspaceId: string;
    blockKey:
      | "WHY_NOW"
      | "NEXT_GESTURE"
      | "WHO"
      | "DISCOVERY"
      | "QUALIFICATION"
      | "HISTORY"
      | "ACCOUNT";
  };
  "lead_detail.evidence_chip.opened": {
    leadId: string;
    chipType:
      | "linkedin"
      | "review"
      | "audit"
      | "voice-note"
      | "prior-nba"
      | "contradiction";
  };
  "lead_detail.snooze": {
    leadId: string;
    kind: "1d" | "3d" | "1w" | "custom" | "trigger";
    triggerType?: string;
  };
  "lead_detail.disposition": {
    leadId: string;
    disposition: "connected" | "voicemail" | "no_answer" | "wrong_number";
  };
  "lead_detail.queue.advance": {
    leadId: string;
    position: number;
    totalToday: number;
    direction?: "next" | "prev";
  };
  "lead_detail.closest_win.shown": {
    leadId: string;
    sisterLeadId: string | null;
    insightId: string;
  };
  "lead_detail.closest_win.applied": {
    leadId: string;
    insightId: string;
  };
  "lead_detail.power_tools.viewed": {
    leadId: string;
  };
  "lead_detail.reasoning.viewed": {
    leadId: string;
    actionId: string;
  };
  "lead_detail.legacy_hash_consumed": {
    leadId: string;
    workspaceId: string;
    hash: string;
  };
  "lead_detail.legacy_workers_link_followed": {
    leadId: string;
    workspaceId?: string;
  };
  "lead_detail.perf.preliminary_to_paint": {
    event: "preliminary_to_paint";
    leadId: string;
    durationMs: number;
  };
  "lead_detail.perf.final_to_paint": {
    event: "final_to_paint";
    leadId: string;
    durationMs: number;
  };
  "lead_detail.perf.first_decision_surface": {
    event: "first_decision_surface";
    leadId: string;
    durationMs: number;
  };

  // -----------------------------------------------------------------
  // Truth Layer v1 (master plan §2 contracts catalog).
  //
  // Every event under `truth.*` is pre-declared here in Wave 0 so that
  // Wave 1 tracks only have to *emit* — no track edits this catalog
  // mid-flight (avoids the file-ownership conflict §1.5 warns about).
  // T-H Observability (Wave 1) consumes these to power the
  // dashboards/truth-layer-v1.json PostHog dashboard.
  //
  // Naming convention: `truth.<contract-name>.<verb>` — keeps
  // `git grep "truth.<contract>"` honest about who emits what.
  // -----------------------------------------------------------------

  // T-A Decision Gates
  "truth.decision_gate.contact_first_fired": {
    leadId: string;
    workspaceId: string;
    hasPhone: boolean;
    hasEmail: boolean;
  };
  "truth.decision_gate.authority_first_fired": {
    leadId: string;
    workspaceId: string;
    authorityScore: number;
  };
  "truth.icp_rozet.capped": {
    leadId: string;
    workspaceId: string;
    rawScore: number;
    cappedScore: number;
  };
  "truth.nba.decision_resolved": {
    leadId: string;
    workspaceId: string;
    type:
      | "EMAIL_FIRST"
      | "CALL_FIRST"
      | "WAIT"
      | "DROP"
      | "CONTACT_DISCOVERY_FIRST";
    blockingGate: "no_contact" | "low_authority" | "outside_icp" | "snoozed" | "none";
  };

  // T-B Locale Gate
  "truth.locale.resolved": {
    leadId: string;
    workspaceId: string;
    locale: "tr-TR" | "en-GB" | "en-US" | "de-DE" | "es-ES" | "fr-FR";
    source: "lead_country_dominant" | "workspace_default" | "fallback";
  };
  "truth.locale.workspace_lead_mismatch": {
    leadId: string;
    workspaceId: string;
    workspaceLocale: string;
    leadCountry: string | null;
  };

  // T-C Evidence Calibration
  "truth.severity.normalized": {
    leadId: string;
    workspaceId: string;
    rawSeverity: number;
    normalizedSeverity: number;
    negRatio: number;
  };
  "truth.switch_signal.direction_assigned": {
    leadId: string;
    workspaceId: string;
    direction: "inbound" | "outbound" | "comparison_neutral";
    competitor: string;
  };
  "truth.window_timer.derived": {
    leadId: string;
    workspaceId: string;
    source: "trigger_evidence" | "queued";
  };

  // T-D Brief Truth-Grounding
  "truth.brief.pain_quoted": {
    leadId: string;
    workspaceId: string;
    count: number;
  };
  "truth.brief.hypothesis_count": {
    leadId: string;
    workspaceId: string;
    count: number;
  };
  "truth.brief.website_claim_blocked": {
    leadId: string;
    workspaceId: string;
  };

  // T-E Website Verification
  "truth.website.verify_started": {
    leadId: string;
    workspaceId: string;
  };
  "truth.website.verify_completed": {
    leadId: string;
    workspaceId: string;
    status: "confirmed_present" | "confirmed_absent" | "uncertain";
    sourcesChecked: number;
    sourcesPositive: number;
    sourcesNegative: number;
  };

  // T-F NBA Hygiene
  "truth.nba.avoidance_overlap_dropped": {
    leadId: string;
    workspaceId: string;
    droppedTopics: string[];
  };
  "truth.nba.objection_source": {
    leadId: string;
    workspaceId: string;
    source: "owner_reply" | "segment_fallback" | "model_inferred";
  };

  // T-G Surface Fidelity
  "truth.surface.review_kpi_rendered": {
    leadId: string;
    percentBase: "negative_reviews" | "total_reviews";
    count: number;
  };

  // T-H Observability — meta events (catalog drift / kill-switch tests)
  "truth.observability.kill_switch_armed": {
    flag: string;
    by: string;
  };
};

export type LeadDetailEventName = keyof LeadDetailEventCatalog;

/**
 * Frozen list of every catalog key. The
 * `telemetry-catalog.test.ts` smoke test uses this to assert the
 * runtime list and the compile-time `LeadDetailEventCatalog` keys
 * stay in lockstep.
 */
export const LEAD_DETAIL_EVENT_NAMES = Object.freeze([
  "lead_detail.v2.viewed",
  "lead_detail.v2.preliminary_received",
  "lead_detail.v2.final_received",
  "lead_detail.block.expanded",
  "lead_detail.evidence_chip.opened",
  "lead_detail.snooze",
  "lead_detail.disposition",
  "lead_detail.queue.advance",
  "lead_detail.closest_win.shown",
  "lead_detail.closest_win.applied",
  "lead_detail.power_tools.viewed",
  "lead_detail.reasoning.viewed",
  "lead_detail.legacy_hash_consumed",
  "lead_detail.legacy_workers_link_followed",
  "lead_detail.perf.preliminary_to_paint",
  "lead_detail.perf.final_to_paint",
  "lead_detail.perf.first_decision_surface",
  // Truth Layer v1
  "truth.decision_gate.contact_first_fired",
  "truth.decision_gate.authority_first_fired",
  "truth.icp_rozet.capped",
  "truth.nba.decision_resolved",
  "truth.locale.resolved",
  "truth.locale.workspace_lead_mismatch",
  "truth.severity.normalized",
  "truth.switch_signal.direction_assigned",
  "truth.window_timer.derived",
  "truth.brief.pain_quoted",
  "truth.brief.hypothesis_count",
  "truth.brief.website_claim_blocked",
  "truth.website.verify_started",
  "truth.website.verify_completed",
  "truth.nba.avoidance_overlap_dropped",
  "truth.nba.objection_source",
  "truth.surface.review_kpi_rendered",
  "truth.observability.kill_switch_armed",
] as const) satisfies readonly LeadDetailEventName[];

interface PosthogClient {
  __loaded?: boolean;
  capture?: (event: string, properties?: Record<string, unknown>) => void;
}

function getClient(): PosthogClient | null {
  if (typeof window === "undefined") return null;
  const ph = posthog as unknown as PosthogClient;
  if (!ph.__loaded) return null;
  if (typeof ph.capture !== "function") return null;
  return ph;
}

/**
 * Type-safe wrapper around `posthog.capture`. Use this everywhere
 * a Lead Detail v2 surface emits an event. The Phase 7 catalog
 * test ensures grep'ing for `posthog.capture` outside this module
 * (or the few legacy adapters) fails CI.
 */
export function track<E extends LeadDetailEventName>(
  event: E,
  props: LeadDetailEventCatalog[E],
): void {
  try {
    const ph = getClient();
    if (!ph) return;
    ph.capture!(event, props as Record<string, unknown>);
  } catch {
    // Telemetry must never break the page (PLAN §6 risk #3).
  }
}
