/**
 * Head Agent — one worker, three rooms (docs/analiz-ve-playbook.md §3, §7, §8).
 *
 *   Room 1 (`roomOne`, pure, no model) picks ONE wedge and the SMALLEST
 *   FineDine package that solves it, from audit + review evidence.
 *   Hard bans first; no strong signal and no two medium signals → no call.
 *
 *   Room 2 (Claude) only writes the talk track for the package Room 1
 *   chose. It cannot change the package or the wedge and can only pick
 *   modules from the deterministic `computeFnbModuleFit` shortlist.
 *
 *   Room 3 (QA, deterministic) checks the talk: package is one of three,
 *   the talk stays on the wedge and inside the package, no ban is broken,
 *   every sentence cites Room 1 evidence. If QA fails — or Claude is
 *   unavailable — there is NO second model attempt: Room 1's output
 *   becomes a plain card (package, three evidence refs, empty talk).
 *
 * `buildBriefDecision` is the single contract used by the live brief
 * worker and by `replayHeadAgentDecision` (offline eval).
 */
import { applyApprovedClaimGate } from "@/lib/control/claim-gate";
import { listApprovedClaims } from "@/lib/control/claims";
import { logger } from "@/lib/logger";
import {
  callClaudeJson,
  runClaudeToolLoop,
  parseClaudeJson,
  getHeadAgentModel,
  isAnthropicConfigured,
} from "./claude";
import { AGENT_TOOLS, executeAgentTool } from "./tools";
import { computeFnbModuleFit, type FnbSignals } from "@/lib/playbook/fnb-module-fit";
import type { FineDineModule } from "@/lib/playbook/vertical-pack";

/** Niche slugs that route to the F&B pack. */
const FNB_NICHES = new Set(["RESTAURANT_TECH", "restaurant", "restaurants", "fnb", "food_beverage"]);

export function isFnbNiche(niche: string | null | undefined): boolean {
  if (!niche) return false;
  return FNB_NICHES.has(niche) || FNB_NICHES.has(niche.toLowerCase());
}

// ===========================================================================
// Room 1 — contract
// ===========================================================================

export type HeadAgentPlan = "starter" | "growth" | "premium" | "none";
export type HeadAgentWedge =
  | "reservation"
  | "bill_wait"
  | "marketplace"
  | "menu_surface"
  | "multi_location"
  | "guest_repeat"
  | "none";
type ActiveWedge = Exclude<HeadAgentWedge, "none">;

export type RoomOneOutput = {
  plan: HeadAgentPlan;
  wedge: HeadAgentWedge;
  /** URL / site fact or review sentence. Empty → wedge is "none". */
  evidence: string[];
  /** Sentences the talk must never break. */
  bans: string[];
  /** Second qualifying wedge with independent evidence, else null. */
  backup: string | null;
};

/** Priority order: the top qualifying wedge wins, the next becomes backup. */
export const WEDGE_PRIORITY: readonly ActiveWedge[] = [
  "reservation",
  "bill_wait",
  "marketplace",
  "menu_surface",
  "multi_location",
  "guest_repeat",
];

/** Below this many reviews the corpus is not evidence (review-analyst skips it too). */
export const REVIEW_CORPUS_MIN = 30;

export type VenueType = "fine_dining" | "full_service" | "cafe" | "qsr" | "food_hall";

/**
 * Tri-state audit facts. `true` = seen, `false` = explicitly absent,
 * `null`/`undefined` = unknown (never evidence either way).
 */
export interface RoomOneAudit {
  reachable?: boolean | null;
  websiteUrl?: string | null;
  hasWebsite?: boolean | null;
  websiteBroken?: boolean | null;
  hasBookingSystem?: boolean | null;
  hasOnlineReservation?: boolean | null;
  bookingProvider?: string | null;
  hasPrepayment?: boolean | null;
  tableCount?: number | null;
  hasQrMenu?: boolean | null;
  pdfMenu?: boolean | null;
  menuUrl?: string | null;
  detectedMenuTool?: string | null;
  hasOnlineOrdering?: boolean | null;
  /** Site links to a delivery marketplace (Deliveroo, Uber Eats, Just Eat…). */
  marketplaceOrdering?: boolean | null;
  deliveryPlatforms?: string[] | null;
  languageCount?: number | null;
  venueType?: VenueType | null;
  tastingMenu?: boolean | null;
  /** Branch of a chain that buys centrally — hard ban, no call. */
  centralPurchasing?: boolean | null;
}

export interface RoomOnePainPhrase {
  text: string;
  /** Missing = true (backwards compat with pre-`sellable` analyst rows). */
  sellable?: boolean;
}

export interface RoomOneInput {
  audit?: RoomOneAudit | null;
  reviews?: { count?: number | null; painPhrases?: RoomOnePainPhrase[] | null } | null;
  locationCount?: number | null;
}

// ===========================================================================
// Room 1 — rules
// ===========================================================================

const MARKETPLACE_BOOKING =
  /(thefork|the fork|lafourchette|opentable|open table|quandoo|resy|designmynight|bookatable|yelp|tripadvisor|zomato|google reserve|tock)/i;

const PHRASE = {
  bill: /(\bbill\b|\bthe check\b|\bcheque\b|\bpay(ing|ment)?\b|card (machine|reader)|\bsplit\b|hesab|hesap|adisyon|kart makines|ödeme)/i,
  reservation: /(reserv|booking|\bbook(ed)?\b|no[- ]?show|deposit|rezerv|kapora|depozito|yer ayırt)/i,
  delivery: /(deliver|deliveroo|uber ?eats|just ?eat|takeaway|take-away|yemeksepeti|\bgetir\b|trendyol|paket servis|kurye)/i,
  menu: /(\bmenu|menü|allergen|alerjen|\bpdf\b)/i,
  repeat: /(\bregulars?\b|every week|come back|coming back|\bloyal|müdavim|her hafta|yine geli|tekrar gel)/i,
  language: /(english|language|translat|tourist|ingilizce|\bdil\b|turist|çeviri)/i,
};

type Strength = "strong" | "medium";
interface WedgeSignal {
  wedge: ActiveWedge;
  strength: Strength;
  evidence: string;
}

interface BanRule {
  text: string;
  /** Pattern a talk track must not match. `null` = rep guidance only. */
  pattern: RegExp | null;
  /** Only the first sentence is checked (opener bans). */
  openerOnly?: boolean;
}

export interface RoomOneEvaluation {
  output: RoomOneOutput;
  /** Signals behind the chosen wedge (strong first). */
  wedgeSignals: WedgeSignal[];
  banRules: BanRule[];
  blocked: boolean;
}

function siteRef(audit: RoomOneAudit, fact: string): string {
  return `${audit.websiteUrl?.trim() || "site"} — ${fact}`;
}

function reviewRef(text: string): string {
  return `yorum: "${text.trim()}"`;
}

function isWalkIn(v: VenueType | null | undefined): boolean {
  return v === "cafe" || v === "qsr" || v === "food_hall";
}

function usablePhrases(reviews: RoomOneInput["reviews"]): string[] {
  const count = reviews?.count;
  if (typeof count === "number" && count < REVIEW_CORPUS_MIN) return [];
  return (reviews?.painPhrases ?? [])
    .filter((p) => p && typeof p.text === "string" && p.text.trim() && p.sellable !== false)
    .map((p) => p.text.trim());
}

function collectSignals(audit: RoomOneAudit, phrases: string[], locationCount: number): WedgeSignal[] {
  const out: WedgeSignal[] = [];
  const walkIn = isWalkIn(audit.venueType);

  // 1. Reservation — marketplace booking without a deposit, or no online booking.
  if (!walkIn) {
    const provider = audit.bookingProvider?.trim() || null;
    if (provider && MARKETPLACE_BOOKING.test(provider) && audit.hasPrepayment !== true) {
      out.push({
        wedge: "reservation",
        strength: "strong",
        evidence: siteRef(audit, `rezervasyon ${provider} üzerinden, depozito görünmüyor`),
      });
    }
    if (
      !provider &&
      audit.hasBookingSystem === false &&
      audit.hasOnlineReservation !== true &&
      audit.reachable !== false
    ) {
      out.push({ wedge: "reservation", strength: "medium", evidence: siteRef(audit, "sitede online rezervasyon yok") });
    }
    for (const p of phrases) {
      if (PHRASE.reservation.test(p)) out.push({ wedge: "reservation", strength: "medium", evidence: reviewRef(p) });
    }
  }

  // 2. Bill wait — reviews about the bill / card machine / split bill. Food delay is not this bucket.
  for (const p of phrases) {
    if (PHRASE.bill.test(p)) out.push({ wedge: "bill_wait", strength: "strong", evidence: reviewRef(p) });
  }

  // 3. Marketplace — only Deliveroo / Uber Eats / Just Eat, no direct ordering.
  const platforms = (audit.deliveryPlatforms ?? []).filter((s) => typeof s === "string" && s.trim());
  const hasMarketplace = platforms.length > 0 || audit.marketplaceOrdering === true;
  if (hasMarketplace) {
    const label = platforms.length > 0 ? platforms.join(", ") : "pazar yeri";
    if (audit.hasOnlineOrdering === false) {
      out.push({
        wedge: "marketplace",
        strength: "strong",
        evidence: siteRef(audit, `sipariş yalnız ${label} üzerinden, doğrudan sipariş yok`),
      });
    } else if (audit.hasOnlineOrdering == null) {
      out.push({ wedge: "marketplace", strength: "medium", evidence: siteRef(audit, `sipariş linki ${label}`) });
    }
  }
  for (const p of phrases) {
    if (PHRASE.delivery.test(p)) out.push({ wedge: "marketplace", strength: "medium", evidence: reviewRef(p) });
  }

  // 4. Menu surface — single venue only (multi-branch is its own wedge).
  if (locationCount <= 1) {
    if (audit.pdfMenu === true) {
      out.push({
        wedge: "menu_surface",
        strength: "strong",
        evidence: audit.menuUrl?.trim() ? `${audit.menuUrl.trim()} — menü PDF` : siteRef(audit, "menü PDF"),
      });
    }
    if (audit.hasQrMenu === false) {
      out.push({ wedge: "menu_surface", strength: "medium", evidence: siteRef(audit, "dijital / QR menü yok") });
    }
    for (const p of phrases) {
      if (PHRASE.menu.test(p)) out.push({ wedge: "menu_surface", strength: "medium", evidence: reviewRef(p) });
    }
  }

  // 5. Multi location — two or more venues on the same account.
  if (locationCount >= 2) {
    out.push({ wedge: "multi_location", strength: "strong", evidence: `harita — aynı hesapta ${locationCount} şube` });
  }

  // 6. Guest repeat — never on review volume alone.
  for (const p of phrases) {
    if (PHRASE.repeat.test(p)) out.push({ wedge: "guest_repeat", strength: "medium", evidence: reviewRef(p) });
  }
  if (audit.venueType === "cafe") {
    out.push({ wedge: "guest_repeat", strength: "medium", evidence: siteRef(audit, "mekân tipi: mahalle kafesi") });
  }

  return out;
}

function qualifies(signals: WedgeSignal[]): boolean {
  const strong = signals.filter((s) => s.strength === "strong").length;
  const medium = signals.filter((s) => s.strength === "medium").length;
  return strong >= 1 || medium >= 2;
}

function planFor(wedge: ActiveWedge, audit: RoomOneAudit, phrases: string[], locationCount: number): HeadAgentPlan {
  const multiLanguage =
    (typeof audit.languageCount === "number" && audit.languageCount > 1) ||
    phrases.some((p) => PHRASE.language.test(p));
  let plan: HeadAgentPlan;
  switch (wedge) {
    case "reservation":
      plan = "growth"; // prepayment is not in Starter; 50/month does not carry a full room
      break;
    case "bill_wait":
      plan = (typeof audit.tableCount === "number" && audit.tableCount > 20) || multiLanguage ? "growth" : "starter";
      break;
    case "marketplace":
      plan = "starter";
      break;
    case "menu_surface":
      plan = multiLanguage ? "growth" : "starter"; // Starter has one language
      break;
    case "multi_location":
      plan = "premium"; // multi-location storefront is Premium only
      break;
    case "guest_repeat":
      plan = "growth"; // Starter keeps the last 10 guests only
      break;
  }
  if (plan === "premium" && locationCount <= 1) plan = "growth";
  return plan;
}

function buildBans(audit: RoomOneAudit, locationCount: number, wedge: HeadAgentWedge): BanRule[] {
  const bans: BanRule[] = [
    {
      text: "AI, CRM, raporlama veya IQ ile açılış yapma.",
      pattern: /\b(ai|a\.i\.|artificial intelligence|yapay zek\w*|crm|reporting|raporlama|iq)\b/i,
      openerOnly: true,
    },
    {
      text: "Sentetik yemek fotoğrafını tabak diye sunma.",
      pattern: /(\bai\b|synthetic|generated|yapay zek\w*|sentetik)[^.]{0,40}(photo|image|picture|fotoğraf|görsel)/i,
    },
  ];
  if (audit.venueType === "fine_dining") {
    bans.push({ text: "Fine dining'de AI fotoğraftan hiç söz etme.", pattern: /(photo|fotoğraf|görsel)/i });
  }
  if (audit.venueType === "fine_dining" || audit.tastingMenu === true) {
    bans.push({
      text: "Tadım menüsü veya tam serviste misafir siparişini ana hikâye yapma.",
      pattern: /(self[- ]?order|order (from|at) (the|their|your) table|guests? (can )?order|misafir\w* sipariş|kendi sipariş)/i,
    });
  }
  if (isWalkIn(audit.venueType)) {
    bans.push({ text: "Yürüyerek dolan kafe, QSR veya food hall'a rezervasyon satma.", pattern: /(reserv|booking|rezerv)/i });
  }
  if (locationCount <= 1) {
    bans.push({ text: "Tek şubeye Premium önerme.", pattern: /\bpremium\b/i });
  }
  if (audit.websiteBroken !== true) {
    bans.push({
      text: "Yeni site önerme; kırık adımı söyle (rezervasyon düğmesi, mobil menü, marketplace linki).",
      pattern: /((new|rebuild|redesign\w*)[^.]{0,20}(website|\bsite\b))|((yeni|baştan)[^.]{0,20}(site|web))/i,
    });
  }
  const provider = audit.bookingProvider?.trim();
  if (provider) {
    bans.push({
      text: `${provider} varken "bir rezervasyon sistemi daha" deme; giriş doğrudan rezervasyon ve ön ödemedir.`,
      pattern: /((another|second|new|replace\w*)[^.]{0,30}(booking|reservation) (system|tool|platform))|((bir|yeni|başka)[^.]{0,20}rezervasyon sistemi)/i,
    });
    bans.push({ text: `Rakip kurulu diye eleme; "${provider} tarafında neyi bırakırsınız?" diye sor.`, pattern: null });
  }
  if (wedge === "marketplace") {
    bans.push({ text: "Paket servis yerine masa başı sipariş satma.", pattern: /(at the table|table[- ]side|masa ?başı|masada sipariş)/i });
  }
  if (audit.centralPurchasing === true) {
    bans.push({ text: "Merkezden satın alan zincirin şube müdürüne paket önerme.", pattern: null });
  }
  return bans;
}

/** Room 1 with its internals (signals + ban patterns) for scoring and QA. */
export function evaluateRoomOne(input: RoomOneInput): RoomOneEvaluation {
  const audit = input.audit ?? {};
  const locationCount =
    typeof input.locationCount === "number" && input.locationCount > 0 ? Math.floor(input.locationCount) : 1;
  const phrases = usablePhrases(input.reviews);

  // Hard ban that stops the call entirely.
  if (audit.centralPurchasing === true) {
    const banRules = buildBans(audit, locationCount, "none");
    return {
      output: { plan: "none", wedge: "none", evidence: [], bans: banRules.map((b) => b.text), backup: null },
      wedgeSignals: [],
      banRules,
      blocked: true,
    };
  }

  const signals = collectSignals(audit, phrases, locationCount);
  const byWedge = new Map<ActiveWedge, WedgeSignal[]>();
  for (const s of signals) byWedge.set(s.wedge, [...(byWedge.get(s.wedge) ?? []), s]);
  const qualifying = WEDGE_PRIORITY.filter((w) => qualifies(byWedge.get(w) ?? []));

  const primary = qualifying[0] ?? null;
  if (!primary) {
    const banRules = buildBans(audit, locationCount, "none");
    return {
      output: { plan: "none", wedge: "none", evidence: [], bans: banRules.map((b) => b.text), backup: null },
      wedgeSignals: [],
      banRules,
      blocked: false,
    };
  }

  const primarySignals = [...(byWedge.get(primary) ?? [])].sort((a, b) =>
    a.strength === b.strength ? 0 : a.strength === "strong" ? -1 : 1,
  );
  const primaryEvidence = new Set(primarySignals.map((s) => s.evidence));

  // Backup: next qualifying wedge with at least one piece of evidence of its own.
  let backup: ActiveWedge | null = null;
  const backupEvidence: string[] = [];
  for (const w of qualifying.slice(1)) {
    const own = (byWedge.get(w) ?? []).map((s) => s.evidence).filter((e) => !primaryEvidence.has(e));
    if (own.length > 0) {
      backup = w;
      backupEvidence.push(...own);
      break;
    }
  }

  const evidence = [...new Set([...primarySignals.map((s) => s.evidence), ...backupEvidence])];
  const banRules = buildBans(audit, locationCount, primary);
  if (evidence.length === 0) {
    return {
      output: { plan: "none", wedge: "none", evidence: [], bans: banRules.map((b) => b.text), backup: null },
      wedgeSignals: [],
      banRules,
      blocked: false,
    };
  }
  return {
    output: {
      plan: planFor(primary, audit, phrases, locationCount),
      wedge: primary,
      evidence,
      bans: banRules.map((b) => b.text),
      backup,
    },
    wedgeSignals: primarySignals,
    banRules,
    blocked: false,
  };
}

/** Room 1: pure, no model. Picks one wedge and the smallest package that solves it. */
export function roomOne(input: RoomOneInput): RoomOneOutput {
  return evaluateRoomOne(input).output;
}

// ===========================================================================
// Decision contract (the brief's `headAgent` block)
// ===========================================================================

export interface HeadAgentModuleRec {
  module: FineDineModule | string;
  readiness: number;
  why: string;
}

export interface HeadAgentConflict {
  claim: string;
  sources: string[];
  note: string;
}

export type RoomTwoStatus =
  /** Claude's talk passed QA and is on the card. */
  | "attached"
  /** Shadow mode: Claude ran, the card stays plain. */
  | "shadow"
  /** QA failed — plain card, no second attempt. */
  | "qa_failed"
  /** Claude not configured, timed out or errored — plain card. */
  | "unavailable"
  /** Room 1 said no call (wedge "none") — Claude not called. */
  | "skipped";

export interface HeadAgentRoomTwo {
  status: RoomTwoStatus;
  qaIssues: string[];
  qaWarnings: string[];
  rounds: number;
  toolCalls: string[];
  /** Shadow / QA-failed draft, for telemetry and review only. Never shown to reps. */
  draftTalkTrack: string | null;
}

export interface HeadAgentDecision {
  packId: string;
  /** Room 1 plan: "starter" | "growth" | "premium" | "none". */
  recommendedPackage: HeadAgentPlan;
  wedge: HeadAgentWedge;
  /** First recommended module (secondary to package + wedge). */
  primaryModule: string | null;
  primaryAngle: string;
  /** "" on a plain card. */
  talkTrack: string;
  recommendedModules: HeadAgentModuleRec[];
  excludedModules: { module: string; why: string }[];
  /** Package fit score 0-100 (deterministic, equals brief salesConfidence). */
  confidence: number;
  evidenceRefs: string[];
  sourceConflicts: HeadAgentConflict[];
  reasoning: string;
  roomOne: RoomOneOutput;
  roomTwo: HeadAgentRoomTwo;
  model: string | null;
  usageTokens: number;
  generatedAt: string;
}

export interface BriefDecisionInput {
  niche: string | null;
  workspaceId?: string;
  leadId?: string;
  businessName?: string;
  address?: string | null;
  /** Language the talk track is written in (workspace language). */
  language?: string | null;
  audit?: RoomOneAudit | null;
  reviewCount?: number | null;
  rating?: number | null;
  priceLevel?: number | null;
  locationCount?: number | null;
  /** ReviewAnalysis row, review-analyst output, or a `{ skipped }` output. */
  reviewAnalysis?: unknown;
  /** Upstream sources known to be skipped ("map" | "website" | "reviews"). */
  skippedSources?: string[];
  /** Replay only: modules excluded in the frozen decision. */
  frozenExcludedModules?: string[];
  /** Test hook: treat Room 3 as failed without calling Claude. */
  forceQaFailure?: boolean;
}

export interface BriefDecisionOptions {
  /** "shadow" runs Room 2 for telemetry only; the card stays plain. */
  mode?: "live" | "shadow";
  /** "tools" = live tool loop; "frozen" = one call, no tools (replay); "off" = never call Claude. */
  roomTwo?: "tools" | "frozen" | "off";
  timeoutMs?: number;
}

export interface HeadAgentBriefDecision {
  briefMode: "head-agent";
  /** Package fit score — the only salesConfidence for restaurant briefs. */
  salesConfidence: number;
  missingSources: string[];
  headAgent: HeadAgentDecision;
}

// ---------------------------------------------------------------------------
// Input normalisation
// ---------------------------------------------------------------------------

function rec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Accepts string phrases and `{ text|phrase|label|quote, sellable? }` objects. */
export function normalizePainPhrases(v: unknown): RoomOnePainPhrase[] {
  if (!Array.isArray(v)) return [];
  const out: RoomOnePainPhrase[] = [];
  for (const x of v) {
    if (typeof x === "string") {
      if (x.trim()) out.push({ text: x.trim() });
      continue;
    }
    const o = rec(x);
    if (!o) continue;
    const text = [o.text, o.phrase, o.label, o.quote].find((t) => typeof t === "string" && t.trim());
    if (typeof text !== "string") continue;
    out.push(typeof o.sellable === "boolean" ? { text: text.trim(), sellable: o.sellable } : { text: text.trim() });
  }
  return out;
}

interface ParsedReviews {
  present: boolean;
  count: number | null;
  phrases: RoomOnePainPhrase[];
}

function parseReviewAnalysis(v: unknown, reviewCount: number | null | undefined): ParsedReviews {
  const o = rec(v);
  if (!o || o.skipped) return { present: false, count: null, phrases: [] };
  const analyzed = typeof o.reviewsAnalyzedCount === "number" ? o.reviewsAnalyzedCount : null;
  return {
    present: true,
    count: analyzed ?? (typeof reviewCount === "number" ? reviewCount : null),
    phrases: normalizePainPhrases(o.painPhrases),
  };
}

function toFnbSignals(input: BriefDecisionInput, audit: RoomOneAudit, phrases: RoomOnePainPhrase[]): FnbSignals {
  const menuUrl = audit.menuUrl ?? null;
  const pdfMenu =
    audit.pdfMenu ?? (menuUrl != null ? /\.pdf(\?|#|$)/i.test(menuUrl) && !audit.detectedMenuTool : null);
  const language = phrases.some((p) => p.sellable !== false && PHRASE.language.test(p.text));
  return {
    hasWebsite: audit.hasWebsite ?? (audit.websiteUrl ? true : null),
    websiteBroken: audit.websiteBroken ?? null,
    detectedMenuTool: audit.detectedMenuTool ?? null,
    hasQrMenu: audit.hasQrMenu ?? null,
    pdfMenu,
    hasOnlineReservation: audit.hasOnlineReservation ?? null,
    hasBookingSystem: audit.hasBookingSystem ?? null,
    bookingProvider: audit.bookingProvider ?? null,
    hasOnlineOrdering: audit.hasOnlineOrdering ?? null,
    // Slow-service reviews never enter the shortlist alone (playbook §7).
    slowServiceSignal: null,
    touristLanguageSignal: language ? true : null,
    isMultiLocation: typeof input.locationCount === "number" ? input.locationCount > 1 : null,
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
    priceLevel: input.priceLevel ?? null,
  };
}

const WEDGE_MODULES: Record<ActiveWedge, readonly string[]> = {
  reservation: ["reservation"],
  bill_wait: ["order_and_pay"],
  marketplace: ["order_and_pay"],
  menu_surface: ["qr_menu", "ai_menu_builder", "multi_language", "website"],
  multi_location: ["multi_location"],
  guest_repeat: ["crm_loyalty"],
};

export const WEDGE_LABELS: Record<HeadAgentWedge, string> = {
  reservation: "Rezervasyon",
  bill_wait: "Hesap bekleme",
  marketplace: "Marketplace",
  menu_surface: "Menü yüzeyi",
  multi_location: "Çok şube",
  guest_repeat: "Misafir tekrarı",
  none: "Arama yok",
};

export const PLAN_LABELS: Record<HeadAgentPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
  none: "Paket yok",
};

/**
 * Package fit score (0-100). Deterministic; replaces the old blend of
 * audit %, review leadScore and scorer score for restaurant briefs.
 */
export function packageFitScore(ev: RoomOneEvaluation, missingSources: string[]): number {
  const missingPenalty = 10 * missingSources.length;
  if (ev.output.wedge === "none") return ev.blocked ? 0 : Math.max(0, 15 - missingPenalty / 2);
  const strong = ev.wedgeSignals.some((s) => s.strength === "strong");
  const extra = Math.max(0, ev.wedgeSignals.length - 1);
  const score = 55 + (strong ? 15 : 0) + 5 * Math.min(extra, 3) + (ev.output.backup ? 5 : 0) - missingPenalty;
  return Math.max(20, Math.min(95, Math.round(score)));
}

// ===========================================================================
// Room 2 — Claude writes the talk for the chosen package
// ===========================================================================

const SYSTEM_PROMPT = `You are the Head Sales Strategist for FineDine, a restaurant platform sold as three plans:
- Starter: menu, QR, website, 1 language, Order & Pay up to 20 tables, 50 reservations/month by e-mail (NO prepayment), CRM keeps the last 10 guests, no custom domain.
- Growth: everything in Starter plus multiple languages, 50 tables, 250 reservations with PREPAYMENT, unlimited guest CRM with segments, custom domain.
- Premium: unlimited, prepayment, MULTI-LOCATION storefront, success manager. Only for groups with 2+ venues.

The PACKAGE and the WEDGE are already decided by deterministic rules (Room 1). You do not choose them and you must not change them.
Your only job: write the 2-3 sentence talk track the rep opens with, for THIS package and THIS wedge.

HARD RULES:
- Every sentence cites at least one evidence id (E1, E2, ...) from the evidence list. A sentence without evidence is not allowed.
- Talk only about the wedge. No second pitch: the backup wedge is not mentioned.
- Never sell a feature outside the package (Starter: no prepayment, no multiple languages; Growth: no multi-location storefront).
- Never break a ban. Bans are listed in the input.
- Never mention prices. No AI, CRM, reporting or "IQ" opener.
- recommendedModules: only modules from allowedModules (may be empty).
- Flag genuine cross-source conflicts (e.g. audit says "no reservation" but a review says "booked online").
- Be concrete about THIS venue. If evidence is thin, say less, do not invent.

You may call read-only tools for raw evidence (lead basics, full reviews, website audit, package catalog, memory) when it changes the wording. Be efficient.

Your FINAL message must be ONLY a JSON object:
{
  "package": string,                 // echo the given package
  "wedge": string,                   // echo the given wedge
  "primaryAngle": string,            // short rep-facing label
  "sentences": [ { "text": string, "evidence": ["E1"] } ],
  "recommendedModules": [ { "module": string, "why": string } ],
  "sourceConflicts": [ { "claim": string, "sources": string[], "note": string } ],
  "reasoning": string                // 1 sentence: why this talk fits the wedge
}`;

interface RawTalk {
  package?: unknown;
  wedge?: unknown;
  primaryAngle?: unknown;
  sentences?: unknown;
  recommendedModules?: unknown;
  sourceConflicts?: unknown;
  reasoning?: unknown;
}

function asConflicts(v: unknown): HeadAgentConflict[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = rec(x);
      if (!o || !o.claim) return null;
      return {
        claim: String(o.claim),
        sources: Array.isArray(o.sources) ? o.sources.map(String) : [],
        note: String(o.note ?? ""),
      };
    })
    .filter((x): x is HeadAgentConflict => x !== null);
}

// ===========================================================================
// Room 3 — deterministic QA
// ===========================================================================

const WEDGE_LINK: Record<ActiveWedge, RegExp> = {
  reservation: /(reserv|booking|\bbook|no[- ]?show|deposit|prepay|cover|table|rezerv|kapora|depozito|ön ödeme|masa)/i,
  bill_wait: /(\bbill|\bpay|\bcheck\b|split|card|hesap|hesab|ödeme|adisyon)/i,
  marketplace: /(deliver|order|commission|deliveroo|uber|just eat|takeaway|sipariş|komisyon|paket)/i,
  menu_surface: /(menu|menü|pdf|allergen|alerjen|language|dil)/i,
  multi_location: /(location|venue|branch|group|site|şube|lokasyon|mekân)/i,
  guest_repeat: /(regular|repeat|return|come back|guest|müdavim|misafir|tekrar)/i,
};

/** Feature words that belong to ONE wedge; a talk on another wedge must not use them. */
const WEDGE_FEATURE: Record<ActiveWedge, RegExp> = {
  reservation: /(reservation system|booking system|rezervasyon sistemi)/i,
  bill_wait: /(pay at (the )?table|order ?(&|and) ?pay|split (the )?bill|masada ödeme|hesab\w* böl)/i,
  marketplace: /(direct (online )?order|commission[- ]free|komisyonsuz|doğrudan sipariş)/i,
  menu_surface: /(digital menu|dijital menü|pdf menu|menu photos)/i,
  multi_location: /(multi[- ]?location|all (of )?your (locations|venues|branches)|tüm şube)/i,
  guest_repeat: /(loyalty|\bcrm\b|sadakat|guest data)/i,
};

const PLAN_FORBIDDEN: Partial<Record<HeadAgentPlan, RegExp>> = {
  starter: /(prepay|pre-pay|deposit|ön ödeme|depozito|multi[- ]?language|multiple languages|languages|çok dil|dil seçen|multi[- ]?location|premium)/i,
  growth: /(multi[- ]?location storefront|all (of )?your (locations|venues|branches)|çok lokasyon vitrin|premium)/i,
};

const VALID_PLANS = new Set(["starter", "growth", "premium"]);

interface QaResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
  talkTrack: string;
  primaryAngle: string;
  recommendedModules: HeadAgentModuleRec[];
  sourceConflicts: HeadAgentConflict[];
  reasoning: string;
}

function roomThreeQa(args: {
  raw: RawTalk;
  ev: RoomOneEvaluation;
  evidenceIds: Map<string, string>;
  shortlist: HeadAgentModuleRec[];
  approvedClaimTexts: string[];
}): QaResult {
  const { raw, ev, evidenceIds, shortlist } = args;
  const plan = ev.output.plan;
  const wedge = ev.output.wedge as ActiveWedge;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!VALID_PLANS.has(plan)) issues.push("invalid_package");
  if (typeof raw.package === "string" && raw.package.trim() && raw.package.trim().toLowerCase() !== plan) {
    issues.push("package_mismatch");
  }
  if (typeof raw.wedge === "string" && raw.wedge.trim() && raw.wedge.trim() !== wedge) issues.push("wedge_mismatch");

  const sentences = Array.isArray(raw.sentences)
    ? raw.sentences
        .map((s) => rec(s))
        .filter((s): s is Record<string, unknown> => s !== null && typeof s.text === "string" && !!s.text.trim())
        .map((s) => ({
          text: String(s.text).trim(),
          evidence: Array.isArray(s.evidence) ? s.evidence.map(String) : [],
        }))
    : [];
  if (sentences.length === 0) issues.push("no_talk_track");
  if (sentences.some((s) => !s.evidence.some((id) => evidenceIds.has(id)))) issues.push("sentence_without_evidence");

  // Claim gate first (drops unapproved % / upsell claims), then judge what is left.
  const carrier = {
    primaryAngle: typeof raw.primaryAngle === "string" ? raw.primaryAngle.trim() : "",
    talkTrack: sentences.map((s) => s.text).join(" "),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning.trim() : "",
    recommendedPackage: null as string | null,
    recommendedModules: [] as Array<{ why: string }>,
    excludedModules: [] as Array<{ why: string }>,
    sourceConflicts: asConflicts(raw.sourceConflicts),
  };
  applyApprovedClaimGate(carrier, args.approvedClaimTexts, warnings);
  const talk = carrier.talkTrack.trim();

  if (talk.length < 20) issues.push("thin_talk_track");
  else if (!WEDGE_LINK[wedge].test(talk)) issues.push("not_linked_to_wedge");

  const planForbidden = PLAN_FORBIDDEN[plan];
  if (planForbidden && planForbidden.test(talk)) issues.push("sells_outside_package");
  for (const w of WEDGE_PRIORITY) {
    if (w !== wedge && WEDGE_FEATURE[w].test(talk)) {
      issues.push(`sells_outside_wedge:${w}`);
      break;
    }
  }

  const firstSentence = sentences[0]?.text ?? "";
  ev.banRules.forEach((ban, i) => {
    if (!ban.pattern) return;
    const target = ban.openerOnly ? firstSentence : talk;
    if (ban.pattern.test(target)) issues.push(`ban_broken:${i}`);
  });

  const allowed = new Map(shortlist.map((m) => [String(m.module), m]));
  const modules: HeadAgentModuleRec[] = [];
  if (Array.isArray(raw.recommendedModules)) {
    for (const x of raw.recommendedModules) {
      const o = rec(x);
      if (!o || !o.module) continue;
      const mod = String(o.module);
      const base = allowed.get(mod);
      if (!base) {
        warnings.push(`dropped_module:${mod}`);
        continue;
      }
      if (!modules.some((m) => m.module === mod)) {
        modules.push({ module: mod, readiness: base.readiness, why: String(o.why ?? base.why) });
      }
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    talkTrack: talk,
    primaryAngle: carrier.primaryAngle,
    recommendedModules: modules.length > 0 ? modules : shortlist,
    sourceConflicts: carrier.sourceConflicts,
    reasoning: carrier.reasoning,
  };
}

// ===========================================================================
// buildBriefDecision — Room 1 → Room 2 → Room 3
// ===========================================================================

export async function buildBriefDecision(
  input: BriefDecisionInput,
  opts: BriefDecisionOptions = {},
): Promise<HeadAgentBriefDecision> {
  const mode = opts.mode ?? "live";
  const audit: RoomOneAudit = input.audit ?? {};
  const reviews = parseReviewAnalysis(input.reviewAnalysis, input.reviewCount);

  // Missing sources: what the decision could not see.
  const missing = new Set((input.skippedSources ?? []).map(String));
  if (input.rating == null && input.reviewCount == null) missing.add("map");
  if (!input.audit) missing.add("website");
  if (!reviews.present || (reviews.count != null && reviews.count < REVIEW_CORPUS_MIN)) missing.add("reviews");
  const missingSources = ["map", "website", "reviews"].filter((s) => missing.has(s))
    .concat([...missing].filter((s) => !["map", "website", "reviews"].includes(s)));

  const ev = evaluateRoomOne({
    audit,
    reviews: {
      count: reviews.present ? reviews.count : (input.reviewCount ?? 0),
      painPhrases: reviews.phrases,
    },
    locationCount: input.locationCount ?? 1,
  });
  const r1 = ev.output;
  const fitScore = packageFitScore(ev, missingSources);

  // Module shortlist (secondary to package + wedge).
  const fit = computeFnbModuleFit(toFnbSignals(input, audit, reviews.phrases));
  const excluded = new Map<string, string>();
  for (const f of fit.fits) if (f.doNotPitch) excluded.set(String(f.module), f.doNotPitchReason ?? "Zaten var.");
  if (audit.bookingProvider?.trim() && !excluded.has("reservation")) {
    excluded.set("reservation", `Rezervasyon sağlayıcısı zaten var (${audit.bookingProvider.trim()}).`);
  }
  for (const m of input.frozenExcludedModules ?? []) {
    if (m && !excluded.has(m)) excluded.set(m, "Donmuş karar veya güncel modül kuralı.");
  }
  const wedgeModules = r1.wedge === "none" ? [] : WEDGE_MODULES[r1.wedge];
  const shortlist: HeadAgentModuleRec[] = fit.fits
    .filter((f) => !f.doNotPitch && f.readiness > 0 && !excluded.has(String(f.module)))
    .filter((f) => f.module !== "website" || audit.websiteBroken === true)
    .filter((f) => wedgeModules.includes(String(f.module)))
    .slice(0, 3)
    .map((f) => ({ module: f.module, readiness: f.readiness, why: f.reason }));

  // Evidence refs: Room 1 evidence, then the facts behind exclusions.
  const observations: string[] = [];
  if (audit.bookingProvider?.trim()) observations.push(siteRef(audit, `rezervasyon sağlayıcısı: ${audit.bookingProvider.trim()}`));
  if (audit.detectedMenuTool?.trim()) observations.push(siteRef(audit, `menü aracı: ${audit.detectedMenuTool.trim()}`));
  const evidenceRefs = [...new Set([...r1.evidence, ...observations])];

  const plainAngle = r1.wedge === "none" ? WEDGE_LABELS.none : `${WEDGE_LABELS[r1.wedge]} → ${PLAN_LABELS[r1.plan]}`;
  const plainReasoning =
    r1.wedge === "none"
      ? missingSources.length > 0
        ? `Oda 1: güçlü sinyal veya iki orta sinyal yok. Eksik kaynak: ${missingSources.join(", ")}.`
        : "Oda 1: güçlü sinyal veya iki orta sinyal yok."
      : `Oda 1: ${WEDGE_LABELS[r1.wedge]} kaçağı, en küçük paket ${PLAN_LABELS[r1.plan]}.${r1.backup ? ` Yedek: ${WEDGE_LABELS[r1.backup as HeadAgentWedge] ?? r1.backup}.` : ""}`;

  const decision: HeadAgentDecision = {
    packId: fit.packId,
    recommendedPackage: r1.plan,
    wedge: r1.wedge,
    primaryModule: shortlist[0]?.module ? String(shortlist[0].module) : null,
    primaryAngle: plainAngle,
    talkTrack: "",
    recommendedModules: shortlist,
    excludedModules: [...excluded.entries()].map(([module, why]) => ({ module, why })),
    confidence: fitScore,
    evidenceRefs: evidenceRefs.slice(0, 3),
    sourceConflicts: [],
    reasoning: plainReasoning,
    roomOne: r1,
    roomTwo: { status: "skipped", qaIssues: [], qaWarnings: [], rounds: 0, toolCalls: [], draftTalkTrack: null },
    model: null,
    usageTokens: 0,
    generatedAt: new Date().toISOString(),
  };
  const result: HeadAgentBriefDecision = {
    briefMode: "head-agent",
    salesConfidence: fitScore,
    missingSources,
    headAgent: decision,
  };

  if (r1.wedge === "none" || r1.plan === "none") return result;
  if (input.forceQaFailure) {
    decision.roomTwo = { ...decision.roomTwo, status: "qa_failed", qaIssues: ["forced_qa_failure"] };
    return result;
  }
  const roomTwoMode = opts.roomTwo ?? (input.workspaceId && input.leadId ? "tools" : "frozen");
  if (roomTwoMode === "off" || !isAnthropicConfigured()) {
    decision.roomTwo = { ...decision.roomTwo, status: "unavailable" };
    return result;
  }

  // ---- Room 2 ----
  const evidenceIds = new Map(evidenceRefs.map((e, i) => [`E${i + 1}`, e]));
  const payload = {
    business: {
      name: input.businessName ?? null,
      address: input.address ?? null,
      rating: input.rating ?? null,
      reviewCount: input.reviewCount ?? null,
    },
    language: input.language ?? "en",
    package: r1.plan,
    wedge: r1.wedge,
    backupWedge: r1.backup,
    evidence: [...evidenceIds.entries()].map(([id, text]) => ({ id, text })),
    bans: r1.bans,
    allowedModules: shortlist,
    excludedModules: decision.excludedModules,
    missingSources,
  };
  const user = `Room 1 decision and evidence (JSON):\n${JSON.stringify(payload, null, 2)}\n\nWrite the talk track for package "${r1.plan}" and wedge "${r1.wedge}". Return the JSON only.`;

  let raw: RawTalk;
  let rounds = 1;
  let toolCalls: string[] = [];
  try {
    if (roomTwoMode === "tools" && input.workspaceId && input.leadId) {
      const ctx = { workspaceId: input.workspaceId, leadId: input.leadId };
      const loop = await runClaudeToolLoop({
        system: SYSTEM_PROMPT,
        initialUser: user,
        tools: AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        executeTool: (name, toolInput) => executeAgentTool(ctx, name, toolInput),
        label: "head_agent.room_two",
        timeoutMs: opts.timeoutMs,
        temperature: 0.2,
        maxTokens: 2048,
        maxRounds: 5,
      });
      raw = parseClaudeJson<RawTalk>(loop.finalText, "head_agent.room_two");
      rounds = loop.rounds;
      toolCalls = loop.toolCalls;
      decision.usageTokens = loop.usage.totalTokens;
    } else {
      const res = await callClaudeJson<RawTalk>({
        system:
          SYSTEM_PROMPT +
          "\nOFFLINE EVALUATION: tools are unavailable. Use only the frozen input. Never invent missing facts.",
        user,
        label: "head_agent.control_replay",
        temperature: 0.2,
        maxTokens: 2048,
        timeoutMs: opts.timeoutMs,
      });
      raw = res.data;
      decision.usageTokens = res.usage.totalTokens;
    }
    decision.model = getHeadAgentModel();
  } catch (err) {
    logger.warn("ai_core.head_agent.room_two_failed", {
      leadId: input.leadId ?? null,
      err: err instanceof Error ? err.message : String(err),
    });
    decision.roomTwo = { ...decision.roomTwo, status: "unavailable" };
    return result;
  }

  // ---- Room 3 ----
  let approvedClaimTexts: string[] = [];
  if (input.workspaceId && roomTwoMode === "tools") {
    try {
      approvedClaimTexts = (await listApprovedClaims(input.workspaceId)).map((c) => c.text);
    } catch (err) {
      logger.warn("ai_core.head_agent.claims_unavailable", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const qa = roomThreeQa({ raw, ev, evidenceIds, shortlist, approvedClaimTexts });
  const base = { qaIssues: qa.issues, qaWarnings: qa.warnings, rounds, toolCalls };

  if (!qa.passed) {
    decision.roomTwo = { ...base, status: "qa_failed", draftTalkTrack: qa.talkTrack || null };
    return result;
  }
  if (mode === "shadow") {
    decision.roomTwo = { ...base, status: "shadow", draftTalkTrack: qa.talkTrack };
    return result;
  }

  decision.roomTwo = { ...base, status: "attached", draftTalkTrack: null };
  decision.talkTrack = qa.talkTrack;
  decision.primaryAngle = qa.primaryAngle || plainAngle;
  decision.recommendedModules = qa.recommendedModules;
  decision.primaryModule = qa.recommendedModules[0]?.module ? String(qa.recommendedModules[0].module) : null;
  decision.sourceConflicts = qa.sourceConflicts;
  decision.reasoning = qa.reasoning || plainReasoning;
  decision.evidenceRefs = evidenceRefs;
  return result;
}

// ===========================================================================
// Offline replay — same contract, frozen input, no tools, no DB writes
// ===========================================================================

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function triBool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Map a frozen golden-case snapshot onto the brief decision input. */
export function snapshotToDecisionInput(inputSnapshot: unknown): BriefDecisionInput {
  const input = rec(inputSnapshot) ?? {};
  const a = rec(input.audit);
  const audit: RoomOneAudit | null = a
    ? {
        websiteUrl: str(a.url) ?? str(a.websiteUrl),
        reachable: triBool(a.reachable),
        hasWebsite: str(a.url) ? true : triBool(a.hasWebsite),
        websiteBroken: triBool(a.websiteBroken),
        hasBookingSystem: triBool(a.hasBookingSystem),
        hasOnlineReservation: triBool(a.hasOnlineReservation),
        bookingProvider: str(a.bookingProvider),
        hasPrepayment: triBool(a.hasPrepayment),
        tableCount: num(a.tableCount),
        hasQrMenu: triBool(a.hasQrMenu),
        pdfMenu: triBool(a.pdfMenu),
        menuUrl: str(a.menuUrl),
        detectedMenuTool: str(a.detectedMenuTool),
        hasOnlineOrdering: triBool(a.hasOnlineOrdering),
        marketplaceOrdering: triBool(a.marketplaceOrdering),
        deliveryPlatforms: Array.isArray(a.deliveryPlatforms) ? a.deliveryPlatforms.map(String) : null,
        languageCount: num(a.languageCount),
        venueType: (str(a.venueType) as VenueType | null) ?? null,
        tastingMenu: triBool(a.tastingMenu),
        centralPurchasing: triBool(a.centralPurchasing),
      }
    : null;
  const frozenExcluded = Array.isArray(input.excludedModules)
    ? input.excludedModules.map((v) => String(rec(v)?.module ?? "")).filter(Boolean)
    : [];
  return {
    niche: "RESTAURANT_TECH",
    businessName: str(input.businessName) ?? undefined,
    address: str(input.address),
    rating: num(input.rating),
    reviewCount: num(input.reviewCount),
    priceLevel: num(input.priceLevel),
    locationCount: num(input.locationCount),
    audit,
    reviewAnalysis: input.reviewAnalysis ?? null,
    frozenExcludedModules: frozenExcluded,
  };
}

/** Offline evaluation: one decision, current rules and prompt, no tools or database writes. */
export async function replayHeadAgentDecision(inputSnapshot: unknown) {
  const brief = rec(rec(inputSnapshot)?.briefContext) ?? {};
  const decision = await buildBriefDecision(snapshotToDecisionInput(inputSnapshot), {
    mode: "live",
    roomTwo: "frozen",
  });
  return { ...brief, ...decision };
}
