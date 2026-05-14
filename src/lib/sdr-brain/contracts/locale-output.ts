/**
 * Truth Layer contract — `OutreachLocale` + `LocaleResolution`.
 *
 * Producer: T-B Locale Gate (`src/lib/locale/lead-locale.ts`).
 * Consumers: opener-writer, lead-response, ai-receptionist.
 *
 * Resolution rule (T-B locked, founder-approved per Open Decision §10.1):
 *   1. lead.country has dominant language → that locale
 *   2. else workspace.defaultLocale
 *   3. else "en-GB" fallback
 *
 * Concretely: TR workspace + GB lead → en-GB (lead country wins because
 * sending TR to a UK operator is worse than sending EN to a TR operator).
 */

export const __contractVersion = 1;

export type OutreachLocale =
  | "tr-TR"
  | "en-GB"
  | "en-US"
  | "de-DE"
  | "es-ES"
  | "fr-FR";

export type LocaleResolutionSource =
  | "lead_country_dominant"
  | "workspace_default"
  | "fallback";

export interface LocaleResolution {
  resolved: OutreachLocale;
  source: LocaleResolutionSource;
  /** 1-2 sentences — populated for telemetry + UI tooltip. */
  reasoning: string;
}

/**
 * Country → dominant business locale lookup.
 * Intentionally narrow — only countries we actually outreach to today.
 * Add via PR with a real lead behind it (no speculative additions).
 */
export const COUNTRY_TO_LOCALE: Readonly<Record<string, OutreachLocale>> = {
  TR: "tr-TR",
  GB: "en-GB",
  IE: "en-GB",
  US: "en-US",
  CA: "en-US",
  AU: "en-GB",
  DE: "de-DE",
  AT: "de-DE",
  CH: "de-DE",
  ES: "es-ES",
  MX: "es-ES",
  AR: "es-ES",
  FR: "fr-FR",
  BE: "fr-FR",
} as const;

export function resolveLocaleFromCountry(
  countryIso: string | null | undefined,
): OutreachLocale | null {
  if (!countryIso) return null;
  const upper = countryIso.toUpperCase();
  return COUNTRY_TO_LOCALE[upper] ?? null;
}
