/**
 * Sunucu tarafı locale sözlükleri.
 *
 * Kart iki çeviri katmanı istemez — route hangi dilde yollarsa kart o dilde
 * render eder. Dil değişimi `SERVER_LOCALE` üzerinden tek yerden yönetilir.
 *
 * `locale.ts` (kart tarafı) ile `CARD_LOCALE` aynı değerde tutulmalı; aksi
 * halde statik etiketler ile sunucu string'leri karışık dilde görünür.
 */

export type ServerLocale = "en" | "tr";

export const SERVER_LOCALE: ServerLocale = "en";

// ---------------------------------------------------------------------------
// Head Agent modül etiketleri (recommendedModules + excludedModules)
// ---------------------------------------------------------------------------

const MODULE_LABELS_EN: Record<string, string> = {
  order_and_pay: "Order & Pay",
  qr_menu: "QR Menu",
  reservation: "Reservations",
  ai_menu_builder: "AI Menu Builder",
  crm_loyalty: "Guest CRM / Loyalty",
  multi_language: "Multi-language Menu",
  website: "Website",
  multi_location: "Multi-location",
};

const MODULE_LABELS_TR: Record<string, string> = {
  order_and_pay: "Order & Pay",
  qr_menu: "QR Menü",
  reservation: "Rezervasyon",
  ai_menu_builder: "AI Menü Oluşturucu",
  crm_loyalty: "Müşteri CRM / Sadakat",
  multi_language: "Çok Dilli Menü",
  website: "Website",
  multi_location: "Çok şube yönetimi",
};

export const MODULE_LABELS: Record<string, string> =
  SERVER_LOCALE === "en" ? MODULE_LABELS_EN : MODULE_LABELS_TR;

export function labelForModule(id: unknown): string {
  if (typeof id !== "string" || !id.trim()) return "";
  return MODULE_LABELS[id] ?? id.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Segment (sub-niche slug → display label)
// ---------------------------------------------------------------------------

const SEGMENT_LABELS_EN: Record<string, string> = {
  "indian-restaurant": "Indian restaurant · chain",
  "fnb-fine-dining": "F&B · Fine Dining",
  "fnb-casual-dining": "F&B · Casual Dining",
  "fnb-bar-club": "F&B · Bar / Club",
  "fnb-cafe-bakery": "F&B · Cafe / Bakery",
  "fnb-fast-food": "F&B · Fast Food",
  "fnb-hotel-fnb": "F&B · Hotel / Restaurant",
  "fnb-pizza": "F&B · Pizza",
  "fnb-burger": "F&B · Burger",
  "fnb-sushi": "F&B · Sushi",
};

const SEGMENT_LABELS_TR: Record<string, string> = {
  "indian-restaurant": "Hint restoranı · zincir",
  "fnb-fine-dining": "F&B · Fine Dining",
  "fnb-casual-dining": "F&B · Casual Dining",
  "fnb-bar-club": "F&B · Bar / Kulüp",
  "fnb-cafe-bakery": "F&B · Kafe / Pastane",
  "fnb-fast-food": "F&B · Fast Food",
  "fnb-hotel-fnb": "F&B · Otel / Restoran",
  "fnb-pizza": "F&B · Pizza",
  "fnb-burger": "F&B · Burger",
  "fnb-sushi": "F&B · Sushi",
};

export function formatSegmentLabel(slug: string | null): string {
  if (!slug) return SERVER_LOCALE === "en" ? "Unknown" : "Bilinmiyor";
  const map = SERVER_LOCALE === "en" ? SEGMENT_LABELS_EN : SEGMENT_LABELS_TR;
  if (map[slug]) return map[slug];
  // Fallback: fnb-xxx → "F&B · xxx"
  return slug.replace(/^fnb-/, "F&B · ").replace(/-/g, " / ");
}

// ---------------------------------------------------------------------------
// Tech signals (buildTechSignals çıktısı)
// ---------------------------------------------------------------------------

interface TechSignalCopy {
  qrMenuLabel: string;
  qrMenuDetected: (tool: string) => string;
  qrMenuPresent: string;
  qrMenuMissing: string;
  qrMenuNotChecked: string;
  reservationLabel: string;
  reservationPresent: string;
  reservationMissing: string;
  deliveryLabel: string;
  deliveryPresent: string;
  deliveryNone: string;
}

const TECH_EN: TechSignalCopy = {
  qrMenuLabel: "QR Menu",
  qrMenuDetected: (tool) => `Detected: ${tool}`,
  qrMenuPresent: "QR menu present on site",
  qrMenuMissing: "Missing — primary sales angle",
  qrMenuNotChecked: "Not checked — no menu link on the site",
  reservationLabel: "Online reservations",
  reservationPresent: "Reservation system present",
  reservationMissing: "No reservation integration",
  deliveryLabel: "Delivery integration",
  deliveryPresent: "Delivery platform link found",
  deliveryNone: "None",
};

const TECH_TR: TechSignalCopy = {
  qrMenuLabel: "QR menü",
  qrMenuDetected: (tool) => `Tespit edildi: ${tool}`,
  qrMenuPresent: "QR menü sitede mevcut",
  qrMenuMissing: "Yok — ana satış fırsatı",
  qrMenuNotChecked: "Kontrol edilmedi — sitede menü bağlantısı yok",
  reservationLabel: "Online rezervasyon",
  reservationPresent: "Rezervasyon sistemi var",
  reservationMissing: "Rezervasyon entegrasyonu yok",
  deliveryLabel: "Paket servis entegrasyonu",
  deliveryPresent: "Teslimat platformu bağlantısı var",
  deliveryNone: "Yok",
};

export const techSignalCopy: TechSignalCopy =
  SERVER_LOCALE === "en" ? TECH_EN : TECH_TR;

// ---------------------------------------------------------------------------
// Glance chip metinleri (buildGlanceChips çıktısı)
// ---------------------------------------------------------------------------

interface GlanceCopy {
  packagePrefix: string;
  reviewScore: (n: number) => string;
  slowSite: (seconds: number) => string;
  noWhatsapp: string;
  noContactForm: string;
  qrMenuPresent: string;
}

const GLANCE_EN: GlanceCopy = {
  packagePrefix: "Package",
  reviewScore: (n) => `Review score ${n}/100`,
  slowSite: (s) => `Slow site ~${s}s`,
  noWhatsapp: "No WhatsApp",
  noContactForm: "No contact form",
  qrMenuPresent: "QR menu present",
};

const GLANCE_TR: GlanceCopy = {
  packagePrefix: "Paket",
  reviewScore: (n) => `Yorum puanı ${n}/100`,
  slowSite: (s) => `Yavaş site ~${s}s`,
  noWhatsapp: "WhatsApp yok",
  noContactForm: "İletişim formu yok",
  qrMenuPresent: "QR menü var",
};

export const glanceCopy: GlanceCopy =
  SERVER_LOCALE === "en" ? GLANCE_EN : GLANCE_TR;

// ---------------------------------------------------------------------------
// Reason codes (SalesOpportunity.reasonCodes slug → human label)
// Önceden kart tarafında CHIP_TR map'i vardı; artık burada çözümleniyor.
// ---------------------------------------------------------------------------

const REASON_LABELS_EN: Record<string, string> = {
  multi_location_chain: "Multi-location chain",
  high_review_volume: "High review volume",
  no_qr_menu: "No QR menu",
  reservation_without_integration: "Reservation without integration",
  high_foot_traffic: "High foot traffic",
  no_booking_system: "No booking system",
  no_website: "No website",
  poor_mobile: "Poor mobile",
  no_https: "No HTTPS",
  weak_seo: "Weak SEO",
  slow_website: "Slow website",
  good_rating: "High rating",
  site_unreachable: "Site unreachable",
  no_contact_form: "No contact form",
  no_whatsapp: "No WhatsApp",
};

const REASON_LABELS_TR: Record<string, string> = {
  multi_location_chain: "Çok şubeli zincir",
  high_review_volume: "Yüksek yorum sayısı",
  no_qr_menu: "QR menü yok",
  reservation_without_integration: "Entegrasyonsuz rezervasyon",
  high_foot_traffic: "Yüksek trafik",
  no_booking_system: "Rezervasyon sistemi yok",
  no_website: "Web sitesi yok",
  poor_mobile: "Mobil uyumsuz",
  no_https: "HTTPS yok",
  weak_seo: "Zayıf SEO",
  slow_website: "Yavaş site",
  good_rating: "Yüksek puan",
  site_unreachable: "Site erişilemez",
  no_contact_form: "İletişim formu yok",
  no_whatsapp: "WhatsApp yok",
};

export function labelForReason(code: string): string {
  const map = SERVER_LOCALE === "en" ? REASON_LABELS_EN : REASON_LABELS_TR;
  return map[code] ?? code.replace(/_/g, " ");
}
