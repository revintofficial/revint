/**
 * Truth Layer v1 — typed error catalog.
 *
 * Owner: T-H Observability (Wave 1).
 * Wave 0 (Foundation) seeds the skeleton + the first batch of codes
 * Wave 1 tracks emit. T-H expands this into the full catalog + Sentry
 * fingerprint mapping.
 *
 * Usage:
 *   throw new TruthLayerError("E_LOCALE_MISMATCH", { ... });
 *   logger.warn(`[truth] ${TRUTH_ERROR_CODES.E_LOCALE_MISMATCH}`, { ... });
 *
 * Why typed: PostHog dashboards + Sentry alert rules pivot on the
 * error code as a discrete dimension. Free-form error strings break
 * the dashboards every time someone re-words a message.
 */

export const TRUTH_ERROR_CODES = {
  // T-A Decision Gates
  E_TRUTH_GATE_FIRED: "E_TRUTH_GATE_FIRED",
  E_NO_CONTACT_FOR_OUTREACH: "E_NO_CONTACT_FOR_OUTREACH",
  E_AUTHORITY_TOO_LOW: "E_AUTHORITY_TOO_LOW",

  // T-B Locale Gate
  E_LOCALE_MISMATCH: "E_LOCALE_MISMATCH",
  E_LOCALE_UNRESOLVABLE: "E_LOCALE_UNRESOLVABLE",

  // T-C Evidence Calibration
  E_SEVERITY_NORMALIZE_INPUT_INVALID: "E_SEVERITY_NORMALIZE_INPUT_INVALID",
  E_SWITCH_DIRECTION_AMBIGUOUS: "E_SWITCH_DIRECTION_AMBIGUOUS",

  // T-D Brief Truth-Grounding
  E_BRIEF_PAINPOINT_UNGROUNDED: "E_BRIEF_PAINPOINT_UNGROUNDED",
  E_BRIEF_WEBSITE_CLAIM_UNVERIFIED: "E_BRIEF_WEBSITE_CLAIM_UNVERIFIED",

  // T-E Website Verification
  E_WEBSITE_VERIFY_ALL_SOURCES_ERRORED: "E_WEBSITE_VERIFY_ALL_SOURCES_ERRORED",
  E_WEBSITE_VERIFY_RATE_LIMITED: "E_WEBSITE_VERIFY_RATE_LIMITED",

  // T-F NBA Hygiene
  E_AVOIDANCE_OVERLAPS_PACKAGE: "E_AVOIDANCE_OVERLAPS_PACKAGE",

  // T-H meta
  E_TELEMETRY_CATALOG_DRIFT: "E_TELEMETRY_CATALOG_DRIFT",
} as const;

export type TruthErrorCode = keyof typeof TRUTH_ERROR_CODES;

/**
 * Frozen list of every error code, in declaration order. The Sentry
 * alert config (`sentry/truth-layer-alerts.yaml`) and the catalog
 * drift test consume this so a code added here without updating the
 * Sentry rule is caught in CI.
 */
export const TRUTH_ERROR_CODE_LIST: ReadonlyArray<TruthErrorCode> = Object.freeze(
  Object.keys(TRUTH_ERROR_CODES) as TruthErrorCode[],
);

export class TruthLayerError extends Error {
  public readonly code: TruthErrorCode;
  public readonly context: Record<string, unknown>;

  constructor(code: TruthErrorCode, context: Record<string, unknown> = {}) {
    super(`[truth] ${code}`);
    this.name = "TruthLayerError";
    this.code = code;
    this.context = context;
  }
}

/**
 * Type-safe code lookup. Use this in `logger.warn` /
 * `Sentry.captureException` calls so the Sentry fingerprint stays
 * in lockstep with the catalog.
 */
export function truthCode(code: TruthErrorCode): string {
  return TRUTH_ERROR_CODES[code];
}

/**
 * Canonical Sentry fingerprint for a TruthLayerError. Sentry groups
 * events by fingerprint — keeping `"truth-layer"` as the first
 * segment and the typed `code` as the second prevents one chatty
 * lead from drowning out the structural pattern, and prevents two
 * unrelated codes from being collapsed into the same issue when
 * Sentry's default stack-grouping accidentally matches.
 *
 * Usage:
 *   Sentry.captureException(err, {
 *     fingerprint: truthFingerprint(err.code, lead.workspaceId),
 *   });
 *
 * The optional `scope` is appended as a third segment when present
 * (e.g. workspaceId, lead-detail surface name). Omit it for
 * cross-workspace aggregations that should bucket together.
 */
export function truthFingerprint(
  code: TruthErrorCode,
  scope?: string,
): string[] {
  const fp = ["truth-layer", TRUTH_ERROR_CODES[code]];
  if (scope) fp.push(scope);
  return fp;
}
