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
import { OutreachStepper } from "@/components/ui/outreach-stepper";
import { CRAWL_LABELS, ANALYZE_LABELS, OUTREACH_LABELS } from "@/lib/labels";
import { ReviewIntelligencePanel } from "@/components/app/review-intelligence-panel";
import { GoogleReviewsAccordion } from "@/components/app/google-reviews-accordion";
import { VoiceNotesPanel } from "@/components/app/voice-notes-panel";
import { SocialProfileIcons } from "@/components/app/social-profile-icons";
import { LeadMapView } from "@/components/app/lead-map-view";
import { AiWorkersPanel } from "@/components/app/ai-workers-panel";
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
  ChevronRight,
  ChevronDown,
  Star,
  Phone,
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
  } | null;
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
        copied={copied}
        contentCheckLoading={contentCheckLoading}
        websiteSearchLoading={websiteSearchLoading}
        onAnalyze={runAnalyze}
        onCrawl={runCrawl}
        onCopy={copyOutreachMessage}
        onContentCheck={runContentCheck}
        onWebsiteSearch={runWebsiteSearch}
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
              {opp ? (
                <>
                  <InsightGrid opp={opp} />
                  {opp.personalizedFirstMessage && (
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
                </>
              ) : (
                <EmptyAnalysisCard analyzing={analyzing} onAnalyze={runAnalyze} />
              )}
            </TabsContent>

            <TabsContent value="website" className="space-y-5">
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
              <AiWorkersPanel leadId={lead.id} language="tr" />
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
                <EmptyAnalysisCard analyzing={analyzing} onAnalyze={runAnalyze} />
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
  copied,
  contentCheckLoading,
  websiteSearchLoading,
  onAnalyze,
  onCrawl,
  onCopy,
  onContentCheck,
  onWebsiteSearch,
}: {
  lead: LeadDetail;
  analyzing: boolean;
  copied: boolean;
  contentCheckLoading: boolean;
  websiteSearchLoading: boolean;
  onAnalyze: () => void;
  onCrawl: () => void;
  onCopy: () => void;
  onContentCheck: () => void;
  onWebsiteSearch: () => void;
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

  const nba = (() => {
    if (lead.hasWebsite && lead.crawlStatus !== "CRAWLED") {
      return { type: "crawl" as const, label: "Scan Website", icon: Globe, onClick: onCrawl };
    }
    if (lead.crawlStatus === "CRAWLED" && lead.analyzeStatus !== "ANALYZED") {
      return { type: "analyze" as const, label: "Run AI Analysis", icon: Bot, onClick: onAnalyze };
    }
    if (lead.analyzeStatus === "ANALYZED" && opp?.personalizedFirstMessage) {
      return { type: "copy" as const, label: copied ? "Copied" : "Copy Message", icon: copied ? Check : Copy, onClick: onCopy };
    }
    if (!lead.hasWebsite && !lead.websiteUrl) {
      return { type: "search" as const, label: "Find Website", icon: Search, onClick: onWebsiteSearch };
    }
    if (lead.analyzeStatus === "ANALYZED") {
      return { type: "reanalyze" as const, label: "Re-analyze", icon: RefreshCw, onClick: onAnalyze };
    }
    return { type: "analyze" as const, label: "Run AI Analysis", icon: Bot, onClick: onAnalyze };
  })();

  const loadingPrimary =
    (nba.type === "analyze" || nba.type === "reanalyze") && analyzing
      ? true
      : nba.type === "search" && websiteSearchLoading
      ? true
      : false;

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

        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-white/8">
          <Button
            onClick={nba.onClick}
            disabled={loadingPrimary}
            className="h-11 rounded-full px-5 gap-2"
          >
            {loadingPrimary ? <Loader2 className="w-4 h-4 animate-spin" /> : <nba.icon className="w-4 h-4" />}
            {loadingPrimary ? "Working..." : nba.label}
          </Button>

          {lead.googleMapsUri && (
            <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-11 rounded-full px-4 gap-1.5">
                <MapPin className="w-4 h-4" />
                Google Maps
              </Button>
            </a>
          )}

          {lead.websiteUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={onContentCheck}
              disabled={contentCheckLoading}
              className="h-11 rounded-full px-4 gap-1.5"
            >
              {contentCheckLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
              Content Check
            </Button>
          )}

          {nba.type !== "analyze" && nba.type !== "reanalyze" && lead.analyzeStatus !== "ANALYZED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAnalyze}
              disabled={analyzing}
              className="h-11 rounded-full px-4 gap-1.5"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              AI Analysis
            </Button>
          )}
        </div>
      </div>
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

function InsightGrid({ opp }: { opp: NonNullable<LeadDetail["salesOpportunity"]> }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-[17px] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0A84FF]" />
            AI Insights
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[11px]">{opp.suggestedOffer}</Badge>
            {opp.expectedPriceBand && (
              <span className="text-[13px] font-semibold text-white">{opp.expectedPriceBand}</span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {opp.whyGoodTarget && (
          <InsightBlock label="Why Good Target">
            <p className="text-[15px] leading-[1.55] text-white/80">{opp.whyGoodTarget}</p>
          </InsightBlock>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {opp.bestSalesAngle && (
            <InsightBlock label="Sales Angle">
              <p className="text-[14px] leading-[1.55] text-white/75">{opp.bestSalesAngle}</p>
            </InsightBlock>
          )}

          {opp.likelyPainPoints.length > 0 && (
            <InsightBlock label="Pain Points">
              <ul className="space-y-1.5">
                {opp.likelyPainPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-white/75 leading-[1.5]">
                    <ChevronRight className="w-3.5 h-3.5 mt-1 shrink-0 text-white/30" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </InsightBlock>
          )}
        </div>

        {opp.reasonCodes.length > 0 && (
          <InsightBlock label="Issue Flags">
            <div className="flex flex-wrap gap-1.5">
              {opp.reasonCodes.map((code) => (
                <Badge key={code} variant="destructive">{code}</Badge>
              ))}
            </div>
          </InsightBlock>
        )}
      </CardContent>
    </Card>
  );
}

function InsightBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-white/40 font-medium mb-1.5">{label}</p>
      {children}
    </div>
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

function EmptyAnalysisCard({ analyzing, onAnalyze }: { analyzing: boolean; onAnalyze: () => void }) {
  return (
    <Card>
      <CardContent className="py-14 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-[#0A84FF]/10 flex items-center justify-center mb-4">
          <Bot className="w-7 h-7 text-[#0A84FF]" />
        </div>
        <p className="text-[17px] font-semibold text-white">No AI analysis yet</p>
        <p className="text-[14px] text-white/55 mt-1 max-w-sm">
          Run the AI to score this lead, surface pain points and draft a personalized first message.
        </p>
        <Button onClick={onAnalyze} disabled={analyzing} className="mt-5 h-11 rounded-full px-5 gap-2">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "Analyzing..." : "Analyze Now"}
        </Button>
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] text-white/55">{label}</span>
      <span className="text-[13px] font-medium text-right max-w-[60%] text-white/90">{value}</span>
    </div>
  );
}
