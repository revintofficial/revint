/**
 * Truth Layer contract — `NextBestActionType`.
 *
 * Producer: T-A Decision Gates (`src/lib/sdr-brain/buying-readiness.ts`,
 * `src/lib/agent-workers/icp-scorer.ts`).
 * Consumers: T-F NBA Hygiene, T-H Observability, lead-detail v2 UI.
 *
 * This is the AI-worker output type — distinct from the DB enum
 * `NextActionKind` which carries persisted action rows. Worker outputs
 * may downgrade a high-level decision into one of several persisted
 * `NextActionKind` values (e.g. `EMAIL_FIRST` → `EMAIL_FIRST` or
 * `ENROLL_IN_CAMPAIGN` depending on workspace cadence config).
 *
 * Contract version is checked at compile time by `scripts/check-contracts.ts`.
 * Bump per §1.4 of the master plan: any *removal* or *type change* of an
 * existing field is a major bump; additive optional fields are minor.
 */

export const __contractVersion = 1;

export type NextBestActionType =
  | "EMAIL_FIRST"
  | "CALL_FIRST"
  | "WAIT"
  | "DROP"
  | "CONTACT_DISCOVERY_FIRST";

export type BlockingGate =
  | "no_contact"
  | "low_authority"
  | "outside_icp"
  | "snoozed";

export interface NbaOutput {
  type: NextBestActionType;
  rationale: string;
  blockingGate?: BlockingGate | null;
  /** 0..1, calibrated against historical reply/connect rates by CI-N. */
  confidence: number;
}
