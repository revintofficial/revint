/**
 * TR dictionary stub — paired with `en/common.ts`.
 *
 * The full marketing-side TR catalog is still pending (see
 * `src/lib/i18n/config.ts` — the locale list still ships `en` only);
 * this file exists so the dictionary shape stays in sync with EN.
 * The marketing keys below are intentionally unchanged from EN.
 */

import type { CommonDictionary } from "../en/common";

export const common = {
  nav: {
    pricing: "Fiyatlandırma",
    forAgencies: "Ajanslar için",
    forSmma: "SMMA için",
    forSpecialists: "Uzmanlar için",
    blog: "Blog",
    glossary: "Sözlük",
    tools: "Araçlar",
    login: "Giriş yap",
    signup: "Kayıt ol",
  },
  footer: {
    privacy: "Gizlilik",
    terms: "Şartlar",
    status: "Durum",
    about: "Hakkımızda",
  },
  cta: {
    getStarted: "Başla",
    bookDemo: "Demo al",
    seePricing: "Fiyatları gör",
  },
} as const satisfies CommonDictionary;
