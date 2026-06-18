/**
 * ICP draft sanitization + mapping to the IdealCustomerProfile row.
 *
 * The wizard hands us a (possibly user-edited) IcpDraft. We sanitize it into
 * the exact column set ICP_SCORER reads, keeping the plain-text `description`
 * as the human surface and the structured weights/thresholds as the machine
 * inputs. `confidence` / `sources` are NOT persisted on the row — they go into
 * `sourceJson` for provenance.
 */
import type { IcpDraft, DraftSource } from "./types";

const DESCRIPTION_MAX = 4000;

function toStringArray(value: unknown, maxItems = 20, maxLen = 120): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, maxLen));
    if (out.length >= maxItems) break;
  }
  return out;
}

function toWeightMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) {
      out[k.slice(0, 80)] = Math.max(-1, Math.min(1, v));
    }
  }
  return out;
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampFloat(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.min(max, value));
}

/** Coerce arbitrary JSON into a well-formed IcpDraft (defensive parse). */
export function sanitizeIcpDraft(input: unknown): IcpDraft {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const sources: DraftSource[] = Array.isArray(raw.sources)
    ? (raw.sources as unknown[])
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({
          url: typeof s.url === "string" ? s.url.slice(0, 500) : "",
          evidence: typeof s.evidence === "string" ? s.evidence.slice(0, 500) : "",
        }))
        .filter((s) => s.url)
        .slice(0, 10)
    : [];

  return {
    description:
      typeof raw.description === "string" ? raw.description.trim().slice(0, DESCRIPTION_MAX) : "",
    industryWeights: toWeightMap(raw.industryWeights),
    subNicheWeights: toWeightMap(raw.subNicheWeights),
    priceLevelMin: clampInt(raw.priceLevelMin, 0, 4),
    priceLevelMax: clampInt(raw.priceLevelMax, 0, 4),
    minReviewCount: clampInt(raw.minReviewCount, 0, 100000),
    minRating: clampFloat(raw.minRating, 0, 5),
    digitalMaturityFloor: clampInt(raw.digitalMaturityFloor, 0, 100),
    highValueSignals: toStringArray(raw.highValueSignals),
    negativeSignals: toStringArray(raw.negativeSignals),
    locationFit:
      raw.locationFit && typeof raw.locationFit === "object" && !Array.isArray(raw.locationFit)
        ? (raw.locationFit as Record<string, unknown>)
        : {},
    confidence: clampFloat(raw.confidence, 0, 1) ?? undefined,
    sources: sources.length ? sources : undefined,
  };
}

/**
 * Map a sanitized ICP draft to the structured columns of IdealCustomerProfile.
 * Excludes `workspaceId`, `name`, and `version` (managed by the caller).
 */
export function mapIcpDraftToProfile(draft: IcpDraft) {
  return {
    industryWeights: draft.industryWeights,
    subNicheWeights: draft.subNicheWeights,
    priceLevelMin: draft.priceLevelMin,
    priceLevelMax: draft.priceLevelMax,
    minReviewCount: draft.minReviewCount,
    minRating: draft.minRating,
    digitalMaturityFloor: draft.digitalMaturityFloor,
    highValueSignals: draft.highValueSignals,
    negativeSignals: draft.negativeSignals,
    locationFit: draft.locationFit,
    description: draft.description || null,
  };
}

/** Build the `sourceJson` provenance blob persisted alongside the ICP row. */
export function buildIcpSourceJson(draft: IcpDraft): Record<string, unknown> {
  return {
    confidence: draft.confidence ?? null,
    sources: draft.sources ?? [],
    extractedAt: new Date().toISOString(),
  };
}
