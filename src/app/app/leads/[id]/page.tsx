"use client";

import { useEffect, useState, use, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularProgress } from "@/components/ui/progress";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { OutreachStepper } from "@/components/ui/outreach-stepper";
import { CRAWL_LABELS, ANALYZE_LABELS, OUTREACH_LABELS } from "@/lib/labels";
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
  Shield,
  Zap,
  Sparkles,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
}

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
  const [auditOpen, setAuditOpen] = useState(false);
  const [planSectionOpen, setPlanSectionOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setLead(data);
        if (data.watchlistItem?.websitePlan) {
          setPlan(data.watchlistItem.websitePlan);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setShowPlan(true);
        setPlanSectionOpen(true);
        if (data.auditSummary) setAuditSummary(data.auditSummary);
      }
    } catch (err) {
      console.error("Plan generation failed:", err);
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

  const primaryHeaderAction = useMemo(() => {
    if (!lead) return null;
    const opp = lead.salesOpportunity;
    if (lead.hasWebsite && lead.crawlStatus !== "CRAWLED") {
      return { type: "crawl" as const, label: "Scan Website" };
    }
    if (lead.crawlStatus === "CRAWLED" && lead.analyzeStatus !== "ANALYZED") {
      return { type: "analyze" as const, label: "Run AI Analysis" };
    }
    if (lead.analyzeStatus === "ANALYZED" && opp?.personalizedFirstMessage) {
      return { type: "copy" as const, label: "Copy Outreach Message" };
    }
    if (!lead.hasWebsite && !lead.websiteUrl) {
      return { type: "search" as const, label: "Find Website" };
    }
    if (lead.analyzeStatus === "ANALYZED") {
      return { type: "reanalyze" as const, label: "Re-analyze" };
    }
    if (lead.googleMapsUri) {
      return { type: "maps" as const, label: "Open in Google Maps", href: lead.googleMapsUri };
    }
    return { type: "analyze" as const, label: "Run AI Analysis" };
  }, [lead]);

  if (loading) {
    return (
      <div className="p-6 md:p-8 lg:p-10 space-y-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 md:p-8 lg:p-10">
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

  const renderPrimaryButton = () => {
    if (!primaryHeaderAction) return null;
    const pa = primaryHeaderAction;
    if (pa.type === "maps" && "href" in pa) {
      return (
        <a href={pa.href} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-1.5">
            <MapPin className="w-4 h-4" />
            {pa.label}
          </Button>
        </a>
      );
    }
    if (pa.type === "crawl") {
      return (
        <Button size="sm" className="gap-1.5" onClick={runCrawl}>
          <Globe className="w-4 h-4" />
          {pa.label}
        </Button>
      );
    }
    if (pa.type === "search") {
      return (
        <Button size="sm" className="gap-1.5" onClick={runWebsiteSearch} disabled={websiteSearchLoading}>
          {websiteSearchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {pa.label}
        </Button>
      );
    }
    if (pa.type === "copy") {
      return (
        <Button size="sm" className="gap-1.5" onClick={copyOutreachMessage}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : pa.label}
        </Button>
      );
    }
    if (pa.type === "analyze" || pa.type === "reanalyze") {
      return (
        <Button size="sm" className="gap-1.5" onClick={runAnalyze} disabled={analyzing}>
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {analyzing ? "Analyzing..." : pa.label}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title={lead.businessName}
        subtitle={lead.formattedAddress}
        breadcrumb={
          <Link href="/app/leads" className="inline-flex items-center gap-1 text-sm text-white/30 hover:text-[#0A84FF] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Leads
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {renderPrimaryButton()}
            {lead.googleMapsUri && primaryHeaderAction?.type !== "maps" && (
              <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <ExternalLink className="w-4 h-4" />
                  Google Maps
                </Button>
              </a>
            )}
            {primaryHeaderAction &&
              primaryHeaderAction.type !== "analyze" &&
              primaryHeaderAction.type !== "reanalyze" &&
              lead.analyzeStatus !== "ANALYZED" && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={runAnalyze} disabled={analyzing}>
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                  {analyzing ? "Analyzing..." : "AI Analysis"}
                </Button>
              )}
            {primaryHeaderAction &&
              (primaryHeaderAction.type === "analyze" || primaryHeaderAction.type === "reanalyze") &&
              lead.hasWebsite &&
              lead.crawlStatus !== "CRAWLED" && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={runCrawl}>
                  <Globe className="w-4 h-4" />
                  Scan Website
                </Button>
              )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0A84FF]" />
                Business Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <InfoRow label="Borough" value={<Badge variant="outline">{lead.borough || "Unknown"}</Badge>} />
                <InfoRow label="Phone" value={lead.phone || "No"} />
                <div className="flex items-start justify-between">
                  <span className="text-sm text-white/50">Website</span>
                  <div className="flex items-center gap-2 max-w-[60%]">
                    {lead.websiteUrl ? (
                      <>
                        <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0A84FF] hover:text-[#0A84FF] truncate transition-colors">
                          {lead.websiteUrl}
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={runContentCheck} disabled={contentCheckLoading}>
                          {contentCheckLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#FF453A]">No</span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={runWebsiteSearch} disabled={websiteSearchLoading}>
                          {websiteSearchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                          Search
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <InfoRow label="Rating" value={lead.rating ? `${lead.rating.toFixed(1)} (${lead.reviewCount} reviews)` : "No"} />
                <InfoRow label="Status" value={lead.businessStatus || "Unknown"} />
                <InfoRow label="Type" value={lead.primaryType || "Unknown"} />
                <InfoRow
                  label="Crawl"
                  value={
                    <Badge variant={lead.crawlStatus === "CRAWLED" ? "success" : "secondary"}>
                      {CRAWL_LABELS[lead.crawlStatus] ?? lead.crawlStatus}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Analysis"
                  value={
                    <Badge variant={lead.analyzeStatus === "ANALYZED" ? "success" : "secondary"}>
                      {ANALYZE_LABELS[lead.analyzeStatus] ?? lead.analyzeStatus}
                    </Badge>
                  }
                />
            </CardContent>
          </Card>

          {showContentCheck && contentCheck && (
            <ContentCheckCard result={contentCheck} onClose={() => setShowContentCheck(false)} />
          )}

          {showWebsiteSearch && websiteSearchResult && (
            <WebsiteSearchCard result={websiteSearchResult} onClose={() => setShowWebsiteSearch(false)} />
          )}

          {audit && (
            <Card>
              <CardHeader
                className="cursor-pointer select-none py-4"
                onClick={() => setAuditOpen(!auditOpen)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Shield className="w-5 h-5 text-[#0A84FF] shrink-0" />
                      Website Audit
                    </CardTitle>
                    {auditCounts && (
                      <p className="text-xs text-white/30 mt-1">
                        Passed {auditCounts.passed} of {auditCounts.total} checks
                      </p>
                    )}
                  </div>
                  {auditOpen ? <ChevronUp className="w-5 h-5 text-white/30 shrink-0 mt-1" /> : <ChevronDown className="w-5 h-5 text-white/30 shrink-0 mt-1" />}
                </div>
              </CardHeader>
              {auditOpen && (
                <CardContent className="space-y-3 pt-0">
                  <InfoRow label="Reachable" value={<Badge variant={audit.reachable ? "success" : "destructive"}>{audit.reachable ? "Yes" : "No"}</Badge>} />
                  <InfoRow label="Load Time" value={audit.loadTimeMs ? `${audit.loadTimeMs}ms` : "Unknown"} />
                  <InfoRow label="HTTPS" value={<Badge variant={audit.https ? "success" : "destructive"}>{audit.https ? "Yes" : "No"}</Badge>} />
                  <InfoRow label="Mobile Friendly" value={<Badge variant={audit.mobileFriendlyGuess ? "success" : "destructive"}>{audit.mobileFriendlyGuess ? "Yes" : "No"}</Badge>} />
                  <InfoRow label="Title" value={audit.title || "No"} />
                  <InfoRow label="Meta Desc." value={audit.metaDescription || "No"} />
                  <InfoRow label="Contact Form" value={audit.hasContactForm ? "Yes" : "No"} />
                  <InfoRow label="WhatsApp" value={audit.hasWhatsappLink ? "Yes" : "No"} />
                  <InfoRow label="Booking" value={audit.hasBookingSystem ? "Yes" : "No"} />
                  <InfoRow label="E-commerce" value={audit.hasEcommerce ? "Yes" : "No"} />

                  <div className="border-t border-white/10 pt-3 mt-3">
                    <p className="text-[13px] font-medium text-white/50 mb-2">Extended Audit</p>
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
                    </div>
                  </div>

                  {audit.securityHeaders && (
                    <div className="border-t border-white/10 pt-3 mt-3">
                      <p className="text-[13px] font-medium text-white/50 mb-2">Security Headers</p>
                      <div className="space-y-2">
                        <AuditBadgeRow label="CSP" value={audit.securityHeaders.hasCSP} />
                        <AuditBadgeRow label="X-Frame-Options" value={audit.securityHeaders.hasXFrameOptions} />
                        <AuditBadgeRow label="X-Content-Type" value={audit.securityHeaders.hasXContentTypeOptions} />
                        <AuditBadgeRow label="Referrer-Policy" value={audit.securityHeaders.hasReferrerPolicy} />
                        <AuditBadgeRow label="HSTS" value={audit.securityHeaders.hasHSTS} />
                        <AuditBadgeRow label="Permissions-Policy" value={audit.securityHeaders.hasPermissionsPolicy} />
                      </div>
                    </div>
                  )}

                  {audit.schemaTypes && audit.schemaTypes.length > 0 && (
                    <div className="border-t border-white/10 pt-3 mt-3">
                      <p className="text-[13px] font-medium text-white/50 mb-2">Schema.org Types</p>
                      <div className="flex flex-wrap gap-1">{audit.schemaTypes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                    </div>
                  )}

                  {audit.accessibilityIssues && audit.accessibilityIssues.length > 0 && (
                    <div className="border-t border-white/10 pt-3 mt-3">
                      <p className="text-[13px] font-medium text-white/50 mb-2">Accessibility Issues</p>
                      <ul className="space-y-1">{audit.accessibilityIssues.map((issue, i) => <li key={i} className="text-sm text-[#FF453A] flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{issue}</li>)}</ul>
                    </div>
                  )}

                  {audit.performanceHints && audit.performanceHints.length > 0 && (
                    <div className="border-t border-white/10 pt-3 mt-3">
                      <p className="text-[13px] font-medium text-white/50 mb-2">Performance Hints</p>
                      <ul className="space-y-1">{audit.performanceHints.map((hint, i) => <li key={i} className="text-sm text-[#FF9F0A] flex items-start gap-1.5"><Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />{hint}</li>)}</ul>
                    </div>
                  )}

                  {audit.servicesDetected.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-white/50">Detected Services</p>
                      <div className="flex flex-wrap gap-1 mt-1">{audit.servicesDetected.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
                    </div>
                  )}

                  {audit.cssFramework && <InfoRow label="CSS Framework" value={audit.cssFramework} />}
                  {typeof audit.pageCount === "number" && audit.pageCount > 0 && <InfoRow label="Page Count" value={String(audit.pageCount)} />}
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {opp ? (
            <>
              <Card>
                <CardHeader
                  className="cursor-pointer select-none py-4 sm:py-4"
                  onClick={() => setAnalysisOpen(!analysisOpen)}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg min-w-0">
                        <Sparkles className="w-5 h-5 text-[#0A84FF] shrink-0" />
                        AI Analysis Results
                      </CardTitle>
                      {analysisOpen ? <ChevronUp className="w-5 h-5 text-white/30 shrink-0 sm:hidden" /> : <ChevronDown className="w-5 h-5 text-white/30 shrink-0 sm:hidden" />}
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={runAnalyze} disabled={analyzing} className="h-8 gap-1.5 text-xs">
                        {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        {analyzing ? "Analyzing..." : "Re-analyze"}
                      </Button>
                      <button type="button" className="hidden sm:block text-white/30 hover:text-white/70 p-1 rounded-lg hover:bg-white/10" onClick={() => setAnalysisOpen(!analysisOpen)} aria-label={analysisOpen ? "Collapse" : "Expand"}>
                        {analysisOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </CardHeader>
                {analysisOpen && (
                  <CardContent className="space-y-5 pt-0">
                    <div className="flex items-center gap-4">
                      <CircularProgress value={opp.opportunityScore} size={64} strokeWidth={5} />
                      <div>
                        <p className="text-sm font-medium text-white/70">Opportunity Score</p>
                        <p className="text-xs text-white/30">
                          {opp.opportunityScore >= 60 ? "High Potential" : opp.opportunityScore >= 35 ? "Medium Potential" : "Low Potential"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[13px] font-medium text-white/50 mb-1">Why Good Target?</p>
                      <p className="text-sm text-white/60 leading-relaxed">{opp.whyGoodTarget}</p>
                    </div>

                    <div>
                      <p className="text-[13px] font-medium text-white/50 mb-1">Sales Angle</p>
                      <p className="text-sm text-white/60 leading-relaxed">{opp.bestSalesAngle}</p>
                    </div>

                    <div>
                      <p className="text-[13px] font-medium text-white/50 mb-2">Issue Flags</p>
                      <div className="flex flex-wrap gap-1">
                        {opp.reasonCodes.map((code) => (
                          <Badge key={code} variant="destructive">{code}</Badge>
                        ))}
                      </div>
                    </div>

                    {opp.likelyPainPoints.length > 0 && (
                      <div>
                        <p className="text-[13px] font-medium text-white/50 mb-1">Likely Pain Points</p>
                        <ul className="text-sm space-y-1">{opp.likelyPainPoints.map((point, i) => <li key={i} className="flex items-start gap-2 text-white/60"><ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30" />{point}</li>)}</ul>
                      </div>
                    )}

                    <div className="flex gap-6">
                      <div>
                        <p className="text-[13px] font-medium text-white/50">Suggested Package</p>
                        <Badge className="mt-1.5 bg-[#0A84FF] text-white border-transparent">{opp.suggestedOffer}</Badge>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-white/50">Price Range</p>
                        <p className="text-sm font-semibold mt-1.5 text-white">{opp.expectedPriceBand}</p>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>

              {opp.personalizedFirstMessage && (
                <Card>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3">
                    <CardTitle>Personalized Message</CardTitle>
                    <Button
                      size="sm"
                      variant={copied ? undefined : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(opp.personalizedFirstMessage || "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white/5 rounded-xl p-4 text-sm leading-relaxed text-white/70 border border-white/10">
                      {opp.personalizedFirstMessage}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Outreach Progress</CardTitle>
                  <p className="text-xs text-white/30 mt-1">Current: {OUTREACH_LABELS[opp.status] ?? opp.status}</p>
                </CardHeader>
                <CardContent>
                  <OutreachStepper currentStatus={opp.status} onStatusChange={updateStatus} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="text-center">
              <CardContent className="py-12">
                <Bot className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/50 mb-4">No AI analysis yet.</p>
                <Button onClick={runAnalyze} disabled={analyzing}>
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <><Sparkles className="w-4 h-4" />Analyze Now</>}
                </Button>
              </CardContent>
            </Card>
          )}

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
        </div>
      </div>
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
        <CardTitle className="flex items-center gap-2">
          <ScanSearch className="w-5 h-5 text-[#0A84FF]" />
          Content Check Result
        </CardTitle>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors rounded-lg p-1 hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl border p-4 ${config.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            <config.Icon className={`w-5 h-5 ${config.color}`} />
            <div className="flex-1">
              <p className={`font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-xs text-white/50">Score: {result.score}/100</p>
            </div>
            <CircularProgress value={result.score} size={48} strokeWidth={4} />
          </div>
          <p className="text-sm text-white/60 leading-relaxed">{result.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: result.wordCount, label: "Words" },
            { value: result.imageCount, label: "Images" },
            { value: result.internalLinkCount, label: "Links" },
            { value: `${(result.htmlSize / 1024).toFixed(0)}`, label: "KB" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white/5 p-3 text-center">
              <p className="text-lg font-semibold text-white">{stat.value}</p>
              <p className="text-xs text-white/30">{stat.label}</p>
            </div>
          ))}
        </div>

        {result.builderDetected && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0A84FF]/6 border border-[#007AFF]/20">
            <Info className="w-4 h-4 text-[#0A84FF] shrink-0" />
            <span className="text-sm text-[#0A84FF]">Built with <strong>{result.builderDetected}</strong></span>
          </div>
        )}

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          <p className="text-[13px] font-medium text-white/50">Detailed Analysis</p>
          {result.signals.map((signal, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${signal.status === "good" ? "bg-[#30D158]" : signal.status === "warning" ? "bg-[#FF9500]" : "bg-[#FF453A]"}`} />
                <span className="text-sm font-medium text-white/70">{signal.label}</span>
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
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#FF9F0A]" />
          Website Search Results
        </CardTitle>
        <button type="button" onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors rounded-lg p-1 hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.found ? (
          <>
            <div className="rounded-xl border border-[#30D158]/20 bg-[#30D158]/6 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CircleCheck className="w-5 h-5 text-[#30D158]" />
                <p className="font-semibold text-[#30D158]">{result.websites.length} website(s) found!</p>
              </div>
              <p className="text-sm text-[#30D158]">The first match was saved to the lead automatically.</p>
            </div>
            <div className="space-y-2">
              {result.websites.map((website, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-3 hover:bg-white/5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0A84FF] hover:text-[#0A84FF] transition-colors break-all">{website.url}</a>
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
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
      <span className="text-sm text-white/50">{label}</span>
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
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0A84FF] shrink-0" />
              AI Website Plan
            </CardTitle>
            <p className="text-xs text-white/30 mt-1">{summaryLine}</p>
            {auditSummary && (
              <p className="text-xs text-white/30 mt-0.5">
                Audit score: {auditSummary.scorePercent}% (passed {auditSummary.passed} of {auditSummary.totalChecks} checks)
              </p>
            )}
          </div>
          {sectionOpen ? <ChevronUp className="w-5 h-5 text-white/30 shrink-0 mt-0.5" /> : <ChevronDown className="w-5 h-5 text-white/30 shrink-0 mt-0.5" />}
        </button>
        <div className="flex flex-wrap items-center gap-2 justify-end pt-1 border-t border-white/5">
          {plan && (
            <>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setShowPlan(!showPlan)}>
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
          <Button size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating Plan...</> : plan ? <><RefreshCw className="w-4 h-4" />Regenerate</> : <><Sparkles className="w-4 h-4" />Generate Website Plan</>}
          </Button>
        </div>
      </CardHeader>
      {sectionOpen && showPlan && plan && (
        <CardContent>
          <div ref={planRef} className="rounded-xl border border-white/10 bg-white/5 p-6 max-h-[700px] overflow-y-auto select-text">
            <MarkdownRenderer content={plan} />
          </div>
        </CardContent>
      )}
      {sectionOpen && !plan && !generating && (
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/30">Click the button to generate a detailed website plan.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
