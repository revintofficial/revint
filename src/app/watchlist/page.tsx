"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GoogleReviewData {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: string;
}

interface SalesOpportunityData {
  opportunityScore: number;
  suggestedOffer: string;
  status: string;
  whyGoodTarget?: string | null;
  likelyPainPoints?: string[];
  bestSalesAngle?: string | null;
  personalizedFirstMessage?: string | null;
  expectedPriceBand?: string | null;
  reasonCodes?: string[];
}

interface WatchlistItem {
  id: string;
  leadId: string;
  siteUrl: string | null;
  notes: string | null;
  websitePlan: string | null;
  createdAt: string;
  updatedAt: string;
  lead: {
    id: string;
    businessName: string;
    formattedAddress: string;
    borough: string | null;
    phone: string | null;
    websiteUrl: string | null;
    analyzeStatus: string;
    googleReviews: GoogleReviewData[];
    salesOpportunity: SalesOpportunityData | null;
  };
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAll, setAnalyzingAll] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleRemove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to remove from watchlist:", err);
      fetchWatchlist();
    }
  };

  const handleReviewsUpdate = (leadId: string, reviews: GoogleReviewData[]) => {
    setItems((prev) =>
      prev.map((item) =>
        item.lead.id === leadId
          ? { ...item, lead: { ...item.lead, googleReviews: reviews } }
          : item
      )
    );
  };

  const handlePlanUpdate = (itemId: string, plan: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, websitePlan: plan } : item
      )
    );
  };

  const handleAnalyzeAll = async () => {
    setAnalyzingAll(true);
    const unanalyzed = items.filter(
      (i) => !i.lead.salesOpportunity && i.lead.analyzeStatus !== "ANALYZING"
    );
    for (const item of unanalyzed) {
      try {
        await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: item.lead.id }),
        });
      } catch {}
    }
    setTimeout(() => {
      fetchWatchlist();
      setAnalyzingAll(false);
    }, 2000);
  };

  const totalScore =
    items.filter((i) => i.lead.salesOpportunity).length > 0
      ? Math.round(
          items
            .filter((i) => i.lead.salesOpportunity)
            .reduce((s, i) => s + (i.lead.salesOpportunity?.opportunityScore || 0), 0) /
            items.filter((i) => i.lead.salesOpportunity).length
        )
      : 0;

  const unanalyzedCount = items.filter(
    (i) => !i.lead.salesOpportunity
  ).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Watchlist</h2>
          <p className="text-zinc-500 mt-1">
            {loading
              ? "Yukleniyor..."
              : `${items.length} lead takip ediliyor`}
          </p>
        </div>

        {!loading && items.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">
                {totalScore}
              </div>
              <span className="text-zinc-500">Ort. Skor</span>
            </div>
            {unanalyzedCount > 0 && (
              <Button
                size="sm"
                onClick={handleAnalyzeAll}
                disabled={analyzingAll}
              >
                {analyzingAll
                  ? "Analiz Ediliyor..."
                  : `Tumunu Analiz Et (${unanalyzedCount})`}
              </Button>
            )}
          </div>
        )}
      </div>

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-zinc-400">
              <p className="text-lg font-medium">
                Henuz watchlist&apos;te lead yok
              </p>
              <p className="text-sm mt-1">
                Leads sayfasindan leadleri watchlist&apos;e ekleyebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <WatchlistCard
            key={item.id}
            item={item}
            onRemove={handleRemove}
            onReviewsUpdate={handleReviewsUpdate}
            onPlanUpdate={handlePlanUpdate}
            onRefresh={fetchWatchlist}
          />
        ))}
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= rating ? "text-amber-400" : "text-zinc-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

const REASON_LABELS: Record<string, string> = {
  no_website: "Web Sitesi Yok",
  poor_mobile: "Mobil Uyumsuz",
  no_booking: "Randevu Sistemi Yok",
  no_whatsapp: "WhatsApp Yok",
  no_https: "HTTPS Yok",
  weak_seo: "Zayif SEO",
  slow_site: "Yavas Site",
  no_ecommerce: "E-Ticaret Yok",
  high_rating_weak_site: "Yuksek Puan, Zayif Site",
  good_rating: "Iyi Puan",
  site_unreachable: "Site Erisim Disi",
  services_unclear: "Hizmetler Belirsiz",
  uncrawled_website: "Site Taranmadi",
};

function SimpleMarkdown({ content }: { content: string }) {
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
          className="border-l-4 border-zinc-300 pl-3 py-1 my-2 text-sm text-zinc-500 italic"
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
          className="bg-zinc-100 rounded-md p-3 my-2 text-xs text-zinc-700 overflow-x-auto"
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
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={key++} className="font-semibold text-zinc-800">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function AnalysisPanel({ opp }: { opp: SalesOpportunityData }) {
  const reasonCodes = (opp.reasonCodes || []) as string[];
  const painPoints = (opp.likelyPainPoints || []) as string[];

  return (
    <div className="rounded-lg border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h4 className="font-semibold text-zinc-800">AI Analiz Sonuclari</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-md bg-white border border-zinc-100 p-3 text-center">
          <div
            className={`text-2xl font-bold ${
              opp.opportunityScore >= 60
                ? "text-emerald-600"
                : opp.opportunityScore >= 35
                  ? "text-amber-600"
                  : "text-zinc-500"
            }`}
          >
            {opp.opportunityScore}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">Firsat Skoru</div>
        </div>
        <div className="rounded-md bg-white border border-zinc-100 p-3 text-center">
          <div className="text-lg font-bold text-zinc-800">
            {opp.suggestedOffer}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">Onerilen Paket</div>
        </div>
        <div className="rounded-md bg-white border border-zinc-100 p-3 text-center">
          <div className="text-lg font-bold text-zinc-800">
            {opp.expectedPriceBand || "N/A"}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">Fiyat Araligi</div>
        </div>
      </div>

      {opp.whyGoodTarget && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Neden Iyi Hedef
          </p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {opp.whyGoodTarget}
          </p>
        </div>
      )}

      {reasonCodes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
            Tespit Edilen Sorunlar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasonCodes.map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">
                {REASON_LABELS[code] || code}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {painPoints.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Aci Noktalari
          </p>
          <ul className="space-y-1">
            {painPoints.map((point, idx) => (
              <li key={idx} className="text-sm text-zinc-600 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5">&#x2022;</span>
                {REASON_LABELS[point] || point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {opp.bestSalesAngle && (
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">
            Satis Acisi
          </p>
          <p className="text-sm text-zinc-700 italic">{opp.bestSalesAngle}</p>
        </div>
      )}

      {opp.personalizedFirstMessage && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-xs font-medium text-emerald-700 uppercase tracking-wider mb-1">
            Kisisellestirilmis Mesaj
          </p>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {opp.personalizedFirstMessage}
          </p>
        </div>
      )}
    </div>
  );
}

function WebsitePlanPanel({
  item,
  onPlanUpdate,
}: {
  item: WatchlistItem;
  onPlanUpdate: (itemId: string, plan: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/website-plan/${item.lead.id}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        onPlanUpdate(item.id, data.plan);
        setShowPlan(true);
      }
    } catch (err) {
      console.error("Plan generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!planRef.current) return;
    const { default: html2canvas } = await import("html2canvas-pro");
    const { default: jsPDF } = await import("jspdf");

    const el = planRef.current;
    const prevMaxH = el.style.maxHeight;
    const prevOverflow = el.style.overflow;
    el.style.maxHeight = "none";
    el.style.overflow = "visible";

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    el.style.maxHeight = prevMaxH;
    el.style.overflow = prevOverflow;

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    let position = 0;
    let remaining = imgHeight;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    remaining -= pageHeight;

    while (remaining > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      remaining -= pageHeight;
    }

    pdf.save(`${item.lead.businessName.replace(/\s+/g, "_")}_website_plan.pdf`);
  };

  const handleDownloadMD = () => {
    if (!item.websitePlan) return;
    const blob = new Blob([item.websitePlan], { type: "text/markdown" });
    const link = document.createElement("a");
    link.download = `${item.lead.businessName.replace(/\s+/g, "_")}_website_plan.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="border-t border-zinc-100 pt-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <h4 className="font-semibold text-zinc-800">AI Website Plan Ajani</h4>
        </div>
        <div className="flex items-center gap-2">
          {item.websitePlan && (
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
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                MD
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleDownloadPDF}
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </Button>
            </>
          )}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generating ? (
              <>
                <div className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white mr-1.5" />
                Plan Olusturuluyor...
              </>
            ) : item.websitePlan ? (
              "Yeniden Olustur"
            ) : (
              "Website Plani Olustur"
            )}
          </Button>
        </div>
      </div>

      {showPlan && item.websitePlan && (
        <div className="mt-3">
          <div
            ref={planRef}
            className="rounded-lg border border-zinc-200 bg-white p-6 max-h-[600px] overflow-y-auto"
          >
            <SimpleMarkdown content={item.websitePlan} />
          </div>
        </div>
      )}
    </div>
  );
}

function WatchlistCard({
  item,
  onRemove,
  onReviewsUpdate,
  onPlanUpdate,
  onRefresh,
}: {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onReviewsUpdate: (leadId: string, reviews: GoogleReviewData[]) => void;
  onPlanUpdate: (itemId: string, plan: string) => void;
  onRefresh: () => void;
}) {
  const [siteUrl, setSiteUrl] = useState(item.siteUrl || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reviews = item.lead.googleReviews || [];
  const opp = item.lead.salesOpportunity;

  const saveField = useCallback(
    async (field: "siteUrl" | "notes", value: string) => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/watchlist/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("idle");
      }
    },
    [item.id]
  );

  const debouncedSave = useCallback(
    (field: "siteUrl" | "notes", value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveField(field, value), 800);
    },
    [saveField]
  );

  const handleSiteUrlChange = (value: string) => {
    setSiteUrl(value);
    debouncedSave("siteUrl", value);
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    debouncedSave("notes", value);
  };

  const fetchReviews = async (refresh = false) => {
    setReviewsLoading(true);
    try {
      const url = `/api/reviews/${item.lead.id}${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        onReviewsUpdate(item.lead.id, data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleToggleReviews = () => {
    const willOpen = !reviewsOpen;
    setReviewsOpen(willOpen);
    if (willOpen && reviews.length === 0) {
      fetchReviews();
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: item.lead.id }),
      });
      setTimeout(() => {
        onRefresh();
        setAnalyzing(false);
        setAnalysisOpen(true);
      }, 1500);
    } catch {
      setAnalyzing(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        ).toFixed(1)
      : null;

  const isAnalyzing =
    analyzing || item.lead.analyzeStatus === "ANALYZING";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              <a
                href={`/leads/${item.lead.id}`}
                className="hover:underline"
              >
                {item.lead.businessName}
              </a>
            </CardTitle>
            <p className="text-sm text-zinc-500 mt-1">
              {item.lead.formattedAddress}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === "saving" && (
              <span className="text-xs text-zinc-400">Kaydediliyor...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-green-500">Kaydedildi</span>
            )}
            {item.lead.borough && (
              <Badge variant="outline">{item.lead.borough}</Badge>
            )}
            {opp && (
              <Badge
                variant={
                  opp.opportunityScore >= 60
                    ? "success"
                    : opp.opportunityScore >= 35
                      ? "warning"
                      : "secondary"
                }
              >
                Skor: {opp.opportunityScore}
              </Badge>
            )}
            {isAnalyzing && (
              <Badge variant="outline" className="animate-pulse">
                Analiz Ediliyor...
              </Badge>
            )}
            {!opp && !isAnalyzing && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-indigo-600"
                onClick={handleAnalyze}
              >
                Analiz Et
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Yapilan Site URL
            </label>
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => handleSiteUrlChange(e.target.value)}
              placeholder="https://example.com"
              className="w-full mt-1 h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Mevcut Website
            </label>
            {item.lead.websiteUrl ? (
              <a
                href={item.lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-zinc-600 hover:underline mt-2 truncate"
              >
                {item.lead.websiteUrl}
              </a>
            ) : (
              <p className="text-sm text-zinc-300 mt-2">Yok</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Notlar
          </label>
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Notlarinizi yazin..."
            rows={3}
            className="w-full mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:bg-white resize-none transition-colors"
          />
        </div>

        {item.lead.phone && (
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Telefon
            </label>
            <p className="text-sm text-zinc-700 mt-1">{item.lead.phone}</p>
          </div>
        )}

        {/* AI Analysis Section */}
        {opp && (
          <div className="border-t border-zinc-100 pt-3">
            <button
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors w-full"
            >
              <svg
                className={`w-4 h-4 transition-transform ${analysisOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              AI Analiz Sonuclari
              <Badge
                variant={
                  opp.opportunityScore >= 60
                    ? "success"
                    : opp.opportunityScore >= 35
                      ? "warning"
                      : "secondary"
                }
                className="ml-1"
              >
                {opp.opportunityScore}/100
              </Badge>
            </button>
            {analysisOpen && (
              <div className="mt-3">
                <AnalysisPanel opp={opp} />
              </div>
            )}
          </div>
        )}

        {/* Google Reviews Section */}
        <div className="border-t border-zinc-100 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleToggleReviews}
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${reviewsOpen ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Google Yorumlari
              {reviews.length > 0 && (
                <span className="text-xs text-zinc-400">
                  ({reviews.length} yorum
                  {avgRating && ` · ${avgRating}`})
                </span>
              )}
            </button>
            {reviewsOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => fetchReviews(true)}
                disabled={reviewsLoading}
              >
                {reviewsLoading ? "Yukleniyor..." : "Yenile"}
              </Button>
            )}
          </div>

          {reviewsOpen && (
            <div className="mt-3 space-y-3">
              {reviewsLoading && reviews.length === 0 && (
                <div className="text-center py-4">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                  <p className="text-xs text-zinc-400 mt-2">
                    Yorumlar yukleniyor...
                  </p>
                </div>
              )}

              {!reviewsLoading && reviews.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-3">
                  Bu isletme icin Google yorumu bulunamadi.
                </p>
              )}

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {review.authorPhoto ? (
                        <img
                          src={review.authorPhoto}
                          alt={review.authorName}
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-medium text-zinc-500">
                          {review.authorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-zinc-700">
                        {review.authorName}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {review.relativeTime}
                    </span>
                  </div>
                  <StarRating rating={review.rating} />
                  {review.text && (
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {review.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Website Plan Section */}
        <WebsitePlanPanel item={item} onPlanUpdate={onPlanUpdate} />

        <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
          <a href={`/leads/${item.lead.id}`}>
            <Button size="sm" variant="ghost">
              Detay
            </Button>
          </a>
          {opp && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? "Analiz Ediliyor..." : "Yeniden Analiz Et"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
            onClick={() => onRemove(item.id)}
          >
            Kaldir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
