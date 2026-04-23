/**
 * i18n config — phase 1 (EN-only).
 *
 * This module is the single source of truth for locale routing. Every
 * caller that needs to know "what locales ship today?" or "what is the
 * default locale?" must read from here — no hard-coded "en" elsewhere.
 *
 * Phase 1 ships only `en`; `tr` is kept in the code path (enums, dicts,
 * hreflang) so phase 2 enablement is a one-line flip. Concretely:
 *
 *   // phase 2
 *   export const LOCALES = ["en", "tr"] as const;
 *
 * That single change should:
 *   - cause generateStaticParams for future [locale] routes to emit both
 *   - cause buildMetadata.alternates.languages to include tr-TR
 *   - cause the middleware to accept tr URLs as canonical
 *
 * URL contract:
 *   - `en` is the implicit default and renders at un-prefixed URLs
 *     (example.com/pricing). Emitting `/en/pricing` is never required.
 *   - `tr` (phase 2) renders under `/tr/*`, e.g. example.com/tr/pricing.
 *   - robots.ts + sitemap.ts both read from here so hreflang and
 *     canonical stay in sync.
 */

export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Pretty-printed hreflang tags (used by buildMetadata). */
export const HREFLANG: Record<Locale, string> = {
  en: "en-US",
};

/** BCP-47 full-locale strings the product considers "supported" — the
 * set accepted by middleware and returned from generateStaticParams.
 */
export function isSupportedLocale(input: string): input is Locale {
  return (LOCALES as readonly string[]).includes(input);
}

/**
 * Negotiate the preferred locale from an Accept-Language header.
 * Returns DEFAULT_LOCALE when no supported tag is found.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const preferred = acceptLanguage
    .split(",")
    .map((t) => t.trim().split(";")[0].toLowerCase())
    .map((tag) => tag.split("-")[0]);
  for (const tag of preferred) {
    if (isSupportedLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
