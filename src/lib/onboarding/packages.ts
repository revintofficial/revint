/**
 * Package draft sanitization + validation for onboarding confirmation.
 *
 * Mirrors the limits enforced by /api/workspace/packages and adds dedupe on
 * package name (the ServicePackage table has @@unique([workspaceId, name])).
 */
import type { PackageDraft } from "./types";

export const PACKAGE_NAME_MAX = 80;
export const PACKAGE_PRICE_MAX = 40;
export const PACKAGE_FEATURE_MAX = 120;
export const PACKAGE_FEATURES_COUNT_MAX = 8;
export const PACKAGES_COUNT_MAX = 12;

export interface SanitizedPackages {
  packages: PackageDraft[];
  /** Names that collided and were dropped (case-insensitive dedupe). */
  droppedDuplicates: string[];
}

function sanitizeFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const f of value) {
    if (typeof f !== "string") continue;
    const trimmed = f.trim();
    if (!trimmed) continue;
    out.push(trimmed.slice(0, PACKAGE_FEATURE_MAX));
    if (out.length >= PACKAGE_FEATURES_COUNT_MAX) break;
  }
  return out;
}

/**
 * Coerce arbitrary JSON into a clean, deduped, ordered list of PackageDrafts.
 * Drops entries without a usable name/price; dedupes by lowercased name.
 */
export function sanitizePackageDrafts(input: unknown): SanitizedPackages {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const droppedDuplicates: string[] = [];
  const packages: PackageDraft[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, PACKAGE_NAME_MAX) : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) {
      droppedDuplicates.push(name);
      continue;
    }
    seen.add(key);

    const priceLabel =
      typeof r.priceLabel === "string" && r.priceLabel.trim()
        ? r.priceLabel.trim().slice(0, PACKAGE_PRICE_MAX)
        : "Contact for pricing";

    packages.push({
      name,
      priceLabel,
      features: sanitizeFeatures(r.features),
      isPopular: r.isPopular === true,
      sortOrder:
        typeof r.sortOrder === "number" && Number.isFinite(r.sortOrder)
          ? Math.round(r.sortOrder)
          : packages.length,
      confidence:
        typeof r.confidence === "number" && Number.isFinite(r.confidence)
          ? Math.max(0, Math.min(1, r.confidence))
          : undefined,
      sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl.slice(0, 500) : undefined,
    });
    if (packages.length >= PACKAGES_COUNT_MAX) break;
  }

  // Re-index sortOrder to a stable 0..n sequence after dedupe/clamp.
  packages
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach((p, i) => {
      p.sortOrder = i;
    });

  return { packages, droppedDuplicates };
}

/** Validate the confirmed package set. Returns an error message or null. */
export function validateConfirmedPackages(packages: PackageDraft[]): string | null {
  if (packages.length === 0) {
    return "At least one package is required before continuing.";
  }
  for (const p of packages) {
    if (!p.name.trim()) return "Every package needs a name.";
    if (p.name.length > PACKAGE_NAME_MAX) {
      return `Package name must be ≤ ${PACKAGE_NAME_MAX} characters.`;
    }
    if (p.priceLabel.length > PACKAGE_PRICE_MAX) {
      return `Price label must be ≤ ${PACKAGE_PRICE_MAX} characters.`;
    }
    if (p.features.length > PACKAGE_FEATURES_COUNT_MAX) {
      return `Each package may have at most ${PACKAGE_FEATURES_COUNT_MAX} features.`;
    }
  }
  return null;
}
