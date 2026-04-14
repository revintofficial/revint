"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Star,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Globe,
  Bot,
  BookmarkX,
} from "lucide-react";
import { toast } from "sonner";

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
  selectedOffer: "STARTER" | "GROWTH" | "SALES" | null;
  meetingResult: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null;
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

type MeetingFilter = "ALL" | "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | "PENDING";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [meetingFilter, setMeetingFilter] = useState<MeetingFilter>("ALL");

  const handleExportExcel = async () => {
    if (items.length === 0) return;
    setExportingExcel(true);
    try {
      const XLSX = await import("xlsx");

      const businessNames = items.map((item) => item.lead.businessName);

      const fieldRows: { label: string; values: (string | number)[] }[] = [
        { label: "Adres", values: items.map((i) => i.lead.formattedAddress) },
        { label: "İlçe", values: items.map((i) => i.lead.borough || "") },
        { label: "Telefon", values: items.map((i) => i.lead.phone || "") },
        { label: "Mevcut Website", values: items.map((i) => i.lead.websiteUrl || "") },
        { label: "Yapılan Site", values: items.map((i) => i.siteUrl || "") },
        { label: "Notlar", values: items.map((i) => i.notes || "") },
        { label: "Seçilen Paket", values: items.map((i) => i.selectedOffer || "") },
        {
          label: "Görüşme Sonucu",
          values: items.map((i) =>
            i.meetingResult === "POSITIVE" ? "Olumlu" : i.meetingResult === "NEGATIVE" ? "Olumsuz" : i.meetingResult === "IN_PROGRESS" ? "Devam Ediyor" : "Bekleyen"
          ),
        },
        { label: "Fırsat Skoru", values: items.map((i) => i.lead.salesOpportunity?.opportunityScore ?? "") },
        { label: "Önerilen Paket", values: items.map((i) => i.lead.salesOpportunity?.suggestedOffer || "") },
        { label: "Fiyat Aralığı", values: items.map((i) => i.lead.salesOpportunity?.expectedPriceBand || "") },
        { label: "Durum", values: items.map((i) => i.lead.salesOpportunity?.status || "") },
        { label: "Neden İyi Hedef", values: items.map((i) => i.lead.salesOpportunity?.whyGoodTarget || "") },
        {
          label: "Sorunlar",
          values: items.map((i) =>
            ((i.lead.salesOpportunity?.reasonCodes || []) as string[]).map((c) => REASON_LABELS[c] || c).join(", ")
          ),
        },
        {
          label: "Acı Noktaları",
          values: items.map((i) =>
            ((i.lead.salesOpportunity?.likelyPainPoints || []) as string[]).map((p) => REASON_LABELS[p] || p).join(", ")
          ),
        },
        { label: "Satış Açısı", values: items.map((i) => i.lead.salesOpportunity?.bestSalesAngle || "") },
        { label: "Kişiselleştirilmiş Mesaj", values: items.map((i) => i.lead.salesOpportunity?.personalizedFirstMessage || "") },
        {
          label: "Google Yorum Sayısı",
          values: items.map((i) => (i.lead.googleReviews || []).length),
        },
        {
          label: "Ortalama Puan",
          values: items.map((i) => {
            const r = i.lead.googleReviews || [];
            return r.length > 0 ? (r.reduce((s, rv) => s + rv.rating, 0) / r.length).toFixed(1) : "";
          }),
        },
        { label: "Eklenme Tarihi", values: items.map((i) => new Date(i.createdAt).toLocaleDateString("tr-TR")) },
      ];

      const header: (string | number)[] = ["", ...businessNames];
      const dataRows = fieldRows.map((f) => [f.label, ...f.values]);
      const sheetData = [header, ...dataRows];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      const colWidths = [
        { wch: 25 },
        ...businessNames.map((name) => ({ wch: Math.max(name.length + 2, 20) })),
      ];
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Watchlist");
      XLSX.writeFile(wb, `watchlist_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (items.length === 0) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");

      const toBase64 = async (url: string) => {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const chunks: string[] = [];
        for (let i = 0; i < bytes.length; i += 8192) {
          chunks.push(String.fromCharCode(...bytes.slice(i, i + 8192)));
        }
        return btoa(chunks.join(""));
      };

      const [regularB64, boldB64] = await Promise.all([
        toBase64("/fonts/Roboto-Regular.ttf"),
        toBase64("/fonts/Roboto-Bold.ttf"),
      ]);

      const pdf = new jsPDF("p", "mm", "a4");

      pdf.addFileToVFS("Roboto-Regular.ttf", regularB64);
      pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      pdf.addFileToVFS("Roboto-Bold.ttf", boldB64);
      pdf.addFont("Roboto-Bold.ttf", "Roboto", "bold");
      pdf.setFont("Roboto", "normal");

      const pageW = 210;
      const pageH = 297;
      const margin = 15;
      const contentW = pageW - margin * 2;
      let y = margin;

      const checkPage = (needed: number) => {
        if (y + needed > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
      };

      const addTitle = (_text: string, size: number, color: [number, number, number] = [24, 24, 27]) => {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.setFont("Roboto", "bold");
      };

      const addBody = (size = 10, color: [number, number, number] = [63, 63, 70]) => {
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.setFont("Roboto", "normal");
      };

      const writeWrapped = (text: string, indent = 0) => {
        const lines = pdf.splitTextToSize(text, contentW - indent);
        for (const line of lines) {
          checkPage(5);
          pdf.text(line, margin + indent, y);
          y += 5;
        }
      };

      addTitle("Watchlist Raporu", 20);
      pdf.text("Watchlist Raporu", margin, y);
      y += 8;
      addBody(10, [113, 113, 122]);
      pdf.text(`${items.length} lead | ${new Date().toLocaleDateString("tr-TR")}`, margin, y);
      y += 4;

      const analyzed = items.filter((i) => i.lead.salesOpportunity);
      if (analyzed.length > 0) {
        const avg = Math.round(
          analyzed.reduce((s, i) => s + (i.lead.salesOpportunity?.opportunityScore || 0), 0) / analyzed.length
        );
        pdf.text(`Ortalama Fırsat Skoru: ${avg}/100`, margin, y);
      }
      y += 8;
      pdf.setDrawColor(228, 228, 231);
      pdf.line(margin, y, pageW - margin, y);
      y += 8;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const opp = item.lead.salesOpportunity;
        const reviews = item.lead.googleReviews || [];

        checkPage(30);

        addTitle(`${idx + 1}. ${item.lead.businessName}`, 14);
        pdf.text(`${idx + 1}. ${item.lead.businessName}`, margin, y);
        y += 6;

        if (opp) {
          const scoreColor: [number, number, number] =
            opp.opportunityScore >= 60 ? [5, 150, 105] : opp.opportunityScore >= 35 ? [217, 119, 6] : [113, 113, 122];
          pdf.setFontSize(10);
          pdf.setFont("Roboto", "bold");
          pdf.setTextColor(...scoreColor);
          pdf.text(`Skor: ${opp.opportunityScore}/100`, pageW - margin - 25, y - 6);
        }

        addBody(9, [113, 113, 122]);
        pdf.text(item.lead.formattedAddress, margin, y);
        y += 5;

        if (item.lead.borough) {
          pdf.text(`İlçe: ${item.lead.borough}`, margin, y);
          y += 5;
        }

        if (item.lead.phone) {
          pdf.text(`Tel: ${item.lead.phone}`, margin, y);
          y += 5;
        }

        if (item.lead.websiteUrl) {
          pdf.setTextColor(79, 70, 229);
          pdf.text(`Web: ${item.lead.websiteUrl}`, margin, y);
          y += 5;
        }

        if (item.siteUrl) {
          pdf.setTextColor(79, 70, 229);
          pdf.text(`Yapılan Site: ${item.siteUrl}`, margin, y);
          y += 5;
        }

        if (item.notes) {
          y += 2;
          addBody(9, [63, 63, 70]);
          addTitle("Notlar:", 9);
          pdf.text("Notlar:", margin, y);
          y += 4;
          addBody(9);
          writeWrapped(item.notes, 2);
        }

        if (opp) {
          y += 3;
          checkPage(25);
          addTitle("AI Analiz", 11, [24, 24, 27]);
          pdf.text("AI Analiz", margin, y);
          y += 5;
          addBody(9);

          pdf.text(`Önerilen Paket: ${opp.suggestedOffer}`, margin + 2, y);
          y += 5;
          if (opp.expectedPriceBand) {
            pdf.text(`Fiyat Aralığı: ${opp.expectedPriceBand}`, margin + 2, y);
            y += 5;
          }
          if (opp.status) {
            pdf.text(`Durum: ${opp.status}`, margin + 2, y);
            y += 5;
          }

          if (opp.whyGoodTarget) {
            checkPage(10);
            addTitle("Neden İyi Hedef:", 9, [63, 63, 70]);
            pdf.text("Neden İyi Hedef:", margin + 2, y);
            y += 4;
            addBody(9);
            writeWrapped(opp.whyGoodTarget, 4);
          }

          const reasonCodes = opp.reasonCodes || [];
          if (reasonCodes.length > 0) {
            checkPage(8);
            addTitle("Sorunlar:", 9, [63, 63, 70]);
            pdf.text("Sorunlar:", margin + 2, y);
            y += 4;
            addBody(9);
            const labels = reasonCodes.map((c) => REASON_LABELS[c] || c).join(", ");
            writeWrapped(labels, 4);
          }

          const painPoints = opp.likelyPainPoints || [];
          if (painPoints.length > 0) {
            checkPage(8);
            addTitle("Acı Noktaları:", 9, [63, 63, 70]);
            pdf.text("Acı Noktaları:", margin + 2, y);
            y += 4;
            addBody(9);
            for (const p of painPoints) {
              checkPage(5);
              pdf.text(`• ${REASON_LABELS[p] || p}`, margin + 4, y);
              y += 4.5;
            }
          }

          if (opp.bestSalesAngle) {
            checkPage(8);
            addTitle("Satış Açısı:", 9, [63, 63, 70]);
            pdf.text("Satış Açısı:", margin + 2, y);
            y += 4;
            addBody(9);
            writeWrapped(opp.bestSalesAngle, 4);
          }

          if (opp.personalizedFirstMessage) {
            checkPage(10);
            addTitle("Kişiselleştirilmiş Mesaj:", 9, [5, 150, 105]);
            pdf.text("Kişiselleştirilmiş Mesaj:", margin + 2, y);
            y += 4;
            addBody(9, [6, 95, 70]);
            writeWrapped(opp.personalizedFirstMessage, 4);
          }
        }

        if (reviews.length > 0) {
          y += 3;
          checkPage(15);
          const avgR = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
          addTitle(`Google Yorumları (${reviews.length} yorum, ort: ${avgR})`, 9, [113, 113, 122]);
          pdf.text(`Google Yorumları (${reviews.length} yorum, ort: ${avgR})`, margin, y);
          y += 5;

          const maxReviews = Math.min(reviews.length, 5);
          for (let ri = 0; ri < maxReviews; ri++) {
            const r = reviews[ri];
            checkPage(12);
            addBody(8, [113, 113, 122]);
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            pdf.text(`${r.authorName}  ${stars}  ${r.relativeTime}`, margin + 2, y);
            y += 4;
            if (r.text) {
              addBody(8, [82, 82, 91]);
              const trimmed = r.text.length > 200 ? r.text.slice(0, 200) + "..." : r.text;
              writeWrapped(trimmed, 4);
            }
            y += 2;
          }
          if (reviews.length > 5) {
            addBody(8, [161, 161, 170]);
            pdf.text(`... ve ${reviews.length - 5} yorum daha`, margin + 2, y);
            y += 5;
          }
        }

        y += 4;
        pdf.setDrawColor(228, 228, 231);
        pdf.line(margin, y, pageW - margin, y);
        y += 8;
      }

      pdf.save(`watchlist_raporu_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

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

  const handleOfferChange = (itemId: string, offer: "STARTER" | "GROWTH" | "SALES" | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selectedOffer: offer } : item
      )
    );
  };

  const handleMeetingResultChange = (itemId: string, result: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, meetingResult: result } : item
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

  const positiveCount = items.filter((i) => i.meetingResult === "POSITIVE").length;
  const negativeCount = items.filter((i) => i.meetingResult === "NEGATIVE").length;
  const inProgressCount = items.filter((i) => i.meetingResult === "IN_PROGRESS").length;
  const pendingCount = items.filter((i) => !i.meetingResult).length;

  const filteredItems = items.filter((item) => {
    if (meetingFilter === "ALL") return true;
    if (meetingFilter === "POSITIVE") return item.meetingResult === "POSITIVE";
    if (meetingFilter === "NEGATIVE") return item.meetingResult === "NEGATIVE";
    if (meetingFilter === "IN_PROGRESS") return item.meetingResult === "IN_PROGRESS";
    if (meetingFilter === "PENDING") return !item.meetingResult;
    return true;
  });

  const FILTER_TABS: { value: MeetingFilter; label: string; count: number }[] = [
    { value: "ALL", label: "Tumunu", count: items.length },
    { value: "POSITIVE", label: "Olumlu", count: positiveCount },
    { value: "IN_PROGRESS", label: "Devam Ediyor", count: inProgressCount },
    { value: "NEGATIVE", label: "Olumsuz", count: negativeCount },
    { value: "PENDING", label: "Bekleyen", count: pendingCount },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Watchlist"
        subtitle={loading ? "Yukleniyor..." : `${items.length} lead takip ediliyor`}
        actions={
          !loading && items.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                  {totalScore}
                </div>
                <span className="text-slate-500">Ort. Skor</span>
              </div>
              {unanalyzedCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleAnalyzeAll}
                  disabled={analyzingAll}
                >
                  {analyzingAll ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Analiz Ediliyor...
                    </>
                  ) : (
                    `Tumunu Analiz Et (${unanalyzedCount})`
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportExcel}
                disabled={exportingExcel}
              >
                {exportingExcel ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Hazirlaniyor...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    Excel
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Hazirlaniyor...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-1.5" />
                    PDF Raporu
                  </>
                )}
              </Button>
            </>
          ) : undefined
        }
      />

      {!loading && items.filter((i) => i.selectedOffer).length > 0 && (
        <div className="flex items-center gap-2">
          {(["STARTER", "GROWTH"] as const).map((offer) => {
            const count = items.filter((i) => i.selectedOffer === offer).length;
            if (count === 0) return null;
            const colors = {
              STARTER: "bg-emerald-100 text-emerald-700",
              GROWTH: "bg-blue-100 text-blue-700",
            };
            return (
              <span key={offer} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${colors[offer]}`}>
                {offer} <span className="font-bold">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex items-center gap-1 bg-slate-100/80 backdrop-blur-sm rounded-xl p-1 w-fit max-w-full overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMeetingFilter(tab.value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                meetingFilter === tab.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                meetingFilter === tab.value
                  ? "bg-slate-100/80"
                  : "bg-slate-200 text-slate-500"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <BookmarkX className="w-12 h-12 mx-auto mb-3 text-slate-300" />
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

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <p className="text-lg font-medium">
                Bu filtreye uygun lead bulunamadi
              </p>
              <p className="text-sm mt-1">
                Farkli bir filtre secmeyi deneyin.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {filteredItems.map((item) => (
          <WatchlistCard
            key={item.id}
            item={item}
            onRemove={handleRemove}
            onReviewsUpdate={handleReviewsUpdate}
            onPlanUpdate={handlePlanUpdate}
            onOfferChange={handleOfferChange}
            onMeetingResultChange={handleMeetingResultChange}
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
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${star <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"}`}
        />
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
  no_contact_form: "Iletisim Formu Yok",
  no_analytics: "Analytics Yok",
  weak_security_headers: "Zayif Guvenlik",
  no_open_graph: "Open Graph Yok",
  no_structured_data: "Structured Data Yok",
  accessibility_issues: "Erisilebilirlik Sorunlari",
  no_pwa: "PWA Yok",
};

function AnalysisPanel({ opp }: { opp: SalesOpportunityData }) {
  const reasonCodes = (opp.reasonCodes || []) as string[];
  const painPoints = (opp.likelyPainPoints || []) as string[];

  return (
    <div className="rounded-xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-slate-700" />
        <h4 className="font-semibold text-slate-800">AI Analiz Sonuclari</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-md bg-white border border-slate-200/60 p-3 text-center">
          <div
            className={`text-2xl font-bold ${
              opp.opportunityScore >= 60
                ? "text-emerald-600"
                : opp.opportunityScore >= 35
                  ? "text-amber-600"
                  : "text-slate-500"
            }`}
          >
            {opp.opportunityScore}
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mt-0.5">Firsat Skoru</div>
        </div>
        <div className="rounded-md bg-white border border-slate-200/60 p-3 text-center">
          <div className="text-lg font-bold text-slate-800">
            {opp.suggestedOffer}
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mt-0.5">Onerilen Paket</div>
        </div>
        <div className="rounded-md bg-white border border-slate-200/60 p-3 text-center">
          <div className="text-lg font-bold text-slate-800">
            {opp.expectedPriceBand || "N/A"}
          </div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mt-0.5">Fiyat Araligi</div>
        </div>
      </div>

      {opp.whyGoodTarget && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Neden Iyi Hedef
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {opp.whyGoodTarget}
          </p>
        </div>
      )}

      {reasonCodes.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">
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
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Aci Noktalari
          </p>
          <ul className="space-y-1">
            {painPoints.map((point, idx) => (
              <li key={idx} className="text-sm text-slate-600 flex items-start gap-1.5">
                <span className="text-rose-400 mt-0.5">&#x2022;</span>
                {REASON_LABELS[point] || point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {opp.bestSalesAngle && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
            Satis Acisi
          </p>
          <p className="text-sm text-slate-700 italic">{opp.bestSalesAngle}</p>
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
  const [copied, setCopied] = useState(false);
  const planRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    if (!item.websitePlan) return;
    try {
      await navigator.clipboard.writeText(item.websitePlan);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = item.websitePlan;
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
    <div className="border-t border-slate-200/60 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600 shrink-0" />
          <h4 className="font-semibold text-slate-800 text-sm sm:text-base">AI Website Plan Ajani</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.websitePlan && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => setShowPlan(!showPlan)}
              >
                {showPlan ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showPlan ? "Gizle" : "Goster"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Kopyalandi!" : "Kopyala"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleDownloadMD}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                MD
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleDownloadPDF}
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
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
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
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
            className="rounded-xl border border-slate-200/60 bg-white p-6 max-h-[600px] overflow-y-auto select-text"
          >
            <MarkdownRenderer content={item.websitePlan} />
          </div>
        </div>
      )}
    </div>
  );
}

const OFFER_PACKAGES = [
  {
    value: "STARTER" as const,
    label: "Starter",
    price: "£500–800",
    color: "emerald",
    description: "Tek sayfa, mobil uyumlu site",
  },
  {
    value: "GROWTH" as const,
    label: "Growth",
    price: "£800–1500",
    color: "blue",
    description: "Cok sayfa, SEO, online satis",
  },
] as const;

function OfferSelector({
  itemId,
  selectedOffer,
  suggestedOffer,
  onOfferChange,
}: {
  itemId: string;
  selectedOffer: "STARTER" | "GROWTH" | "SALES" | null;
  suggestedOffer?: string | null;
  onOfferChange: (itemId: string, offer: "STARTER" | "GROWTH" | "SALES" | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (offer: "STARTER" | "GROWTH" | "SALES") => {
    const newValue = selectedOffer === offer ? null : offer;
    onOfferChange(itemId, newValue);
    setSaving(true);
    try {
      await fetch(`/api/watchlist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOffer: newValue }),
      });
    } catch {
      onOfferChange(itemId, selectedOffer);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Teklif Paketi
        </label>
        {saving && (
          <span className="text-[10px] text-slate-400 animate-pulse">kaydediliyor...</span>
        )}
        {suggestedOffer && !selectedOffer && (
          <span className="text-[10px] text-slate-400">
            AI onerisi: {suggestedOffer}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OFFER_PACKAGES.map((pkg) => {
          const isSelected = selectedOffer === pkg.value;
          const isSuggested = suggestedOffer === pkg.value;
          const colorMap = {
            emerald: {
              selected: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
              hover: "hover:border-emerald-300 hover:bg-emerald-50/50",
              dot: "bg-emerald-500",
              label: "text-emerald-700",
              price: "text-emerald-600",
            },
            blue: {
              selected: "border-blue-500 bg-blue-50 ring-2 ring-blue-500/20",
              hover: "hover:border-blue-300 hover:bg-blue-50/50",
              dot: "bg-blue-500",
              label: "text-blue-700",
              price: "text-blue-600",
            },
          };
          const colors = colorMap[pkg.color];

          return (
            <button
              key={pkg.value}
              onClick={() => handleSelect(pkg.value)}
              className={`relative rounded-xl border p-2.5 text-left transition-all ${
                isSelected
                  ? colors.selected
                  : `border-slate-200/60 bg-white ${colors.hover}`
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className={`w-4 h-4 ${colors.label}`} />
                </div>
              )}
              {isSuggested && !isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <span className="text-[9px] font-medium text-slate-400 bg-slate-100/80 px-1 rounded">AI</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-sm font-semibold ${isSelected ? colors.label : "text-slate-700"}`}>
                  {pkg.label}
                </span>
              </div>
              <div className={`text-xs font-medium ${isSelected ? colors.price : "text-slate-500"}`}>
                {pkg.price}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                {pkg.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MeetingResultSelector({
  itemId,
  meetingResult,
  onMeetingResultChange,
}: {
  itemId: string;
  meetingResult: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null;
  onMeetingResultChange: (itemId: string, result: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null) => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (result: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS") => {
    const newValue = meetingResult === result ? null : result;
    onMeetingResultChange(itemId, newValue);
    setSaving(true);
    try {
      await fetch(`/api/watchlist/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingResult: newValue }),
      });
    } catch {
      onMeetingResultChange(itemId, meetingResult);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Gorusme Sonucu
        </label>
        {saving && (
          <span className="text-[10px] text-slate-400 animate-pulse">kaydediliyor...</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleSelect("POSITIVE")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "POSITIVE"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
              : "border-slate-200/60 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Olumlu Bitti
          {meetingResult === "POSITIVE" && (
            <Check className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => handleSelect("IN_PROGRESS")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "IN_PROGRESS"
              ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20"
              : "border-slate-200/60 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Devam Ediyor
          {meetingResult === "IN_PROGRESS" && (
            <Check className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => handleSelect("NEGATIVE")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "NEGATIVE"
              ? "border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20"
              : "border-slate-200/60 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50/50"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Olumsuz Bitti
          {meetingResult === "NEGATIVE" && (
            <Check className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}

function WatchlistCard({
  item,
  onRemove,
  onReviewsUpdate,
  onPlanUpdate,
  onOfferChange,
  onMeetingResultChange,
  onRefresh,
}: {
  item: WatchlistItem;
  onRemove: (id: string) => void;
  onReviewsUpdate: (leadId: string, reviews: GoogleReviewData[]) => void;
  onPlanUpdate: (itemId: string, plan: string) => void;
  onOfferChange: (itemId: string, offer: "STARTER" | "GROWTH" | "SALES" | null) => void;
  onMeetingResultChange: (itemId: string, result: "POSITIVE" | "NEGATIVE" | "IN_PROGRESS" | null) => void;
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
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
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

  const hasValidSiteUrl = (() => {
    if (!siteUrl || !siteUrl.trim()) return false;
    try {
      const urlStr = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
      const parsed = new URL(urlStr);
      return parsed.hostname.includes(".");
    } catch {
      return false;
    }
  })();

  return (
    <>
    <Card className={`overflow-hidden rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300${hasValidSiteUrl ? " bg-emerald-50/70 border-emerald-200" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">
              <Link
                href={`/leads/${item.lead.id}`}
                className="hover:underline"
              >
                {item.lead.businessName}
              </Link>
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1 truncate">
              {item.lead.formattedAddress}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {saveStatus === "saving" && (
              <span className="text-xs text-slate-400">Kaydediliyor...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-green-500">Kaydedildi</span>
            )}
            {item.meetingResult === "POSITIVE" && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                Olumlu
              </Badge>
            )}
            {item.meetingResult === "IN_PROGRESS" && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                Devam Ediyor
              </Badge>
            )}
            {item.meetingResult === "NEGATIVE" && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                Olumsuz
              </Badge>
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
            {item.websitePlan && (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                Plan Hazir
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
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Yapilan Site URL
            </label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="url"
                value={siteUrl}
                onChange={(e) => handleSiteUrlChange(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 h-9"
              />
              {siteUrl && (
                <a
                  href={siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 h-9 w-9 rounded-md border border-slate-200/60 bg-slate-50/80 hover:bg-slate-100/80 flex items-center justify-center transition-colors"
                  title="Siteyi ac"
                >
                  <Globe className="w-4 h-4 text-slate-600" />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Mevcut Website
            </label>
            {item.lead.websiteUrl ? (
              <a
                href={item.lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-slate-600 hover:underline mt-2 truncate"
              >
                {item.lead.websiteUrl}
              </a>
            ) : (
              <p className="text-sm text-slate-300 mt-2">Yok</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Notlar
          </label>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Notlarinizi yazin..."
            rows={3}
            className="w-full mt-1 resize-none"
          />
        </div>

        <OfferSelector
          itemId={item.id}
          selectedOffer={item.selectedOffer}
          suggestedOffer={opp?.suggestedOffer}
          onOfferChange={onOfferChange}
        />

        <MeetingResultSelector
          itemId={item.id}
          meetingResult={item.meetingResult}
          onMeetingResultChange={onMeetingResultChange}
        />

        {item.lead.phone && (
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Telefon
            </label>
            <p className="text-sm text-slate-700 mt-1">{item.lead.phone}</p>
          </div>
        )}

        {opp && (
          <div className="border-t border-slate-200/60 pt-3">
            <button
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors w-full"
            >
              {analysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

        <div className="border-t border-slate-200/60 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleToggleReviews}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              {reviewsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Google Yorumlari
              {reviews.length > 0 && (
                <span className="text-xs text-slate-400">
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
                {reviewsLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Yukleniyor...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Yenile
                  </>
                )}
              </Button>
            )}
          </div>

          {reviewsOpen && (
            <div className="mt-3 space-y-3">
              {reviewsLoading && reviews.length === 0 && (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">
                    Yorumlar yukleniyor...
                  </p>
                </div>
              )}

              {!reviewsLoading && reviews.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-3">
                  Bu isletme icin Google yorumu bulunamadi.
                </p>
              )}

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-3 space-y-1.5"
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
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-500">
                          {review.authorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700">
                        {review.authorName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {review.relativeTime}
                    </span>
                  </div>
                  <StarRating rating={review.rating} />
                  {review.text && (
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {review.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <WebsitePlanPanel item={item} onPlanUpdate={onPlanUpdate} />

        <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
          <Link href={`/leads/${item.lead.id}`}>
            <Button size="sm" variant="ghost">
              Detay
            </Button>
          </Link>
          {opp && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Analiz Ediliyor...
                </>
              ) : (
                "Yeniden Analiz Et"
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 ml-auto"
            onClick={() => setRemoveDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Kaldir
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Emin misiniz?</DialogTitle>
          <DialogDescription className="text-left pt-1">
            <span className="font-medium text-slate-700">{item.lead.businessName}</span>{" "}
            isletmesini watchlist&apos;ten kaldirmak uzeresiniz. Bu islemi onayliyor musunuz?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setRemoveDialogOpen(false)}>
            Iptal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onRemove(item.id);
              setRemoveDialogOpen(false);
            }}
          >
            Evet, kaldir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
