"use client";

import { useEffect, useState, use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  useEffect(() => {
    fetch(`/api/leads/${id}`)
      .then((r) => r.json())
      .then(setLead)
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

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 rounded" />
          <div className="h-64 bg-zinc-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8">
        <p className="text-zinc-500">Lead bulunamadi.</p>
      </div>
    );
  }

  const opp = lead.salesOpportunity;
  const audit = lead.websiteAudit;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <a
            href="/leads"
            className="text-sm text-zinc-400 hover:text-zinc-600"
          >
            &larr; Leads
          </a>
          <h2 className="text-3xl font-bold tracking-tight mt-2">
            {lead.businessName}
          </h2>
          <p className="text-zinc-500 mt-1">{lead.formattedAddress}</p>
        </div>
        <div className="flex gap-2">
          {lead.hasWebsite && lead.crawlStatus !== "CRAWLED" && (
            <Button variant="outline" onClick={runCrawl}>
              Crawl
            </Button>
          )}
          {lead.analyzeStatus !== "ANALYZED" && (
            <Button onClick={runAnalyze}>AI Analiz</Button>
          )}
          {lead.googleMapsUri && (
            <a
              href={lead.googleMapsUri}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">Google Maps</Button>
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
              <InfoRow
                label="Website"
                value={
                  lead.websiteUrl ? (
                    <a
                      href={lead.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {lead.websiteUrl}
                    </a>
                  ) : (
                    "Yok"
                  )
                }
              />
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: AI Analysis */}
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
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-lg">
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
        </div>
      </div>
    </div>
  );
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
