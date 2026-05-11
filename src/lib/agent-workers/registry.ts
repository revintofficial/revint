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
 * Labels are English-first. Turkish fields (`displayNameTr`,
 * `descriptionTr`) are retained in the type shape for backward
 * compatibility but the UI no longer reads them.
 */
import type { AgentWorkerKind, Plan } from "@/generated/prisma/client";
import type {
  AgentWorker,
  AgentWorkerContext,
  AgentWorkerFinalize,
  AgentWorkerOutput,
  AgentWorkerRun,
  AgentWorkerStart,
  MemoryWrite,
} from "./types";

/**
 * Shape that a worker's impl module must export. At least one of `run`
 * (sync mode) or `start` + `finalize` (async-apify mode) must be
 * present. `memoryWrites` is optional and returned by modules that
 * produce SemanticMemory side effects. Registry callers don't
 * observe the module shape directly - they go through the resolvers
 * (`resolveWorkerRun`, `resolveWorkerStart`, etc.).
 */
interface WorkerModule {
  run?: AgentWorkerRun;
  start?: AgentWorkerStart;
  finalize?: AgentWorkerFinalize;
  memoryWrites?: (output: unknown, ctx: AgentWorkerContext) => MemoryWrite[] | Promise<MemoryWrite[]>;
}

type AgentWorkerMeta = Omit<AgentWorker, "run" | "memoryWrites"> & {
  // Dynamic import path (relative to this file). The import is cached
  // on first call.
  implModule?: () => Promise<WorkerModule>;
};

const meta: Record<AgentWorkerKind, AgentWorkerMeta> = {
  // -------- Grup A: Intelligence (migrated to AI Core registry) --------
  WEBSITE_AUDITOR: {
    kind: "WEBSITE_AUDITOR",
    group: "intelligence",
    displayName: "Website Auditor",
    displayNameTr: "Website Analizcisi",
    description: "Crawls the lead's site with Playwright and records booking, mobile, speed, schema, and security signals.",
    descriptionTr: "Playwright ile lead'in sitesini tarar; randevu, mobil, hiz, schema ve guvenlik sinyallerini kaydeder.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 15000,
    implModule: () =>
      import("./website-auditor").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  REVIEW_ANALYST: {
    kind: "REVIEW_ANALYST",
    group: "intelligence",
    displayName: "Review Analyst",
    displayNameTr: "Yorum Analizcisi",
    description: "Aggregates up to 50 Google reviews into KPI bars (weakness / strength / pain phrases).",
    descriptionTr: "50 Google yorumunu KPI cubuklarina cevirir (zayif yon / guclu yon / aci ifadeleri).",
    minPlan: "FREE",
    phase1Enabled: true,
    // PLAN §Phase 5 — bumped 20s → 30s. High-volume leads
    // (Bianco43: 1572 reviews) trip the 60s outer deadline
    // (3 × estimatedDurationMs) at 20s. 30s gives the executor a
    // 90s outer budget, headroom for the 200-review Gemini context
    // window. Pair this with the sample reduction in
    // `review-analyst.ts` (220 → 200) so the per-call cost falls
    // even as the safety budget rises.
    estimatedDurationMs: 30000,
    dependsOn: ["GOOGLE_PLACES_REVIEWS"],
    implModule: () => import("./review-analyst").then((m) => ({ run: m.run, memoryWrites: m.memoryWrites })),
  },
  GOOGLE_PLACES_REVIEWS: {
    kind: "GOOGLE_PLACES_REVIEWS",
    group: "intelligence",
    displayName: "Google Places Reviews",
    displayNameTr: "Google Places Yorumlari",
    description: "Pre-loads up to 5 reviews from Google Places API on lead creation so REVIEW_ANALYST has a corpus to analyze. FREE-safe (one Places API call, no Gemini, no Apify).",
    descriptionTr: "Lead olusturuldugunda Google Places API'den 5 yoruma kadar onceden yukler; REVIEW_ANALYST analiz edecek corpus'u bulur. FREE-uyumlu (tek Places API cagrisi, Gemini/Apify yok).",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 4000,
    // FineDine deployment redesign — Places API caps at 5 reviews/business,
    // which biases sentiment too much. Replaced by APIFY_GMAPS_DEEP in
    // every default chain. Hidden so reps don't accidentally re-trigger
    // a flow we deliberately deprecated.
    hiddenFromPanel: true,
    implModule: () =>
      import("./google-places-reviews").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  SALES_OPPORTUNITY_SCORER: {
    kind: "SALES_OPPORTUNITY_SCORER",
    group: "intelligence",
    displayName: "Opportunity Scorer",
    displayNameTr: "Firsat Skorlayici",
    description: "0-100 opportunity score plus suggested offer and best sales angle.",
    descriptionTr: "0-100 firsat skoru, onerilen paket ve en iyi satis acisi.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 12000,
    implModule: () =>
      import("./sales-opportunity-scorer").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  SUBVERTICAL_CLASSIFIER: {
    kind: "SUBVERTICAL_CLASSIFIER",
    group: "intelligence",
    displayName: "Sub-vertical Classifier",
    displayNameTr: "Alt Dikey Siniflandirici",
    description:
      "Tags hybrid-niche leads (e.g. fnb → fnb-bar-club, fnb-fine-dining). Rule-based first using website-audit signals + name + Google Places type; falls back to a Gemini call only when rules can't decide. Self-skips for workspaces whose niche has no children.",
    descriptionTr:
      "Hibrit-nis leadlere (orn. fnb → fnb-bar-club, fnb-fine-dining) etiket atar. Once kural tabanli (audit sinyalleri + isim + Google Places tipi); kural cozemezse Gemini fallback. Cocuk paketi olmayan workspace'lerde kendini atlar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 4000,
    dependsOn: ["WEBSITE_AUDITOR"],
    implModule: () =>
      import("./subvertical-classifier").then((m) => ({ run: m.run })),
  },
  SOCIAL_SCRAPER: {
    kind: "SOCIAL_SCRAPER",
    group: "intelligence",
    displayName: "Social Scraper",
    displayNameTr: "Sosyal Profil Toplayici",
    description: "Discovers Instagram, Facebook, LinkedIn, TikTok profiles and follower counts (links-from-site). For deep profile data use APIFY_* social workers.",
    descriptionTr: "Instagram, Facebook, LinkedIn, TikTok profillerini bulur (siteden link cikarma). Derin profil datasi icin APIFY_* sosyal worker'larini kullan.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 8000,
    implModule: () => import("./social-scraper").then((m) => ({ run: m.run })),
  },
  EMAIL_VERIFIER: {
    kind: "EMAIL_VERIFIER",
    group: "intelligence",
    displayName: "Email Verifier",
    displayNameTr: "Email Dogrulayici",
    description: "ZeroBounce verification for every contact email on the lead's site.",
    descriptionTr: "Sitede bulunan her iletisim email'i icin ZeroBounce dogrulama.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 3000,
    implModule: () => import("./email-verifier").then((m) => ({ run: m.run })),
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
    // Legacy "website plan" surface predates SDR Brain v2; not in any
    // chain. Hidden until/unless we revive a website-redesign upsell.
    hiddenFromPanel: true,
  },
  WEBSITE_MOCKUP_GENERATOR: {
    kind: "WEBSITE_MOCKUP_GENERATOR",
    group: "pitch",
    displayName: "Website Mockup Generator",
    displayNameTr: "Website Mockup Uretici",
    description: "Production-quality single-page landing site, shareable at /m/{slug} so the prospect can open the preview on their phone.",
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
    description: "Personalized cold-email or WhatsApp first message grounded in the lead's pain points, augmented with the workspace's past winning openers via few-shot retrieval from SemanticMemory.",
    descriptionTr: "Lead'in aci noktalarina dayali kisisellestirilmis cold-email veya WhatsApp ilk mesaji. Workspace'in gecmiste cevap alan opener'larindan few-shot retrieval ile ses ogrenmesi.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 8000,
    memoryReads: [
      { kinds: ["OPENER_SUCCESS"], topK: 5, scope: "workspace" },
      { kinds: ["LEAD_PROFILE"], topK: 1, scope: "lead" },
    ],
    implModule: () => import("./opener-writer").then((m) => ({ run: m.run })),
  },
  VIDEO_SCRIPT_WRITER: {
    kind: "VIDEO_SCRIPT_WRITER",
    group: "pitch",
    displayName: "Video Script Writer",
    displayNameTr: "Sesli Not Transkribe Edici",
    description: "30-second Loom / Vidyard personalized video script per lead.",
    descriptionTr: "Her lead icin 30-saniyelik Loom / Vidyard kisisellestirilmis video script.",
    minPlan: "PRO",
    phase1Enabled: false,
    estimatedDurationMs: 10000,
    // Pitch deliverable — outside the SDR cycle. Stays in registry for
    // the user_one_click_pitch chain (where it's optional) but hidden
    // from the per-lead panel.
    hiddenFromPanel: true,
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
    // Server-side only — fired by POST /api/leads/[id]/voice-notes
    // (which then emits voice_note_added). No useful manual trigger
    // surface on the lead-detail panel.
    hiddenFromPanel: true,
  },
  LEAD_DOSSIER_GENERATOR: {
    kind: "LEAD_DOSSIER_GENERATOR",
    group: "pitch",
    displayName: "Lead Dossier Generator",
    displayNameTr: "Lead Dosya Olusturucu",
    description: "Synthesises every collected signal (audit, reviews, scorer, semantic memory, Apify runs) into a 2-minute Markdown brief. Output is cached on AgentRun so the dossier button serves instantly until source data changes.",
    descriptionTr: "Toplanmis her sinyali (audit, yorumlar, scorer, semantic memory, Apify runlari) 2 dakikalik Markdown brief'e cevirir. Output AgentRun'da cache'lenir; kaynak data degismedikce buton aninda servis eder.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 12000,
    memoryReads: [{ kinds: ["LEAD_PROFILE", "REVIEW_CHUNK"], topK: 10, scope: "lead" }],
    implModule: () =>
      import("./lead-dossier-generator").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  LEAD_INTELLIGENCE_BRIEF: {
    kind: "LEAD_INTELLIGENCE_BRIEF",
    group: "intelligence",
    displayName: "Sales Intelligence Brief",
    displayNameTr: "Satis Brief'i",
    description: "Final-stage rollup: reads every upstream artifact (audit, reviews, social, deep crawl, dossier, mockup) and writes a single canonical 'Sales Talking Points' payload + a 0-100 Sales Confidence score. Replaces the old multi-source scoring confusion with one number the rep can trust.",
    descriptionTr: "Tum onceki sinyalleri (audit, yorumlar, sosyal, derin tarama, dosya, mockup) tek satilabilir brief'e ve 0-100 Sales Confidence skoruna ozetler. Coklu kaynaklardan gelen skor karmasini tek guvenilir bir numaraya indirger.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 9000,
    memoryReads: [
      { kinds: ["LEAD_PROFILE", "REVIEW_CHUNK", "PROSPECT_KB_CHUNK"], topK: 12, scope: "lead" },
    ],
    implModule: () =>
      import("./lead-intelligence-brief").then((m) => ({
        run: m.run,
      })),
  },

  // -------- Grup C: Deliverable (prospect-install packs) --------
  // SDR Brain v2 redesign — deliverables are install packs the agency
  // sells to the client AFTER the deal closes. They're not part of the
  // SDR cycle (qualify → outreach → discover → close) so every entry
  // here is `hiddenFromPanel`. Re-enable per workspace if/when we
  // ship a "Client Workspace" view that surfaces them.
  AI_RECEPTIONIST_BUILDER: {
    kind: "AI_RECEPTIONIST_BUILDER",
    group: "deliverable",
    displayName: "AI Receptionist Builder",
    displayNameTr: "AI Resepsiyonist Kurucu",
    description: "Voice agent config (Synthflow / Retell / Vapi) with greeting, FAQ, hours, booking flow tuned to the lead's business. When APIFY_WEB_CRAWL_DEEP has populated PROSPECT_KB_CHUNK memory, the FAQs and services are grounded in the prospect's own site content.",
    descriptionTr: "Synthflow / Retell / Vapi uyumlu sesli ajan config'i. APIFY_WEB_CRAWL_DEEP PROSPECT_KB_CHUNK bellegini doldurduysa SSS ve servisler prospect'in kendi site icerigine dayali.",
    // LAUNCH: temporarily open to FREE tier (normally PRO+). Flip back
    // to "PRO" in registry + quota.ts when first 30-day usage stabilises.
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 40000,
    hiddenFromPanel: true,
    exportFormats: ["synthflow", "retell", "vapi", "ghl", "json", "kb_json"],
    memoryReads: [{ kinds: ["PROSPECT_KB_CHUNK"], topK: 30, scope: "lead" }],
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
    hiddenFromPanel: true,
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
    hiddenFromPanel: true,
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
    hiddenFromPanel: true,
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
    hiddenFromPanel: true,
    exportFormats: ["json", "zip"],
  },

  // -------- Grup D: Ops (platform-level, agency-side) --------
  // All ops workers fire from server triggers (inbox sync cron, send
  // queue, deployed receptionist calls). Surfacing them on the lead
  // detail panel just confuses the rep — there's no "Generate" they
  // can usefully click. Hidden but kept registered so the orchestrator
  // can still resolve them (INBOX_REPLY_ATTRIBUTOR is part of the
  // inbox_reply_received chain).
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
    hiddenFromPanel: true,
  },
  INBOX_REPLY_ATTRIBUTOR: {
    kind: "INBOX_REPLY_ATTRIBUTOR",
    group: "ops",
    displayName: "Inbox Reply Attributor",
    displayNameTr: "Gelen Kutusu Eslestirici",
    description: "Matches Gmail / Outlook inbound replies to sent openers and advances the pipeline stage. Phase 1: reads the current status so the learning-loop sentinel can write OPENER_SUCCESS/FAILURE memory.",
    descriptionTr: "Gmail / Outlook gelen cevaplarini gonderilen openerlarla eslestirir, pipeline asamasini ilerletir. Faz 1: sadece mevcut statusu okur, sentinel OPENER_SUCCESS/FAILURE memory'i yazar.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 5000,
    hiddenFromPanel: true,
    implModule: () =>
      import("./inbox-reply-attributor").then((m) => ({ run: m.run })),
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
    hiddenFromPanel: true,
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
    hiddenFromPanel: true,
  },

  // -------- Grup E: Enrichment (Apify external data sources) --------
  // Each Apify worker hits a remote actor, chunks + upserts results
  // into SemanticMemory (under the appropriate MemoryKind), and
  // persists the raw artifact to AgentRun.outputJson. All are
  // opt-in: chains include them only under user_deep_research or
  // user_receptionist_with_kb. Every FREE workspace has $0 budget;
  // paid tiers accrue costUsdCents against a monthly cap checked in
  // `src/lib/agent-workers/quota.ts`.
  APIFY_GMAPS_DEEP: {
    kind: "APIFY_GMAPS_DEEP",
    group: "enrichment",
    displayName: "Google Maps Deep Scraper",
    displayNameTr: "Google Maps Derin Tarayici",
    description: "Pulls up to 500 reviews + emails + 6 social links + photos via Apify compass/crawler-google-places. ~$1-2 per lead.",
    descriptionTr: "Apify compass/crawler-google-places ile 500 yoruma kadar + emailler + 6 sosyal link + fotograf. Lead basi ~$1-2.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 90000,
    implModule: () =>
      import("./apify/gmaps-deep").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_WEB_CRAWL_DEEP: {
    kind: "APIFY_WEB_CRAWL_DEEP",
    group: "enrichment",
    displayName: "Website Deep Crawler",
    displayNameTr: "Site Derin Tarayici",
    description: "Crawls the lead's site into markdown chunks suitable for RAG. Populates PROSPECT_KB_CHUNK memory consumed by AI_RECEPTIONIST_BUILDER. ~$0.50 per site.",
    descriptionTr: "Lead sitesini RAG icin markdown chunklara cevirir. AI_RECEPTIONIST_BUILDER'in kullandigi PROSPECT_KB_CHUNK bellegine yazar. Site basi ~$0.50.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 120000,
    implModule: () =>
      import("./apify/web-crawl-deep").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_INSTAGRAM_DEEP: {
    kind: "APIFY_INSTAGRAM_DEEP",
    group: "enrichment",
    displayName: "Instagram Deep Scraper",
    displayNameTr: "Instagram Derin Tarayici",
    description: "Profile info + recent posts + engagement via Apify instagram-scraper. ~$0.003 per post.",
    descriptionTr: "Apify instagram-scraper ile profil + son postlar + engagement. Post basi ~$0.003.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 60000,
    implModule: () =>
      import("./apify/instagram-deep").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_FACEBOOK_DEEP: {
    kind: "APIFY_FACEBOOK_DEEP",
    group: "enrichment",
    displayName: "Facebook Deep Scraper",
    displayNameTr: "Facebook Derin Tarayici",
    description: "Posts + engagement from Apify facebook-posts-scraper. ~$0.002 per post.",
    descriptionTr: "Apify facebook-posts-scraper ile postlar + engagement. Post basi ~$0.002.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 60000,
    implModule: () =>
      import("./apify/facebook-deep").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_TIKTOK_DEEP: {
    kind: "APIFY_TIKTOK_DEEP",
    group: "enrichment",
    displayName: "TikTok Deep Scraper",
    displayNameTr: "TikTok Derin Tarayici",
    description: "Videos + engagement from Apify clockworks/tiktok-scraper. ~$0.003 per video.",
    descriptionTr: "Apify clockworks/tiktok-scraper ile videolar + engagement. Video basi ~$0.003.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 60000,
    // No chain wires this in (TikTok signal isn't part of the
    // restaurant-tech ICP). Hidden until a niche pack pulls it in.
    hiddenFromPanel: true,
    implModule: () =>
      import("./apify/tiktok-deep").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_SERP_RANK: {
    kind: "APIFY_SERP_RANK",
    group: "enrichment",
    displayName: "SERP Rank Tracker",
    displayNameTr: "SERP Sira Takibi",
    description: "Where this lead ranks for target keywords via Apify google-search-scraper. Pitch angle fuel.",
    descriptionTr: "Apify google-search-scraper ile lead'in hedef kelimelerdeki sirasi. Pitch acisi icin yakit.",
    minPlan: "PRO",
    phase1Enabled: true,
    // 90s estimate -> 180s outer deadline (Math.min(90*3, 180) caps
    // at 180s) when the executor falls back to the sync `run()` path.
    // The async-apify path uses Apify's actor timeout (180s) plus the
    // webhook round-trip; the executor's deadline does not apply to
    // async runs because they finish via webhook callback.
    estimatedDurationMs: 90000,
    mode: "async-apify",
    implModule: () =>
      import("./apify/serp-rank").then((m) => ({
        run: m.run,
        start: m.start,
        finalize: m.finalize,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_COMPETITOR_ADS: {
    kind: "APIFY_COMPETITOR_ADS",
    group: "enrichment",
    displayName: "Competitor Ads Scanner",
    displayNameTr: "Rakip Reklam Tarayicisi",
    description: "Facebook/Instagram ad library scan via Apify curious_coder/facebook-ads-library-scraper.",
    descriptionTr: "Apify curious_coder/facebook-ads-library-scraper ile Facebook/Instagram reklam kutuphanesi taramasi.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 60000,
    implModule: () =>
      import("./apify/competitor-ads").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_LINKEDIN_COMPANY: {
    kind: "APIFY_LINKEDIN_COMPANY",
    group: "enrichment",
    displayName: "LinkedIn Company Scraper",
    displayNameTr: "LinkedIn Sirket Tarayicisi",
    description: "Company employees + hiring signals via HarvestAPI actors. Growing businesses = budget.",
    descriptionTr: "HarvestAPI actor'leri ile sirket calisanlari + ise alim sinyalleri. Buyuyen is = butce.",
    minPlan: "PRO_TEAM",
    phase1Enabled: true,
    estimatedDurationMs: 75000,
    // Not currently wired into any chain — hiring signals come from
    // SERP + dedicated trigger detection rules instead. Keep the
    // implementation around for the Phase 2 STAKEHOLDER_DISCOVERER
    // worker that will actually consume LinkedIn employee data.
    hiddenFromPanel: true,
    implModule: () =>
      import("./apify/linkedin-company").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  APIFY_REDDIT_MENTIONS: {
    kind: "APIFY_REDDIT_MENTIONS",
    group: "enrichment",
    displayName: "Reddit Mentions Scanner",
    displayNameTr: "Reddit Mention Tarayicisi",
    description: "Business reputation scan via Apify trudax/reddit-scraper-lite.",
    descriptionTr: "Apify trudax/reddit-scraper-lite ile itibar taramasi.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 45000,
    implModule: () =>
      import("./apify/reddit-mentions").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },

  // -------- Grup F: SDR Brain v2 (Sales Cognition Engine) --------
  // T1 deterministic enrichers — no Gemini call, derived from existing
  // Lead / WebsiteAudit / ReviewAnalysis substrate. Fast (<2s) so they
  // can run on every `lead_created` chain without affecting tail latency.
  ICP_SCORER: {
    kind: "ICP_SCORER",
    group: "intelligence",
    displayName: "ICP Scorer",
    displayNameTr: "ICP Skorlayici",
    description: "Deterministic 0-100 fit score against the workspace's Ideal Customer Profile. Reads price level, reviews, niche, signals; persists to Lead.icpFitScore for fast list ordering.",
    descriptionTr: "Workspace'in ICP tanimina karsi deterministik 0-100 uyum skoru. Fiyat seviyesi, yorumlar, nis, sinyalleri okur; hizli liste siralama icin Lead.icpFitScore'a yazar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 1500,
    implModule: () =>
      import("./icp-scorer").then((m) => ({ run: m.run })),
  },
  STAKEHOLDER_DISCOVERER: {
    kind: "STAKEHOLDER_DISCOVERER",
    group: "intelligence",
    displayName: "Stakeholder Discoverer",
    displayNameTr: "Karar Verici Bulucu",
    description: "Discovers candidate stakeholders from website team pages, Google Maps owner fields, and LinkedIn-company enrichment. Phase 2 placeholder.",
    descriptionTr: "Site ekip sayfalari, Google Maps sahip alanlari ve LinkedIn sirket zenginlestirmesi'nden aday paydaslar bulur. Faz 2 placeholder.",
    minPlan: "FREE",
    phase1Enabled: false,
    estimatedDurationMs: 6000,
    // Phase 2 placeholder — no implModule yet. The newly shipped
    // BUYING_COMMITTEE_MAPPER covers the SDR Brain v2 stakeholder
    // surface, so this entry stays hidden until we build the
    // dedicated discovery worker that will feed it.
    hiddenFromPanel: true,
  },
  ACCOUNT_TIER_RANKER: {
    kind: "ACCOUNT_TIER_RANKER",
    group: "intelligence",
    displayName: "Account Tier Ranker",
    displayNameTr: "Hesap Seviye Belirleyici",
    description: "Buckets the lead's parent Account into TIER_1/TIER_2/TIER_3/TIER_4 based on locations, ICP fit, sales confidence, contact density, and sub-niche signals.",
    descriptionTr: "Lead'in ust hesabini lokasyon sayisi, ICP uyumu, satis guveni, iletisim yogunlugu ve alt-nis sinyallerine gore TIER_1/TIER_2/TIER_3/TIER_4'e gruplar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 1500,
    dependsOn: ["ICP_SCORER", "SALES_OPPORTUNITY_SCORER"],
    implModule: () =>
      import("./account-tier-ranker").then((m) => ({ run: m.run })),
  },
  BANT_INFERRER: {
    kind: "BANT_INFERRER",
    group: "intelligence",
    displayName: "BANT Inferrer",
    displayNameTr: "BANT Cikartici",
    description: "Derives Budget/Authority/Need/Timing scores from existing lead signals (no Gemini call). Persists a preliminary LeadNextAction so the UI can render an NBA card within 3-5s of lead_created.",
    descriptionTr: "Mevcut lead sinyallerinden Butce/Yetki/Ihtiyac/Zamanlama skorlarini cikarir (Gemini cagrisi yok). UI'in lead_created sonrasi 3-5s icinde NBA karti gostermesi icin on-LeadNextAction yazar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 2000,
    // SDR-Brain v2 Phase 3 — BANT_INFERRER reads Account.locationsCount
    // + Account.tier for the budget / authority dimensions when the
    // BuyingReadinessInput is enriched.
    requiredIncludes: { account: true },
    implModule: () =>
      import("./bant-inferrer").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },

  // T2 reasoners — light Gemini call + deterministic rules.
  TRIGGER_DETECTOR: {
    kind: "TRIGGER_DETECTOR",
    group: "intelligence",
    displayName: "Trigger Detector",
    displayNameTr: "Tetikleyici Bulucu",
    description: "Walks audit, reviews, social, hiring, and SERP signals to detect sales triggers (NEW_LOCATION_OPENING, RATING_DROP, HIRING_MARKETING, etc.) with severity + confidence + decay window.",
    descriptionTr: "Audit, yorumlar, sosyal, ise alim, SERP sinyallerini tarar; satis tetikleyicilerini (NEW_LOCATION_OPENING, RATING_DROP, HIRING_MARKETING, vs.) siddet + guven + decay penceresi ile bulur.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 6000,
    memoryReads: [
      { kinds: ["HIRING_SIGNAL", "SERP_SNAPSHOT", "REDDIT_MENTION", "SOCIAL_POST"], topK: 12, scope: "lead" },
    ],
    // SDR-Brain v2 Phase 2 — TRIGGER_DETECTOR needs the raw
    // GoogleReview rows (rating-trend rule: last-30d avg vs prior-30d
    // avg) and the Account (multi-location rules: NEW_LOCATION_OPENING,
    // CHAIN_EXPANSION). Both are capped or single rows so the join
    // is cheap.
    requiredIncludes: { googleReviews: true, account: true },
    implModule: () =>
      import("./trigger-detector").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  COMMERCIAL_INSIGHT_MATCHER: {
    kind: "COMMERCIAL_INSIGHT_MATCHER",
    group: "intelligence",
    displayName: "Commercial Insight Matcher",
    displayNameTr: "Ticari Insight Eslestirici",
    description: "Matches workspace CommercialInsights to the lead's niche + active triggers, ranked by Wilson lower-bound win-rate from InsightPerformance. Output feeds SDR_BRAIN's reframe choice.",
    descriptionTr: "Workspace CommercialInsights'larini lead'in nisi + aktif tetikleyicileriyle eslestirir; InsightPerformance'dan Wilson lower-bound kazanma oraniyla siralar. Cikti SDR_BRAIN'in reframe secimini besler.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 1500,
    dependsOn: ["TRIGGER_DETECTOR"],
    implModule: () =>
      import("./commercial-insight-matcher").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  WHY_NOW_SYNTHESIZER: {
    kind: "WHY_NOW_SYNTHESIZER",
    group: "intelligence",
    displayName: "Why-Now Synthesizer",
    displayNameTr: "Neden-Simdi Ozetleyici",
    description: "Reads active LeadTrigger rows, weights by severity * confidence * recency, and returns a single SDR-ready 'why now' headline + opener-friendly quote + recommended timing window.",
    descriptionTr: "Aktif LeadTrigger satirlarini okur; siddet * guven * yenilik ile agirliklandirir; tek bir SDR-hazir 'neden simdi' baslik + opener'a uygun alinti + onerilen zamanlama penceresi dondurur.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 6000,
    dependsOn: ["TRIGGER_DETECTOR"],
    implModule: () =>
      import("./why-now-synthesizer").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  BUYING_COMMITTEE_MAPPER: {
    kind: "BUYING_COMMITTEE_MAPPER",
    group: "intelligence",
    displayName: "Buying Committee Mapper",
    displayNameTr: "Karar Verici Haritalayici",
    description: "Maps stakeholders into Challenger roles (DECISION_MAKER, INFLUENCER, BLOCKER, CHAMPION, GATEKEEPER, USER) with influence + sentiment, persisted as Stakeholder rows.",
    descriptionTr: "Paydaslari Challenger rollerine (DECISION_MAKER, INFLUENCER, BLOCKER, CHAMPION, GATEKEEPER, USER) etki + duygu durumu ile haritalar; Stakeholder satirlari olarak saklar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 8000,
    memoryReads: [
      { kinds: ["SOCIAL_POST", "SERP_SNAPSHOT", "HIRING_SIGNAL"], topK: 10, scope: "lead" },
    ],
    implModule: () =>
      import("./buying-committee-mapper").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  OBJECTION_PREDICTOR: {
    kind: "OBJECTION_PREDICTOR",
    group: "intelligence",
    displayName: "Objection Predictor",
    displayNameTr: "Itiraz Tahmin Edici",
    description: "Forecasts the top 5 objections this prospect is most likely to raise (PRICE / TIMING / AUTHORITY / TRUST / COMPETITOR) with a pre-built preemptive response per objection.",
    descriptionTr: "Bu prospect'in en olasi 5 itirazini (FIYAT / ZAMANLAMA / YETKI / GUVEN / RAKIP) tahmin eder; her itiraza onceden hazirlanmis preemptive cevap saglar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 6000,
    implModule: () =>
      import("./objection-predictor").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },

  // T5 event-driven extractors (voice notes / pipeline stage changes).
  MEDDPICC_EXTRACTOR: {
    kind: "MEDDPICC_EXTRACTOR",
    group: "intelligence",
    displayName: "MEDDPICC Extractor",
    displayNameTr: "MEDDPICC Cikartici",
    description: "Extracts evidence-grounded MEDDPICC facts (Metrics, Economic Buyer, Decision Criteria, Process, Paper Process, Pain, Champion, Competition) from voice notes / email threads. Rolls up DealQualification.fillCompletePct + riskScore.",
    descriptionTr: "Sesli not / email yazismalarindan kanit-temelli MEDDPICC faktlarini (Metrikler, Ekonomik Alici, Karar Kriterleri, Surec, Kagit Sureci, Aci, Sampiyon, Rekabet) cikarir. DealQualification.fillCompletePct + riskScore'u toplar.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 8000,
    memoryReads: [{ kinds: ["VOICE_NOTE", "COPILOT_TURN"], topK: 6, scope: "lead" }],
    implModule: () =>
      import("./meddpicc-extractor").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },
  SPIN_EXTRACTOR: {
    kind: "SPIN_EXTRACTOR",
    group: "intelligence",
    displayName: "SPIN Extractor",
    displayNameTr: "SPIN Cikartici",
    description: "Classifies discovery transcript sentences into SPIN buckets (SITUATION / PROBLEM / IMPLICATION / NEED_PAYOFF). Surfaces qualification gaps the rep can fill on the next call.",
    descriptionTr: "Kesif transkript cumlelerini SPIN bolumlerine (SITUATION / PROBLEM / IMPLICATION / NEED_PAYOFF) siniflandirir. Temsilcinin sonraki gorusmede dolduracagi kalifikasyon eksikliklerini ortaya cikarir.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 8000,
    implModule: () =>
      import("./spin-extractor").then((m) => ({
        run: m.run,
        memoryWrites: m.memoryWrites,
      })),
  },

  // Closed-loop attribution. Walks active LeadNextAction +
  // InsightApplication on terminal events (reply, disposition, stage
  // change). Bumps InsightPerformance counters + adjusts
  // LeadTrigger.confidence (false-positive learning).
  OUTCOME_ATTRIBUTOR: {
    kind: "OUTCOME_ATTRIBUTOR",
    group: "ops",
    displayName: "Outcome Attributor",
    displayNameTr: "Sonuc Eslestirici",
    description: "Maps inbound replies, call dispositions, and pipeline stage changes back onto the LeadNextAction + CommercialInsight that produced them. Updates win-rate counters that COMMERCIAL_INSIGHT_MATCHER uses to rank reframes.",
    descriptionTr: "Gelen cevaplari, call dispositionlarini ve pipeline asama degisikliklerini onlari ureten LeadNextAction + CommercialInsight'a baglar. COMMERCIAL_INSIGHT_MATCHER'in reframeleri siralamak icin kullandigi kazanma orani sayaclarini gunceller.",
    minPlan: "FREE",
    phase1Enabled: true,
    estimatedDurationMs: 4000,
    // Pure event-driven attribution worker — fires from
    // inbox_reply_received / disposition_logged / watchlist_stage_changed
    // chains. Surfacing a manual "Run Outcome Attributor" button on
    // the lead panel makes no sense (the outcome hasn't happened yet),
    // so hide it. Performance is visible in /app/settings/insight-performance.
    hiddenFromPanel: true,
    implModule: () =>
      import("./outcome-attributor").then((m) => ({
        run: m.run,
      })),
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
 *
 * NOTE: `listWorkers()` returns EVERY registered worker — including
 * server-internal ones (`OUTCOME_ATTRIBUTOR`, `INBOX_REPLY_ATTRIBUTOR`),
 * deprecated entries (`GOOGLE_PLACES_REVIEWS`), client deliverables
 * (`AI_RECEPTIONIST_BUILDER`, `REVIEW_REPLY_AGENT`, ...), and Phase 2
 * placeholders. Use `listPanelWorkers()` for surfaces that show a
 * per-lead "Run worker" UI (the lead-detail AI Workers tab).
 */
export function listWorkers(): AgentWorker[] {
  return Object.values(WORKERS);
}

/**
 * Returns the subset of workers that should be surfaced on the
 * lead-detail "AI Workers" panel. Filters out anything flagged
 * `hiddenFromPanel: true` in the registry — i.e. deliverables, ops
 * jobs, deprecated workers, and Phase 2 placeholders. The lead-detail
 * panel API uses this; the platform-level `/app/agent-runs` history
 * view should keep using `listWorkers()` so legacy AgentRun rows still
 * resolve a display name.
 */
export function listPanelWorkers(): AgentWorker[] {
  return Object.values(WORKERS).filter((w) => !w.hiddenFromPanel);
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
 * Dynamic import + cache of a worker's module. Throws if the worker
 * is not yet implemented (Phase 2 / 3 placeholders).
 */
const moduleCache = new Map<AgentWorkerKind, WorkerModule>();

async function resolveModule(kind: AgentWorkerKind): Promise<WorkerModule> {
  const cached = moduleCache.get(kind);
  if (cached) return cached;
  const m = meta[kind];
  if (!m.implModule) {
    throw new Error(`Worker ${kind} is not yet implemented (phase 2/3 placeholder)`);
  }
  const mod = await m.implModule();
  moduleCache.set(kind, mod);
  return mod;
}

export async function resolveWorkerRun(kind: AgentWorkerKind): Promise<AgentWorkerRun | undefined> {
  const mod = await resolveModule(kind);
  return mod.run;
}

/**
 * Returns the worker's `start(ctx)` callback used by async-apify
 * workers to kick off an actor run + webhook. Returns undefined for
 * sync-mode workers; callers must fall back to `resolveWorkerRun`.
 */
export async function resolveWorkerStart(
  kind: AgentWorkerKind,
): Promise<AgentWorkerStart | undefined> {
  const mod = await resolveModule(kind);
  return mod.start;
}

/**
 * Returns the worker's `finalize(ctx, payload)` callback invoked by
 * the Apify webhook handler when the actor run completes. Returns
 * undefined for sync-mode workers (they have no webhook step).
 */
export async function resolveWorkerFinalize(
  kind: AgentWorkerKind,
): Promise<AgentWorkerFinalize | undefined> {
  const mod = await resolveModule(kind);
  return mod.finalize;
}

/**
 * Returns the memoryWrites callback for a worker, or undefined if
 * the worker does not write semantic memory. Uses the same lazy-import
 * + cache as `resolveWorkerRun`.
 *
 * Previously this function had a `catch { return undefined }` around
 * resolveModule to paper over phase-2/3 placeholders that have no
 * implModule set. That hid every real import error too (bad default
 * export, syntax error, runtime crash during module init), so a
 * broken worker silently shipped no memory writes -- and the outer
 * executor had no way to tell the difference from a legitimate
 * no-writes worker. Now:
 *   - Missing implModule (placeholder) returns undefined explicitly.
 *   - Any other import failure throws, so executor marks the run
 *     FAILED with a clear diagnostic.
 */
export async function resolveMemoryWrites(
  kind: AgentWorkerKind,
): Promise<WorkerModule["memoryWrites"] | undefined> {
  const m = meta[kind];
  if (!m?.implModule) return undefined;
  const mod = await resolveModule(kind);
  return mod.memoryWrites;
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
  if (!run) {
    throw new Error(
      `Worker ${kind} has no sync run() handler; it is async-apify-only and must be invoked via start()`,
    );
  }
  return run(ctx);
}
