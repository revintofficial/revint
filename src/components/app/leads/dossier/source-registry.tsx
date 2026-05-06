/**
 * Source-chip registry for the AI Dossier.
 *
 * The dossier prompt cites every meaningful claim with a token like
 * `[website_audit]` or `[run:APIFY_FACEBOOK_DEEP]`. The renderer
 * (`DossierMarkdown.tsx`) tokenises the markdown and looks each token
 * up here to pick an icon, label, color, jump target and drawer body.
 *
 * Three layers of resolution, in order:
 *   1. Normaliser — accepts both the canonical token (`sales_opportunity`)
 *      and the legacy variants the model used to emit
 *      (`salesOpportunity`, `review_analyst`, `APIFY_FACEBOOK_DEEP`
 *      without the `run:` prefix). Old cached dossier markdown stays
 *      readable without invalidating the cache.
 *   2. Native registry — eight first-class sources (lead, audit,
 *      review_analysis, etc.) get a hand-written `DrawerBody` component.
 *   3. Worker / memory resolver — tokens of the form `run:KIND` and
 *      `memory:KIND` are looked up against the AgentWorkerKind /
 *      MemoryKind metadata maps and rendered with a generic drawer
 *      body backed by `summarizeForDossier` data + raw output JSON.
 *
 * Anything that fails all three layers renders as a muted "Source: <raw>"
 * chip — never crashes, never hides.
 */
"use client";

import * as React from "react";
import { humanizePrimaryType } from "@/lib/labels";
import {
  Building2,
  Globe,
  Target,
  Star,
  MessageSquareQuote,
  Mic,
  Tag,
  Package,
  Activity,
  Brain,
  HelpCircle,
  MessageSquare,
  Camera,
  Music2,
  Briefcase,
  MessagesSquare,
  Search,
  Megaphone,
  MapPin,
  Network,
  Layout,
  PenLine,
  FileVideo,
  MailCheck,
  ShieldCheck,
  BrainCircuit,
  Layers,
  PhoneCall,
  CornerDownRight,
  CalendarPlus,
  Newspaper,
  Inbox,
  Send,
  TrendingUp,
} from "lucide-react";
import type { AgentWorkerKind, MemoryKind } from "@/generated/prisma/client";
import type { DossierSourceSummary, KeyMetric } from "@/lib/agent-workers/dossier-summary";

/**
 * Lead detail page tabs the dossier chip can jump to. Mirrors the
 * `TabKey` union in `src/app/app/leads/[id]/page.tsx` — kept as a
 * loose string here so the registry stays decoupled from the page.
 */
export type LeadDetailTab = "overview" | "website" | "workers" | "reviews" | "outreach";

export interface SourceVisual {
  /** Lucide icon component. */
  Icon: React.ComponentType<{ className?: string }>;
  /** Short label shown inside the chip pill. */
  label: string;
  /** Full title shown at the top of the drawer + popover. */
  title: string;
  /** Color group for tinting the chip background + ring. */
  tone: SourceTone;
  /** Optional one-line explainer rendered in the drawer header. */
  description?: string;
  /** Tab to switch to when the user clicks "Open in tab" inside the drawer. */
  jumpTab: LeadDetailTab;
  /** Element id to scroll into view inside that tab. May not exist on the page yet — `scrollIntoView` is a no-op then. */
  jumpAnchor: string;
}

export type SourceTone =
  | "primary"
  | "blue"
  | "purple"
  | "green"
  | "orange"
  | "yellow"
  | "teal"
  | "red"
  | "neutral";

/* ------------------------------------------------------------------ */
/*  Canonical tag set + normaliser                                     */
/* ------------------------------------------------------------------ */

export type CanonicalTag =
  | { kind: "native"; key: NativeTag }
  | { kind: "run"; workerKind: AgentWorkerKind }
  | { kind: "memory"; memoryKind: MemoryKind }
  | { kind: "unknown"; raw: string };

export type NativeTag =
  | "lead"
  | "website_audit"
  | "sales_opportunity"
  | "review_analysis"
  | "reviews"
  | "voice_notes"
  | "niche_pack"
  | "service_packages";

const NATIVE_ALIASES: Record<string, NativeTag> = {
  lead: "lead",
  website_audit: "website_audit",
  websiteaudit: "website_audit",
  sales_opportunity: "sales_opportunity",
  salesopportunity: "sales_opportunity",
  review_analysis: "review_analysis",
  reviewanalysis: "review_analysis",
  review_analyst: "review_analysis",
  reviewanalyst: "review_analysis",
  reviews: "reviews",
  google_reviews: "reviews",
  voice_notes: "voice_notes",
  voicenotes: "voice_notes",
  niche_pack: "niche_pack",
  nichepack: "niche_pack",
  service_packages: "service_packages",
  servicepackages: "service_packages",
  workspaceservicepackages: "service_packages",
};

// Worker kinds the dossier prompt is allowed to cite — used as the
// allow-list for the bare-form normaliser fallback (`[APIFY_FACEBOOK_DEEP]`
// without the `run:` prefix becomes `run:APIFY_FACEBOOK_DEEP`).
const WORKER_KINDS = new Set<AgentWorkerKind>([
  "WEBSITE_AUDITOR",
  "REVIEW_ANALYST",
  "SALES_OPPORTUNITY_SCORER",
  "SOCIAL_SCRAPER",
  "GOOGLE_PLACES_REVIEWS",
  "SUBVERTICAL_CLASSIFIER",
  "APIFY_FACEBOOK_DEEP",
  "APIFY_INSTAGRAM_DEEP",
  "APIFY_TIKTOK_DEEP",
  "APIFY_LINKEDIN_COMPANY",
  "APIFY_REDDIT_MENTIONS",
  "APIFY_SERP_RANK",
  "APIFY_COMPETITOR_ADS",
  "APIFY_GMAPS_DEEP",
  "APIFY_WEB_CRAWL_DEEP",
  "WEBSITE_MOCKUP_GENERATOR",
  "OPENER_WRITER",
  "VIDEO_SCRIPT_WRITER",
  "EMAIL_VERIFIER",
  "LEAD_INTELLIGENCE_BRIEF",
  "LEAD_DOSSIER_GENERATOR",
  "AI_RECEPTIONIST_BUILDER",
  "REVIEW_REPLY_AGENT",
  "LEAD_RESPONSE_AGENT",
  "BOOKING_WIDGET_BUILDER",
  "GBP_AUTOPOST_AGENT",
  "VOICE_NOTE_TRANSCRIBER",
  "WEBSITE_PLAN_GENERATOR",
  "INBOX_REPLY_ATTRIBUTOR",
  "OUTREACH_SENDER",
  "CONTAINMENT_RATE_TRACKER",
  "COPILOT_CHAT",
]);

const MEMORY_KINDS = new Set<MemoryKind>([
  "LEAD_PROFILE",
  "REVIEW_CHUNK",
  "VOICE_NOTE",
  "OPENER_SUCCESS",
  "OPENER_FAILURE",
  "MOCKUP_SECTION",
  "WORKSPACE_OFFER",
  "WORKSPACE_PERSONA",
  "PROSPECT_KB_CHUNK",
  "COPILOT_TURN",
  "SOCIAL_POST",
  "SERP_SNAPSHOT",
  "COMPETITOR_AD",
  "HIRING_SIGNAL",
  "REDDIT_MENTION",
]);

/**
 * Parses a raw `[token]` string (without brackets) into a structured
 * `CanonicalTag`. Accepts the canonical grammar AND the legacy variants
 * old cached dossier markdown carries.
 *
 * Returns an `unknown` tag for anything we can't recognise — the chip
 * renderer falls back to a muted neutral pill so unknown citations
 * still look intentional rather than dropping out as raw text.
 */
export function parseCitationToken(raw: string): CanonicalTag {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "unknown", raw };
  const lower = trimmed.toLowerCase();

  // run:WORKER_KIND
  if (lower.startsWith("run:")) {
    const kindRaw = trimmed.slice(4).toUpperCase().replace(/[^A-Z_]/g, "");
    if (WORKER_KINDS.has(kindRaw as AgentWorkerKind)) {
      return { kind: "run", workerKind: kindRaw as AgentWorkerKind };
    }
    return { kind: "unknown", raw };
  }

  // memory:MEMORY_KIND, plus the legacy `semantic_memory:KIND` form.
  const memoryPrefixMatch = lower.match(/^(?:memory|semantic_memory):(.+)$/);
  if (memoryPrefixMatch) {
    const kindRaw = memoryPrefixMatch[1].toUpperCase().replace(/[^A-Z_]/g, "");
    if (MEMORY_KINDS.has(kindRaw as MemoryKind)) {
      return { kind: "memory", memoryKind: kindRaw as MemoryKind };
    }
    return { kind: "unknown", raw };
  }

  // Bare worker kind — `[APIFY_FACEBOOK_DEEP]` → run:APIFY_FACEBOOK_DEEP.
  // Only applies to ALL-CAPS tokens that match a known kind so we don't
  // accidentally swallow real prose in brackets.
  if (/^[A-Z][A-Z0-9_]+$/.test(trimmed)) {
    if (WORKER_KINDS.has(trimmed as AgentWorkerKind)) {
      return { kind: "run", workerKind: trimmed as AgentWorkerKind };
    }
    if (MEMORY_KINDS.has(trimmed as MemoryKind)) {
      return { kind: "memory", memoryKind: trimmed as MemoryKind };
    }
  }

  // Native tag aliases (snake_case + camelCase + a few legacy hand-spellings).
  const nativeKey = NATIVE_ALIASES[lower.replace(/[^a-z0-9]/g, "")];
  if (nativeKey) return { kind: "native", key: nativeKey };

  return { kind: "unknown", raw };
}

/* ------------------------------------------------------------------ */
/*  Visual definitions                                                 */
/* ------------------------------------------------------------------ */

const NATIVE_VISUALS: Record<NativeTag, SourceVisual> = {
  lead: {
    Icon: Building2,
    label: "Lead",
    title: "Lead profile",
    tone: "primary",
    description: "Core business record from Google Places.",
    jumpTab: "overview",
    jumpAnchor: "anchor-identity",
  },
  website_audit: {
    Icon: Globe,
    label: "Website audit",
    title: "Website audit",
    tone: "blue",
    description: "Crawler findings: speed, security headers, integrations.",
    jumpTab: "website",
    jumpAnchor: "anchor-website-audit",
  },
  sales_opportunity: {
    Icon: Target,
    label: "Sales opportunity",
    title: "Sales opportunity scorer",
    tone: "green",
    description: "Opportunity score, suggested offer, package fit.",
    jumpTab: "outreach",
    jumpAnchor: "anchor-sales-opportunity",
  },
  review_analysis: {
    Icon: Star,
    label: "Review analysis",
    title: "Review analysis",
    tone: "yellow",
    description: "Pain phrases, strengths, switch signals from Google reviews.",
    jumpTab: "reviews",
    jumpAnchor: "anchor-review-analysis",
  },
  reviews: {
    Icon: MessageSquareQuote,
    label: "Reviews",
    title: "Customer reviews",
    tone: "yellow",
    description: "Raw Google review corpus.",
    jumpTab: "reviews",
    jumpAnchor: "anchor-reviews",
  },
  voice_notes: {
    Icon: Mic,
    label: "Voice notes",
    title: "Voice notes",
    tone: "purple",
    description: "Transcribed call notes left by the rep.",
    jumpTab: "reviews",
    jumpAnchor: "anchor-voice-notes",
  },
  niche_pack: {
    Icon: Tag,
    label: "Niche pack",
    title: "Niche pack",
    tone: "orange",
    description: "Sub-vertical pitch angle, high-value signals, modules.",
    jumpTab: "website",
    jumpAnchor: "anchor-niche-pack",
  },
  service_packages: {
    Icon: Package,
    label: "Service packages",
    title: "Service packages",
    tone: "green",
    description: "The price card the rep actually sells.",
    jumpTab: "overview",
    jumpAnchor: "anchor-service-packages",
  },
};

interface WorkerVisualSeed {
  Icon: SourceVisual["Icon"];
  shortLabel: string;
  longLabel: string;
  tone: SourceTone;
  description?: string;
}

const WORKER_VISUALS: Partial<Record<AgentWorkerKind, WorkerVisualSeed>> = {
  WEBSITE_AUDITOR: { Icon: ShieldCheck, shortLabel: "Audit run", longLabel: "Website auditor", tone: "blue" },
  REVIEW_ANALYST: { Icon: Star, shortLabel: "Review analyst", longLabel: "Review analyst", tone: "yellow" },
  SALES_OPPORTUNITY_SCORER: { Icon: Target, shortLabel: "Scorer", longLabel: "Sales opportunity scorer", tone: "green" },
  SOCIAL_SCRAPER: { Icon: Activity, shortLabel: "Social scraper", longLabel: "Social profile scraper", tone: "purple" },
  GOOGLE_PLACES_REVIEWS: { Icon: MapPin, shortLabel: "Places reviews", longLabel: "Google Places review preload", tone: "yellow" },
  SUBVERTICAL_CLASSIFIER: { Icon: Layers, shortLabel: "Sub-niche", longLabel: "Sub-vertical classifier", tone: "orange" },
  APIFY_FACEBOOK_DEEP: { Icon: MessageSquare, shortLabel: "Facebook deep", longLabel: "Facebook deep scrape", tone: "blue" },
  APIFY_INSTAGRAM_DEEP: { Icon: Camera, shortLabel: "Instagram deep", longLabel: "Instagram deep scrape", tone: "purple" },
  APIFY_TIKTOK_DEEP: { Icon: Music2, shortLabel: "TikTok deep", longLabel: "TikTok deep scrape", tone: "red" },
  APIFY_LINKEDIN_COMPANY: { Icon: Briefcase, shortLabel: "LinkedIn", longLabel: "LinkedIn company + jobs", tone: "blue" },
  APIFY_REDDIT_MENTIONS: { Icon: MessagesSquare, shortLabel: "Reddit", longLabel: "Reddit mentions", tone: "orange" },
  APIFY_SERP_RANK: { Icon: Search, shortLabel: "SERP", longLabel: "Google SERP rank tracker", tone: "teal" },
  APIFY_COMPETITOR_ADS: { Icon: Megaphone, shortLabel: "Competitor ads", longLabel: "Meta ad library scan", tone: "red" },
  APIFY_GMAPS_DEEP: { Icon: MapPin, shortLabel: "Maps deep", longLabel: "Google Maps deep scrape", tone: "yellow" },
  APIFY_WEB_CRAWL_DEEP: { Icon: Network, shortLabel: "Site crawl", longLabel: "Deep website crawl", tone: "blue" },
  WEBSITE_MOCKUP_GENERATOR: { Icon: Layout, shortLabel: "Mockup", longLabel: "Website mockup generator", tone: "primary" },
  OPENER_WRITER: { Icon: PenLine, shortLabel: "Opener", longLabel: "Opener writer", tone: "primary" },
  VIDEO_SCRIPT_WRITER: { Icon: FileVideo, shortLabel: "Video script", longLabel: "Video script writer", tone: "purple" },
  EMAIL_VERIFIER: { Icon: MailCheck, shortLabel: "Email verifier", longLabel: "Email deliverability verifier", tone: "green" },
  LEAD_INTELLIGENCE_BRIEF: { Icon: BrainCircuit, shortLabel: "Brief", longLabel: "Lead intelligence brief", tone: "primary" },
  LEAD_DOSSIER_GENERATOR: { Icon: Newspaper, shortLabel: "Dossier", longLabel: "Lead dossier generator", tone: "primary" },
  AI_RECEPTIONIST_BUILDER: { Icon: PhoneCall, shortLabel: "Receptionist", longLabel: "AI receptionist builder", tone: "teal" },
  REVIEW_REPLY_AGENT: { Icon: CornerDownRight, shortLabel: "Review reply", longLabel: "Review reply agent", tone: "yellow" },
  LEAD_RESPONSE_AGENT: { Icon: Send, shortLabel: "Lead response", longLabel: "Lead response agent", tone: "primary" },
  BOOKING_WIDGET_BUILDER: { Icon: CalendarPlus, shortLabel: "Booking", longLabel: "Booking widget builder", tone: "green" },
  GBP_AUTOPOST_AGENT: { Icon: Newspaper, shortLabel: "GBP posts", longLabel: "GBP autopost agent", tone: "yellow" },
  VOICE_NOTE_TRANSCRIBER: { Icon: Mic, shortLabel: "Transcriber", longLabel: "Voice note transcriber", tone: "purple" },
  WEBSITE_PLAN_GENERATOR: { Icon: Layout, shortLabel: "Site plan", longLabel: "Website plan generator", tone: "primary" },
  INBOX_REPLY_ATTRIBUTOR: { Icon: Inbox, shortLabel: "Inbox attr.", longLabel: "Inbox reply attributor", tone: "neutral" },
  OUTREACH_SENDER: { Icon: Send, shortLabel: "Outreach", longLabel: "Outreach sender", tone: "primary" },
  CONTAINMENT_RATE_TRACKER: { Icon: TrendingUp, shortLabel: "Containment", longLabel: "Containment rate tracker", tone: "neutral" },
  COPILOT_CHAT: { Icon: BrainCircuit, shortLabel: "Copilot", longLabel: "Copilot turn", tone: "primary" },
};

interface MemoryVisualSeed {
  Icon: SourceVisual["Icon"];
  shortLabel: string;
  longLabel: string;
  tone: SourceTone;
}

const MEMORY_VISUALS: Partial<Record<MemoryKind, MemoryVisualSeed>> = {
  LEAD_PROFILE: { Icon: Brain, shortLabel: "Lead profile mem.", longLabel: "Lead profile memory", tone: "primary" },
  REVIEW_CHUNK: { Icon: MessageSquareQuote, shortLabel: "Review chunk", longLabel: "Review chunk memory", tone: "yellow" },
  VOICE_NOTE: { Icon: Mic, shortLabel: "Voice note mem.", longLabel: "Voice note memory", tone: "purple" },
  OPENER_SUCCESS: { Icon: Send, shortLabel: "Opener wins", longLabel: "Opener success memory", tone: "green" },
  OPENER_FAILURE: { Icon: Send, shortLabel: "Opener misses", longLabel: "Opener failure memory", tone: "red" },
  MOCKUP_SECTION: { Icon: Layout, shortLabel: "Mockup mem.", longLabel: "Mockup section memory", tone: "primary" },
  WORKSPACE_OFFER: { Icon: Package, shortLabel: "Offer mem.", longLabel: "Workspace offer memory", tone: "green" },
  WORKSPACE_PERSONA: { Icon: Building2, shortLabel: "Persona mem.", longLabel: "Workspace persona memory", tone: "primary" },
  PROSPECT_KB_CHUNK: { Icon: Network, shortLabel: "Site KB", longLabel: "Prospect KB chunk", tone: "blue" },
  COPILOT_TURN: { Icon: BrainCircuit, shortLabel: "Copilot turn", longLabel: "Copilot conversation turn", tone: "primary" },
  SOCIAL_POST: { Icon: Activity, shortLabel: "Social post", longLabel: "Social post memory", tone: "purple" },
  SERP_SNAPSHOT: { Icon: Search, shortLabel: "SERP snap", longLabel: "SERP snapshot memory", tone: "teal" },
  COMPETITOR_AD: { Icon: Megaphone, shortLabel: "Competitor ad", longLabel: "Competitor ad memory", tone: "red" },
  HIRING_SIGNAL: { Icon: Briefcase, shortLabel: "Hiring", longLabel: "Hiring signal memory", tone: "blue" },
  REDDIT_MENTION: { Icon: MessagesSquare, shortLabel: "Reddit mem.", longLabel: "Reddit mention memory", tone: "orange" },
};

const UNKNOWN_VISUAL: SourceVisual = {
  Icon: HelpCircle,
  label: "Source",
  title: "Source",
  tone: "neutral",
  description: "Unrecognised citation token.",
  jumpTab: "workers",
  jumpAnchor: "anchor-workers-top",
};

/**
 * Resolves a `CanonicalTag` to the visual definition the chip + drawer
 * use. Worker / memory tokens fall back to a generic visual when the
 * specific kind isn't in the explicit map (so a freshly added worker
 * still renders sensibly until someone adds a row above).
 */
export function getSourceVisual(tag: CanonicalTag): SourceVisual {
  if (tag.kind === "native") return NATIVE_VISUALS[tag.key];
  if (tag.kind === "run") {
    const seed = WORKER_VISUALS[tag.workerKind];
    if (seed) {
      return {
        Icon: seed.Icon,
        label: seed.shortLabel,
        title: seed.longLabel,
        tone: seed.tone,
        description: seed.description ?? `Agent run output: ${tag.workerKind}.`,
        jumpTab: "workers",
        jumpAnchor: `worker-${tag.workerKind}`,
      };
    }
    return {
      Icon: Activity,
      label: humanizeKind(tag.workerKind),
      title: humanizeKind(tag.workerKind),
      tone: "neutral",
      description: `Agent run output: ${tag.workerKind}.`,
      jumpTab: "workers",
      jumpAnchor: `worker-${tag.workerKind}`,
    };
  }
  if (tag.kind === "memory") {
    const seed = MEMORY_VISUALS[tag.memoryKind];
    if (seed) {
      return {
        Icon: seed.Icon,
        label: seed.shortLabel,
        title: seed.longLabel,
        tone: seed.tone,
        description: `Semantic memory of kind ${tag.memoryKind}.`,
        jumpTab: "workers",
        jumpAnchor: `memory-${tag.memoryKind}`,
      };
    }
    return {
      Icon: Brain,
      label: humanizeKind(tag.memoryKind),
      title: humanizeKind(tag.memoryKind),
      tone: "neutral",
      description: `Semantic memory of kind ${tag.memoryKind}.`,
      jumpTab: "workers",
      jumpAnchor: `memory-${tag.memoryKind}`,
    };
  }
  return { ...UNKNOWN_VISUAL, label: tag.raw, title: `Source: ${tag.raw}` };
}

/**
 * Maps the symbolic `tone` keyword to the actual CSS classes that style
 * the chip pill. Tailwind v4 picks up arbitrary `[var(...)]` values at
 * build time so we can mix brand vars with the iOS-named system tokens
 * without a JS-side palette.
 */
export function chipClassesForTone(tone: SourceTone): {
  bg: string;
  text: string;
  border: string;
  iconColor: string;
} {
  switch (tone) {
    case "primary":
      return {
        bg: "bg-[var(--leadac-500)]/12 hover:bg-[var(--leadac-500)]/20",
        text: "text-[var(--leadac-500)]",
        border: "border-[var(--leadac-500)]/30",
        iconColor: "text-[var(--leadac-500)]",
      };
    case "blue":
      return {
        bg: "bg-[var(--system-blue)]/12 hover:bg-[var(--system-blue)]/20",
        text: "text-[var(--system-blue)]",
        border: "border-[var(--system-blue)]/30",
        iconColor: "text-[var(--system-blue)]",
      };
    case "purple":
      return {
        bg: "bg-[var(--system-purple)]/12 hover:bg-[var(--system-purple)]/20",
        text: "text-[var(--system-purple)]",
        border: "border-[var(--system-purple)]/30",
        iconColor: "text-[var(--system-purple)]",
      };
    case "green":
      return {
        bg: "bg-[var(--system-green)]/12 hover:bg-[var(--system-green)]/20",
        text: "text-[var(--system-green)]",
        border: "border-[var(--system-green)]/30",
        iconColor: "text-[var(--system-green)]",
      };
    case "orange":
      return {
        bg: "bg-[var(--system-orange)]/12 hover:bg-[var(--system-orange)]/20",
        text: "text-[var(--system-orange)]",
        border: "border-[var(--system-orange)]/30",
        iconColor: "text-[var(--system-orange)]",
      };
    case "yellow":
      return {
        bg: "bg-[var(--system-yellow)]/12 hover:bg-[var(--system-yellow)]/22",
        text: "text-[var(--system-yellow)]",
        border: "border-[var(--system-yellow)]/30",
        iconColor: "text-[var(--system-yellow)]",
      };
    case "teal":
      return {
        bg: "bg-[var(--system-teal)]/12 hover:bg-[var(--system-teal)]/20",
        text: "text-[var(--system-teal)]",
        border: "border-[var(--system-teal)]/30",
        iconColor: "text-[var(--system-teal)]",
      };
    case "red":
      return {
        bg: "bg-[var(--system-red)]/12 hover:bg-[var(--system-red)]/20",
        text: "text-[var(--system-red)]",
        border: "border-[var(--system-red)]/30",
        iconColor: "text-[var(--system-red)]",
      };
    case "neutral":
    default:
      return {
        bg: "bg-white/5 hover:bg-white/10",
        text: "text-white/70",
        border: "border-white/15",
        iconColor: "text-white/50",
      };
  }
}

function humanizeKind(kind: string): string {
  return kind
    .toLowerCase()
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/* ------------------------------------------------------------------ */
/*  Sources payload — wire shape from /dossier-sources                  */
/* ------------------------------------------------------------------ */

/**
 * Wire shape returned by `GET /api/leads/[id]/dossier-sources`. Kept
 * here (rather than in the route file) so client components stay
 * decoupled from the server module — the route only `import type`s
 * this and is the single producer.
 */
export interface DossierSourcesPayload {
  leadId: string;
  lead: {
    id: string;
    businessName: string;
    primaryType: string | null;
    formattedAddress: string;
    rating: number | null;
    reviewCount: number | null;
    websiteUrl: string | null;
    phone: string | null;
    nicheSlug: string | null;
    subNicheSlug: string | null;
    subNicheSource: "AUTO" | "MANUAL" | null;
    subNicheConfidence: number | null;
  };
  websiteAudit: Record<string, unknown> | null;
  salesOpportunity: Record<string, unknown> | null;
  reviewAnalysis: {
    leadScore: number;
    summary: string | null;
    weaknessKpis: unknown;
    strengthKpis: unknown;
    painPhrases: unknown;
    strengthPhrases: unknown;
    sentimentBreakdown: unknown;
    switchSignals: unknown;
    reviewsAnalyzedCount: number;
    analyzedAt: string | null;
  } | null;
  reviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    text: string | null;
    relativeTime: string | null;
    publishTime: string | null;
  }>;
  voiceNotes: {
    count: number;
    latest: { id: string; transcriptPreview: string; createdAt: string } | null;
  };
  nichePack: {
    slug: string | null;
    label: string;
    tagline: string;
    pitchAngle: string;
    highValueSignals: string[];
    featuredProductModules: string[];
  } | null;
  servicePackages: Array<{
    id: string;
    name: string;
    priceLabel: string;
    features: string[];
    isPopular: boolean;
  }>;
  runs: Record<
    string,
    {
      runId: string;
      workerKind: AgentWorkerKind;
      finishedAt: string | null;
      artifactUrl: string | null;
      summary: DossierSourceSummary;
    }
  >;
  memory: Record<
    string,
    {
      kind: MemoryKind;
      count: number;
      latest: Array<{
        id: string;
        text: string;
        refType: string | null;
        refId: string | null;
        createdAt: string;
      }>;
    }
  >;
}

/**
 * Resolves the popover preview for a tag. For native sources the
 * "preview" is hand-rolled against the live data on the page; for
 * `run:KIND` we just forward the server-side `summarizeForDossier`
 * output; for `memory:KIND` we synthesise a small count + latest-text
 * preview.
 */
export function buildPreviewMetrics(
  tag: CanonicalTag,
  sources: DossierSourcesPayload | null,
): { headline?: string; metrics: KeyMetric[]; loading: boolean; missing?: boolean } {
  if (!sources) return { metrics: [], loading: true };

  if (tag.kind === "native") {
    switch (tag.key) {
      case "lead": {
        const m: KeyMetric[] = [];
        if (sources.lead.rating != null) m.push({ label: "Rating", value: `${sources.lead.rating}★` });
        if (sources.lead.reviewCount != null) m.push({ label: "Reviews", value: String(sources.lead.reviewCount) });
        if (sources.lead.primaryType) m.push({ label: "Type", value: humanizePrimaryType(sources.lead.primaryType) });
        if (sources.lead.phone) m.push({ label: "Phone", value: sources.lead.phone });
        return { metrics: m, loading: false };
      }
      case "website_audit": {
        const a = sources.websiteAudit;
        if (!a) return { metrics: [{ label: "Status", value: "No audit yet" }], loading: false, missing: true };
        const m: KeyMetric[] = [];
        if (typeof a.loadTimeMs === "number") m.push({ label: "Load", value: `${a.loadTimeMs} ms` });
        if (typeof a.https === "boolean") m.push({ label: "HTTPS", value: a.https ? "yes" : "no" });
        if (typeof a.hasWhatsappLink === "boolean") {
          m.push({ label: "WhatsApp", value: a.hasWhatsappLink ? "yes" : "no" });
        }
        if (typeof a.hasBookingSystem === "boolean") {
          m.push({ label: "Booking", value: a.hasBookingSystem ? "yes" : "no" });
        }
        const sec = a.securityHeaders as Record<string, boolean> | null | undefined;
        if (sec) {
          const total = Object.keys(sec).length;
          const passed = Object.values(sec).filter(Boolean).length;
          m.push({ label: "Sec headers", value: `${passed}/${total}` });
        }
        return { metrics: m, loading: false };
      }
      case "sales_opportunity": {
        const o = sources.salesOpportunity;
        if (!o) return { metrics: [{ label: "Status", value: "Not scored yet" }], loading: false, missing: true };
        const m: KeyMetric[] = [];
        if (typeof o.opportunityScore === "number") m.push({ label: "Score", value: `${o.opportunityScore}/100` });
        if (typeof o.suggestedOffer === "string") m.push({ label: "Offer", value: String(o.suggestedOffer) });
        if (typeof o.expectedPriceBand === "string" && o.expectedPriceBand) {
          m.push({ label: "Price band", value: String(o.expectedPriceBand) });
        }
        if (Array.isArray(o.likelyPainPoints)) {
          m.push({ label: "Pain points", value: String(o.likelyPainPoints.length) });
        }
        return { metrics: m, loading: false };
      }
      case "review_analysis": {
        const r = sources.reviewAnalysis;
        if (!r) return { metrics: [{ label: "Status", value: "Not analysed yet" }], loading: false, missing: true };
        const m: KeyMetric[] = [{ label: "Lead score", value: `${r.leadScore}/100` }];
        m.push({ label: "Reviews used", value: String(r.reviewsAnalyzedCount) });
        if (Array.isArray(r.painPhrases) && r.painPhrases.length > 0) {
          const first = r.painPhrases[0];
          if (typeof first === "string") m.push({ label: "Top pain", value: first });
        }
        return {
          headline: typeof r.summary === "string" ? r.summary : undefined,
          metrics: m,
          loading: false,
        };
      }
      case "reviews": {
        return {
          metrics: [
            { label: "Stars", value: sources.lead.rating != null ? `${sources.lead.rating}★` : "—" },
            { label: "Total reviews", value: sources.lead.reviewCount != null ? String(sources.lead.reviewCount) : "—" },
            { label: "Latest sample", value: sources.reviews[0]?.text ? truncate(sources.reviews[0].text, 60) : "—" },
          ],
          loading: false,
        };
      }
      case "voice_notes": {
        return {
          metrics: [
            { label: "Notes", value: String(sources.voiceNotes.count) },
            ...(sources.voiceNotes.latest
              ? [{ label: "Latest", value: truncate(sources.voiceNotes.latest.transcriptPreview, 70) }]
              : []),
          ],
          loading: false,
        };
      }
      case "niche_pack": {
        if (!sources.nichePack) {
          return { metrics: [{ label: "Status", value: "Not classified" }], loading: false, missing: true };
        }
        return {
          headline: sources.nichePack.tagline,
          metrics: [
            { label: "Pack", value: sources.nichePack.label },
            { label: "Slug", value: sources.nichePack.slug ?? "—" },
            { label: "Pitch angle", value: truncate(sources.nichePack.pitchAngle, 70) },
          ],
          loading: false,
        };
      }
      case "service_packages": {
        const total = sources.servicePackages.length;
        return {
          metrics: [
            { label: "Configured", value: String(total) },
            ...(total > 0
              ? [
                  {
                    label: "Tiers",
                    value: sources.servicePackages
                      .slice(0, 3)
                      .map((p) => p.name)
                      .join(", "),
                  },
                ]
              : []),
          ],
          loading: false,
          missing: total === 0,
        };
      }
    }
  }

  if (tag.kind === "run") {
    const run = sources.runs[tag.workerKind];
    if (!run) {
      return {
        metrics: [{ label: "Status", value: "No successful run yet" }],
        loading: false,
        missing: true,
      };
    }
    return {
      headline: run.summary.headline,
      metrics: run.summary.metrics,
      loading: false,
    };
  }

  if (tag.kind === "memory") {
    const group = sources.memory[tag.memoryKind];
    if (!group || group.count === 0) {
      return { metrics: [{ label: "Status", value: "Memory empty" }], loading: false, missing: true };
    }
    return {
      metrics: [
        { label: "Rows", value: String(group.count) },
        ...(group.latest[0]
          ? [{ label: "Latest", value: truncate(group.latest[0].text, 80) }]
          : []),
      ],
      loading: false,
    };
  }

  return {
    metrics: [{ label: "Source", value: tag.raw }],
    loading: false,
    missing: true,
  };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
