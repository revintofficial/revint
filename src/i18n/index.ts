import type { Locale } from "@/lib/i18n/config";
import { common as commonEn } from "./en/common";
import { common as commonTr } from "./tr/common";
import type { CommonDictionary } from "./en/common";

/**
 * Dictionary loader. Phase 1 ships `en` as the only public locale,
 * but `tr` is fully populated so any surface that opts into Turkish
 * (e.g. Lead Detail v2) compiles end-to-end. The contract: every
 * locale returns the *same shape* — enforced at build time by
 * `satisfies CommonDictionary`.
 *
 * Use:  `const t = await loadDictionary(locale);`
 */

type LeadDetailLocale = Locale | "tr";

const DICTIONARIES: Record<LeadDetailLocale, { common: CommonDictionary }> = {
  en: { common: commonEn },
  tr: { common: commonTr },
};

export async function loadDictionary(
  locale: Locale,
): Promise<{ common: CommonDictionary }> {
  return DICTIONARIES[locale];
}

/**
 * Lead Detail v2 surfaces (phases 0–7) consume Turkish before the
 * marketing site does. Use this loader for in-app strings that need
 * the TR slot today; switch back to `loadDictionary` once the global
 * locale config in `src/lib/i18n/config.ts` adds `tr`.
 */
export async function loadLeadDetailDictionary(
  locale: LeadDetailLocale,
): Promise<{ common: CommonDictionary }> {
  return DICTIONARIES[locale] ?? DICTIONARIES.en;
}
