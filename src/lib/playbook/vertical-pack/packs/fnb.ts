/**
 * FineDine (F&B) vertical pack — the first niche definition on top of
 * the generic vertical-pack engine.
 *
 * This file holds ALL F&B-specific knowledge: raw signal shape, the
 * normalization rules, the scoring rules per FineDine module, hard
 * do-not-pitch exclusions, the play library, and the multi-location
 * context multiplier. The engine (`../engine.ts`) contains none of it.
 *
 * Sources (FineDine research + 2026 industry reports): staffing/labor
 * pressure -> Order & Pay / QR; menu conversion -> AI menu; tourist /
 * multilingual -> multi-language; multi-location groups -> multi-venue
 * control; repeat trade -> CRM/loyalty; missing/broken site -> website.
 */

import {
  tri,
  triThreshold,
  type Tri,
  type VerticalPack,
  type ScoringRule,
  type PackPlay,
} from "../engine";

export type FineDineModule =
  | "order_and_pay"
  | "qr_menu"
  | "reservation"
  | "ai_menu_builder"
  | "crm_loyalty"
  | "multi_language"
  | "website"
  | "multi_location";

/**
 * Raw F&B signals derived from the existing substrate. All optional and
 * explicitly tri-state: `true` = present, `false` = explicit absence,
 * `null`/`undefined` = unknown (NEUTRAL).
 */
export interface FnbSignals {
  hasWebsite?: boolean | null;
  websiteBroken?: boolean | null;
  detectedMenuTool?: string | null;
  hasQrMenu?: boolean | null;
  pdfMenu?: boolean | null;
  hasOnlineReservation?: boolean | null;
  hasBookingSystem?: boolean | null;
  bookingProvider?: string | null;
  hasOnlineOrdering?: boolean | null;
  slowServiceSignal?: boolean | null;
  touristLanguageSignal?: boolean | null;
  isMultiLocation?: boolean | null;
  rating?: number | null;
  reviewCount?: number | null;
  /** Google price level 0-4 (0/1 ~ casual). */
  priceLevel?: number | null;
}

export interface FnbNormalized {
  website: Tri;
  websiteBroken: Tri;
  digitalMenu: Tri;
  pdfMenu: Tri;
  reservation: Tri;
  onlineOrdering: Tri;
  slowService: Tri;
  touristLanguage: Tri;
  multiLocation: Tri;
  repeatTrade: Tri;
  casual: Tri;
  detectedMenuTool: string | null;
  bookingProvider: string | null;
}

function normalize(s: FnbSignals): FnbNormalized {
  const digitalMenu: Tri =
    s.detectedMenuTool || s.hasQrMenu === true
      ? "present"
      : s.hasQrMenu === false
        ? "absent"
        : "unknown";

  const reservation: Tri =
    s.bookingProvider || s.hasOnlineReservation === true || s.hasBookingSystem === true
      ? "present"
      : s.hasOnlineReservation === false || s.hasBookingSystem === false
        ? "absent"
        : "unknown";

  const repeatTrade: Tri = triThreshold(
    s.reviewCount != null && s.rating != null,
    (s.reviewCount ?? 0) >= 100 && (s.rating ?? 0) >= 4.2,
  );

  const casual: Tri = triThreshold(s.priceLevel != null, (s.priceLevel ?? 99) <= 1);

  return {
    website: tri(s.hasWebsite),
    websiteBroken: tri(s.websiteBroken),
    digitalMenu,
    pdfMenu: tri(s.pdfMenu),
    reservation,
    onlineOrdering: tri(s.hasOnlineOrdering),
    slowService: tri(s.slowServiceSignal),
    touristLanguage: tri(s.touristLanguageSignal),
    multiLocation: tri(s.isMultiLocation),
    repeatTrade,
    casual,
    detectedMenuTool: s.detectedMenuTool ?? null,
    bookingProvider: s.bookingProvider ?? null,
  };
}

const RULES: ReadonlyArray<ScoringRule<FineDineModule, FnbNormalized>> = [
  // Order & Pay (staffing / slow service)
  { module: "order_and_pay", source: "review", points: 55, reason: "Reviews flag slow service / long waits at peak.", signal: "slowServiceSignal", when: (n) => n.slowService === "present" },
  { module: "order_and_pay", source: "ops", points: 25, reason: "Casual / high-volume format benefits from self-order + pay.", signal: "priceLevel", when: (n) => n.casual === "present" },
  { module: "order_and_pay", source: "ops", points: 25, reason: "No online ordering detected on the site.", signal: "hasOnlineOrdering", when: (n) => n.onlineOrdering === "absent" },

  // QR menu (digital menu absent)
  { module: "qr_menu", source: "menu", points: 45, reason: "PDF menu detected: weak mobile conversion.", signal: "pdfMenu", when: (n) => n.pdfMenu === "present" },
  { module: "qr_menu", source: "menu", points: 35, reason: "No digital / QR menu detected.", signal: "digitalMenu", when: (n) => n.digitalMenu === "absent" },

  // AI menu builder (menu conversion)
  { module: "ai_menu_builder", source: "menu", points: 35, reason: "PDF menu: no photos, descriptions or best-seller cues.", signal: "pdfMenu", when: (n) => n.pdfMenu === "present" },
  { module: "ai_menu_builder", source: "menu", points: 20, reason: "Menu not optimised for mobile decision-making.", signal: "digitalMenu", when: (n) => n.digitalMenu === "absent" },

  // Reservation
  { module: "reservation", source: "ops", points: 45, reason: "No online reservation system detected.", signal: "reservation", when: (n) => n.reservation === "absent" },

  // Multi-language (tourist)
  { module: "multi_language", source: "review", points: 55, reason: "Reviews indicate tourists / language-barrier order loss.", signal: "touristLanguageSignal", when: (n) => n.touristLanguage === "present" },

  // Multi-location (standalone module; also drives the multiplier)
  { module: "multi_location", source: "ops", points: 60, reason: "Lead belongs to a multi-location group: needs central control.", signal: "isMultiLocation", when: (n) => n.multiLocation === "present" },

  // CRM / loyalty (repeat trade)
  { module: "crm_loyalty", source: "reputation", points: 50, reason: "Strong repeat trade (high rating + review volume): own the guest relationship.", signal: "repeatTrade", when: (n) => n.repeatTrade === "present" },

  // Website
  { module: "website", source: "website", points: 60, reason: "No website detected.", signal: "hasWebsite", when: (n) => n.website === "absent" },
  { module: "website", source: "website", points: 45, reason: "Website is broken / parked / expired.", signal: "websiteBroken", when: (n) => n.websiteBroken === "present" },
];

function exclusions(n: FnbNormalized): Map<FineDineModule, string> {
  const out = new Map<FineDineModule, string>();
  if (n.digitalMenu === "present") {
    out.set(
      "qr_menu",
      `Already has a digital menu${n.detectedMenuTool ? ` (${n.detectedMenuTool})` : ""}; lead with conversion / Order & Pay instead.`,
    );
  }
  if (n.reservation === "present") {
    out.set(
      "reservation",
      `Already uses a reservation system${n.bookingProvider ? ` (${n.bookingProvider})` : ""}; do not pitch booking.`,
    );
  }
  // Website excluded ONLY when explicitly present and not broken.
  if (n.website === "present" && n.websiteBroken !== "present") {
    out.set("website", "Has a working website; focus on conversion modules, not a new site.");
  }
  return out;
}

const PLAYS: ReadonlyArray<PackPlay<FineDineModule, FnbNormalized>> = [
  {
    id: "slow_service_staffing",
    label: "Slow Service / Staff Shortage",
    module: "order_and_pay",
    pitch: "Same team, faster service: Order & Pay removes menu, order and payment friction at peak.",
    dontPitch: "Venue whose differentiator is attentive, high-touch table service.",
    strength: (n) => (n.slowService === "present" ? 0.7 : 0) + (n.casual === "present" ? 0.3 : 0),
  },
  {
    id: "menu_conversion",
    label: "Menu Conversion Audit",
    module: "ai_menu_builder",
    pitch: "Your menu is a conversion layer: photos, descriptions and best-sellers lift basket size.",
    dontPitch: "Tiny single-location with a static, rarely-changing menu.",
    strength: (n) => (n.pdfMenu === "present" ? 0.6 : 0) + (n.digitalMenu === "absent" ? 0.4 : 0),
  },
  {
    id: "multi_location_control",
    label: "Multi-location Control",
    module: "multi_location",
    pitch: "Manage menu, pricing, campaigns and reporting across every venue from one panel.",
    dontPitch: "Single independent location.",
    strength: (n) => (n.multiLocation === "present" ? 1 : 0),
  },
  {
    id: "tourist_multilanguage",
    label: "Tourist / Multi-language Revenue",
    module: "multi_language",
    pitch: "Cut language-barrier order loss: menu accessible in 40+ languages.",
    dontPitch: "Hyper-local venue with a single-language audience.",
    strength: (n) => (n.touristLanguage === "present" ? 1 : 0),
  },
  {
    id: "guest_data_crm",
    label: "Guest Data / CRM",
    module: "crm_loyalty",
    pitch: "Own the guest relationship: feedback, segments and campaigns drive repeat visits.",
    dontPitch: "Pure tourist-trade venue with no repeat customers.",
    strength: (n) => (n.repeatTrade === "present" ? 1 : 0),
  },
];

export const FNB_PACK: VerticalPack<FineDineModule, FnbSignals, FnbNormalized> = {
  id: "fnb",
  label: "FineDine — Food & Beverage",
  normalize,
  rules: RULES,
  exclusions,
  plays: PLAYS,
  multiplier: {
    when: (n) => n.multiLocation === "present",
    factor: 1.2,
    amplifies: new Set(["crm_loyalty", "ai_menu_builder", "order_and_pay"]),
  },
};
