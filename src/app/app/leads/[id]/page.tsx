"use client";

import { useEffect, useState, use, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircularProgress } from "@/components/ui/progress";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { DossierMarkdown } from "@/components/app/leads/dossier/DossierMarkdown";
import { DossierSourceDrawer } from "@/components/app/leads/dossier/DossierSourceDrawer";
import { useDossierSources } from "@/components/app/leads/dossier/use-dossier-sources";
import type {
  CanonicalTag,
  DossierSourcesPayload,
  LeadDetailTab,
} from "@/components/app/leads/dossier/source-registry";
import { OutreachStepper } from "@/components/ui/outreach-stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CRAWL_LABELS, ANALYZE_LABELS, OUTREACH_LABELS, REASON_LABELS, OFFER_LABELS } from "@/lib/labels";
import { ReviewIntelligencePanel } from "@/components/app/review-intelligence-panel";
import { GoogleReviewsAccordion } from "@/components/app/google-reviews-accordion";
import { VoiceNotesPanel } from "@/components/app/voice-notes-panel";
import { SocialProfileIcons } from "@/components/app/social-profile-icons";
import { LeadMapView } from "@/components/app/lead-map-view";
import { AiWorkersPanel } from "@/components/app/ai-workers-panel";
import { PlannerActions } from "@/components/app/planner-actions";
import { WebsiteIntelligencePanel } from "@/components/app/website-intelligence-panel";
import {
  ArrowLeft,
  MapPin,
  ExternalLink,
  Bot,
  RefreshCw,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  ScanSearch,
  Search,
  AlertTriangle,
  Info,
  Zap,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  Globe,
  Bot as BotIcon,
  MessageSquareText,
  Star,
  Phone,
  PhoneOff,
  Mail,
  MessageCircle,
  Clock,
  ClipboardList,
  X,
} from "lucide-react";

interface ContentCheckSignal {
  label: string;
  status: "good" | "bad" | "warning";
  detail: string;
}

interface ContentCheckResult {
  url: string;
  reachable: boolean;
  verdict: "placeholder" | "basic" | "developed" | "unreachable";
  score: number;
  signals: ContentCheckSignal[];
  summary: string;
  htmlSize: number;
  wordCount: number;
  imageCount: number;
  internalLinkCount: number;
  hasCustomContent: boolean;
  isParked: boolean;
  isComingSoon: boolean;
  builderDetected: string | null;
}

interface WebsiteSearchFoundItem {
  url: string;
  title: string | null;
  source: "domain_guess" | "google_search";
  reachable: boolean;
}

interface WebsiteSearchResult {
  businessName: string;
  found: boolean;
  websites: WebsiteSearchFoundItem[];
  searchedCount: number;
}

interface SecurityHeaders {
  hasCSP: boolean;
  hasXFrameOptions: boolean;
  hasXContentTypeOptions: boolean;
  hasReferrerPolicy: boolean;
  hasHSTS: boolean;
  hasXXSSProtection: boolean;
  hasPermissionsPolicy: boolean;
}

interface HeroSocialProfiles {
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  twitter?: string | null;
  whatsapp?: string | null;
  pinterest?: string | null;
}

type DiscoveredCategory =
  | "social"
  | "directory"
  | "review"
  | "registry"
  | "maps";

type DiscoveredPlatform =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "pinterest"
  | "reddit"
  | "yell"
  | "bark"
  | "checkatrade"
  | "trustatrader"
  | "yellowpages"
  | "foursquare"
  | "trustpilot"
  | "yelp"
  | "glassdoor"
  | "bbb"
  | "companies_house"
  | "google_maps";

interface DiscoveredLink {
  platform: DiscoveredPlatform;
  category: DiscoveredCategory;
  url: string;
  title: string | null;
  sources: string[];
}

interface LeadDetail {
  id: string;
  businessName: string;
  formattedAddress: string;
  borough: string | null;
  phone: string | null;
  websiteUrl: string | null;
  hasWebsite: boolean;
  googleMapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  primaryType: string | null;
  discoverySourceQuery?: string | null;
  crawlStatus: string;
  analyzeStatus: string;
  auditSummary?: { totalChecks: number; passed: number; failed: number; unknown?: number; scorePercent: number } | null;
  websiteAudit: {
    reachable: boolean;
    crawlAttemptedAt?: string | null;
    crawlError?: string | null;
    httpStatus?: number | null;
    loadTimeMs: number | null;
    https: boolean;
    mobileFriendlyGuess: boolean;
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
    hasContactForm: boolean;
    hasWhatsappLink: boolean;
    hasBookingSystem: boolean;
    hasEcommerce: boolean;
    servicesDetected: string[];
    navItems: { text: string; href: string }[];
    ctaLinks: { text: string; href: string }[];
    hasOpenGraph?: boolean;
    hasTwitterCards?: boolean;
    hasFavicon?: boolean;
    hasManifest?: boolean;
    hasServiceWorker?: boolean;
    hasGoogleAnalytics?: boolean;
    hasCookieConsent?: boolean;
    hasResponsiveImages?: boolean;
    hasFontDisplay?: boolean;
    securityHeaders?: SecurityHeaders;
    schemaTypes?: string[];
    accessibilityIssues?: string[];
    fontsDetected?: string[];
    performanceHints?: string[];
    cssFramework?: string | null;
    pageCount?: number;
    socialProfiles?: HeroSocialProfiles | null;
    contactEmails?: string[] | null;
    rawFeaturesJson?: {
      hasQrMenu?: boolean;
      hasOnlineReservation?: boolean;
      hasDeliveryIntegration?: boolean;
      detectedMenuTool?: string | null;
      menuUrl?: string | null;
    } | null;
    bookingProvider?: string | null;
    brokenLinksCount?: number;
    structuredDataPresent?: boolean;
  } | null;
  workspace?: { niche: string } | null;
  // Hybrid-niche fields. `nicheSlug` is the parent (e.g. "fnb"),
  // `subNicheSlug` is the child (e.g. "fnb-bar-club") chosen by the
  // SUBVERTICAL_CLASSIFIER worker or by a manual rep override.
  // `subNicheSource` distinguishes "AUTO" (classifier) from "MANUAL"
  // (rep). `subNicheConfidence` is only meaningful when source = AUTO;
  // confidence < 0.7 means the opener pipeline falls back to the
  // generic parent pitch (see opener-writer.ts).
  nicheSlug: string | null;
  subNicheSlug: string | null;
  subNicheSource: "AUTO" | "MANUAL" | null;
  subNicheConfidence: number | null;
  subNicheVersion: number;
  salesOpportunity: {
    opportunityScore: number;
    reasonCodes: string[];
    whyGoodTarget: string | null;
    likelyPainPoints: string[];
    bestSalesAngle: string | null;
    suggestedOffer: string;
    personalizedFirstMessage: string | null;
    expectedPriceBand: string | null;
    recommendedPackageId: string | null;
    recommendedPackageReason: string | null;
    recommendedPackage: {
      id: string;
      name: string;
      priceLabel: string;
      features: string[];
    } | null;
    status: string;
  } | null;
  watchlistItem?: {
    id: string;
    websitePlan: string | null;
  } | null;
  reviewAnalysisStatus?: string;
  pipelineStatus?: string;
  reviewAnalysis?: {
    leadScore: number;
    summary: string | null;
    weaknessKpis: { label: string; percent: number }[];
  } | null;
  googleReviews?: { id: string }[];
  sourceLat?: number | null;
  sourceLng?: number | null;
  discoveredLinks?: DiscoveredLink[];
  // Phase 1 SDR fields.
  salesConfidence?: number | null;
  intelligenceVersion?: number;
  lastContactedAt?: string | null;
  nextActionDueAt?: string | null;
  sequenceStep?: number;
  lastDisposition?: string | null;
  dnc?: boolean;
  consentSource?: string | null;
  timezone?: string | null;
  archivedAt?: string | null;
  snoozeUntil?: string | null;
  assignedToUserId?: string | null;
}

type TabKey = "overview" | "website" | "workers" | "reviews" | "outreach";
const TAB_KEYS: TabKey[] = ["overview", "website", "workers", "reviews", "outreach"];

/**
 * Phase 0/B2 — "Checks Passed" comes ONLY from the canonical
 * `auditSummary` returned by GET /api/leads/[id], which itself runs
 * `runAuditChecklist` (the same logic the website-plan endpoint and
 * the dossier prompt use). Previously this page maintained its own
 * boolean tally over a subset of WebsiteAudit fields, which:
 *   - disagreed with the audit-score and AI-written dossier copy
 *   - showed `1/7` to the FineDine SDR even when the site was clearly fine
 *     (the crawler.ts B1 bug zeroed all booleans, leaving only `https`
 *      passing because it's derived from the URL string)
 * The previous local helper has been removed — use `auditSummary` from the
 * lead payload everywhere.
 */

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [auditSummary, setAuditSummary] = useState<{ totalChecks: number; passed: number; failed: number; unknown?: number; scorePercent: number } | null>(null);
  const [contentCheck, setContentCheck] = useState<ContentCheckResult | null>(null);
  const [contentCheckLoading, setContentCheckLoading] = useState(false);
  const [showContentCheck, setShowContentCheck] = useState(false);
  const [websiteSearchResult, setWebsiteSearchResult] = useState<WebsiteSearchResult | null>(null);
  const [websiteSearchLoading, setWebsiteSearchLoading] = useState(false);
  const [showWebsiteSearch, setShowWebsiteSearch] = useState(false);
  const [planSectionOpen, setPlanSectionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dossier, setDossier] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierCopied, setDossierCopied] = useState(false);
  const [dossierCollapsed, setDossierCollapsed] = useState(false);
  // Source-chip drawer: tag the user clicked, or null when closed.
  const [drawerTag, setDrawerTag] = useState<CanonicalTag | null>(null);
  // Dossier-sources backing data (websiteAudit / runs / memory etc.).
  // Lazy: only fetched once a dossier exists. `refetchSources` is
  // called after the user re-generates the dossier so chips re-bind
  // to the freshly-stale source map.
  const {
    sources: dossierSources,
    refetch: refetchDossierSources,
  } = useDossierSources(id, !!dossier);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/leads/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          // 404 / 401 / 500 - keep `lead` null so the empty state renders
          // instead of trying to consume an `{ error }` body as a Lead.
          setLead(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data || typeof data !== "object" || !data.id) {
          setLead(null);
          return;
        }
        setLead(data);
        if (data.watchlistItem?.websitePlan) {
          setPlan(data.watchlistItem.websitePlan);
          setPlanSectionOpen(true);
        }
        // Phase 0/B2 — server now returns canonical auditSummary so the
        // "Checks Passed" tile and the audit-score subtitle agree on the
        // same number from the moment the page loads (no waiting for
        // /api/website-plan).
        if (data.auditSummary) {
          setAuditSummary(data.auditSummary);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setLead(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncFromHash = () => {
      const raw = window.location.hash.replace("#", "") as TabKey;
      if (TAB_KEYS.includes(raw)) setActiveTab(raw);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const handleTabChange = (next: string) => {
    const key = next as TabKey;
    setActiveTab(key);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${key}`);
    }
  };

  const refetchLead = async () => {
    try {
      const res = await fetch(`/api/leads/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === "object" && data.id) {
        setLead(data);
      }
    } catch (err) {
      console.error("refetchLead failed", err);
    }
  };

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error("Failed to update status");
        return;
      }
      await refetchLead();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const runCrawl = async () => {
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      if (!res.ok) {
        toast.error("Failed to crawl website");
        return;
      }
      await refetchLead();
    } catch (err) {
      console.error(err);
      toast.error("Failed to crawl website");
    }
  };

  const generatePlan = async () => {
    setPlanGenerating(true);
    try {
      const res = await fetch(`/api/website-plan/${id}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 402) {
          toast.error(err.message || "AI credit quota reached. Upgrade your plan to continue.");
        } else if (res.status === 401) {
          toast.error("Session expired. Please sign in again.");
        } else {
          toast.error(err.error || `Failed to generate plan (${res.status})`);
        }
        return;
      }
      const data = await res.json();
      setPlan(data.plan);
      setShowPlan(true);
      setPlanSectionOpen(true);
      if (data.auditSummary) setAuditSummary(data.auditSummary);
    } catch (err) {
      console.error("Plan generation failed:", err);
      toast.error("Plan generation failed. Check your connection and retry.");
    } finally {
      setPlanGenerating(false);
    }
  };

  const runContentCheck = async () => {
    if (!lead?.websiteUrl) return;
    setContentCheckLoading(true);
    try {
      const res = await fetch("/api/website-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lead.websiteUrl }),
      });
      if (res.ok) {
        setContentCheck(await res.json());
        setShowContentCheck(true);
        setActiveTab("website");
      }
    } catch (err) {
      console.error("Content check failed:", err);
    } finally {
      setContentCheckLoading(false);
    }
  };

  const runWebsiteSearch = async () => {
    if (!lead) return;
    setWebsiteSearchLoading(true);
    setWebsiteSearchResult(null);
    try {
      const res = await fetch("/api/website-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: lead.businessName, address: lead.formattedAddress, leadId: lead.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebsiteSearchResult(data);
        setShowWebsiteSearch(true);
        setActiveTab("website");
        if (data.found) {
          const refreshRes = await fetch(`/api/leads/${id}`);
          setLead(await refreshRes.json());
        }
      }
    } catch (err) {
      console.error("Website search failed:", err);
    } finally {
      setWebsiteSearchLoading(false);
    }
  };

  const generateDossier = async () => {
    setDossierLoading(true);
    try {
      const res = await fetch(`/api/leads/${id}/explain`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || err.detail || `Failed to generate dossier (${res.status})`);
        return;
      }
      const data = await res.json();
      setDossier(data.markdown ?? null);
      setDossierCollapsed(false);
      // Pull the freshly-baked source preview map so the chips in the
      // new dossier markdown bind to up-to-date data on first render.
      refetchDossierSources();
    } catch (err) {
      console.error("Dossier generation failed:", err);
      toast.error("Failed to generate dossier. Check your connection and retry.");
    } finally {
      setDossierLoading(false);
    }
  };

  /**
   * Jump handler shared by every source-chip drawer. Switches to the
   * relevant tab, scrolls the matching anchor into view (if it
   * exists — we tolerate missing anchors so registry entries can
   * point at sections we'll wire up later), then closes the drawer.
   */
  const handleSourceJump = (tab: LeadDetailTab, anchor: string) => {
    handleTabChange(tab);
    setDrawerTag(null);
    // Wait one frame so the tab swap mounts the target panel before
    // we try to scroll. Without this, anchors inside a tab that's
    // currently unmounted resolve to null and the scroll silently
    // no-ops.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const copyDossier = async () => {
    if (!dossier) return;
    try {
      await navigator.clipboard.writeText(dossier);
      setDossierCopied(true);
      setTimeout(() => setDossierCopied(false), 2000);
    } catch {
      // Fallback is noisy; silently ignore - user can select text manually.
    }
  };

  const copyOutreachMessage = () => {
    const msg = lead?.salesOpportunity?.personalizedFirstMessage;
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-5">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-56 rounded-[28px]" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Skeleton className="h-96 rounded-3xl lg:col-span-4" />
          <Skeleton className="h-96 rounded-3xl lg:col-span-8" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-10">
        <Card className="p-12 text-center">
          <Search className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">Lead not found.</p>
          <Link href="/app/leads"><Button variant="outline" className="mt-4">Back to Leads</Button></Link>
        </Card>
      </div>
    );
  }

  const opp = lead.salesOpportunity;
  const audit = lead.websiteAudit;

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-5">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1 text-[13px] text-white/40 hover:text-(--leadac-500) transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Leads
      </Link>

      <SalesCallSheet lead={lead} onLogged={() => { void refetchLead(); }} />

      <HeroBand lead={lead} onPipelineStarted={() => { void refetchLead(); }} />

      {/*
       * Side drawer triggered by clicking any source chip in the AI
       * Dossier markdown. Mounted once at the page root so it overlays
       * the whole layout regardless of which tab is active.
       */}
      <DossierSourceDrawer
        tag={drawerTag}
        sources={dossierSources}
        onClose={() => setDrawerTag(null)}
        onJumpToTab={handleSourceJump}
      />

      {/* Phone-only collapsible identity card. On lg+ the IdentityRail aside
          takes over (left column); on phone we move the same data to a tap-
          to-expand block under the hero so it's never hidden but doesn't
          dominate the viewport. */}
      <div className="lg:hidden">
        <CollapsibleIdentityRail
          lead={lead}
          contentCheckLoading={contentCheckLoading}
          websiteSearchLoading={websiteSearchLoading}
          onContentCheck={runContentCheck}
          onWebsiteSearch={runWebsiteSearch}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <aside className="hidden lg:block lg:col-span-4 lg:sticky lg:top-6 lg:self-start space-y-5">
          <div id="anchor-identity">
            <IdentityRail
              lead={lead}
              contentCheckLoading={contentCheckLoading}
              websiteSearchLoading={websiteSearchLoading}
              onContentCheck={runContentCheck}
              onWebsiteSearch={runWebsiteSearch}
            />
          </div>
        </aside>

        <section className="lg:col-span-8 min-w-0 space-y-5">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            {/* Phone: iOS segmented control. Tablet+: original Radix TabsList. */}
            <div className="md:hidden">
              <SegmentedControl<TabKey>
                ariaLabel="Lead detail sections"
                variant="fill"
                size="sm"
                value={activeTab}
                onChange={(v) => handleTabChange(v)}
                items={[
                  { value: "overview", label: "Overview", shortLabel: "Brief", icon: Sparkles },
                  { value: "website", label: "Site", icon: Globe },
                  { value: "workers", label: "Workers", icon: BotIcon },
                  { value: "reviews", label: "Reviews", shortLabel: "Reviews", icon: Star },
                  { value: "outreach", label: "Outreach", shortLabel: "Outreach", icon: MessageSquareText },
                ]}
              />
            </div>
            <div className="hidden md:block overflow-x-auto scrollbar-hide -mx-1 px-1">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="overview" className="flex-1 sm:flex-initial">Overview</TabsTrigger>
                <TabsTrigger value="website" className="flex-1 sm:flex-initial">Website</TabsTrigger>
                <TabsTrigger value="workers" className="flex-1 sm:flex-initial">Workers</TabsTrigger>
                <TabsTrigger value="reviews" className="flex-1 sm:flex-initial">Reviews</TabsTrigger>
                <TabsTrigger value="outreach" className="flex-1 sm:flex-initial">Outreach</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-5">
              <DossierSection
                dossier={dossier}
                loading={dossierLoading}
                copied={dossierCopied}
                collapsed={dossierCollapsed}
                sources={dossierSources}
                onGenerate={generateDossier}
                onCopy={copyDossier}
                onToggle={() => setDossierCollapsed((v) => !v)}
                onOpenSource={setDrawerTag}
              />
              {opp && (
                <div id="anchor-service-packages">
                  <RecommendedPackageCard
                    pkg={opp.recommendedPackage}
                    reason={opp.recommendedPackageReason}
                    fallbackOffer={opp.suggestedOffer}
                  />
                </div>
              )}
              {opp?.personalizedFirstMessage && (
                <PersonalizedMessageCard
                  message={opp.personalizedFirstMessage}
                  copied={copied}
                  onCopy={() => {
                    navigator.clipboard.writeText(opp.personalizedFirstMessage || "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                />
              )}
            </TabsContent>

            <TabsContent value="website" className="space-y-5">
              <div id="anchor-website-audit">
                <WebsiteIntelligencePanel
                  websiteUrl={lead.websiteUrl}
                  hasWebsite={lead.hasWebsite}
                  businessName={lead.businessName}
                  workspaceNiche={lead.workspace?.niche ?? null}
                  nicheSlug={lead.nicheSlug}
                  subNicheSlug={lead.subNicheSlug}
                  audit={audit}
                  auditSummary={auditSummary}
                  contentCheck={showContentCheck ? contentCheck : null}
                  contentCheckLoading={contentCheckLoading}
                  websiteSearch={showWebsiteSearch ? websiteSearchResult : null}
                  websiteSearchLoading={websiteSearchLoading}
                  onCrawl={runCrawl}
                  onContentCheck={runContentCheck}
                  onWebsiteSearch={runWebsiteSearch}
                />
              </div>
              <div id="anchor-niche-pack">
                <SubNicheOverride
                  leadId={lead.id}
                  nicheSlug={lead.nicheSlug}
                  subNicheSlug={lead.subNicheSlug}
                  subNicheSource={lead.subNicheSource}
                  subNicheConfidence={lead.subNicheConfidence}
                  onChange={refetchLead}
                />
              </div>
            </TabsContent>

            <TabsContent value="workers" className="space-y-5">
              {/* AI Core orchestrator actions - starts pre-built chains
                  like one-click pitch pack, deep research, receptionist+KB.
                  The actual per-worker panel below still exposes
                  individual workers. */}
              <div id="anchor-workers-top">
                <PlannerActions leadId={lead.id} plan="PRO" />
              </div>
              <AiWorkersPanel leadId={lead.id} />
              <WebsitePlanSection
                plan={plan}
                showPlan={showPlan}
                setShowPlan={setShowPlan}
                sectionOpen={planSectionOpen}
                setSectionOpen={setPlanSectionOpen}
                generating={planGenerating}
                onGenerate={generatePlan}
                auditSummary={auditSummary}
                businessName={lead.businessName}
              />
            </TabsContent>

            <TabsContent value="reviews" className="space-y-5">
              <div id="anchor-review-analysis">
                <ReviewIntelligencePanel
                  leadId={lead.id}
                  hasReviews={(lead.googleReviews?.length ?? 0) > 0}
                  storedReviewCount={lead.googleReviews?.length ?? 0}
                  totalReviewCount={lead.reviewCount ?? 0}
                />
              </div>
              <div id="anchor-reviews">
                <GoogleReviewsAccordion leadId={lead.id} />
              </div>
              <div id="anchor-voice-notes">
                <VoiceNotesPanel leadId={lead.id} />
              </div>
            </TabsContent>

            <TabsContent value="outreach" className="space-y-5" id="anchor-sales-opportunity">
              {opp ? (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-[12px] uppercase tracking-[0.06em] text-white/40 mb-2">Current Status</p>
                        <Badge variant="default" className="text-[13px] px-3 py-1">
                          {OUTREACH_LABELS[opp.status] ?? opp.status}
                        </Badge>
                      </div>
                      {opp.personalizedFirstMessage && (
                        <Button size="sm" variant="outline" onClick={copyOutreachMessage} className="gap-1.5">
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "Copied" : "Copy message"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="py-4">
                    <OutreachStepper currentStatus={opp.status} onStatusChange={updateStatus} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-[14px] text-white/55">
                      Outreach tracking unlocks once an AI dossier has been generated for this lead.
                    </p>
                  </CardContent>
                </Card>
              )}
              {opp && (
                <RecommendedPackageCard
                  pkg={opp.recommendedPackage}
                  reason={opp.recommendedPackageReason}
                  fallbackOffer={opp.suggestedOffer}
                />
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-[17px]">Social Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  <SocialProfileIcons leadId={lead.id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <MobileActionBar lead={lead} onLogged={() => { void refetchLead(); }} />
    </div>
  );
}

/** Narrative block shown directly under the lead title — mirrors sales-opportunity copy. */
function HeroFitSummary({ lead }: { lead: LeadDetail }) {
  const opp = lead.salesOpportunity;
  const why = opp?.whyGoodTarget?.trim();
  const pains = Array.isArray(opp?.likelyPainPoints)
    ? (opp.likelyPainPoints as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 10)
    : [];

  if (!why && pains.length === 0) return null;

  const labelCls =
    "text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium mb-2";

  const twoCol = Boolean(why && pains.length > 0);

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 sm:px-5 sm:py-5">
      <div className={`grid gap-5 ${twoCol ? "md:grid-cols-2 md:gap-8 md:items-start" : ""}`}>
        {why ? (
          <div className="min-w-0">
            <p className={labelCls}>Why they&apos;re a fit</p>
            <p className="text-[13px] sm:text-[14px] text-white/72 leading-relaxed">{why}</p>
          </div>
        ) : null}
        {pains.length > 0 ? (
          <div className="min-w-0">
            <p className={labelCls}>Likely pain points</p>
            <ul className="text-[13px] text-white/68 space-y-1.5 list-none pl-0">
              {pains.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-(--leadac-500)/70" aria-hidden />
                  <span className="leading-snug">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Dense CRM hero strip: recommended motion, AI hooks, and site wedges reps scan in seconds (F&B / multi-outlet buyers). */
function HeroPriorityStrip({ lead }: { lead: LeadDetail }) {
  const opp = lead.salesOpportunity;
  const audit = lead.websiteAudit;
  const ra = lead.reviewAnalysis;
  const raw = audit?.rawFeaturesJson;

  const reasonCodes = Array.from(
    new Set(
      Array.isArray(opp?.reasonCodes)
        ? (opp.reasonCodes as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        : [],
    ),
  ).slice(0, 5);

  const slowMs = audit?.loadTimeMs;
  const slowLabel =
    slowMs != null && slowMs >= 3500 ? `Slow site ~${Math.round(slowMs / 1000)}s` : null;

  const wedges: string[] = [];
  if (audit?.hasWhatsappLink === false) wedges.push("No WhatsApp");
  if (audit?.hasContactForm === false) wedges.push("No contact form");
  if (raw?.hasQrMenu === true) wedges.push("QR menu detected");

  const showStrip =
    opp?.recommendedPackage != null ||
    opp?.suggestedOffer != null ||
    reasonCodes.length > 0 ||
    slowLabel != null ||
    wedges.length > 0 ||
    ra != null;

  if (!showStrip) return null;

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 sm:px-5">
      <p className="text-[10px] uppercase tracking-[0.1em] text-white/40 mb-2.5 flex items-center gap-1.5 font-medium">
        <Zap className="w-3 h-3 text-(--leadac-500)" aria-hidden />
        At a glance
      </p>
      <div className="flex flex-wrap gap-2">
        {opp?.recommendedPackage && (
          <Badge
            variant="outline"
            className="text-[11px] font-normal border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          >
            Package: {opp.recommendedPackage.name}
          </Badge>
        )}
        {opp?.suggestedOffer && (
          <Badge variant="outline" className="text-[11px] font-normal border-white/15 bg-white/5">
            Tier: {OFFER_LABELS[opp.suggestedOffer] ?? opp.suggestedOffer}
          </Badge>
        )}
        {ra != null && (
          <Badge variant="outline" className="text-[11px] font-normal border-white/15 bg-white/5">
            Review IQ {ra.leadScore}/100
          </Badge>
        )}
        {slowLabel && (
          <Badge variant="outline" className="text-[11px] font-normal border-amber-500/30 bg-amber-500/10 text-amber-100">
            {slowLabel}
          </Badge>
        )}
        {wedges.map((w) => (
          <Badge
            key={w}
            variant="outline"
            className="text-[11px] font-normal border-white/12 bg-white/[0.06] text-white/75"
          >
            {w}
          </Badge>
        ))}
        {reasonCodes.map((code) => (
          <Badge
            key={code}
            variant="outline"
            title={code}
            className="text-[11px] font-normal border-(--leadac-500)/25 bg-(--leadac-500)/10 text-(--leadac-200)"
          >
            {REASON_LABELS[code] ?? code.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function HeroBand({
  lead,
  onPipelineStarted,
}: {
  lead: LeadDetail;
  onPipelineStarted?: () => void;
}) {
  const opp = lead.salesOpportunity;
  // Phase 1 — prefer the unified Sales Confidence rollup written by
  // LEAD_INTELLIGENCE_BRIEF over the raw opportunityScore. Falls back
  // to opportunityScore for leads enriched before the brief shipped.
  const score = lead.salesConfidence ?? opp?.opportunityScore ?? null;
  const scoreLabel = lead.salesConfidence != null ? "Sales Confidence" : "Opportunity";
  const potentialLabel =
    score == null ? null : score >= 60 ? "High Potential" : score >= 35 ? "Medium Potential" : "Low Potential";
  const potentialColor =
    score == null
      ? "text-white/40"
      : score >= 60
      ? "text-[hsl(152_48%_50%)]"
      : score >= 35
      ? "text-[hsl(38_70%_52%)]"
      : "text-[hsl(4_62%_54%)]";

  const appleMapsUrl = (() => {
    if (lead.sourceLat == null || lead.sourceLng == null) return null;
    const q = encodeURIComponent(lead.businessName);
    return `https://maps.apple.com/?q=${q}&ll=${lead.sourceLat},${lead.sourceLng}`;
  })();

  const chips: { label: string; icon?: typeof Star }[] = [];
  if (lead.borough) chips.push({ label: lead.borough });
  if (lead.primaryType) chips.push({ label: lead.primaryType });
  if (lead.businessStatus && lead.businessStatus !== "OPERATIONAL") chips.push({ label: lead.businessStatus });

  return (
    <div
      className="relative overflow-hidden rounded-[28px] glass-card"
      style={{
        background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.68)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top right, hsl(var(--leadac-h) var(--leadac-s) 50% / 0.18), transparent 55%), radial-gradient(ellipse at bottom left, hsl(152 48% 50% / 0.08), transparent 60%)",
        }}
      />
      <div className="relative p-5 sm:p-7 md:p-8">
        <div className="flex flex-col-reverse md:flex-row md:items-start md:justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] sm:text-[32px] md:text-[40px] font-semibold tracking-[-0.02em] text-white leading-[1.1] break-words">
              {lead.businessName}
            </h1>
            <p className="text-[13.5px] sm:text-[15px] mt-2 text-white/60 max-w-2xl">
              {lead.formattedAddress}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              {lead.rating != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[13px] text-white/85">
                  <Star className="w-3.5 h-3.5 text-[hsl(38_70%_52%)] fill-[hsl(38_70%_52%)]" />
                  {lead.rating.toFixed(1)}
                  {lead.reviewCount != null && (
                    <span className="text-white/50">({lead.reviewCount})</span>
                  )}
                </span>
              )}
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center rounded-full bg-white/8 px-3 py-1 text-[13px] text-white/70"
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-5 md:flex-col md:items-end md:gap-2 shrink-0">
            {score != null ? (
              <div className="flex items-center gap-4 md:flex-col md:items-center md:gap-2">
                <div className="relative">
                  <CircularProgress value={score} size={96} strokeWidth={7} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-semibold tracking-[-0.02em] text-white leading-none">
                      {score}
                    </span>
                  </div>
                </div>
                <div className="md:text-center">
                  <p className="text-[12px] uppercase tracking-[0.06em] text-white/40">{scoreLabel}</p>
                  <p className={`text-[13px] font-medium ${potentialColor}`}>{potentialLabel}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 border border-white/10 px-5 py-4 w-[180px]">
                <Bot className="w-6 h-6 text-white/30 mb-1.5" />
                <p className="text-[12px] uppercase tracking-[0.06em] text-white/40">No analysis yet</p>
              </div>
            )}
          </div>
        </div>

        <HeroFitSummary lead={lead} />

        <HeroPriorityStrip lead={lead} />

        <HeroContactBar
          phone={lead.phone}
          whatsapp={lead.websiteAudit?.socialProfiles?.whatsapp ?? null}
          emails={lead.websiteAudit?.contactEmails ?? null}
        />

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-white/8">
          {lead.googleMapsUri && (
            <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-11 rounded-full px-4 gap-1.5">
                <MapPin className="w-4 h-4" />
                Google Maps
              </Button>
            </a>
          )}

          {appleMapsUrl && (
            <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-11 rounded-full px-4 gap-1.5">
                <MapPin className="w-4 h-4" />
                Apple Maps
              </Button>
            </a>
          )}

          <HeroSocialBadges
            profiles={lead.websiteAudit?.socialProfiles ?? null}
            discovered={lead.discoveredLinks ?? []}
          />
        </div>

        <HeroDirectoryBadges links={lead.discoveredLinks ?? []} />

        <HeroPipelineRerunBar leadId={lead.id} onStarted={onPipelineStarted} />
      </div>
    </div>
  );
}

const BRAND_ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "currentColor",
  width: 16,
  height: 16,
} as const;

const BRAND_PATHS = {
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849s-.012 3.584-.069 4.849c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  twitter:
    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  whatsapp:
    "M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z",
  reddit:
    "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c.264 0 .515.107.703.295a1 1 0 0 1 0 1.412 1 1 0 0 1-1.405 0 1 1 0 0 1 0-1.412.996.996 0 0 1 .702-.295ZM12 5.499c2.45 0 4.652 1.084 6.193 2.816.188-.061.379-.093.582-.093.942 0 1.711.769 1.711 1.721a1.72 1.72 0 0 1-.688 1.377c.03.187.046.377.046.574 0 2.924-3.45 5.301-7.706 5.301s-7.706-2.377-7.706-5.301c0-.197.015-.387.046-.574a1.717 1.717 0 0 1-.688-1.377c0-.952.769-1.721 1.711-1.721.203 0 .394.032.582.093C7.348 6.583 9.55 5.499 12 5.499Zm-4.45 5.6c-.817 0-1.476.659-1.476 1.476 0 .816.659 1.476 1.476 1.476.817 0 1.476-.66 1.476-1.476 0-.817-.659-1.476-1.476-1.476Zm8.9 0c-.817 0-1.476.659-1.476 1.476 0 .816.659 1.476 1.476 1.476.817 0 1.476-.66 1.476-1.476 0-.817-.659-1.476-1.476-1.476ZM9.347 14.94a.495.495 0 0 0-.69.7c1.049 1.05 2.747 1.55 3.84 1.55 1.093 0 2.791-.5 3.84-1.55a.495.495 0 0 0-.69-.7c-.824.825-2.242 1.275-3.15 1.275-.908 0-2.326-.45-3.15-1.275Z",
  pinterest:
    "M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.406.042-3.442.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.358-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z",
} as const;

interface HeroSocialLink {
  key: keyof typeof BRAND_PATHS;
  label: string;
  url: string;
  color: string;
}

const SOCIAL_ORDER: Array<{
  key: keyof typeof BRAND_PATHS;
  platform: DiscoveredPlatform;
  label: string;
  color: string;
}> = [
  { key: "instagram", platform: "instagram", label: "Instagram", color: "#E1306C" },
  { key: "facebook", platform: "facebook", label: "Facebook", color: "#1877F2" },
  { key: "linkedin", platform: "linkedin", label: "LinkedIn", color: "#0A66C2" },
  { key: "youtube", platform: "youtube", label: "YouTube", color: "#FF0000" },
  { key: "twitter", platform: "twitter", label: "X", color: "#E7E9EA" },
  { key: "tiktok", platform: "tiktok", label: "TikTok", color: "#EE1D52" },
  { key: "whatsapp", platform: "whatsapp", label: "WhatsApp", color: "#25D366" },
  { key: "reddit", platform: "reddit", label: "Reddit", color: "#FF4500" },
  { key: "pinterest", platform: "pinterest", label: "Pinterest", color: "#E60023" },
];

// Merge website-audit-provided socials with anything the SERP / Apify
// actors dug up. Direct website audit wins on collision (it's a first-party
// signal) but the SERP fallback means we still get badges for leads that
// don't link their own socials from their site.
function HeroSocialBadges({
  profiles,
  discovered,
}: {
  profiles: HeroSocialProfiles | null;
  discovered: DiscoveredLink[];
}) {
  const discoveredByPlatform = new Map<DiscoveredPlatform, DiscoveredLink>();
  for (const d of discovered) {
    if (d.category !== "social") continue;
    if (!discoveredByPlatform.has(d.platform)) discoveredByPlatform.set(d.platform, d);
  }

  const profileBag = (profiles ?? {}) as Record<string, unknown>;
  const links: HeroSocialLink[] = SOCIAL_ORDER
    .map(({ key, platform, label, color }) => {
      const rawProfile = profileBag[key];
      const directUrl = typeof rawProfile === "string" && rawProfile ? rawProfile : null;
      const url = directUrl ?? discoveredByPlatform.get(platform)?.url ?? null;
      return url ? { key, label, url, color } : null;
    })
    .filter((v): v is HeroSocialLink => v !== null);

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 ml-auto">
      <span className="text-[11px] uppercase tracking-[0.08em] text-white/30 mr-0.5">Social</span>
      {links.map(({ key, label, url, color }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={`${label} · ${url}`}
          className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-colors"
          style={{ color }}
        >
          <svg {...BRAND_ICON_PROPS}>
            <path d={BRAND_PATHS[key]} />
          </svg>
          <span className="sr-only">{label}</span>
        </a>
      ))}
    </div>
  );
}

const DIRECTORY_META: Record<
  DiscoveredPlatform,
  { label: string; dot: string; category: DiscoveredCategory }
> = {
  instagram: { label: "Instagram", dot: "#E1306C", category: "social" },
  facebook: { label: "Facebook", dot: "#1877F2", category: "social" },
  linkedin: { label: "LinkedIn", dot: "#0A66C2", category: "social" },
  twitter: { label: "X", dot: "#E7E9EA", category: "social" },
  youtube: { label: "YouTube", dot: "#FF0000", category: "social" },
  tiktok: { label: "TikTok", dot: "#EE1D52", category: "social" },
  whatsapp: { label: "WhatsApp", dot: "#25D366", category: "social" },
  pinterest: { label: "Pinterest", dot: "#E60023", category: "social" },
  reddit: { label: "Reddit", dot: "#FF4500", category: "social" },
  yell: { label: "Yell", dot: "#FFD100", category: "directory" },
  bark: { label: "Bark", dot: "hsl(152 48% 50%)", category: "directory" },
  checkatrade: { label: "Checkatrade", dot: "#F8A01B", category: "directory" },
  trustatrader: { label: "TrustATrader", dot: "#0083C1", category: "directory" },
  yellowpages: { label: "Yellow Pages", dot: "#FFD100", category: "directory" },
  foursquare: { label: "Foursquare", dot: "#F94877", category: "directory" },
  trustpilot: { label: "Trustpilot", dot: "#00B67A", category: "review" },
  yelp: { label: "Yelp", dot: "#FF1A1A", category: "review" },
  glassdoor: { label: "Glassdoor", dot: "#0CAA41", category: "review" },
  bbb: { label: "BBB", dot: "#0A66C2", category: "review" },
  companies_house: { label: "Companies House", dot: "#00703C", category: "registry" },
  google_maps: { label: "Google Maps", dot: "#4285F4", category: "maps" },
};

const CATEGORY_LABELS: Record<DiscoveredCategory, string> = {
  social: "Social",
  directory: "Listings",
  review: "Reviews",
  registry: "Registry",
  maps: "Maps",
};

function HeroDirectoryBadges({ links }: { links: DiscoveredLink[] }) {
  // Social links already render in HeroSocialBadges; this row is for the
  // longer tail of listings, reviews, registry and maps presence pulled
  // from SERP / gmaps / reddit / competitor ads actors.
  const nonSocial = links.filter((l) => l.category !== "social");
  if (nonSocial.length === 0) return null;

  const grouped = new Map<DiscoveredCategory, DiscoveredLink[]>();
  for (const l of nonSocial) {
    const arr = grouped.get(l.category) ?? [];
    arr.push(l);
    grouped.set(l.category, arr);
  }

  const order: DiscoveredCategory[] = ["directory", "review", "registry", "maps"];

  return (
    <div className="mt-4 flex flex-col gap-2">
      {order.map((cat) => {
        const items = grouped.get(cat);
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-white/30 mr-1">
              {CATEGORY_LABELS[cat]}
            </span>
            {items.map((link) => {
              const meta = DIRECTORY_META[link.platform];
              const title = link.title
                ? `${meta.label} · ${link.title}`
                : `${meta.label} · ${link.url}`;
              return (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/75 hover:bg-white/10 hover:border-white/20 hover:text-white transition-colors max-w-[260px]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: meta.dot }}
                  />
                  <span className="truncate">{meta.label}</span>
                  <ExternalLink className="w-3 h-3 text-white/40 shrink-0" />
                </a>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function HeroPipelineRerunBar({
  leadId,
  onStarted,
}: {
  leadId: string;
  onStarted?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/pipeline-rerun`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && data.error === "no_service_packages") {
          toast.error(data.message || "Add a service package in Settings first.");
        } else if (res.status === 409) {
          toast.error(data.message || "Lead pipeline is disabled for this workspace.");
        } else {
          toast.error(data.error || data.message || `Could not start pipeline (${res.status})`);
        }
        return;
      }
      toast.success("Intake pipeline started — same flow as when this lead was first added.");
      onStarted?.();
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-[11px] uppercase tracking-[0.08em] text-white/30 mr-0.5">Pipeline</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void run()}
        disabled={busy}
        title="Re-runs your workspace lead pipeline (audit, reviews, scoring, dossier — per Settings)."
        className="h-9 rounded-full px-3 gap-1.5 text-[12px]"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        Re-run intake pipeline
      </Button>
    </div>
  );
}

/**
 * Phone/tablet variant of IdentityRail — collapsed by default to save vertical
 * space, expands inline when the user taps the header. Animation honors
 * prefers-reduced-motion via the global CSS rule.
 */
function CollapsibleIdentityRail(props: {
  lead: LeadDetail;
  contentCheckLoading: boolean;
  websiteSearchLoading: boolean;
  onContentCheck: () => void;
  onWebsiteSearch: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-identity-rail"
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 focus-visible:outline-2 focus-visible:outline-(--leadac-500) rounded-2xl"
        style={{
          minHeight: "var(--touch-target-min)",
          background: "hsl(var(--leadac-h) var(--leadac-ns) 11% / 0.65)",
          border: "0.5px solid hsl(0 0% 100% / 0.06)",
        }}
      >
        <Layers className="w-4 h-4 shrink-0" style={{ color: "var(--leadac-300)" }} />
        <span
          className="flex-1 text-left font-medium"
          style={{
            color: "var(--leadac-text-1)",
            fontSize: "var(--text-callout)",
          }}
        >
          Identity & contact
        </span>
        <span
          className="text-[12px]"
          style={{ color: "var(--leadac-text-3)" }}
        >
          {open ? "Hide" : "Show"}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4" style={{ color: "var(--leadac-text-3)" }} />
        ) : (
          <ChevronDown className="w-4 h-4" style={{ color: "var(--leadac-text-3)" }} />
        )}
      </button>
      {open && (
        <div id="mobile-identity-rail" className="animate-fade-in-up space-y-5">
          <IdentityRail {...props} />
        </div>
      )}
    </div>
  );
}

function IdentityRail({
  lead,
  contentCheckLoading,
  websiteSearchLoading,
  onContentCheck,
  onWebsiteSearch,
}: {
  lead: LeadDetail;
  contentCheckLoading: boolean;
  websiteSearchLoading: boolean;
  onContentCheck: () => void;
  onWebsiteSearch: () => void;
}) {
  const opp = lead.salesOpportunity;

  return (
    <>
      <Card>
        <CardContent className="p-0 divide-y divide-white/8">
          <RailGroup label="Contact">
            <RailRow label="Phone">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white hover:text-(--leadac-500) transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-white/40" />
                  {lead.phone}
                </a>
              ) : (
                <span className="text-[14px] text-white/40">—</span>
              )}
            </RailRow>

            <RailRow label="Website">
              {lead.websiteUrl ? (
                <div className="flex items-center gap-1.5 max-w-full min-w-0">
                  <a
                    href={lead.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-medium text-(--leadac-500) hover:underline truncate"
                  >
                    {lead.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </a>
                  <button
                    type="button"
                    onClick={onContentCheck}
                    disabled={contentCheckLoading}
                    className="p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors shrink-0 disabled:opacity-50"
                    title="Content Check"
                  >
                    {contentCheckLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ScanSearch className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onWebsiteSearch}
                  disabled={websiteSearchLoading}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-(--leadac-500) hover:underline disabled:opacity-50"
                >
                  {websiteSearchLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  Find website
                </button>
              )}
            </RailRow>

            {lead.googleMapsUri && (
              <RailRow label="Maps">
                <a
                  href={lead.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-(--leadac-500) hover:underline"
                >
                  Open
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </RailRow>
            )}
          </RailGroup>

          <RailGroup label="Details">
            <RailRow label="Borough">
              <span className="text-[14px] text-white/85">{lead.borough || "—"}</span>
            </RailRow>
            <RailRow label="Type">
              <span className="text-[14px] text-white/85 truncate">{lead.primaryType || "—"}</span>
            </RailRow>
            <RailRow label="Status">
              <span className="text-[14px] text-white/85">{lead.businessStatus || "—"}</span>
            </RailRow>
            <RailRow label="Reviews">
              <span className="text-[14px] text-white/85">
                {lead.reviewCount != null ? `${lead.reviewCount}` : "—"}
              </span>
            </RailRow>
          </RailGroup>

          <RailGroup label="Pipeline">
            <RailRow label="Crawl">
              <StatusDot status={lead.crawlStatus === "CRAWLED" ? "ok" : "pending"}>
                {CRAWL_LABELS[lead.crawlStatus] ?? lead.crawlStatus}
              </StatusDot>
            </RailRow>
            <RailRow label="Analysis">
              <StatusDot status={lead.analyzeStatus === "ANALYZED" ? "ok" : "pending"}>
                {ANALYZE_LABELS[lead.analyzeStatus] ?? lead.analyzeStatus}
              </StatusDot>
            </RailRow>
            {opp && (
              <RailRow label="Outreach">
                <StatusDot status={opp.status === "WON" ? "ok" : opp.status === "LOST" ? "bad" : "pending"}>
                  {OUTREACH_LABELS[opp.status] ?? opp.status}
                </StatusDot>
              </RailRow>
            )}
          </RailGroup>
        </CardContent>
      </Card>

      {lead.sourceLat != null && lead.sourceLng != null && (
        <div className="rounded-3xl overflow-hidden border border-white/8">
          <LeadMapView
            lat={lead.sourceLat}
            lng={lead.sourceLng}
            title={lead.businessName}
            address={lead.formattedAddress}
          />
        </div>
      )}
    </>
  );
}

function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="p-4 sm:p-5 space-y-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium">{label}</p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function RailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <span className="text-[13px] text-white/50 shrink-0">{label}</span>
      <div className="min-w-0 text-right max-w-[65%] truncate">{children}</div>
    </div>
  );
}

function StatusDot({ status, children }: { status: "ok" | "pending" | "bad"; children: ReactNode }) {
  const color =
    status === "ok" ? "bg-[hsl(152_48%_50%)]" : status === "bad" ? "bg-[hsl(4_62%_54%)]" : "bg-white/35";
  const text =
    status === "ok" ? "text-[hsl(152_48%_50%)]" : status === "bad" ? "text-[hsl(4_62%_54%)]" : "text-white/70";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {children}
    </span>
  );
}

function RecommendedPackageCard({
  pkg,
  reason,
  fallbackOffer,
}: {
  pkg: { id: string; name: string; priceLabel: string; features: string[] } | null;
  reason: string | null;
  fallbackOffer: string | null;
}) {
  // No analyst-picked package + no legacy enum suggestion -> render
  // nothing. The legacy enum is shown as a quiet fallback so reps on
  // workspaces that haven't configured priced tiers yet still see a
  // tier hint without us pretending we picked one from a price card.
  if (!pkg && !fallbackOffer) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[17px] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-(--leadac-500)" />
          {pkg ? "Recommended package" : "Recommended tier"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pkg ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[18px] font-semibold tracking-[-0.01em] text-white">{pkg.name}</span>
              <span className="text-[14px] text-(--leadac-300)">{pkg.priceLabel}</span>
            </div>
            {reason && (
              <p className="text-[14px] leading-[1.6] text-white/75">{reason}</p>
            )}
            {pkg.features.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {pkg.features.slice(0, 6).map((f) => (
                  <li
                    key={f}
                    className="inline-flex items-center rounded-full bg-white/6 border border-white/8 px-2.5 py-0.5 text-[12px] text-white/70"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full bg-white/8 px-3 py-1 text-[13px] text-white/85 capitalize">
              {fallbackOffer?.toLowerCase()}
            </span>
            <p className="text-[13px] text-white/55">
              No service packages configured yet. Define them in Settings → Service Packages so the analyst can recommend a specific tier with a price.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonalizedMessageCard({
  message,
  copied,
  onCopy,
}: {
  message: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <Card className="relative">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3">
        <CardTitle className="text-[17px] flex items-center gap-2">
          <FileText className="w-4 h-4 text-(--leadac-500)" />
          Personalized Message
        </CardTitle>
        <Button
          size="sm"
          variant={copied ? undefined : "outline"}
          className="h-8 gap-1.5 text-xs"
          onClick={onCopy}
        >
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="relative rounded-2xl bg-white/5 border border-white/8 p-5 pl-6">
          <div className="absolute left-0 top-5 bottom-5 w-[2px] rounded-full bg-(--leadac-500)" />
          <p className="text-[15px] leading-[1.65] text-white/85 whitespace-pre-wrap">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// EmptyAuditCard, WebsiteStatsRow, StatTile, AuditAccordion, AuditGroup,
// ContentCheckCard, WebsiteSearchCard, AuditBadgeRow, RestaurantSignalsCard
// and InfoRow have moved into `WebsiteIntelligencePanel` so the website
// tab now renders one cohesive surface instead of seven separate cards.

function WebsitePlanSection({
  plan,
  showPlan,
  setShowPlan,
  sectionOpen,
  setSectionOpen,
  generating,
  onGenerate,
  auditSummary,
  businessName,
}: {
  plan: string | null;
  showPlan: boolean;
  setShowPlan: (v: boolean) => void;
  sectionOpen: boolean;
  setSectionOpen: (v: boolean) => void;
  generating: boolean;
  onGenerate: () => void;
  auditSummary: { totalChecks: number; passed: number; failed: number; unknown?: number; scorePercent: number } | null;
  businessName: string;
}) {
  const planRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = plan;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadMD = () => {
    if (!plan) return;
    const blob = new Blob([plan], { type: "text/markdown" });
    const link = document.createElement("a");
    link.download = `${businessName.replace(/\s+/g, "_")}_website_plan.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const summaryLine = plan
    ? (showPlan ? "Plan expanded below" : "Plan ready — expand to view")
    : "No plan generated yet";

  return (
    <Card>
      <CardHeader className="space-y-3">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-2 text-left rounded-lg -m-1 p-1 hover:bg-white/5 transition-colors"
          onClick={() => setSectionOpen(!sectionOpen)}
        >
          <div className="min-w-0">
            <CardTitle className="text-[17px] flex items-center gap-2">
              <FileText className="w-4 h-4 text-(--leadac-500) shrink-0" />
              Sales Talking Points
            </CardTitle>
            <p className="text-[12px] text-white/40 mt-1">{summaryLine}</p>
            {auditSummary && (
              <p className="text-[12px] text-white/40 mt-0.5">
                Audit score: {auditSummary.scorePercent}% (passed {auditSummary.passed} of {auditSummary.totalChecks - (auditSummary.unknown ?? 0)} checks)
              </p>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-white/30 shrink-0 mt-0.5 transition-transform ${sectionOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className="flex flex-wrap items-center gap-2 justify-end pt-1 border-t border-white/5">
          {plan && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1.5"
                onClick={() => {
                  const next = !showPlan;
                  setShowPlan(next);
                  if (next) setSectionOpen(true);
                }}
              >
                {showPlan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPlan ? "Hide" : "Show"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={handleDownloadMD}>
                <Download className="w-3.5 h-3.5" />
                Download MD
              </Button>
            </>
          )}
          <Button size="sm" onClick={onGenerate} disabled={generating} className="h-9 rounded-full px-4 gap-1.5">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Building...</> : plan ? <><RefreshCw className="w-4 h-4" />Regenerate</> : <><Sparkles className="w-4 h-4" />Build talking points</>}
          </Button>
        </div>
      </CardHeader>
      {sectionOpen && showPlan && plan && (
        <CardContent>
          <div ref={planRef} className="rounded-2xl border border-white/10 bg-white/5 p-6 max-h-[700px] overflow-y-auto select-text">
            <MarkdownRenderer content={plan} />
          </div>
        </CardContent>
      )}
      {sectionOpen && !plan && !generating && (
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">Generate the cold-call ready talking points for this lead.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function DossierSection({
  dossier,
  loading,
  copied,
  collapsed,
  sources,
  onGenerate,
  onCopy,
  onToggle,
  onOpenSource,
}: {
  dossier: string | null;
  loading: boolean;
  copied: boolean;
  collapsed: boolean;
  sources: DossierSourcesPayload | null;
  onGenerate: () => void;
  onCopy: () => void;
  onToggle: () => void;
  onOpenSource: (tag: CanonicalTag) => void;
}) {
  const hasContent = !!dossier;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-[17px] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-(--leadac-500)" />
              AI Dossier
            </CardTitle>
            <p className="text-[12px] text-white/40 mt-1 max-w-xl">
              Opportunity score, recommended package and a full sales brief synthesised from every
              agent: website audit, reviews, SERP, social scrapers and semantic memory.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {hasContent && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCopy}
                  className="h-8 gap-1.5 text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onToggle}
                  className="h-8 gap-1.5 text-xs"
                  title={collapsed ? "Expand dossier" : "Collapse dossier (text is preserved)"}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`}
                  />
                  {collapsed ? "Expand" : "Collapse"}
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={onGenerate}
              disabled={loading}
              className="h-9 gap-1.5 text-xs rounded-full px-4"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : hasContent ? (
                <RefreshCw className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {loading ? "Working..." : hasContent ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>

      {loading && !hasContent && (
        <CardContent>
          <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
            <Loader2 className="w-5 h-5 text-(--leadac-500) animate-spin" />
            <p className="text-[13px] text-white/55">
              Gathering raw agent data and sending it to Gemini 2.5 Flash...
            </p>
          </div>
        </CardContent>
      )}

      {!loading && !hasContent && (
        <CardContent>
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
            <div className="text-[13px] text-white/65 leading-[1.55]">
              Not generated yet. Click <strong className="text-white/90">Generate</strong> to
              produce the opportunity score, recommended package and the full dossier in one pass.
            </div>
          </div>
        </CardContent>
      )}

      {hasContent && !collapsed && (
        <CardContent>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 max-h-[720px] overflow-y-auto select-text">
            <DossierMarkdown
              markdown={dossier!}
              sources={sources}
              onOpenSource={onOpenSource}
            />
          </div>
        </CardContent>
      )}

      {hasContent && collapsed && (
        <CardContent>
          <div className="flex items-center gap-2 text-[12px] text-white/50">
            <Info className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <span>
              Dossier is collapsed ({dossier!.length.toLocaleString()} chars). Click{" "}
              <strong className="text-white/80">Expand</strong> to view.
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function HeroContactBar({
  phone,
  whatsapp,
  emails,
}: {
  phone: string | null;
  whatsapp: string | null;
  emails: string[] | null;
}) {
  const phoneDigits = phone ? phone.replace(/[^\d+]/g, "").replace(/^\+?/, "") : "";
  const waUrl = whatsapp
    ? whatsapp
    : phoneDigits.length >= 7
    ? `https://wa.me/${phoneDigits}`
    : null;
  const primaryEmail =
    emails && emails.length > 0
      ? emails.find((e) => typeof e === "string" && e.includes("@")) ?? null
      : null;

  if (!phone && !waUrl && !primaryEmail) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-5">
      <span className="text-[11px] uppercase tracking-[0.08em] text-white/30 mr-0.5">Contact</span>
      {phone && (
        <a
          href={`tel:${phone}`}
          title={`Call ${phone}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          <Phone className="w-3.5 h-3.5 text-(--leadac-500)" />
          <span className="truncate max-w-[200px]">{phone}</span>
        </a>
      )}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`WhatsApp ${phone ?? waUrl}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
          WhatsApp
        </a>
      )}
      {primaryEmail && (
        <a
          href={`mailto:${primaryEmail}`}
          title={`Email ${primaryEmail}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10 hover:border-white/20 hover:text-white transition-colors"
        >
          <Mail className="w-3.5 h-3.5 text-[hsl(38_70%_52%)]" />
          <span className="truncate max-w-[240px]">{primaryEmail}</span>
        </a>
      )}
    </div>
  );
}

interface SubNicheOption {
  slug: string;
  label: string;
  tagline: string;
}

/**
 * SubNicheOverride lets a rep correct the AI classifier's sub-niche
 * pick. It only renders when the lead has a parent niche with at
 * least one child (i.e. a hybrid pack like "fnb"). Single-pack
 * verticals show nothing.
 *
 * Confidence < 0.7 with AUTO source surfaces a destructive-tinted
 * warning so the rep knows the opener is falling back to a generic
 * pitch. Picking a value (or "Clear") fires PATCH and triggers a
 * full pipeline re-emit on the server (audit + scorer + opener
 * + mockup re-run with the new sub-niche).
 */
function SubNicheOverride({
  leadId,
  nicheSlug,
  subNicheSlug,
  subNicheSource,
  subNicheConfidence,
  onChange,
}: {
  leadId: string;
  nicheSlug: string | null;
  subNicheSlug: string | null;
  subNicheSource: "AUTO" | "MANUAL" | null;
  subNicheConfidence: number | null;
  onChange: () => void;
}) {
  const [options, setOptions] = useState<SubNicheOption[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lazy-load child options on mount. The endpoint returns a slim
  // shape (slug + label + tagline); we don't ship the full NichePack
  // including regex literals to the browser.
  useEffect(() => {
    if (!nicheSlug) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setOptionsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/sub-niche`);
        if (cancelled) return;
        if (!res.ok) {
          setOptions([]);
          return;
        }
        const data = (await res.json()) as { options?: SubNicheOption[] };
        if (cancelled) return;
        setOptions(Array.isArray(data.options) ? data.options : []);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, nicheSlug]);

  const save = async (rawValue: string) => {
    // The Select component uses "__none__" as a sentinel for the
    // "clear override" item because Radix doesn't allow empty-string
    // values. Translate it back to null at the wire boundary.
    const next = rawValue === "__none__" ? null : rawValue;
    if (next === subNicheSlug && subNicheSource === "MANUAL") return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/sub-niche`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subNicheSlug: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to update sub-niche (${res.status})`);
        return;
      }
      toast.success(
        next
          ? "Sub-niche locked in. Re-running opener and mockup..."
          : "Override cleared. Classifier will re-pick on the next run.",
      );
      onChange();
    } catch (err) {
      console.error("SubNicheOverride save failed", err);
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  if (options === null) return null;
  if (options.length === 0) return null;

  const lowConfidence =
    subNicheSource === "AUTO" &&
    typeof subNicheConfidence === "number" &&
    subNicheConfidence < 0.7;

  const currentLabel = subNicheSlug
    ? options.find((o) => o.slug === subNicheSlug)?.label ?? subNicheSlug
    : "Not classified yet";

  const badgeVariant: "default" | "success" | "destructive" =
    subNicheSource === "MANUAL"
      ? "success"
      : lowConfidence
      ? "destructive"
      : "default";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-(--leadac-500)" />
          Sub-niche
        </CardTitle>
        <p className="text-[12px] text-white/40 mt-1">
          Drives audit checks, opener pitch angle, and mockup template selection.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badgeVariant}>{currentLabel}</Badge>
          {subNicheSource === "MANUAL" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/55">
              <Check className="w-3 h-3 text-[hsl(152_48%_50%)]" />
              manual override
            </span>
          )}
          {subNicheSource === "AUTO" && typeof subNicheConfidence === "number" && (
            <span
              className={`text-[11px] ${
                lowConfidence ? "text-[hsl(4_62%_54%)]" : "text-white/55"
              }`}
            >
              auto · {Math.round(subNicheConfidence * 100)}% confidence
            </span>
          )}
        </div>

        {lowConfidence && (
          <div className="rounded-2xl border border-[hsl(4_62%_54%)]/20 bg-[hsl(4_62%_54%)]/6 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(4_62%_54%)] shrink-0 mt-0.5" />
            <div className="text-[12px] text-white/75 leading-[1.55]">
              Classifier confidence is below 70%. The opener and audit are
              falling back to a generic pitch instead of a specialised one.
              Pick the right sub-niche below to unlock vertical-specific
              signals.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={subNicheSlug ?? "__none__"}
            disabled={saving || optionsLoading}
            onChange={(e) => save(e.target.value)}
            className="h-9 rounded-md bg-white/5 border border-white/10 px-3 text-[13px] text-white/85 focus:outline-none focus:border-(--leadac-500)/40 disabled:opacity-60"
          >
            <option value="__none__">— Clear / let classifier re-pick —</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
          {(saving || optionsLoading) && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-white/50" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — SDR-first call sheet + mobile action bar.
// ---------------------------------------------------------------------------

const DISPOSITION_LABELS: Record<string, string> = {
  ANSWERED_INTERESTED: "Answered — interested",
  ANSWERED_NOT_INTERESTED: "Answered — not interested",
  VOICEMAIL: "Left voicemail",
  NO_ANSWER: "No answer",
  WRONG_NUMBER: "Wrong number",
  BOOKED_MEETING: "Booked a meeting",
  OPTED_OUT: "Opted out / DNC",
};

function formatDateRel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return diffMin <= 0 ? `in ${-diffMin}m` : `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 48) return diffHr <= 0 ? `in ${-diffHr}h` : `${diffHr}h ago`;
  return d.toLocaleDateString();
}

/**
 * Phase 2 — small inline badge showing the prospect's local time
 * along with a hint ("lunch service — don't call"). Renders in the
 * sticky call sheet header next to last-contact / next-action info.
 * Re-renders once a minute so the time stays fresh while the rep
 * sits on the page.
 */
function LocalTimeBadgeInline({ timezone }: { timezone: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  let label = "";
  let isCallable = true;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const time = fmt.format(new Date());
    const hour = parseInt(time.split(":")[0] ?? "0", 10);
    let hint: string | null = null;
    if (hour < 9 || hour >= 19) {
      hint = "after hours";
      isCallable = false;
    } else if (hour >= 12 && hour < 14) {
      hint = "lunch service";
      isCallable = false;
    } else if (hour >= 14 && hour < 17) {
      hint = "best window";
    }
    label = hint ? `${time} · ${hint}` : time;
  } catch {
    return null;
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{ color: isCallable ? "var(--leadac-text-2)" : "hsl(35 80% 70%)" }}
      title={`Prospect timezone: ${timezone}`}
    >
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

/**
 * Phase 1 — sticky "Sales Call Sheet" header that appears at the top
 * of the lead detail page. Shows the rep at-a-glance:
 *   - Sales Confidence ring
 *   - Last contact + next action timing
 *   - Big inline buttons: Call, Email, WhatsApp, Log
 *   - DNC / opted-out red banner when appropriate
 * Mirrored on small screens by `MobileActionBar` (sticky bottom bar).
 */
function SalesCallSheet({
  lead,
  onLogged,
}: {
  lead: LeadDetail;
  onLogged?: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const confidence = lead.salesConfidence ?? lead.salesOpportunity?.opportunityScore ?? null;
  const phone = lead.phone;
  const whatsapp = lead.websiteAudit?.socialProfiles?.whatsapp ?? null;
  const firstEmail = lead.websiteAudit?.contactEmails?.[0] ?? null;
  const dncBlocked = !!(lead.dnc || lead.lastDisposition === "OPTED_OUT");

  return (
    <>
      <div
        className="sticky top-0 z-30 -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-10 px-4 sm:px-6 md:px-8 lg:px-10 py-3 backdrop-blur-md border-b border-white/8"
        style={{ background: "hsl(var(--leadac-h) var(--leadac-ns) 9% / 0.85)" }}
      >
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {confidence != null && (
              <div className="hidden sm:block shrink-0">
                <CircularProgress value={confidence} size={42} strokeWidth={4} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[15px] sm:text-[16px] font-medium text-white truncate">
                {lead.businessName}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/55">
                {confidence != null && (
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Confidence {confidence}
                  </span>
                )}
                {lead.lastContactedAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Last contact {formatDateRel(lead.lastContactedAt)}
                  </span>
                )}
                {lead.nextActionDueAt && (
                  <span className="inline-flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    Next action {formatDateRel(lead.nextActionDueAt)}
                  </span>
                )}
                {lead.lastDisposition && (
                  <span className="inline-flex items-center gap-1 text-white/70">
                    {DISPOSITION_LABELS[lead.lastDisposition] ?? lead.lastDisposition}
                  </span>
                )}
                {lead.timezone && (
                  <LocalTimeBadgeInline timezone={lead.timezone} />
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {phone && (
              dncBlocked ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-1.5 opacity-50 cursor-not-allowed"
                  disabled
                  title="Do not contact — outbound blocked"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Call
                </Button>
              ) : (
                <a href={`tel:${phone}`}>
                  <Button size="sm" variant="outline" className="rounded-full gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    Call
                  </Button>
                </a>
              )
            )}
            {firstEmail && (
              dncBlocked ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-1.5 opacity-50 cursor-not-allowed"
                  disabled
                  title="Do not contact — outbound blocked"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Button>
              ) : (
                <a href={`mailto:${firstEmail}`}>
                  <Button size="sm" variant="outline" className="rounded-full gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </Button>
                </a>
              )
            )}
            {whatsapp && (
              dncBlocked ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-1.5 opacity-50 cursor-not-allowed"
                  disabled
                  title="Do not contact — outbound blocked"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
              ) : (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="rounded-full gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </Button>
                </a>
              )
            )}
            <Button size="sm" className="rounded-full gap-1.5" onClick={() => setLogOpen(true)}>
              <ClipboardList className="w-3.5 h-3.5" />
              Log call
            </Button>
          </div>
        </div>

        {dncBlocked && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[hsl(4_62%_54%)]/30 bg-[hsl(4_62%_54%)]/10 px-3 py-1 text-[12px] text-[hsl(4_42%_72%)]">
            <PhoneOff className="w-3.5 h-3.5" />
            Do not contact — outbound is blocked for this lead
            {lead.consentSource && (
              <span className="ml-2 text-white/40">· source: {lead.consentSource}</span>
            )}
          </div>
        )}
      </div>

      <LogCallModal
        open={logOpen}
        onOpenChange={setLogOpen}
        leadId={lead.id}
        onLogged={onLogged}
      />
    </>
  );
}

/**
 * Mobile-only sticky bottom action bar. Field reps spend most of
 * their day on a phone — they shouldn't have to scroll back to the
 * top of the page to dial / email / log a call.
 */
function MobileActionBar({
  lead,
  onLogged,
}: {
  lead: LeadDetail;
  onLogged?: () => void;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const phone = lead.phone;
  const whatsapp = lead.websiteAudit?.socialProfiles?.whatsapp ?? null;
  const firstEmail = lead.websiteAudit?.contactEmails?.[0] ?? null;
  const blocked = !!(lead.dnc || lead.lastDisposition === "OPTED_OUT");

  return (
    <>
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 backdrop-blur-md"
        style={{
          background: "hsl(var(--leadac-h) var(--leadac-ns) 7% / 0.92)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 8px)",
          paddingTop: "8px",
        }}
      >
        <div className="grid grid-cols-4 gap-1 px-2">
          <a
            href={!blocked && phone ? `tel:${phone}` : undefined}
            aria-disabled={blocked || !phone}
            className={
              !blocked && phone
                ? "flex flex-col items-center justify-center rounded-xl py-2 text-white/85"
                : "flex flex-col items-center justify-center rounded-xl py-2 text-white/30 pointer-events-none"
            }
          >
            <Phone className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Call</span>
          </a>
          <a
            href={!blocked && firstEmail ? `mailto:${firstEmail}` : undefined}
            aria-disabled={blocked || !firstEmail}
            className={
              !blocked && firstEmail
                ? "flex flex-col items-center justify-center rounded-xl py-2 text-white/85"
                : "flex flex-col items-center justify-center rounded-xl py-2 text-white/30 pointer-events-none"
            }
          >
            <Mail className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Email</span>
          </a>
          <a
            href={!blocked && whatsapp ? whatsapp : undefined}
            target={whatsapp ? "_blank" : undefined}
            rel="noopener noreferrer"
            aria-disabled={blocked || !whatsapp}
            className={
              !blocked && whatsapp
                ? "flex flex-col items-center justify-center rounded-xl py-2 text-white/85"
                : "flex flex-col items-center justify-center rounded-xl py-2 text-white/30 pointer-events-none"
            }
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="flex flex-col items-center justify-center rounded-xl py-2 text-(--leadac-500)"
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Log</span>
          </button>
        </div>
      </div>
      {/* Add bottom padding so the page content isn't hidden under the bar */}
      <div className="md:hidden h-20" aria-hidden />

      <LogCallModal
        open={logOpen}
        onOpenChange={setLogOpen}
        leadId={lead.id}
        onLogged={onLogged}
      />
    </>
  );
}

/**
 * Phase 1 — log a call disposition. Posts to the new
 * /api/leads/[id]/log-call endpoint, which writes a LeadActivity row
 * + updates Lead.lastContactedAt, lastDisposition, and (depending on
 * the disposition) nextActionDueAt + dnc.
 */
function LogCallModal({
  open,
  onOpenChange,
  leadId,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  leadId: string;
  onLogged?: () => void;
}) {
  const [disposition, setDisposition] = useState<string>("VOICEMAIL");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/log-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, notes: notes.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to log call");
        return;
      }
      toast.success("Call logged");
      onLogged?.();
      onOpenChange(false);
      setNotes("");
    } catch (err) {
      console.error(err);
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[hsl(var(--leadac-h)_var(--leadac-ns)_10%)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-medium text-white">Log call outcome</h3>
          <button onClick={() => onOpenChange(false)} className="text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {Object.entries(DISPOSITION_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDisposition(value)}
              className={
                disposition === value
                  ? "w-full text-left rounded-xl border border-(--leadac-500)/40 bg-(--leadac-500)/10 px-3 py-2 text-[13px] text-white"
                  : "w-full text-left rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-[13px] text-white/70 hover:bg-white/6"
              }
            >
              {label}
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note for the timeline (e.g. 'asked to call back Tuesday')"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-(--leadac-500)/40 resize-none"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
