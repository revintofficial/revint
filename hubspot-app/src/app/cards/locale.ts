/**
 * Kart-tarafı locale katmanı.
 *
 * Tek yerden dil seçimi: `CARD_LOCALE`. İki kart (RevintAITab +
 * RevintLeadSummaryCard) ve sayı/tarih biçimleri bu dosyadan okur.
 *
 * - "en": yabancı yatırımcı sunumu / İngiliz pazarı (varsayılan)
 * - "tr": FineDine ekibi için demo
 *
 * Dili değiştirmek için TEK satır (`CARD_LOCALE`) yeter — bundle time
 * sabit olduğu için tree-shake çalışır ve diğer dil paketi atılır.
 */

export type CardLocale = "en" | "tr";

export const CARD_LOCALE: CardLocale = "en";

// ---------------------------------------------------------------------------
// Statik metinler
// ---------------------------------------------------------------------------

interface Strings {
  // Başlık satırı
  inboundAge: string;

  // Önerilen Paket hero
  recommendedPackage: string;
  score: string;
  annualBillingSubtitle: string;
  dataConfidence: string;
  headAgentConfidence: string;
  opportunityScore: string;
  whyThisPackage: string;
  whatsIncluded: string;
  dontPitch: string;

  // Head Agent bloğu
  headAgent: string;
  openingAngle: string;
  reasoning: string;
  pitchThese: string;

  // Müşteri Sesi bloğu
  voiceOfCustomer: string;
  sentimentPositive: string;
  sentimentNeutral: string;
  sentimentNegative: string;
  topComplaints: string;
  topPraise: string;
  whatCustomersSay: string;
  openFullAnalysis: string;

  // Kayıt Özellikleri tablosu
  revintMetrics: string;
  colMetric: string;
  colValue: string;
  segment: string;
  location: string;
  locations: string;
  tier: string;
  gaps: string;
  digitalMaturity: string;
  enterpriseSignal: string;
  lastAnalyzed: string;

  // Website Raporu bloğu
  websiteReport: string;
  overallSignals: string;

  // Aksiyon linki
  openActionSheet: string;

  // Yükleme / hata / boş durumlar
  loadingTab: string;
  loadingSidebar: string;
  errorTitle: string;
  errorSignatureMismatch: string;
  errorUnavailable: string;
  errorCantReach: string;
  emptyNotInRevint: string;
  emptyPortalNotConnected: string;
  emptyNotLinkedTab: string;
  emptyNotLinkedSidebar: string;
  emptyPortalInstructions: string;

  // Sidebar'a özel
  sidebarAlertLowConfidence: string;
  sidebarAlertFallback: string;
  verifyBeforeCalling: string;
  revintScoreLabel: string;
  dataConfidenceUpper: string;
  whyTheyreAFit: string;
  likelyPainPointsLabel: string;
  openFullAnalysisSidebar: string;

  // Tier labels (deriveTier)
  tierUnknown: string;
  tierSuspect: string;
  tierDeveloping: string;
  tierTargetCandidate: string;
  tierTarget: string;

  // Trust labels (deriveTrustLabel)
  trustHigh: string;
  trustMedium: string;
  trustLow: string;
  trustUnknown: string;

  // Maturity + enterprise signal
  maturityLow: string;
  maturityMedium: string;
  maturityHigh: string;
  enterpriseYes: string;
  enterpriseNo: string;

  // Göreli zaman etiketleri (formatAnalyzedAt)
  timeDash: string;
  timeJustNow: string;

  // Segment (fallback)
  segmentUnknown: string;

  // Package link in sidebar — glance chip prefix
  // ("Package: " / "Paket: " — route serverlocale'den gelir)
}

const EN: Strings = {
  inboundAge: "Inbound age",

  recommendedPackage: "Recommended Package",
  score: "Score",
  annualBillingSubtitle: "Annual billing · list price",
  dataConfidence: "Data confidence",
  headAgentConfidence: "Head Agent confidence",
  opportunityScore: "Opportunity score",
  whyThisPackage: "Why this package?",
  whatsIncluded: "What's included",
  dontPitch: "Don't pitch",

  headAgent: "Head Agent",
  openingAngle: "Opening angle",
  reasoning: "Reasoning",
  pitchThese: "Pitch these",

  voiceOfCustomer: "Voice of Customer",
  sentimentPositive: "Positive",
  sentimentNeutral: "Neutral",
  sentimentNegative: "Negative",
  topComplaints: "Top complaints",
  topPraise: "Top praise",
  whatCustomersSay: "What customers actually say",
  openFullAnalysis: "Open full analysis in Revint →",

  revintMetrics: "Revint Metrics",
  colMetric: "Metric",
  colValue: "Value",
  segment: "Segment",
  location: "Location",
  locations: "Locations",
  tier: "Tier",
  gaps: "Gaps",
  digitalMaturity: "Digital maturity",
  enterpriseSignal: "Enterprise signal",
  lastAnalyzed: "Last analyzed",

  websiteReport: "Website Report",
  overallSignals: "Overall signals",

  openActionSheet: "Open Revint action sheet →",

  loadingTab: "Loading Revint AI analysis…",
  loadingSidebar: "Loading Revint analysis…",
  errorTitle: "Revint unavailable",
  errorSignatureMismatch:
    "Signature mismatch — reconnect from Revint Settings → Integrations.",
  errorUnavailable: "Revint is temporarily unavailable. Refresh the page.",
  errorCantReach: "Can't reach Revint. Check your integration settings.",
  emptyNotInRevint: "Not yet in Revint",
  emptyPortalNotConnected: "Portal not connected",
  emptyNotLinkedTab: "This lead isn't linked to Revint yet.",
  emptyNotLinkedSidebar:
    "This lead isn't linked to Revint. It will auto-match once the integration is active.",
  emptyPortalInstructions:
    "Connect this portal from Revint Settings → Integrations.",

  sidebarAlertLowConfidence: "Low data confidence",
  sidebarAlertFallback: "Inconsistency detected across data sources.",
  verifyBeforeCalling: "Verify before calling",
  revintScoreLabel: "Revint score",
  dataConfidenceUpper: "Data confidence",
  whyTheyreAFit: "Why they're a fit",
  likelyPainPointsLabel: "Likely pain points",
  openFullAnalysisSidebar: "Open full analysis in Revint →",

  tierUnknown: "UNKNOWN",
  tierSuspect: "SUSPECT",
  tierDeveloping: "DEVELOPING",
  tierTargetCandidate: "TARGET CANDIDATE",
  tierTarget: "TARGET",

  trustHigh: "High",
  trustMedium: "Medium",
  trustLow: "Low",
  trustUnknown: "Unknown",

  maturityLow: "Low",
  maturityMedium: "Medium",
  maturityHigh: "High",
  enterpriseYes: "Yes",
  enterpriseNo: "No",

  timeDash: "—",
  timeJustNow: "Just now",

  segmentUnknown: "Unknown",
};

const TR: Strings = {
  inboundAge: "Gelişten beri",

  recommendedPackage: "Önerilen Paket",
  score: "Skor",
  annualBillingSubtitle: "Yıllık faturalandırmada liste fiyatı",
  dataConfidence: "Veri güveni",
  headAgentConfidence: "Head Agent güveni",
  opportunityScore: "Fırsat puanı",
  whyThisPackage: "Neden bu paket?",
  whatsIncluded: "Paket özellikleri",
  dontPitch: "Önerilmeyen",

  headAgent: "Head Agent",
  openingAngle: "Açılış açısı",
  reasoning: "Gerekçe",
  pitchThese: "Önerilenler",

  voiceOfCustomer: "Müşteri Sesi",
  sentimentPositive: "Pozitif",
  sentimentNeutral: "Nötr",
  sentimentNegative: "Negatif",
  topComplaints: "En sık şikayetler",
  topPraise: "En sık övgüler",
  whatCustomersSay: "Yorumlarda öne çıkanlar",
  openFullAnalysis: "Tam analizi Revint'te aç →",

  revintMetrics: "Revint Metrikleri",
  colMetric: "Metrik",
  colValue: "Değer",
  segment: "Segment",
  location: "Konum",
  locations: "Şube sayısı",
  tier: "Seviye",
  gaps: "Eksikler",
  digitalMaturity: "Dijital olgunluk",
  enterpriseSignal: "Kurumsal sinyal",
  lastAnalyzed: "Son analiz",

  websiteReport: "Website Raporu",
  overallSignals: "Genel Sinyaller",

  openActionSheet: "Revint aksiyon sayfasını aç →",

  loadingTab: "Revint AI analizi yükleniyor…",
  loadingSidebar: "Revint analizi yükleniyor…",
  errorTitle: "Revint erişilemiyor",
  errorSignatureMismatch:
    "İmza uyuşmazlığı — Revint Ayarlar → Entegrasyonlar'dan yeniden bağlanın.",
  errorUnavailable: "Revint geçici olarak ulaşılamaz. Sayfayı yenileyin.",
  errorCantReach: "Revint'e ulaşılamadı. Entegrasyon ayarlarını kontrol edin.",
  emptyNotInRevint: "Revint'te henüz yok",
  emptyPortalNotConnected: "Portal bağlı değil",
  emptyNotLinkedTab: "Bu lead henüz Revint'e bağlı değil.",
  emptyNotLinkedSidebar:
    "Bu lead Revint'e bağlı değil. Entegrasyon aktifse otomatik eşleşecektir.",
  emptyPortalInstructions:
    "Revint Ayarlar → Entegrasyonlar'dan bu portali bağlayın.",

  sidebarAlertLowConfidence: "Veri güveni düşük",
  sidebarAlertFallback: "Veri kaynakları arasında tutarsızlık tespit edildi.",
  verifyBeforeCalling: "Aramadan önce doğrula",
  revintScoreLabel: "Revint Skoru",
  dataConfidenceUpper: "Veri güveni",
  whyTheyreAFit: "Neden uygun",
  likelyPainPointsLabel: "Olası sorunlar",
  openFullAnalysisSidebar: "Revint'te tam analizi aç →",

  tierUnknown: "BİLİNMİYOR",
  tierSuspect: "ŞÜPHELİ",
  tierDeveloping: "GELİŞMEKTE",
  tierTargetCandidate: "HEDEF ADAY",
  tierTarget: "HEDEF",

  trustHigh: "Yüksek",
  trustMedium: "Orta",
  trustLow: "Düşük",
  trustUnknown: "Bilinmiyor",

  maturityLow: "Düşük",
  maturityMedium: "Orta",
  maturityHigh: "Yüksek",
  enterpriseYes: "Var",
  enterpriseNo: "Yok",

  timeDash: "—",
  timeJustNow: "Az önce",

  segmentUnknown: "Bilinmiyor",
};

export const strings: Strings = { en: EN, tr: TR }[CARD_LOCALE];

// ---------------------------------------------------------------------------
// Sayı biçimlendirme (Intl bağımlılığı yok — deterministik)
// ---------------------------------------------------------------------------

export const numberFormat = {
  en: {
    rating: (v: number) => v.toFixed(1),
    int: (v: number) =>
      String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
    percent: (v: number) => `${v}%`,
  },
  tr: {
    rating: (v: number) => v.toFixed(1).replace(".", ","),
    int: (v: number) =>
      String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, "."),
    percent: (v: number) => `%${v}`,
  },
}[CARD_LOCALE];

// ---------------------------------------------------------------------------
// Göreli zaman biçimlendirme
// ---------------------------------------------------------------------------

function timeEn(h: number | null): string {
  if (h == null) return "—";
  if (h === 0) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeTr(h: number | null): string {
  if (h == null) return "—";
  if (h === 0) return "Az önce";
  if (h < 24) return `${h}sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

export const timeFormat = {
  inboundAge: CARD_LOCALE === "en" ? timeEn : timeTr,
};

// ---------------------------------------------------------------------------
// Yorum özet satırı için küçük biçim yardımcıları (sayı önceden formatlı)
// ---------------------------------------------------------------------------

export const voiceSummary = {
  en: {
    reviews: (formatted: string) => `${formatted} reviews`,
    score: (n: number) => `review sub-score ${n}/100`,
  },
  tr: {
    reviews: (formatted: string) => `${formatted} yorum`,
    score: (n: number) => `yorum alt skoru ${n}/100`,
  },
}[CARD_LOCALE];
