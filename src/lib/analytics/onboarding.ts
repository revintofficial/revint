"use client";

import posthog from "posthog-js";

/**
 * Onboarding funnel events (decision file section 10). Fire-and-forget;
 * no-ops when PostHog isn't loaded (local dev / DNT). Keep event names in
 * snake_case to match the rest of the funnel taxonomy.
 */
export type OnboardingEvent =
  | "onboarding_started"
  | "workspace_step_completed"
  | "company_domain_submitted"
  | "calibration_worker_started"
  | "icp_draft_viewed"
  | "icp_draft_edited"
  | "icp_draft_confirmed"
  | "packages_draft_viewed"
  | "packages_draft_edited"
  | "packages_confirmed"
  | "hubspot_connect_started"
  | "hubspot_provisioned"
  | "hubspot_import_started"
  | "hubspot_import_completed"
  | "hubspot_skipped"
  | "first_analyzed_lead_visible"
  | "onboarding_completed";

export function trackOnboarding(
  event: OnboardingEvent,
  props?: Record<string, unknown>,
): void {
  try {
    if (typeof window === "undefined") return;
    if (!posthog.__loaded) return;
    posthog.capture(event, props);
  } catch {
    // analytics is best-effort
  }
}
