"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
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
import { OutreachStepper } from "@/components/ui/outreach-stepper";
import { CRAWL_LABELS, ANALYZE_LABELS, OUTREACH_LABELS } from "@/lib/labels";
import { ReviewIntelligencePanel } from "@/components/app/review-intelligence-panel";
import { GoogleReviewsAccordion } from "@/components/app/google-reviews-accordion";
import { VoiceNotesPanel } from "@/components/app/voice-notes-panel";
import { SocialProfileIcons } from "@/components/app/social-profile-icons";
import { LeadMapView } from "@/components/app/lead-map-view";
import { AiWorkersPanel } from "@/components/app/ai-workers-panel";
import { PlannerActions } from "@/components/app/planner-actions";
import {
  ArrowLeft,
  Globe,
  MapPin,
  ExternalLink,
  Bot,
  RefreshCw,
  Copy,
  Check,
  Download,
  Eye,
  EyeOff,
  Loader2,
  ScanSearch,
  Search,
  CircleCheck,
  CircleX,
  AlertTriangle,
  Info,
  Zap,
  Sparkles,
  FileText,
  ChevronDown,
  Star,
  Phone,
  Mail,
  MessageCircle,
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
  crawlStatus: string;
  analyzeStatus: string;
  websiteAudit: {
    reachable: boolean;
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
  } | null;
  workspace?: { niche: string } | null;
  salesOpportunity: {
    opportunityScore: number;
    reasonCodes: string[];
    whyGoodTarget: string | null;
    likelyPainPoints: string[];
    bestSalesAngle: string | null;
    suggestedOffer: string;
    personalizedFirstMessage: string | null;
    expectedPriceBand: string | null;
    status: string;
  } | null;
  watchlistItem?: {
    id: string;
    websitePlan: string | null;
  } | null;
  reviewAnalysisStatus?: string;
  reviewAnalysis?: {
    leadScore: number;
    summary: string | null;
    weaknessKpis: { label: string; percent: number }[];
  } | null;
  googleReviews?: { id: string }[];
  sourceLat?: number | null;
  sourceLng?: number | null;
  discoveredLinks?: DiscoveredLink[];
}

type TabKey = "overview" | "website" | "workers" | "reviews" | "outreach";
const TAB_KEYS: TabKey[] = ["overview", "website", "workers", "reviews", "outreach"];

function countAuditPassTotal(audit: NonNullable<LeadDetail["websiteAudit"]>): { passed: number; total: number } {
  const bools: boolean[] = [
    audit.reachable,
    audit.https,
    audit.mobileFriendlyGuess,
    audit.hasContactForm,
    audit.hasWhatsappLink,
    audit.hasBookingSystem,
    audit.hasEcommerce,
  ];
  const optionalKeys = [
    "hasOpenGraph",
    "hasTwitterCards",
    "hasFavicon",
    "hasManifest",
    "hasServiceWorker",
    "hasGoogleAnalytics",
    "hasCookieConsent",
    "hasResponsiveImages",
    "hasFontDisplay",
  ] as const;
  for (const k of optionalKeys) {
    const v = audit[k];
    if (typeof v === "boolean") bools.push(v);
  }
  if (audit.securityHeaders) {
    const sh = audit.securityHeaders;
    bools.push(
      sh.hasCSP,
      sh.hasXFrameOptions,
      sh.hasXContentTypeOptions,
      sh.hasReferrerPolicy,
      sh.hasHSTS,
      sh.hasPermissionsPolicy,
    );
  }
  const passed = bools.filter(Boolean).length;
  return { passed, total: bools.length };
}

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
  const [auditSummary, setAuditSummary] = useState<{ totalChecks: number; passed: number; failed: number; scorePercent: number } | null>(null);
  const [contentCheck, setContentCheck] = useState<ContentCheckResult | null>(null);
  const [contentCheckLoading, setContentCheckLoading] = useState(false);
  const [showContentCheck, setShowContentCheck] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [websiteSearchResult, setWebsiteSearchResult] = useState<WebsiteSearchResult | null>(null);
  const [websiteSearchLoading, setWebsiteSearchLoading] = useState(false);
  const [showWebsiteSearch, setShowWebsiteSearch] = useState(false);
  const [planSectionOpen, setPlanSectionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dossier, setDossier] = useState<string | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierCopied, setDossierCopied] = useState(false);
  const [dossierCollapsed, setDossierCollapsed] = useState(false);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        if (data.watchlistItem?.websitePlan) {
          setPlan(data.watchlistItem.websitePlan);
          setPlanSectionOpen(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  const updateStatus = async (status: string) => {
    await fetch(`/api/leads/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const res = await fetch(`/api/leads/${id}`);
    setLead(await res.json());
  };

  const runCrawl = async () => {
    await fetch("/api/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id }),
    });
    const res = await fetch(`/api/leads/${id}`);
    setLead(await res.json());
  };

  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: id }),
      });
      const res = await fetch(`/api/leads/${id}`);
      setLead(await res.json());
    } catch (err) {
      console.error("Analyze failed:", err);
    } finally {
      setAnalyzing(false);
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
    } catch (err) {
      console.error("Dossier generation failed:", err);
      toast.error("Failed to generate dossier. Check your connection and retry.");
    } finally {
      setDossierLoading(false);
    }
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
  const auditCounts = audit ? countAuditPassTotal(audit) : null;

  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 space-y-5">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1 text-[13px] text-white/40 hover:text-[#0A84FF] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Leads
      </Link>

      <HeroBand
        lead={lead}
        analyzing={analyzing}
        contentCheckLoading={contentCheckLoading}
        dossierLoading={dossierLoading}
        onAnalyze={runAnalyze}
        onCrawl={runCrawl}
        onContentCheck={runContentCheck}
        onDossier={generateDossier}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <aside className="lg:col-span-4 lg:sticky lg:top-6 lg:self-start space-y-5">
          <IdentityRail
            lead={lead}
            contentCheckLoading={contentCheckLoading}
            websiteSearchLoading={websiteSearchLoading}
            onContentCheck={runContentCheck}
            onWebsiteSearch={runWebsiteSearch}
          />
        </aside>

        <section className="lg:col-span-8 min-w-0 space-y-5">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
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
                onGenerate={generateDossier}
                onCopy={copyDossier}
                onToggle={() => setDossierCollapsed((v) => !v)}
              />
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
              {lead.workspace?.niche === "RESTAURANT_TECH" && audit && (
                <RestaurantSignalsCard features={audit.rawFeaturesJson ?? null} />
              )}
              {audit ? (
                <>
                  <WebsiteStatsRow audit={audit} auditCounts={auditCounts} />
                  <AuditAccordion audit={audit} />
                </>
              ) : (
                <EmptyAuditCard
                  hasWebsite={lead.hasWebsite}
                  onCrawl={runCrawl}
                  onWebsiteSearch={runWebsiteSearch}
                  websiteSearchLoading={websiteSearchLoading}
                />
              )}
              {showContentCheck && contentCheck && (
                <ContentCheckCard result={contentCheck} onClose={() => setShowContentCheck(false)} />
              )}
              {showWebsiteSearch && websiteSearchResult && (
                <WebsiteSearchCard result={websiteSearchResult} onClose={() => setShowWebsiteSearch(false)} />
              )}
            </TabsContent>

            <TabsContent value="workers" className="space-y-5">
              {/* AI Core orchestrator actions - starts pre-built chains
                  like one-click pitch pack, deep research, receptionist+KB.
                  The actual per-worker panel below still exposes
                  individual workers. */}
              <PlannerActions leadId={lead.id} plan="PRO" />
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
              <ReviewIntelligencePanel
                leadId={lead.id}
                hasReviews={(lead.googleReviews?.length ?? 0) > 0}
              />
              <GoogleReviewsAccordion leadId={lead.id} />
              <VoiceNotesPanel leadId={lead.id} />
            </TabsContent>

            <TabsContent value="outreach" className="space-y-5">
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
    </div>
  );
}

function HeroBand({
  lead,
  analyzing,
  contentCheckLoading,
  dossierLoading,
  onAnalyze,
  onCrawl,
  onContentCheck,
  onDossier,
}: {
  lead: LeadDetail;
  analyzing: boolean;
  contentCheckLoading: boolean;
  dossierLoading: boolean;
  onAnalyze: () => void;
  onCrawl: () => void;
  onContentCheck: () => void;
  onDossier: () => void;
}) {
  const opp = lead.salesOpportunity;
  const score = opp?.opportunityScore ?? null;
  const potentialLabel =
    score == null ? null : score >= 60 ? "High Potential" : score >= 35 ? "Medium Potential" : "Low Potential";
  const potentialColor =
    score == null
      ? "text-white/40"
      : score >= 60
      ? "text-[#30D158]"
      : score >= 35
      ? "text-[#FF9F0A]"
      : "text-[#FF453A]";

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
        background: "rgba(28, 28, 30, 0.68)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(10,132,255,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(48,209,88,0.08), transparent 60%)",
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
                  <Star className="w-3.5 h-3.5 text-[#FFD60A] fill-[#FFD60A]" />
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
                  <p className="text-[12px] uppercase tracking-[0.06em] text-white/40">Opportunity</p>
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

        <HeroAgentBar
          leadId={lead.id}
          hasWebsite={!!lead.websiteUrl}
          analyzing={analyzing}
          contentCheckLoading={contentCheckLoading}
          dossierLoading={dossierLoading}
          onCrawl={onCrawl}
          onContentCheck={onContentCheck}
          onAnalyze={onAnalyze}
          onDossier={onDossier}
        />
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
  bark: { label: "Bark", dot: "#30D158", category: "directory" },
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

type AgentRunState = "idle" | "running" | "done" | "failed";

// Deep Scan is the only worker-backed action in the hero bar - it kicks off
// APIFY_WEB_CRAWL_DEEP which runs async on a BullMQ worker and is polled via
// /api/agent-runs/:id. The other three actions reuse handlers that already
// exist on the lead page (crawl, content-check, dossier generation) so they
// keep the parent's loading state as the source of truth.
const DEEP_SCAN_KIND = "APIFY_WEB_CRAWL_DEEP" as const;

function HeroAgentBar({
  leadId,
  hasWebsite,
  analyzing,
  contentCheckLoading,
  dossierLoading,
  onCrawl,
  onContentCheck,
  onAnalyze,
  onDossier,
}: {
  leadId: string;
  hasWebsite: boolean;
  analyzing: boolean;
  contentCheckLoading: boolean;
  dossierLoading: boolean;
  onCrawl: () => void;
  onContentCheck: () => void;
  onAnalyze: () => void;
  onDossier: () => void;
}) {
  const [deepScanState, setDeepScanState] = useState<AgentRunState>("idle");
  const pollerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollerRef.current != null) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, []);

  const pollRun = useCallback((runId: string) => {
    if (pollerRef.current != null) window.clearInterval(pollerRef.current);
    const intervalId = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/agent-runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const run = await res.json();
        if (run.status === "SUCCEEDED" || run.status === "FAILED" || run.status === "CANCELLED") {
          window.clearInterval(intervalId);
          pollerRef.current = null;
          const next: AgentRunState = run.status === "SUCCEEDED" ? "done" : "failed";
          setDeepScanState(next);
          if (run.status === "SUCCEEDED") {
            toast.success("Deep scan finished.");
          } else if (run.status === "FAILED") {
            toast.error(`Deep scan failed: ${run.errorMsg ?? "unknown error"}`);
          }
        }
      } catch (err) {
        console.error("HeroAgentBar poll error:", err);
      }
    }, 2000);
    pollerRef.current = intervalId;
  }, []);

  const triggerDeepScan = useCallback(async () => {
    setDeepScanState("running");
    try {
      const res = await fetch(`/api/leads/${leadId}/workers/${DEEP_SCAN_KIND}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDeepScanState("idle");
        if (res.status === 402) {
          toast.error(err.message || "Plan or quota insufficient.");
        } else {
          toast.error(err.error || `Failed to start (${res.status})`);
        }
        return;
      }
      const { runId } = await res.json();
      pollRun(runId);
    } catch (err) {
      console.error("HeroAgentBar trigger error:", err);
      setDeepScanState("idle");
      toast.error("Connection error");
    }
  }, [leadId, pollRun]);

  interface Action {
    key: string;
    label: string;
    icon: typeof Sparkles;
    hint: string;
    onClick: () => void;
    busy: boolean;
    disabled?: boolean;
    state?: AgentRunState;
  }

  const actions: Action[] = [
    {
      key: "deep-scan",
      label: "Deep Scan",
      icon: Sparkles,
      hint: "Full Apify crawl of the lead's site into searchable knowledge chunks.",
      onClick: triggerDeepScan,
      busy: deepScanState === "running",
      disabled: !hasWebsite,
      state: deepScanState,
    },
    {
      key: "content-check",
      label: "Content Check",
      icon: ScanSearch,
      hint: "Quick audit of the lead's homepage content quality.",
      onClick: onContentCheck,
      busy: contentCheckLoading,
      disabled: !hasWebsite,
    },
    {
      key: "scan-website",
      label: "Scan Website",
      icon: Globe,
      hint: "Run the standard Playwright website auditor.",
      onClick: onCrawl,
      busy: false,
      disabled: !hasWebsite,
    },
    {
      key: "ai-dossier",
      label: "AI Dossier Analyze",
      icon: Bot,
      hint: "Generate the full AI dossier and refresh the opportunity analysis.",
      onClick: () => {
        onDossier();
        onAnalyze();
      },
      busy: dossierLoading || analyzing,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <span className="text-[11px] uppercase tracking-[0.08em] text-white/30 mr-0.5">Run agent</span>
      {actions.map((a) => {
        const done = a.state === "done";
        const failed = a.state === "failed";
        const Icon = a.busy ? Loader2 : done ? Check : failed ? AlertTriangle : a.icon;
        return (
          <Button
            key={a.key}
            size="sm"
            variant="outline"
            onClick={a.onClick}
            disabled={a.busy || a.disabled}
            title={a.hint}
            className="h-9 rounded-full px-3 gap-1.5 text-[12px]"
          >
            <Icon className={`w-3.5 h-3.5 ${a.busy ? "animate-spin" : ""}`} />
            {a.label}
            {done && <span className="ml-0.5 text-[10px] text-[#30D158]">done</span>}
            {failed && <span className="ml-0.5 text-[10px] text-[#FF453A]">failed</span>}
          </Button>
        );
      })}
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
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white hover:text-[#0A84FF] transition-colors"
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
                    className="text-[14px] font-medium text-[#0A84FF] hover:underline truncate"
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
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0A84FF] hover:underline disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#0A84FF] hover:underline"
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
    status === "ok" ? "bg-[#30D158]" : status === "bad" ? "bg-[#FF453A]" : "bg-white/35";
  const text =
    status === "ok" ? "text-[#30D158]" : status === "bad" ? "text-[#FF453A]" : "text-white/70";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {children}
    </span>
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
          <FileText className="w-4 h-4 text-[#0A84FF]" />
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
          <div className="absolute left-0 top-5 bottom-5 w-[2px] rounded-full bg-[#0A84FF]" />
          <p className="text-[15px] leading-[1.65] text-white/85 whitespace-pre-wrap">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyAuditCard({
  hasWebsite,
  onCrawl,
  onWebsiteSearch,
  websiteSearchLoading,
}: {
  hasWebsite: boolean;
  onCrawl: () => void;
  onWebsiteSearch: () => void;
  websiteSearchLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-14 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <Globe className="w-7 h-7 text-white/40" />
        </div>
        <p className="text-[17px] font-semibold text-white">
          {hasWebsite ? "Website not scanned yet" : "No website on file"}
        </p>
        <p className="text-[14px] text-white/55 mt-1 max-w-sm">
          {hasWebsite
            ? "Scan the website to extract technical signals, detected services and opportunity indicators."
            : "Search the web for an active domain matching this business."}
        </p>
        {hasWebsite ? (
          <Button onClick={onCrawl} className="mt-5 h-11 rounded-full px-5 gap-2">
            <Globe className="w-4 h-4" />
            Scan Website
          </Button>
        ) : (
          <Button
            onClick={onWebsiteSearch}
            disabled={websiteSearchLoading}
            className="mt-5 h-11 rounded-full px-5 gap-2"
          >
            {websiteSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find Website
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function WebsiteStatsRow({
  audit,
  auditCounts,
}: {
  audit: NonNullable<LeadDetail["websiteAudit"]>;
  auditCounts: { passed: number; total: number } | null;
}) {
  const scorePct = auditCounts ? Math.round((auditCounts.passed / Math.max(1, auditCounts.total)) * 100) : 0;
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile
        value={auditCounts ? `${auditCounts.passed}/${auditCounts.total}` : "—"}
        label="Checks Passed"
        accent={scorePct >= 70 ? "ok" : scorePct >= 40 ? "warn" : "bad"}
      />
      <StatTile
        value={audit.loadTimeMs != null ? `${audit.loadTimeMs}` : "—"}
        suffix={audit.loadTimeMs != null ? "ms" : undefined}
        label="Load Time"
        accent={audit.loadTimeMs == null ? "neutral" : audit.loadTimeMs < 1500 ? "ok" : audit.loadTimeMs < 3500 ? "warn" : "bad"}
      />
      <StatTile
        value={audit.https ? "Yes" : "No"}
        label="HTTPS"
        accent={audit.https ? "ok" : "bad"}
      />
    </div>
  );
}

function StatTile({
  value,
  suffix,
  label,
  accent = "neutral",
}: {
  value: string;
  suffix?: string;
  label: string;
  accent?: "ok" | "warn" | "bad" | "neutral";
}) {
  const color =
    accent === "ok"
      ? "text-[#30D158]"
      : accent === "warn"
      ? "text-[#FF9F0A]"
      : accent === "bad"
      ? "text-[#FF453A]"
      : "text-white";
  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 p-4 text-center">
      <p className={`text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] leading-none ${color}`}>
        {value}
        {suffix && <span className="text-[13px] font-medium text-white/40 ml-1">{suffix}</span>}
      </p>
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/40 mt-2">{label}</p>
    </div>
  );
}

function AuditAccordion({ audit }: { audit: NonNullable<LeadDetail["websiteAudit"]> }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ core: true });
  const toggle = (k: string) => setOpenGroups((s) => ({ ...s, [k]: !s[k] }));

  const coreRows: { label: string; value: ReactNode }[] = [
    { label: "Reachable", value: <Badge variant={audit.reachable ? "success" : "destructive"}>{audit.reachable ? "Yes" : "No"}</Badge> },
    { label: "Mobile Friendly", value: <Badge variant={audit.mobileFriendlyGuess ? "success" : "destructive"}>{audit.mobileFriendlyGuess ? "Yes" : "No"}</Badge> },
    { label: "Title", value: audit.title || "—" },
    { label: "Meta Description", value: audit.metaDescription || "—" },
    { label: "Contact Form", value: audit.hasContactForm ? "Yes" : "No" },
    { label: "WhatsApp", value: audit.hasWhatsappLink ? "Yes" : "No" },
    { label: "Booking", value: audit.hasBookingSystem ? "Yes" : "No" },
    { label: "E-commerce", value: audit.hasEcommerce ? "Yes" : "No" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[17px]">Website Audit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <AuditGroup label="Core" open={!!openGroups.core} onToggle={() => toggle("core")}>
          <div className="space-y-2.5">
            {coreRows.map((r) => (
              <InfoRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </AuditGroup>

        <AuditGroup label="Extended" open={!!openGroups.extended} onToggle={() => toggle("extended")}>
          <div className="space-y-2">
            <AuditBadgeRow label="Open Graph" value={audit.hasOpenGraph} />
            <AuditBadgeRow label="Twitter Cards" value={audit.hasTwitterCards} />
            <AuditBadgeRow label="Favicon" value={audit.hasFavicon} />
            <AuditBadgeRow label="PWA Manifest" value={audit.hasManifest} />
            <AuditBadgeRow label="Service Worker" value={audit.hasServiceWorker} />
            <AuditBadgeRow label="Google Analytics" value={audit.hasGoogleAnalytics} />
            <AuditBadgeRow label="Cookie Consent" value={audit.hasCookieConsent} />
            <AuditBadgeRow label="Responsive Images" value={audit.hasResponsiveImages} />
            <AuditBadgeRow label="Font Display Swap" value={audit.hasFontDisplay} />
            {audit.cssFramework && <InfoRow label="CSS Framework" value={audit.cssFramework} />}
            {typeof audit.pageCount === "number" && audit.pageCount > 0 && (
              <InfoRow label="Page Count" value={String(audit.pageCount)} />
            )}
            {audit.schemaTypes && audit.schemaTypes.length > 0 && (
              <div className="pt-1">
                <p className="text-[12px] text-white/40 uppercase tracking-[0.06em] mb-1.5">Schema.org</p>
                <div className="flex flex-wrap gap-1.5">
                  {audit.schemaTypes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                </div>
              </div>
            )}
            {audit.servicesDetected.length > 0 && (
              <div className="pt-1">
                <p className="text-[12px] text-white/40 uppercase tracking-[0.06em] mb-1.5">Detected Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {audit.servicesDetected.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                </div>
              </div>
            )}
          </div>
        </AuditGroup>

        {audit.securityHeaders && (
          <AuditGroup label="Security Headers" open={!!openGroups.security} onToggle={() => toggle("security")}>
            <div className="space-y-2">
              <AuditBadgeRow label="CSP" value={audit.securityHeaders.hasCSP} />
              <AuditBadgeRow label="X-Frame-Options" value={audit.securityHeaders.hasXFrameOptions} />
              <AuditBadgeRow label="X-Content-Type" value={audit.securityHeaders.hasXContentTypeOptions} />
              <AuditBadgeRow label="Referrer-Policy" value={audit.securityHeaders.hasReferrerPolicy} />
              <AuditBadgeRow label="HSTS" value={audit.securityHeaders.hasHSTS} />
              <AuditBadgeRow label="Permissions-Policy" value={audit.securityHeaders.hasPermissionsPolicy} />
            </div>
          </AuditGroup>
        )}

        {((audit.accessibilityIssues && audit.accessibilityIssues.length > 0) ||
          (audit.performanceHints && audit.performanceHints.length > 0)) && (
          <AuditGroup label="Performance & A11y" open={!!openGroups.perf} onToggle={() => toggle("perf")}>
            <div className="space-y-3">
              {audit.accessibilityIssues && audit.accessibilityIssues.length > 0 && (
                <div>
                  <p className="text-[12px] text-white/40 uppercase tracking-[0.06em] mb-1.5">Accessibility Issues</p>
                  <ul className="space-y-1">
                    {audit.accessibilityIssues.map((issue, i) => (
                      <li key={i} className="text-[14px] text-[#FF453A] flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {audit.performanceHints && audit.performanceHints.length > 0 && (
                <div>
                  <p className="text-[12px] text-white/40 uppercase tracking-[0.06em] mb-1.5">Performance Hints</p>
                  <ul className="space-y-1">
                    {audit.performanceHints.map((hint, i) => (
                      <li key={i} className="text-[14px] text-[#FF9F0A] flex items-start gap-1.5">
                        <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        {hint}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AuditGroup>
        )}
      </CardContent>
    </Card>
  );
}

function AuditGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-[14px] font-medium text-white">{label}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function ContentCheckCard({ result, onClose }: { result: ContentCheckResult; onClose: () => void }) {
  const verdictConfig: Record<string, { label: string; color: string; bg: string; Icon: typeof CircleX }> = {
    placeholder: { label: "Placeholder / Empty Site", color: "text-[#FF453A]", bg: "bg-[#FF453A]/6 border-[#FF453A]/20", Icon: CircleX },
    basic: { label: "Basic Site", color: "text-[#FF9F0A]", bg: "bg-[#FF9500]/6 border-[#FF9F0A]/20", Icon: AlertTriangle },
    developed: { label: "Developed Site", color: "text-[#30D158]", bg: "bg-[#30D158]/6 border-[#30D158]/20", Icon: CircleCheck },
    unreachable: { label: "Unreachable", color: "text-white/60", bg: "bg-white/5 border-white/10", Icon: CircleX },
  };

  const config = verdictConfig[result.verdict] || verdictConfig.unreachable;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-[17px] flex items-center gap-2">
          <ScanSearch className="w-4 h-4 text-[#0A84FF]" />
          Content Check Result
        </CardTitle>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors rounded-lg p-1 hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-2xl border p-4 ${config.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            <config.Icon className={`w-5 h-5 ${config.color}`} />
            <div className="flex-1">
              <p className={`font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-xs text-white/50">Score: {result.score}/100</p>
            </div>
            <CircularProgress value={result.score} size={48} strokeWidth={4} />
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: result.wordCount, label: "Words" },
            { value: result.imageCount, label: "Images" },
            { value: result.internalLinkCount, label: "Links" },
            { value: `${(result.htmlSize / 1024).toFixed(0)}`, label: "KB" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/5 p-3 text-center">
              <p className="text-lg font-semibold text-white">{stat.value}</p>
              <p className="text-[11px] uppercase tracking-[0.06em] text-white/40">{stat.label}</p>
            </div>
          ))}
        </div>

        {result.builderDetected && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-[#0A84FF]/6 border border-[#007AFF]/20">
            <Info className="w-4 h-4 text-[#0A84FF] shrink-0" />
            <span className="text-sm text-[#0A84FF]">Built with <strong>{result.builderDetected}</strong></span>
          </div>
        )}

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          <p className="text-[12px] uppercase tracking-[0.06em] text-white/40">Detailed Analysis</p>
          {result.signals.map((signal, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${signal.status === "good" ? "bg-[#30D158]" : signal.status === "warning" ? "bg-[#FF9500]" : "bg-[#FF453A]"}`} />
                <span className="text-sm font-medium text-white/75">{signal.label}</span>
              </div>
              <span className="text-sm text-white/50 text-right max-w-[55%] truncate">{signal.detail}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WebsiteSearchCard({ result, onClose }: { result: WebsiteSearchResult; onClose: () => void }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-[17px] flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#FF9F0A]" />
          Website Search Results
        </CardTitle>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors rounded-lg p-1 hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.found ? (
          <>
            <div className="rounded-2xl border border-[#30D158]/20 bg-[#30D158]/6 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CircleCheck className="w-5 h-5 text-[#30D158]" />
                <p className="font-semibold text-[#30D158]">{result.websites.length} website(s) found!</p>
              </div>
              <p className="text-sm text-[#30D158]">The first match was saved to the lead automatically.</p>
            </div>
            <div className="space-y-2">
              {result.websites.map((website, i) => (
                <div key={i} className="rounded-2xl border border-white/10 p-3 hover:bg-white/5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0A84FF] hover:underline break-all">{website.url}</a>
                      {website.title && <p className="text-xs text-white/50 mt-0.5 truncate">{website.title}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={website.source === "google_search" ? "secondary" : "outline"}>{website.source === "google_search" ? "Google" : "Domain"}</Badge>
                      {i === 0 && <Badge variant="success">Saved</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CircleX className="w-5 h-5 text-white/30" />
              <p className="font-semibold text-white/60">No website found</p>
            </div>
            <p className="text-sm text-white/50">Scanned {result.searchedCount} addresses but no active website was detected.</p>
          </div>
        )}
        <p className="text-xs text-white/30 text-center">{result.searchedCount} addresses scanned</p>
      </CardContent>
    </Card>
  );
}

function AuditBadgeRow({ label, value }: { label: string; value?: boolean }) {
  if (value === undefined) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-white/55">{label}</span>
      <Badge variant={value ? "success" : "destructive"} className="text-xs">{value ? "Yes" : "No"}</Badge>
    </div>
  );
}

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
  auditSummary: { totalChecks: number; passed: number; failed: number; scorePercent: number } | null;
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
              <FileText className="w-4 h-4 text-[#0A84FF] shrink-0" />
              AI Website Plan
            </CardTitle>
            <p className="text-[12px] text-white/40 mt-1">{summaryLine}</p>
            {auditSummary && (
              <p className="text-[12px] text-white/40 mt-0.5">
                Audit score: {auditSummary.scorePercent}% (passed {auditSummary.passed} of {auditSummary.totalChecks} checks)
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
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : plan ? <><RefreshCw className="w-4 h-4" />Regenerate</> : <><Sparkles className="w-4 h-4" />Generate Plan</>}
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
            <p className="text-sm text-white/40">Click the button to generate a detailed website plan.</p>
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
  onGenerate,
  onCopy,
  onToggle,
}: {
  dossier: string | null;
  loading: boolean;
  copied: boolean;
  collapsed: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onToggle: () => void;
}) {
  const hasContent = !!dossier;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-[17px] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0A84FF]" />
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
            <Loader2 className="w-5 h-5 text-[#0A84FF] animate-spin" />
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
            <MarkdownRenderer content={dossier!} />
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
          <Phone className="w-3.5 h-3.5 text-[#0A84FF]" />
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
          <Mail className="w-3.5 h-3.5 text-[#FF9F0A]" />
          <span className="truncate max-w-[240px]">{primaryEmail}</span>
        </a>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] text-white/55">{label}</span>
      <span className="text-[13px] font-medium text-right max-w-[60%] text-white/90">{value}</span>
    </div>
  );
}

function RestaurantSignalsCard({
  features,
}: {
  features: {
    hasQrMenu?: boolean;
    hasOnlineReservation?: boolean;
    hasDeliveryIntegration?: boolean;
    detectedMenuTool?: string | null;
    menuUrl?: string | null;
  } | null;
}) {
  const signals = [
    {
      label: "QR Menu",
      present: !!features?.hasQrMenu,
      detail: features?.detectedMenuTool
        ? `Detected: ${features.detectedMenuTool}`
        : "Not detected — primary sales opportunity",
      priority: "critical" as const,
    },
    {
      label: "Online Reservation",
      present: !!features?.hasOnlineReservation,
      detail: features?.hasOnlineReservation
        ? "Reservation system found"
        : "No reservation integration",
      priority: "important" as const,
    },
    {
      label: "Delivery Integration",
      present: !!features?.hasDeliveryIntegration,
      detail: features?.hasDeliveryIntegration
        ? "Delivery platform link found"
        : "No delivery platform embed",
      priority: "nice_to_have" as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px] flex items-center gap-2">
          <span className="text-lg">🍽</span>
          Restaurant Tech Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {signals.map((s) => (
          <div key={s.label} className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {s.present ? (
                <CircleCheck className="w-4 h-4 text-emerald-400" />
              ) : s.priority === "critical" ? (
                <CircleX className="w-4 h-4 text-red-400" />
              ) : s.priority === "important" ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <Info className="w-4 h-4 text-white/30" />
              )}
            </div>
            <div>
              <p className="text-[13px] font-medium text-white/90">{s.label}</p>
              <p className="text-[12px] text-white/50">{s.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
