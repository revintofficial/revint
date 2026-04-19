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
