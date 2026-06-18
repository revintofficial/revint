/**
 * Calibration-first onboarding — shared draft contracts.
 *
 * These types describe the JSON the WORKSPACE_CONTEXT_EXTRACTOR worker
 * writes into `WorkspaceOnboardingDraft` and that the onboarding wizard
 * reads/edits before confirming into the real `IdealCustomerProfile` /
 * `ServicePackage` rows. AI predictions live ONLY in the draft until the
 * user confirms them.
 */

/** Lifecycle of the onboarding draft / calibration worker. */
export type OnboardingDraftStatus = "PENDING" | "RUNNING" | "READY" | "FAILED";

export const ONBOARDING_DRAFT_STATUSES: OnboardingDraftStatus[] = [
  "PENDING",
  "RUNNING",
  "READY",
  "FAILED",
];

/** Evidence source backing an AI-extracted field. */
export interface DraftSource {
  url: string;
  evidence: string;
}

/**
 * ICP draft — plain-text `description` is the primary user-facing surface;
 * the structured fields are the machine inputs ICP_SCORER consumes. Shape
 * mirrors `IdealCustomerProfile` plus draft-only `confidence` / `sources`.
 */
export interface IcpDraft {
  description: string;
  industryWeights: Record<string, number>;
  subNicheWeights: Record<string, number>;
  priceLevelMin: number | null;
  priceLevelMax: number | null;
  minReviewCount: number | null;
  minRating: number | null;
  digitalMaturityFloor: number | null;
  highValueSignals: string[];
  negativeSignals: string[];
  locationFit: Record<string, unknown>;
  /** 0..1 model confidence. Draft-only — not persisted on the ICP row. */
  confidence?: number;
  /** Pages the draft was extracted from. Draft-only. */
  sources?: DraftSource[];
}

/** A single draft service package. */
export interface PackageDraft {
  name: string;
  priceLabel: string;
  features: string[];
  isPopular: boolean;
  sortOrder: number;
  /** Draft-only provenance fields. */
  confidence?: number;
  sourceUrl?: string;
}

/**
 * Company context the extractor distilled from the crawl. Used for copy +
 * source drawer; not directly persisted on the workspace beyond the inputs.
 */
export interface CompanyContext {
  companyName?: string;
  summary?: string;
  valueProposition?: string;
  targetCustomers?: string;
  warnings?: string[];
  sources?: DraftSource[];
}

/** An empty ICP draft used as a manual-entry fallback when crawl fails. */
export function emptyIcpDraft(): IcpDraft {
  return {
    description: "",
    industryWeights: {},
    subNicheWeights: {},
    priceLevelMin: null,
    priceLevelMax: null,
    minReviewCount: null,
    minRating: null,
    digitalMaturityFloor: null,
    highValueSignals: [],
    negativeSignals: [],
    locationFit: {},
  };
}
