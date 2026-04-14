"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CircularProgress } from "@/components/ui/progress";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  ArrowLeft,
  Globe,
  MapPin,
  Phone,
  Star,
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
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Lead bulunamadı.</p>
          <Link href="/leads"><Button variant="outline" className="mt-4">Lead&apos;lere Dön</Button></Link>
        </Card>
      </div>
    );
  }

  const opp = lead.salesOpportunity;
  const audit = lead.websiteAudit;

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title={lead.businessName}
        subtitle={lead.formattedAddress}
        breadcrumb={
          <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-indigo-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Leads
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {lead.hasWebsite && lead.crawlStatus !== "CRAWLED" && (
              <Button size="sm" variant="outline" onClick={runCrawl}>
                <Globe className="w-4 h-4" />
                Crawl
              </Button>
            )}
            {lead.analyzeStatus !== "ANALYZED" && (
              <Button size="sm" variant="gradient" onClick={runAnalyze} disabled={analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {analyzing ? "Analiz Ediliyor..." : "AI Analiz"}
              </Button>
            )}
            {lead.googleMapsUri && (
              <a href={lead.googleMapsUri} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-4 h-4" />
                  Google Maps
                </Button>
              </a>
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
                <FileText className="w-5 h-5 text-indigo-500" />
                İşletme Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Borough" value={<Badge variant="outline">{lead.borough || "Bilinmiyor"}</Badge>} />
              <InfoRow label="Telefon" value={lead.phone || "Yok"} />
              <div className="flex items-start justify-between">
                <span className="text-sm text-slate-500">Website</span>
                <div className="flex items-center gap-2 max-w-[60%]">
                  {lead.websiteUrl ? (
                    <>
                      <a href={lead.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 truncate transition-colors">
                        {lead.websiteUrl}
                      </a>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={runContentCheck} disabled={contentCheckLoading}>
                        {contentCheckLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanSearch className="w-3 h-3" />}
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-rose-500">Yok</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={runWebsiteSearch} disabled={websiteSearchLoading}>
                        {websiteSearchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                        Ara
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <InfoRow label="Rating" value={lead.rating ? `${lead.rating.toFixed(1)} (${lead.reviewCount} yorum)` : "Yok"} />
              <InfoRow label="Durum" value={lead.businessStatus || "Bilinmiyor"} />
              <InfoRow label="Tür" value={lead.primaryType || "Bilinmiyor"} />
              <InfoRow label="Crawl" value={<Badge variant={lead.crawlStatus === "CRAWLED" ? "success" : "secondary"}>{lead.crawlStatus}</Badge>} />
              <InfoRow label="Analiz" value={<Badge variant={lead.analyzeStatus === "ANALYZED" ? "success" : "secondary"}>{lead.analyzeStatus}</Badge>} />
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-500" />
                  Website Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="Ulaşılabilir" value={<Badge variant={audit.reachable ? "success" : "destructive"}>{audit.reachable ? "Evet" : "Hayır"}</Badge>} />
                <InfoRow label="Yüklenme" value={audit.loadTimeMs ? `${audit.loadTimeMs}ms` : "Bilinmiyor"} />
                <InfoRow label="HTTPS" value={<Badge variant={audit.https ? "success" : "destructive"}>{audit.https ? "Evet" : "Hayır"}</Badge>} />
                <InfoRow label="Mobil Uyumlu" value={<Badge variant={audit.mobileFriendlyGuess ? "success" : "destructive"}>{audit.mobileFriendlyGuess ? "Evet" : "Hayır"}</Badge>} />
                <InfoRow label="Title" value={audit.title || "Yok"} />
                <InfoRow label="Meta Desc." value={audit.metaDescription || "Yok"} />
                <InfoRow label="Contact Form" value={audit.hasContactForm ? "Var" : "Yok"} />
                <InfoRow label="WhatsApp" value={audit.hasWhatsappLink ? "Var" : "Yok"} />
                <InfoRow label="Booking" value={audit.hasBookingSystem ? "Var" : "Yok"} />
                <InfoRow label="E-commerce" value={audit.hasEcommerce ? "Var" : "Yok"} />

                <div className="border-t border-slate-200/60 pt-3 mt-3">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Genişletilmiş Audit</p>
                  <div className="space-y-2">
                    <AuditBadgeRow label="Open Graph" value={audit.hasOpenGraph} />
                    <AuditBadgeRow label="Twitter Cards" value={audit.hasTwitterCards} />
                    <AuditBadgeRow label="Favicon" value={audit.hasFavicon} />
                    <AuditBadgeRow label="PWA Manifest" value={audit.hasManifest} />
                    <AuditBadgeRow label="Service Worker" value={audit.hasServiceWorker} />
                    <AuditBadgeRow label="Google Analytics" value={audit.hasGoogleAnalytics} />
                    <AuditBadgeRow label="Cookie Consent" value={audit.hasCookieConsent} />
                    <AuditBadgeRow label="Responsive Görseller" value={audit.hasResponsiveImages} />
                    <AuditBadgeRow label="Font Display Swap" value={audit.hasFontDisplay} />
                  </div>
                </div>

                {audit.securityHeaders && (
                  <div className="border-t border-slate-200/60 pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Güvenlik Header&apos;ları</p>
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
                  <div className="border-t border-slate-200/60 pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Schema.org Tipleri</p>
                    <div className="flex flex-wrap gap-1">{audit.schemaTypes.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div>
                  </div>
                )}

                {audit.accessibilityIssues && audit.accessibilityIssues.length > 0 && (
                  <div className="border-t border-slate-200/60 pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Erişilebilirlik Sorunları</p>
                    <ul className="space-y-1">{audit.accessibilityIssues.map((issue, i) => <li key={i} className="text-sm text-rose-600 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{issue}</li>)}</ul>
                  </div>
                )}

                {audit.performanceHints && audit.performanceHints.length > 0 && (
                  <div className="border-t border-slate-200/60 pt-3 mt-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Performans İpuçları</p>
                    <ul className="space-y-1">{audit.performanceHints.map((hint, i) => <li key={i} className="text-sm text-amber-600 flex items-start gap-1.5"><Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />{hint}</li>)}</ul>
                  </div>
                )}

                {audit.servicesDetected.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500">Tespit Edilen Hizmetler</p>
                    <div className="flex flex-wrap gap-1 mt-1">{audit.servicesDetected.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}</div>
                  </div>
                )}

                {audit.cssFramework && <InfoRow label="CSS Framework" value={audit.cssFramework} />}
                {typeof audit.pageCount === "number" && audit.pageCount > 0 && <InfoRow label="Sayfa Sayısı" value={String(audit.pageCount)} />}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {opp ? (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    AI Analiz Sonuçları
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={runAnalyze} disabled={analyzing} className="h-8 gap-1.5 text-xs">
                    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {analyzing ? "Analiz Ediliyor..." : "Yeniden Analiz"}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <CircularProgress value={opp.opportunityScore} size={64} strokeWidth={5} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Opportunity Score</p>
                      <p className="text-xs text-slate-400">
                        {opp.opportunityScore >= 60 ? "Yüksek Potansiyel" : opp.opportunityScore >= 35 ? "Orta Potansiyel" : "Düşük Potansiyel"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Neden İyi Hedef?</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{opp.whyGoodTarget}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Satış Açısı</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{opp.bestSalesAngle}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Problem Noktaları</p>
                    <div className="flex flex-wrap gap-1">{opp.reasonCodes.map((code) => <Badge key={code} variant="destructive">{code}</Badge>)}</div>
                  </div>

                  {opp.likelyPainPoints.length > 0 && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">Muhtemel Sıkıntı Noktaları</p>
                      <ul className="text-sm space-y-1">{opp.likelyPainPoints.map((point, i) => <li key={i} className="flex items-start gap-2 text-slate-600"><ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />{point}</li>)}</ul>
                    </div>
                  )}

                  <div className="flex gap-6">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Önerilen Paket</p>
                      <Badge variant="gradient" className="mt-1.5">{opp.suggestedOffer}</Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Fiyat Bandı</p>
                      <p className="text-sm font-semibold mt-1.5 text-slate-900">{opp.expectedPriceBand}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {opp.personalizedFirstMessage && (
                <Card>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3">
                    <CardTitle>Kişiselleşmiş Mesaj</CardTitle>
                    <Button
                      size="sm"
                      variant={copied ? "gradient" : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(opp.personalizedFirstMessage || "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? <><Check className="w-3.5 h-3.5" />Kopyalandı</> : <><Copy className="w-3.5 h-3.5" />Kopyala</>}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50/80 rounded-xl p-4 text-sm leading-relaxed text-slate-700 border border-slate-200/60">
                      {opp.personalizedFirstMessage}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Outreach Durumu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {["NEW", "CONTACTED", "INTERESTED", "MEETING", "WON", "LOST"].map((s) => (
                      <Button key={s} size="sm" variant={opp.status === s ? "gradient" : "outline"} onClick={() => updateStatus(s)}>{s}</Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="text-center">
              <CardContent className="py-12">
                <Bot className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">Henüz AI analizi yapılmamış.</p>
                <Button variant="gradient" onClick={runAnalyze} disabled={analyzing}>
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Analiz Ediliyor...</> : <><Sparkles className="w-4 h-4" />Şimdi Analiz Et</>}
                </Button>
              </CardContent>
            </Card>
          )}

          <WebsitePlanSection
            leadId={id}
            plan={plan}
            showPlan={showPlan}
            setShowPlan={setShowPlan}
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
    placeholder: { label: "Placeholder / Boş Site", color: "text-rose-600", bg: "bg-rose-50/80 border-rose-200/60", Icon: CircleX },
    basic: { label: "Temel Düzey Site", color: "text-amber-600", bg: "bg-amber-50/80 border-amber-200/60", Icon: AlertTriangle },
    developed: { label: "Geliştirilmiş Site", color: "text-emerald-600", bg: "bg-emerald-50/80 border-emerald-200/60", Icon: CircleCheck },
    unreachable: { label: "Erişilemedi", color: "text-slate-600", bg: "bg-slate-50/80 border-slate-200/60", Icon: CircleX },
  };

  const config = verdictConfig[result.verdict] || verdictConfig.unreachable;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2">
          <ScanSearch className="w-5 h-5 text-indigo-500" />
          İçerik Kontrol Sonucu
        </CardTitle>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100/80">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl border p-4 ${config.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            <config.Icon className={`w-5 h-5 ${config.color}`} />
            <div className="flex-1">
              <p className={`font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-xs text-slate-500">Skor: {result.score}/100</p>
            </div>
            <CircularProgress value={result.score} size={48} strokeWidth={4} />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { value: result.wordCount, label: "Kelime" },
            { value: result.imageCount, label: "Görsel" },
            { value: result.internalLinkCount, label: "Link" },
            { value: `${(result.htmlSize / 1024).toFixed(0)}`, label: "KB" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-slate-50/80 p-3 text-center">
              <p className="text-lg font-semibold text-slate-800">{stat.value}</p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        {result.builderDetected && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200/60">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-sm text-indigo-700"><strong>{result.builderDetected}</strong> ile oluşturulmuş</span>
          </div>
        )}

        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Detaylı Analiz</p>
          {result.signals.map((signal, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100/60 last:border-0">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${signal.status === "good" ? "bg-emerald-500" : signal.status === "warning" ? "bg-amber-500" : "bg-rose-500"}`} />
                <span className="text-sm font-medium text-slate-700">{signal.label}</span>
              </div>
              <span className="text-sm text-slate-500 text-right max-w-[55%] truncate">{signal.detail}</span>
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
          <Globe className="w-5 h-5 text-amber-500" />
          Website Arama Sonucu
        </CardTitle>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100/80">
          <X className="w-4 h-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.found ? (
          <>
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/80 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CircleCheck className="w-5 h-5 text-emerald-600" />
                <p className="font-semibold text-emerald-700">{result.websites.length} website bulundu!</p>
              </div>
              <p className="text-sm text-emerald-600">İlk bulunan site lead&apos;e otomatik kaydedildi.</p>
            </div>
            <div className="space-y-2">
              {result.websites.map((website, i) => (
                <div key={i} className="rounded-xl border border-slate-200/60 p-3 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <a href={website.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors break-all">{website.url}</a>
                      {website.title && <p className="text-xs text-slate-500 mt-0.5 truncate">{website.title}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant={website.source === "google_search" ? "secondary" : "outline"}>{website.source === "google_search" ? "Google" : "Domain"}</Badge>
                      {i === 0 && <Badge variant="success">Kaydedildi</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CircleX className="w-5 h-5 text-slate-400" />
              <p className="font-semibold text-slate-600">Website bulunamadı</p>
            </div>
            <p className="text-sm text-slate-500">{result.searchedCount} adres tarandı ancak aktif bir website tespit edilemedi.</p>
          </div>
        )}
        <p className="text-xs text-slate-400 text-center">{result.searchedCount} adres tarandı</p>
      </CardContent>
    </Card>
  );
}

function AuditBadgeRow({ label, value }: { label: string; value?: boolean }) {
  if (value === undefined) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <Badge variant={value ? "success" : "destructive"} className="text-xs">{value ? "Var" : "Yok"}</Badge>
    </div>
  );
}

function WebsitePlanSection({
  leadId,
  plan,
  showPlan,
  setShowPlan,
  generating,
  onGenerate,
  auditSummary,
  businessName,
}: {
  leadId: string;
  plan: string | null;
  showPlan: boolean;
  setShowPlan: (v: boolean) => void;
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

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            AI Website Plan
          </CardTitle>
          {auditSummary && (
            <p className="text-xs text-slate-400 mt-1">
              Audit Skoru: {auditSummary.scorePercent}% ({auditSummary.passed}/{auditSummary.totalChecks - (auditSummary.totalChecks - auditSummary.passed - auditSummary.failed)} başarılı)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={() => setShowPlan(!showPlan)}>
                {showPlan ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPlan ? "Gizle" : "Göster"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Kopyalandı!" : "Kopyala"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs gap-1.5" onClick={handleDownloadMD}>
                <Download className="w-3.5 h-3.5" />
                MD İndir
              </Button>
            </>
          )}
          <Button size="sm" variant="gradient" onClick={onGenerate} disabled={generating}>
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" />Plan Oluşturuluyor...</> : plan ? <><RefreshCw className="w-4 h-4" />Yeniden Oluştur</> : <><Sparkles className="w-4 h-4" />Website Planı Oluştur</>}
          </Button>
        </div>
      </CardHeader>
      {showPlan && plan && (
        <CardContent>
          <div ref={planRef} className="rounded-xl border border-slate-200/60 bg-white/80 p-6 max-h-[700px] overflow-y-auto select-text">
            <MarkdownRenderer content={plan} />
          </div>
        </CardContent>
      )}
      {!plan && !generating && (
        <CardContent>
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Detaylı website planı oluşturmak için butona tıklayın.</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
