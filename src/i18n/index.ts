import type { Locale } from "@/lib/i18n/config";
import { common as commonEn } from "./en/common";
import type { CommonDictionary } from "./en/common";

/**
 * Dictionary loader. Phase 1 always resolves to `en`. Phase 2 adds a
 * `tr` branch. The contract: every locale returns the *same shape*
 * — this is enforced at build time by `satisfies CommonDictionary`.
 *
 * Use:  `const t = await loadDictionary(locale);`
 */

const DICTIONARIES: Record<Locale, { common: CommonDictionary }> = {
  en: { common: commonEn },
};

export async function loadDictionary(
  locale: Locale,
): Promise<{ common: CommonDictionary }> {
  return DICTIONARIES[locale];
}
