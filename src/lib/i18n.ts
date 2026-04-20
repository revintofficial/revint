/**
 * P2.3 - Multi-language email + mockup support.
 *
 * Workspace.language (P0.2'de eklendi) prompt'lara şu sırayla iniyor:
 *   - WebsitePlan prompt'ı: {my_offer} bloğunda "Dil: {language}" satırı ile
 *   - SalesOpportunity prompt'ı (analyze worker): henüz Türkçe hardcoded;
 *     `localizeAnalysisPrompt` ile multi-language hale getiriyoruz
 *   - Video script prompt'ı: {workspace_language} placeholder ile
 *   - Co-pilot prompt'ı: kullanıcı dilinden otomatik
 *
 * Desteklenen diller: tr (default), en, es, de, fr, it, pt.
 *
 * `priceCurrency` mockup pricing önerilerinde kullanılıyor; £ Londra default,
 * TR'de ₺, ABD/CA'da $, AB'de €.
 */

export const SUPPORTED_LANGUAGES = ["tr", "en", "es", "de", "fr", "it", "pt"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  tr: "Türkçe",
  en: "English",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
  pt: "Português",
};

export const LANGUAGE_INSTRUCTIONS: Record<SupportedLanguage, string> = {
  tr: "Yanit ve cikti dili: Turkce. Dogal, konusma dilinde Turkce kullan, jenerik ceviri kokmasin.",
  en: "Output language: English. Use natural, conversational English. No translation artifacts.",
  es: "Idioma de salida: Español. Usa español natural y conversacional.",
  de: "Ausgabesprache: Deutsch. Verwende naturliches, gesprochenes Deutsch.",
  fr: "Langue de sortie: Français. Utilise un français naturel et conversationnel.",
  it: "Lingua di output: Italiano. Usa italiano naturale e colloquiale.",
  pt: "Idioma de saída: Português. Use português natural e conversacional.",
};

export const PRICE_CURRENCY: Record<SupportedLanguage, string> = {
  tr: "₺",
  en: "£",
  es: "€",
  de: "€",
  fr: "€",
  it: "€",
  pt: "€",
};

/**
 * Inject language instruction into a prompt template by string interpolation.
 * Use as the first line of any prompt that needs to honor workspace.language.
 */
export function languagePreamble(language: string | null | undefined): string {
  const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(language ?? "")
    ? (language as SupportedLanguage)
    : "tr";
  return LANGUAGE_INSTRUCTIONS[lang];
}

export function priceCurrency(language: string | null | undefined): string {
  const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(language ?? "")
    ? (language as SupportedLanguage)
    : "tr";
  return PRICE_CURRENCY[lang];
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Pick a translation string from a `{ tr, en }` map for AI Workers UI
 * labels that aren't part of the per-worker registry (error strings,
 * quota messages, empty states, etc.). Falls back to `en` when the
 * requested language isn't present in the map.
 */
export function pickLang<T extends Record<string, string>>(
  language: string | null | undefined,
  labels: T & { tr: string; en: string },
): string {
  const lang = (language ?? "tr").toLowerCase();
  if (lang in labels) return labels[lang as keyof T];
  return labels.en;
}

/**
 * Common AI Workers UI strings reused across the panel, the public
 * mockup route, and the export endpoints. Kept here (not inline in
 * each component) so we can audit translations in one place.
 */
export const AGENT_WORKER_LABELS = {
  panel_title: { tr: "AI Agent", en: "AI Workers" },
  panel_subtitle: {
    tr: "Her lead icin uretilen AI worker paketleri. 4 grup, 14 is.",
    en: "AI worker packs generated per lead. 4 groups, 14 jobs.",
  },
  action_generate: { tr: "Uret", en: "Generate" },
  action_regenerate: { tr: "Yeniden uret", en: "Regenerate" },
  action_open: { tr: "Ac", en: "Open" },
  action_export: { tr: "Export", en: "Export" },
  status_ready: { tr: "Hazir", en: "Ready" },
  status_running: { tr: "Calisiyor...", en: "Running..." },
  status_failed: { tr: "Basarisiz", en: "Failed" },
  status_soon: { tr: "Yakinda", en: "Soon" },
  quota_exhausted: {
    tr: "Kota doldu. Plan yukseltin veya cycle reset'i bekleyin.",
    en: "Quota exhausted. Upgrade or wait for cycle reset.",
  },
  plan_upgrade_required: {
    tr: "Plan yukseltilmeli",
    en: "Upgrade required",
  },
} as const;

