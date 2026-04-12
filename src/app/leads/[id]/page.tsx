"use client";

import { useEffect, useState, use, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: id }),
    });
    const res = await fetch(`/api/leads/${id}`);
    setLead(await res.json());
  };

  const generatePlan = async () => {
    setPlanGenerating(true);
    try {
      const res = await fetch(`/api/website-plan/${id}`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setShowPlan(true);
        if (data.auditSummary) {
          setAuditSummary(data.auditSummary);
        }
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
        const data = await res.json();
        setContentCheck(data);
        setShowContentCheck(true);
      }
    } catch (err) {
      console.error("Content check failed:", err);
    } finally {
      setContentCheckLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 rounded" />
          <div className="h-64 bg-zinc-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-4 md:p-8">
        <p className="text-zinc-500">Lead bulunamadi.</p>
      </div>
    );
  }

  const opp = lead.salesOpportunity;
  const audit = lead.websiteAudit;

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <a
            href="/leads"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            &larr; Leads
          </a>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-2">
            {lead.businessName}
          </h2>
          <p className="text-zinc-500 mt-1 text-sm">{lead.formattedAddress}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.hasWebsite && lead.crawlStatus !== "CRAWLED" && (
            <Button size="sm" variant="outline" onClick={runCrawl}>
              Crawl
            </Button>
          )}
          {lead.analyzeStatus !== "ANALYZED" && (
            <Button size="sm" onClick={runAnalyze}>AI Analiz</Button>
          )}
          {lead.googleMapsUri && (
            <a
              href={lead.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline">Google Maps</Button>
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Business Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Isletme Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Borough" value={lead.borough || "Bilinmiyor"} />
              <InfoRow label="Telefon" value={lead.phone || "Yok"} />
              <div className="flex items-start justify-between">
                <span className="text-sm text-zinc-500">Website</span>
                <div className="flex items-center gap-2 max-w-[60%]">
                  {lead.websiteUrl ? (
                    <>
                      <a
                        href={lead.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline truncate"
                      >
                        {lead.websiteUrl}
                      </a>
                      <button
                        onClick={runContentCheck}
                        disabled={contentCheckLoading}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        {contentCheckLoading ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                            Kontrol...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
                            Icerik Kontrol
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <span className="text-sm font-medium">Yok</span>
                  )}
                </div>
              </div>
              <InfoRow
                label="Rating"
                value={
                  lead.rating
                    ? `${lead.rating.toFixed(1)} (${lead.reviewCount} yorum)`
                    : "Yok"
                }
              />
              <InfoRow
                label="Durum"
                value={lead.businessStatus || "Bilinmiyor"}
              />
              <InfoRow label="Tur" value={lead.primaryType || "Bilinmiyor"} />
              <InfoRow label="Crawl" value={lead.crawlStatus} />
              <InfoRow label="Analiz" value={lead.analyzeStatus} />
            </CardContent>
          </Card>

          {showContentCheck && contentCheck && (
            <ContentCheckCard
              result={contentCheck}
              onClose={() => setShowContentCheck(false)}
            />
          )}

          {audit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Website Audit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  label="Ulasilabilir"
                  value={
                    <Badge variant={audit.reachable ? "success" : "destructive"}>
                      {audit.reachable ? "Evet" : "Hayir"}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Yuklenme"
                  value={
                    audit.loadTimeMs ? `${audit.loadTimeMs}ms` : "Bilinmiyor"
                  }
                />
                <InfoRow
                  label="HTTPS"
                  value={
                    <Badge variant={audit.https ? "success" : "destructive"}>
                      {audit.https ? "Evet" : "Hayir"}
                    </Badge>
                  }
                />
                <InfoRow
                  label="Mobil Uyumlu"
                  value={
                    <Badge
                      variant={
                        audit.mobileFriendlyGuess ? "success" : "destructive"
                      }
                    >
                      {audit.mobileFriendlyGuess ? "Evet" : "Hayir"}
                    </Badge>
                  }
                />
                <InfoRow label="Title" value={audit.title || "Yok"} />
                <InfoRow
                  label="Meta Desc."
                  value={audit.metaDescription || "Yok"}
                />
                <InfoRow
                  label="Contact Form"
                  value={audit.hasContactForm ? "Var" : "Yok"}
                />
                <InfoRow
                  label="WhatsApp"
                  value={audit.hasWhatsappLink ? "Var" : "Yok"}
                />
                <InfoRow
                  label="Booking"
                  value={audit.hasBookingSystem ? "Var" : "Yok"}
                />
                <InfoRow
                  label="E-commerce"
                  value={audit.hasEcommerce ? "Var" : "Yok"}
                />

                {/* Extended audit fields */}
                <div className="border-t border-zinc-100 pt-3 mt-3">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                    Genisletilmis Audit
                  </p>
                  <div className="space-y-2">
                    <AuditBadgeRow label="Open Graph" value={audit.hasOpenGraph} />
                    <AuditBadgeRow label="Twitter Cards" value={audit.hasTwitterCards} />
                    <AuditBadgeRow label="Favicon" value={audit.hasFavicon} />
                    <AuditBadgeRow label="PWA Manifest" value={audit.hasManifest} />
                    <AuditBadgeRow label="Service Worker" value={audit.hasServiceWorker} />
                    <AuditBadgeRow label="Google Analytics" value={audit.hasGoogleAnalytics} />
                    <AuditBadgeRow label="Cookie Consent" value={audit.hasCookieConsent} />
                    <AuditBadgeRow label="Responsive Gorseller" value={audit.hasResponsiveImages} />
                    <AuditBadgeRow label="Font Display Swap" value={audit.hasFontDisplay} />
                  </div>
                </div>

                {/* Security headers */}
                {audit.securityHeaders && (
                  <div className="border-t border-zinc-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Guvenlik Header&apos;lari
                    </p>
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

                {/* Schema types */}
                {audit.schemaTypes && audit.schemaTypes.length > 0 && (
                  <div className="border-t border-zinc-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Schema.org Tipleri
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {audit.schemaTypes.map((t) => (
                        <Badge key={t} variant="outline">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accessibility issues */}
                {audit.accessibilityIssues && audit.accessibilityIssues.length > 0 && (
                  <div className="border-t border-zinc-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Erisilebilirlik Sorunlari
                    </p>
                    <ul className="space-y-1">
                      {audit.accessibilityIssues.map((issue, i) => (
                        <li key={i} className="text-sm text-red-600 flex items-start gap-1.5">
                          <span className="mt-0.5">&#x2022;</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Performance hints */}
                {audit.performanceHints && audit.performanceHints.length > 0 && (
                  <div className="border-t border-zinc-100 pt-3 mt-3">
                    <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Performans Ipuclari
                    </p>
                    <ul className="space-y-1">
                      {audit.performanceHints.map((hint, i) => (
                        <li key={i} className="text-sm text-amber-600 flex items-start gap-1.5">
                          <span className="mt-0.5">&#x2022;</span>
                          {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {audit.servicesDetected.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-zinc-500">
                      Tespit Edilen Hizmetler
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {audit.servicesDetected.map((s: string) => (
                        <Badge key={s} variant="outline">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {audit.cssFramework && (
                  <InfoRow label="CSS Framework" value={audit.cssFramework} />
                )}
                {typeof audit.pageCount === "number" && audit.pageCount > 0 && (
                  <InfoRow label="Tespit Edilen Sayfa Sayisi" value={String(audit.pageCount)} />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: AI Analysis + Plan */}
        <div className="space-y-6">
          {opp ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    AI Analiz Sonuclari
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`text-5xl font-bold ${
                        opp.opportunityScore >= 60
                          ? "text-emerald-500"
                          : opp.opportunityScore >= 35
                          ? "text-amber-500"
                          : "text-zinc-400"
                      }`}
                    >
                      {opp.opportunityScore}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Opportunity Score</p>
                      <p className="text-xs text-zinc-400">
                        {opp.opportunityScore >= 60
                          ? "Yuksek Potansiyel"
                          : opp.opportunityScore >= 35
                          ? "Orta Potansiyel"
                          : "Dusuk Potansiyel"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-zinc-500 mb-1">
                      Neden Iyi Hedef?
                    </p>
                    <p className="text-sm">{opp.whyGoodTarget}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-zinc-500 mb-1">
                      Satis Acisi
                    </p>
                    <p className="text-sm">{opp.bestSalesAngle}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-zinc-500 mb-2">
                      Problem Noktalari
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {opp.reasonCodes.map((code: string) => (
                        <Badge key={code} variant="destructive">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {opp.likelyPainPoints.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-zinc-500 mb-1">
                        Muhtemel Sikinti Noktalari
                      </p>
                      <ul className="text-sm space-y-1">
                        {opp.likelyPainPoints.map(
                          (point: string, i: number) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-zinc-400 mt-0.5">
                                &bull;
                              </span>
                              {point}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-500">
                        Onerilen Paket
                      </p>
                      <Badge variant="default" className="mt-1">
                        {opp.suggestedOffer}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">
                        Fiyat Bandi
                      </p>
                      <p className="text-sm font-bold mt-1">
                        {opp.expectedPriceBand}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {opp.personalizedFirstMessage && (
                <Card>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-3">
                    <CardTitle className="text-base sm:text-lg">
                      Kisisellesmis Mesaj
                    </CardTitle>
                    <Button
                      size="sm"
                      variant={copied ? "default" : "outline"}
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          opp.personalizedFirstMessage || ""
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          Kopyalandi
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          Kopyala
                        </>
                      )}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-zinc-50 rounded-lg p-4 text-sm leading-relaxed">
                      {opp.personalizedFirstMessage}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outreach Durumu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {["NEW", "CONTACTED", "INTERESTED", "MEETING", "WON", "LOST"].map(
                      (s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={opp.status === s ? "default" : "outline"}
                          onClick={() => updateStatus(s)}
                        >
                          {s}
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-zinc-400">
                  Henuz AI analizi yapilmamis.
                </p>
                <Button className="mt-4" onClick={runAnalyze}>
                  Simdi Analiz Et
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Website Plan Section */}
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

function ContentCheckCard({
  result,
  onClose,
}: {
  result: ContentCheckResult;
  onClose: () => void;
}) {
  const verdictConfig = {
    placeholder: {
      label: "Placeholder / Bos Site",
      color: "text-red-600",
      bg: "bg-red-50 border-red-200",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      ),
    },
    basic: {
      label: "Temel Duzey Site",
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
      ),
    },
    developed: {
      label: "Gelistirilmis Site",
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-200",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
      ),
    },
    unreachable: {
      label: "Erisilemedi",
      color: "text-zinc-600",
      bg: "bg-zinc-50 border-zinc-200",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>
      ),
    },
  };

  const config = verdictConfig[result.verdict];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
          Icerik Kontrol Sonucu
        </CardTitle>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg border p-4 ${config.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            {config.icon}
            <div>
              <p className={`font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-xs text-zinc-500">Skor: {result.score}/100</p>
            </div>
            <div className="ml-auto">
              <div className="relative w-14 h-14">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#e4e4e7" strokeWidth="4" />
                  <circle
                    cx="28"
                    cy="28"
                    r="24"
                    fill="none"
                    stroke={result.score >= 65 ? "#10b981" : result.score >= 35 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="4"
                    strokeDasharray={`${(result.score / 100) * 150.8} 150.8`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                  {result.score}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-zinc-700 leading-relaxed">{result.summary}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg bg-zinc-50 p-3 text-center">
            <p className="text-lg font-bold text-zinc-800">{result.wordCount}</p>
            <p className="text-xs text-zinc-500">Kelime</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-center">
            <p className="text-lg font-bold text-zinc-800">{result.imageCount}</p>
            <p className="text-xs text-zinc-500">Gorsel</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-center">
            <p className="text-lg font-bold text-zinc-800">{result.internalLinkCount}</p>
            <p className="text-xs text-zinc-500">Link</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-center">
            <p className="text-lg font-bold text-zinc-800">{(result.htmlSize / 1024).toFixed(0)}</p>
            <p className="text-xs text-zinc-500">KB HTML</p>
          </div>
        </div>

        {result.builderDetected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 border border-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <span className="text-sm text-blue-700">
              <strong>{result.builderDetected}</strong> ile olusturulmus
            </span>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Detayli Analiz
          </p>
          {result.signals.map((signal, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-zinc-100 last:border-0">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    signal.status === "good"
                      ? "bg-emerald-500"
                      : signal.status === "warning"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-medium text-zinc-700">{signal.label}</span>
              </div>
              <span className="text-sm text-zinc-500 text-right max-w-[55%] truncate">
                {signal.detail}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditBadgeRow({ label, value }: { label: string; value?: boolean }) {
  if (value === undefined) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <Badge variant={value ? "success" : "destructive"} className="text-xs">
        {value ? "Var" : "Yok"}
      </Badge>
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
          <CardTitle className="text-lg">AI Website Plan</CardTitle>
          {auditSummary && (
            <p className="text-xs text-zinc-400 mt-1">
              Audit Skoru: {auditSummary.scorePercent}% ({auditSummary.passed}/{auditSummary.totalChecks - (auditSummary.totalChecks - auditSummary.passed - auditSummary.failed)} basarili)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setShowPlan(!showPlan)}
              >
                {showPlan ? "Gizle" : "Goster"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleDownloadMD}
              >
                MD Indir
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generating ? (
              <>
                <div className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white mr-1.5" />
                Plan Olusturuluyor...
              </>
            ) : plan ? (
              "Yeniden Olustur"
            ) : (
              "Website Plani Olustur"
            )}
          </Button>
        </div>
      </CardHeader>
      {showPlan && plan && (
        <CardContent>
          <div
            ref={planRef}
            className="rounded-lg border border-zinc-200 bg-white p-6 max-h-[700px] overflow-y-auto"
          >
            <PlanMarkdownRenderer content={plan} />
          </div>
        </CardContent>
      )}
      {!plan && !generating && (
        <CardContent>
          <p className="text-sm text-zinc-400 text-center py-6">
            El Kitabi standartlarinda detayli website plani olusturmak icin butona tiklayin.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function PlanMarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold mt-6 mb-3 text-zinc-900">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={i}
          className="text-xl font-semibold mt-5 mb-2 text-zinc-800 border-b border-zinc-200 pb-1"
        >
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg font-semibold mt-4 mb-1.5 text-zinc-700">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={i} className="text-base font-semibold mt-3 mb-1 text-zinc-600">
          {line.slice(5)}
        </h4>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li
          key={i}
          className="ml-4 text-sm text-zinc-600 leading-relaxed list-disc"
        >
          {formatInline(line.slice(2))}
        </li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li
          key={i}
          className="ml-4 text-sm text-zinc-600 leading-relaxed list-decimal"
        >
          {formatInline(text)}
        </li>
      );
    } else if (line.startsWith("---")) {
      elements.push(<hr key={i} className="my-4 border-zinc-200" />);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="border-l-4 border-indigo-300 pl-3 py-1 my-2 text-sm text-zinc-600 bg-indigo-50/50 rounded-r"
        >
          {formatInline(line.slice(2))}
        </blockquote>
      );
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={`code-${i}`}
          className="bg-zinc-900 text-zinc-100 rounded-md p-4 my-2 text-xs overflow-x-auto"
        >
          {codeLines.join("\n")}
        </pre>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-zinc-600 leading-relaxed">
          {formatInline(line)}
        </p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);

    let firstMatch: { index: number; length: number; node: React.ReactNode; type: string } | null = null;

    if (boldMatch && boldMatch.index !== undefined) {
      firstMatch = {
        index: boldMatch.index,
        length: boldMatch[0].length,
        node: <strong key={key++} className="font-semibold text-zinc-800">{boldMatch[1]}</strong>,
        type: "bold",
      };
    }

    if (codeMatch && codeMatch.index !== undefined) {
      if (!firstMatch || codeMatch.index < firstMatch.index) {
        firstMatch = {
          index: codeMatch.index,
          length: codeMatch[0].length,
          node: <code key={key++} className="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-xs font-mono">{codeMatch[1]}</code>,
          type: "code",
        };
      }
    }

    if (firstMatch) {
      if (firstMatch.index > 0) {
        parts.push(remaining.slice(0, firstMatch.index));
      }
      parts.push(firstMatch.node);
      remaining = remaining.slice(firstMatch.index + firstMatch.length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
