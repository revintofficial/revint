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
    estimatedDurationMs: 20000,
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
    description: "Matches Gmail / Outlook inbound replies to sent openers and advances the pipeline stage. Phase 1: reads the current status so the learning-loop sentinel can write OPENER_SUCCESS/FAILURE memory.",
    descriptionTr: "Gmail / Outlook gelen cevaplarini gonderilen openerlarla eslestirir, pipeline asamasini ilerletir. Faz 1: sadece mevcut statusu okur, sentinel OPENER_SUCCESS/FAILURE memory'i yazar.",
    minPlan: "PRO",
    phase1Enabled: true,
    estimatedDurationMs: 5000,
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
