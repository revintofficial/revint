/**
 * AI Workers registry - single source of truth for all 19 worker kinds.
 *
 * The registry is intentionally **pure metadata** at module load time:
 * no worker implementation modules are imported eagerly. The `run`
 * handlers are resolved lazily via dynamic import on first invocation
 * (see `resolveWorkerRun`) so Phase 2 / Phase 3 workers can declare
 * their metadata without pulling Gemini prompt bundles into the API
 * route bundle graph.
 *
 * Labels in both English and Turkish. The UI picks the right one based
 * on `workspace.language`.
 */
import type { AgentWorkerKind, Plan } from "@/generated/prisma/client";
import type {
  AgentWorker,
  AgentWorkerContext,
  AgentWorkerOutput,
  AgentWorkerRun,
} from "./types";

type AgentWorkerMeta = Omit<AgentWorker, "run"> & {
  // Dynamic import path (relative to this file). The import is cached
  // on first call.
  implModule?: () => Promise<{ run: AgentWorkerRun }>;
};

const meta: Record<AgentWorkerKind, AgentWorkerMeta> = {
  // -------- Grup A: Intelligence (auto-run on ingest, legacy workers) --------
  WEBSITE_AUDITOR: {
    kind: "WEBSITE_AUDITOR",
    group: "intelligence",
    displayName: "Website Auditor",
    displayNameTr: "Website Analizcisi",
    description: "Crawls the lead's site with Playwright and records booking, mobile, speed, schema, and security signals.",
    descriptionTr: "Playwright ile lead'in sitesini tarar; randevu, mobil, hiz, schema ve guvenlik sinyallerini kaydeder.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 15000,
  },
  REVIEW_ANALYST: {
    kind: "REVIEW_ANALYST",
    group: "intelligence",
    displayName: "Review Analyst",
    displayNameTr: "Yorum Analizcisi",
    description: "Aggregates up to 50 Google reviews into KPI bars (weakness / strength / pain phrases).",
    descriptionTr: "50 Google yorumunu KPI cubuklarina cevirir (zayif yon / guclu yon / aci ifadeleri).",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 20000,
  },
  SALES_OPPORTUNITY_SCORER: {
    kind: "SALES_OPPORTUNITY_SCORER",
    group: "intelligence",
    displayName: "Opportunity Scorer",
    displayNameTr: "Firsat Skorlayici",
    description: "0-100 opportunity score plus suggested offer and best sales angle.",
    descriptionTr: "0-100 firsat skoru, onerilen paket ve en iyi satis acisi.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 12000,
  },
  SOCIAL_SCRAPER: {
    kind: "SOCIAL_SCRAPER",
    group: "intelligence",
    displayName: "Social Scraper",
    displayNameTr: "Sosyal Profil Toplayici",
    description: "Discovers Instagram, Facebook, LinkedIn, TikTok profiles and follower counts.",
    descriptionTr: "Instagram, Facebook, LinkedIn, TikTok profillerini ve takipci sayilarini bulur.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 8000,
  },
  EMAIL_VERIFIER: {
    kind: "EMAIL_VERIFIER",
    group: "intelligence",
    displayName: "Email Verifier",
    displayNameTr: "Email Dogrulayici",
    description: "ZeroBounce verification for every contact email on the lead's site.",
    descriptionTr: "Sitede bulunan her iletisim email'i icin ZeroBounce dogrulama.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 3000,
  },

  // -------- Grup B: Pitch (agency-facing artifacts, sent to prospects) --------
  WEBSITE_PLAN_GENERATOR: {
    kind: "WEBSITE_PLAN_GENERATOR",
    group: "pitch",
    displayName: "Website Plan Generator",
    displayNameTr: "Website Plan Uretici",
    description: "19-section professional web development plan grounded in the lead's audit and review analysis.",
    descriptionTr: "Lead'in audit ve yorum analizine dayali 19 bolumluk profesyonel web gelistirme plani.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 35000,
  },
  WEBSITE_MOCKUP_GENERATOR: {
    kind: "WEBSITE_MOCKUP_GENERATOR",
    group: "pitch",
    displayName: "Website Mockup Generator",
    displayNameTr: "Website Mockup Uretici",
    description: "Real single-page landing site in landing-page quality. Shareable at /m/{slug} as a preview the prospect can open on their phone.",
    descriptionTr: "Gercek landing page kalitesinde tek-sayfa site. /m/{slug} adresinde onizleme olarak paylasilir, prospect telefonundan acar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 25000,
    exportFormats: ["html"],
    implModule: () => import("./website-mockup").then((m) => ({ run: m.run })),
  },
  OPENER_WRITER: {
    kind: "OPENER_WRITER",
    group: "pitch",
    displayName: "Opener Writer",
    displayNameTr: "Acilis Mesaji Yazici",
    description: "Personalized cold-email or WhatsApp first message grounded in the lead's pain points.",
    descriptionTr: "Lead'in aci noktalarina dayali kisisellestirilmis cold-email veya WhatsApp ilk mesaji.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 8000,
  },
  VIDEO_SCRIPT_WRITER: {
    kind: "VIDEO_SCRIPT_WRITER",
    group: "pitch",
    displayName: "Video Script Writer",
    displayNameTr: "Video Script Yazici",
    description: "30-second Loom / Vidyard personalized video script per lead.",
    descriptionTr: "Her lead icin 30-saniyelik Loom / Vidyard kisisellestirilmis video script.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 10000,
  },
  VOICE_NOTE_TRANSCRIBER: {
    kind: "VOICE_NOTE_TRANSCRIBER",
    group: "pitch",
    displayName: "Voice Note Transcriber",
    displayNameTr: "Sesli Not Transkribe Edici",
    description: "Gemini transcribes field voice memos and appends to the pipeline notes.",
    descriptionTr: "Saha sesli notlarini Gemini ile metne cevirir, pipeline notlarina ekler.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 6000,
  },

  // -------- Grup C: Deliverable (prospect-install packs) --------
  AI_RECEPTIONIST_BUILDER: {
    kind: "AI_RECEPTIONIST_BUILDER",
    group: "deliverable",
    displayName: "AI Receptionist Builder",
    displayNameTr: "AI Resepsiyonist Kurucu",
    description: "Voice agent config (Synthflow / Retell / Vapi) with greeting, FAQ, hours, booking flow tuned to the lead's business.",
    descriptionTr: "Synthflow / Retell / Vapi uyumlu sesli ajan config'i - karsilama, SSS, calisma saatleri, randevu akisi lead'e ozel.",
    // LAUNCH: temporarily open to FREE tier (normally PRO+). Flip back
    // to "PRO" in registry + quota.ts when first 30-day usage stabilises.
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 40000,
    exportFormats: ["synthflow", "retell", "vapi", "ghl", "json"],
    implModule: () => import("./ai-receptionist").then((m) => ({ run: m.run })),
  },
  REVIEW_REPLY_AGENT: {
    kind: "REVIEW_REPLY_AGENT",
    group: "deliverable",
    displayName: "Review Reply Agent",
    displayNameTr: "Yorum Cevap Ajani",
    description: "50-reply pool + tone spec + 1-2 star approval rule. Drops into Reploi / UseLocalGuide / Zapier for Google Business Profile.",
    descriptionTr: "50-cevap havuzu + ton tanimi + 1-2 yildiz onay kurali. Reploi / UseLocalGuide / Zapier'a Google Business Profile icin direkt takilir.",
    // LAUNCH: temporarily open to FREE tier (normally PRO+).
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 25000,
    exportFormats: ["json", "zip"],
    implModule: () => import("./review-reply").then((m) => ({ run: m.run })),
  },
  LEAD_RESPONSE_AGENT: {
    kind: "LEAD_RESPONSE_AGENT",
    group: "deliverable",
    displayName: "Lead Response Agent",
    displayNameTr: "Lead Cevap Ajani",
    description: "SMS / email trigger tree that replies to inbound leads within 60 seconds. Exports to GHL Conversation AI or n8n.",
    descriptionTr: "Gelen leadlere 60 saniyede cevap veren SMS / email tetikleyici akisi. GHL Conversation AI veya n8n'e export.",
    // LAUNCH: temporarily open to FREE tier (normally PRO+).
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 20000,
    exportFormats: ["ghl", "n8n", "make", "json"],
    implModule: () => import("./lead-response").then((m) => ({ run: m.run })),
  },
  BOOKING_WIDGET_BUILDER: {
    kind: "BOOKING_WIDGET_BUILDER",
    group: "deliverable",
    displayName: "Booking Widget Builder",
    displayNameTr: "Randevu Widget Kurucu",
    description: "Embeddable HTML booking widget plus Cal.com / GHL calendar config.",
    descriptionTr: "Sitede kullanilabilir HTML randevu widget'i ve Cal.com / GHL takvim konfigurasyonu.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 15000,
    exportFormats: ["html", "json"],
  },
  GBP_AUTOPOST_AGENT: {
    kind: "GBP_AUTOPOST_AGENT",
    group: "deliverable",
    displayName: "GBP Auto-Post Agent",
    displayNameTr: "GBP Otomatik Post Ajani",
    description: "30-day Google Business Profile post schedule with asset prompts (offer / update / event posts).",
    descriptionTr: "30 gunluk Google Business Profile post takvimi ve gorsel prompt'lari (teklif / guncelleme / etkinlik).",
    minPlan: "PRO_TEAM",
    phase1Enabled: false,
    estimatedDurationMs: 30000,
    exportFormats: ["json", "zip"],
  },

  // -------- Grup D: Ops (platform-level, agency-side) --------
  COPILOT_CHAT: {
    kind: "COPILOT_CHAT",
    group: "ops",
    displayName: "Co-pilot Chat",
    displayNameTr: "Co-pilot Sohbeti",
    description: "Workspace-wide Gemini chat that knows every lead in the pipeline.",
    descriptionTr: "Pipeline'daki her lead'i bilen workspace-capinda Gemini sohbeti.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 4000,
  },
  INBOX_REPLY_ATTRIBUTOR: {
    kind: "INBOX_REPLY_ATTRIBUTOR",
    group: "ops",
    displayName: "Inbox Reply Attributor",
    displayNameTr: "Gelen Kutusu Eslestirici",
    description: "Matches Gmail / Outlook inbound replies to sent openers and advances the pipeline stage.",
    descriptionTr: "Gmail / Outlook gelen cevaplarini gonderilen openerlarla eslestirir, pipeline asamasini ilerletir.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 5000,
  },
  OUTREACH_SENDER: {
    kind: "OUTREACH_SENDER",
    group: "ops",
    displayName: "Outreach Sender",
    displayNameTr: "Outreach Gonderici",
    description: "OAuth-backed Gmail / Outlook direct send from inside the workspace with per-account daily limits.",
    descriptionTr: "OAuth ile baglanan Gmail / Outlook'tan workspace icinden direkt gonderim, hesap basi gunluk limitli.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 3000,
  },
  CONTAINMENT_RATE_TRACKER: {
    kind: "CONTAINMENT_RATE_TRACKER",
    group: "ops",
    displayName: "Containment Rate Tracker",
    displayNameTr: "AI Otomasyon Orani Takibi",
    description: "Tracks what percent of the deployed receptionist calls the AI closed without human handoff. Agency-ready metric for client renewal pitches.",
    descriptionTr: "Kurulan resepsiyonistin insan devrine gerek duymadan bitirdigi call yuzdesi. Ajansin musteri yenileme pitch'i icin hazir metrik.",
    minPlan: "PRO_TEAM",
    phase1Enabled: false,
    estimatedDurationMs: 0,
  },
};

/**
 * All workers keyed by kind. Use this as the public registry surface.
 */
export const WORKERS: Record<AgentWorkerKind, AgentWorker> = Object.fromEntries(
  Object.entries(meta).map(([kind, m]) => [kind, toPublicWorker(m)]),
) as Record<AgentWorkerKind, AgentWorker>;

function toPublicWorker(m: AgentWorkerMeta): AgentWorker {
  // Public registry entry never exposes `implModule` directly; callers
  // use `resolveWorkerRun(kind)` which handles the lazy import + cache.
  const { implModule: _impl, ...rest } = m;
  return rest;
}

/**
 * Returns the list of workers visible to the given plan, ordered by
 * group then kind. Workers below the user's plan are still returned
 * with `minPlan` so the UI can render them as "upgrade to unlock".
 */
export function listWorkers(): AgentWorker[] {
  return Object.values(WORKERS);
}

export function getWorker(kind: AgentWorkerKind): AgentWorker | undefined {
  return WORKERS[kind];
}

/**
 * Tier ordering - higher = more access. Used by quota gating to
 * evaluate `workspace.plan >= worker.minPlan`.
 */
const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  PRO: 1,
  PRO_TEAM: 2,
  AGENCY: 3,
};

export function planMeetsMinimum(plan: Plan, minPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

/**
 * Dynamic import + cache of a worker's `run` handler. Throws if the
 * worker is not yet implemented (Phase 2 / 3 placeholders).
 */
const runCache = new Map<AgentWorkerKind, AgentWorkerRun>();

export async function resolveWorkerRun(kind: AgentWorkerKind): Promise<AgentWorkerRun> {
  const cached = runCache.get(kind);
  if (cached) return cached;
  const m = meta[kind];
  if (!m.implModule) {
    throw new Error(`Worker ${kind} is not yet implemented (phase 2/3 placeholder)`);
  }
  const mod = await m.implModule();
  runCache.set(kind, mod.run);
  return mod.run;
}

/**
 * Convenience runner used by the BullMQ worker process. Wraps the lazy
 * resolver + execution + return shape so the queue code stays thin.
 */
export async function runWorker(
  kind: AgentWorkerKind,
  ctx: AgentWorkerContext,
): Promise<AgentWorkerOutput> {
  const run = await resolveWorkerRun(kind);
  return run(ctx);
}
