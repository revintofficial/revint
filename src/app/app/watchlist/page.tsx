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
import { exportToExcel, exportToPDF } from "@/lib/watchlist-export";
import { REASON_LABELS } from "@/lib/labels";

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
type ActiveTab = "leads" | "meetings" | "export";

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAll, setAnalyzingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingSender, setExportingSender] = useState<"smartlead" | "instantly" | null>(null);
  const [meetingFilter, setMeetingFilter] = useState<MeetingFilter>("ALL");
  const [activeTab, setActiveTab] = useState<ActiveTab>("leads");

  const handleExportExcel = async () => {
    if (items.length === 0) return;
    setExportingExcel(true);
    try {
      await exportToExcel(items);
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
      await exportToPDF(items);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSender = async (format: "smartlead" | "instantly") => {
    if (items.length === 0) return;
    setExportingSender(format);
    try {
      const leadIds = items.map((i) => i.lead.id);
      const res = await fetch("/api/leads/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadengine-${format}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const missingEmails = parseInt(res.headers.get("X-Leads-Without-Email") || "0", 10);
      if (missingEmails > 0) {
        toast.warning(
          `${missingEmails} lead${missingEmails === 1 ? "" : "s"} exported without an email. Add emails manually before sending.`
        );
      } else {
        toast.success(`Exported ${items.length} leads for ${format === "smartlead" ? "Smartlead" : "Instantly"}.`);
      }
    } catch (err) {
      console.error("Sender export failed:", err);
      toast.error("Export failed");
    } finally {
      setExportingSender(null);
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
    { value: "ALL", label: "All", count: items.length },
    { value: "POSITIVE", label: "Positive", count: positiveCount },
    { value: "IN_PROGRESS", label: "In Progress", count: inProgressCount },
    { value: "NEGATIVE", label: "Negative", count: negativeCount },
    { value: "PENDING", label: "Pending", count: pendingCount },
  ];

  const TAB_ITEMS: { value: ActiveTab; label: string }[] = [
    { value: "leads", label: "Leads" },
    { value: "meetings", label: "Meetings" },
    { value: "export", label: "Export" },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6">
      <PageHeader
        title="Shortlist"
        subtitle={loading ? "Loading..." : `${items.length} leads on your shortlist`}
        actions={
          !loading && items.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <div className="h-8 w-8 rounded-full bg-[#0A84FF] text-white flex items-center justify-center text-xs font-bold">
                  {totalScore}
                </div>
                <span className="text-white/50">Avg. Score</span>
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
                      Analyzing...
                    </>
                  ) : (
                    `Analyze All (${unanalyzedCount})`
                  )}
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {/* Tabs */}
      {!loading && items.length > 0 && (
        <div className="flex items-center gap-1 bg-white/10 rounded-[10px] p-0.5 w-fit">
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.value
                  ? "bg-white/10 text-white shadow-sm rounded-[8px]"
                  : "text-white/50 hover:text-white rounded-[8px]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === "export" && !loading && items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export Shortlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Push to your sender
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleExportSender("smartlead")}
                disabled={exportingSender !== null}
              >
                {exportingSender === "smartlead" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing Smartlead CSV...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Export to Smartlead</>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleExportSender("instantly")}
                disabled={exportingSender !== null}
              >
                {exportingSender === "instantly" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing Instantly CSV...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" />Export to Instantly</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Includes mockup URL, audit summary, and personalized opener as
                custom variables. Where we couldn&apos;t find an email on the
                site, the row is exported with email blank so you can fill in.
              </p>
            </div>

            <div className="border-t pt-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Reports
              </p>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExportExcel}
                disabled={exportingExcel}
              >
                {exportingExcel ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing...</>
                ) : (
                  <><FileSpreadsheet className="w-4 h-4 mr-2" />Export as Excel</>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" />Export as PDF Report</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab !== "export" && !loading && items.filter((i) => i.selectedOffer).length > 0 && (
        <div className="flex items-center gap-2">
          {(["STARTER", "GROWTH"] as const).map((offer) => {
            const count = items.filter((i) => i.selectedOffer === offer).length;
            if (count === 0) return null;
            const colors = {
              STARTER: "bg-[#30D158]/10 text-[#30D158]",
              GROWTH: "bg-[#0A84FF]/10 text-[#0A84FF]",
            };
            return (
              <span key={offer} className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${colors[offer]}`}>
                {offer} <span className="font-bold">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {activeTab !== "export" && !loading && items.length > 0 && (
        <div className="flex items-center gap-1 bg-white/10 rounded-[10px] p-0.5 w-fit max-w-full overflow-x-auto">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setMeetingFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                meetingFilter === tab.value
                  ? "bg-white/10 text-white shadow-sm rounded-[8px]"
                  : "text-white/50 hover:text-white rounded-[8px]"
              }`}
            >
              {tab.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                meetingFilter === tab.value
                  ? "bg-white/10"
                  : "bg-white/15 text-white/50"
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
            <div key={i} className="rounded-2xl border border-white/10 p-6 space-y-4">
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
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-white/30">
              <BookmarkX className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-lg font-medium">
                No leads on your shortlist yet
              </p>
              <p className="text-sm mt-1">
                Add leads from the Leads page to build your shortlist.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && items.length > 0 && filteredItems.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-white/30">
              <p className="text-lg font-medium">
                No leads match this filter
              </p>
              <p className="text-sm mt-1">
                Try a different filter.
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
          className={`w-3.5 h-3.5 ${star <= rating ? "text-[#FF9F0A] fill-[#FF9500]" : "text-white/20"}`}
        />
      ))}
    </span>
  );
}

// REASON_LABELS imported from @/lib/labels

function AnalysisPanel({ opp }: { opp: SalesOpportunityData }) {
  const reasonCodes = (opp.reasonCodes || []) as string[];
  const painPoints = (opp.likelyPainPoints || []) as string[];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-white/70" />
        <h4 className="font-semibold text-white">AI Analysis Results</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-md bg-white/5 border border-white/10 p-3 text-center">
          <div
            className={`text-2xl font-bold ${
              opp.opportunityScore >= 60
                ? "text-[#30D158]"
                : opp.opportunityScore >= 35
                  ? "text-[#FF9F0A]"
                  : "text-white/50"
            }`}
          >
            {opp.opportunityScore}
          </div>
          <div className="text-[13px] font-medium text-white/50 mt-0.5">Opportunity Score</div>
        </div>
        <div className="rounded-md bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-lg font-bold text-white">
            {opp.suggestedOffer}
          </div>
          <div className="text-[13px] font-medium text-white/50 mt-0.5">Suggested Package</div>
        </div>
        <div className="rounded-md bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-lg font-bold text-white">
            {opp.expectedPriceBand || "N/A"}
          </div>
          <div className="text-[13px] font-medium text-white/50 mt-0.5">Price Range</div>
        </div>
      </div>

      {opp.whyGoodTarget && (
        <div>
          <p className="text-[13px] font-medium text-white/50 mb-1">
            Why Good Target
          </p>
          <p className="text-sm text-white/70 leading-relaxed">
            {opp.whyGoodTarget}
          </p>
        </div>
      )}

      {reasonCodes.length > 0 && (
        <div>
          <p className="text-[13px] font-medium text-white/50 mb-1.5">
            Issues Found
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
          <p className="text-[13px] font-medium text-white/50 mb-1">
            Pain Points
          </p>
          <ul className="space-y-1">
            {painPoints.map((point, idx) => (
              <li key={idx} className="text-sm text-white/60 flex items-start gap-1.5">
                <span className="text-[#FF453A] mt-0.5">&#x2022;</span>
                {REASON_LABELS[point] || point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {opp.bestSalesAngle && (
        <div>
          <p className="text-[13px] font-medium text-white/50 mb-1">
            Sales Angle
          </p>
          <p className="text-sm text-white/70 italic">{opp.bestSalesAngle}</p>
        </div>
      )}

      {opp.personalizedFirstMessage && (
        <div className="rounded-md bg-[#30D158]/10 border border-[#30D158]/20 p-3">
          <p className="text-[13px] font-medium text-[#30D158] mb-1">
            Personalized Message
          </p>
          <p className="text-sm text-[#30D158] leading-relaxed">
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
    <div className="border-t border-white/10 pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#0A84FF] shrink-0" />
          <h4 className="font-semibold text-white text-sm sm:text-base">AI Website Plan</h4>
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
                {showPlan ? "Hide" : "Show"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copied ? "Copied!" : "Copy"}
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
            className="bg-[#0A84FF] hover:bg-[#0063D1] text-white"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Generating Plan...
              </>
            ) : item.websitePlan ? (
              "Regenerate"
            ) : (
              "Generate Website Plan"
            )}
          </Button>
        </div>
      </div>

      {showPlan && item.websitePlan && (
        <div className="mt-3">
          <div
            ref={planRef}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 max-h-[600px] overflow-y-auto select-text"
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
    description: "Single page, mobile-friendly",
  },
  {
    value: "GROWTH" as const,
    label: "Growth",
    price: "£800–1500",
    color: "blue",
    description: "Multi-page, SEO, online sales",
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
        <label className="text-[13px] font-medium text-white/50">
          Offer Package
        </label>
        {saving && (
          <span className="text-[10px] text-white/30 animate-pulse">saving...</span>
        )}
        {suggestedOffer && !selectedOffer && (
          <span className="text-[10px] text-white/30">
            AI suggests: {suggestedOffer}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {OFFER_PACKAGES.map((pkg) => {
          const isSelected = selectedOffer === pkg.value;
          const isSuggested = suggestedOffer === pkg.value;
          const colorMap = {
            emerald: {
              selected: "border-[#30D158] bg-[#30D158]/10 ring-2 ring-[#30D158]/20",
              hover: "hover:border-[#30D158]/40 hover:bg-[#30D158]/5",
              dot: "bg-[#30D158]",
              label: "text-[#30D158]",
              price: "text-[#30D158]",
            },
            blue: {
              selected: "border-[#007AFF] bg-[#0A84FF]/10 ring-2 ring-[#0A84FF]/20",
              hover: "hover:border-[#007AFF]/40 hover:bg-[#0A84FF]/5",
              dot: "bg-[#0A84FF]",
              label: "text-[#0A84FF]",
              price: "text-[#0A84FF]",
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
                  : `border-white/10 bg-white/5 ${colors.hover}`
              }`}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <Check className={`w-4 h-4 ${colors.label}`} />
                </div>
              )}
              {isSuggested && !isSelected && (
                <div className="absolute top-1.5 right-1.5">
                  <span className="text-[9px] font-medium text-white/30 bg-white/10 px-1 rounded">AI</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-sm font-semibold ${isSelected ? colors.label : "text-white/70"}`}>
                  {pkg.label}
                </span>
              </div>
              <div className={`text-xs font-medium ${isSelected ? colors.price : "text-white/50"}`}>
                {pkg.price}
              </div>
              <div className="text-[10px] text-white/30 mt-0.5 leading-tight">
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
        <label className="text-[13px] font-medium text-white/50">
          Meeting Result
        </label>
        {saving && (
          <span className="text-[10px] text-white/30 animate-pulse">saving...</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleSelect("POSITIVE")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "POSITIVE"
              ? "border-[#30D158] bg-[#30D158]/10 text-[#30D158] ring-2 ring-[#30D158]/20"
              : "border-white/10 bg-white/5 text-white/60 hover:border-[#30D158]/40 hover:bg-[#30D158]/5"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Positive Outcome
          {meetingResult === "POSITIVE" && (
            <Check className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => handleSelect("IN_PROGRESS")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "IN_PROGRESS"
              ? "border-[#FF9F0A] bg-[#FF9500]/10 text-[#FF9F0A] ring-2 ring-[#FF9F0A]/20"
              : "border-white/10 bg-white/5 text-white/60 hover:border-[#FF9F0A]/40 hover:bg-[#FF9500]/5"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          In Progress
          {meetingResult === "IN_PROGRESS" && (
            <Check className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>
        <button
          onClick={() => handleSelect("NEGATIVE")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
            meetingResult === "NEGATIVE"
              ? "border-[#FF453A] bg-[#FF453A]/10 text-[#FF453A] ring-2 ring-[#FF453A]/20"
              : "border-white/10 bg-white/5 text-white/60 hover:border-[#FF453A]/40 hover:bg-[#FF453A]/5"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Negative Outcome
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
    <Card className={`overflow-hidden hover:shadow-md transition-all duration-300${hasValidSiteUrl ? " bg-[#30D158]/10 border-[#30D158]/30" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">
              <Link
                href={`/app/leads/${item.lead.id}`}
                className="hover:underline"
              >
                {item.lead.businessName}
              </Link>
            </CardTitle>
            <p className="text-sm text-white/50 mt-1 truncate">
              {item.lead.formattedAddress}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
            {saveStatus === "saving" && (
              <span className="text-xs text-white/30">Saving...</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-[#30D158]">Saved</span>
            )}
            {item.meetingResult === "POSITIVE" && (
              <Badge className="bg-[#30D158]/10 text-[#30D158] border-[#30D158]/20">
                Positive
              </Badge>
            )}
            {item.meetingResult === "IN_PROGRESS" && (
              <Badge className="bg-[#FF9500]/10 text-[#FF9F0A] border-[#FF9F0A]/20">
                In Progress
              </Badge>
            )}
            {item.meetingResult === "NEGATIVE" && (
              <Badge className="bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/20">
                Negative
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
              <Badge className="bg-[#0A84FF]/10 text-[#0A84FF] border-[#007AFF]/20">
                Plan Ready
              </Badge>
            )}
            {isAnalyzing && (
              <Badge variant="outline" className="animate-pulse">
                Analyzing...
              </Badge>
            )}
            {!opp && !isAnalyzing && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-[#0A84FF]"
                onClick={handleAnalyze}
              >
                Analyze
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] font-medium text-white/50">
              Built Website URL
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
                  className="shrink-0 h-9 w-9 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Open site"
                >
                  <Globe className="w-4 h-4 text-white/60" />
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="text-[13px] font-medium text-white/50">
              Current Website
            </label>
            {item.lead.websiteUrl ? (
              <a
                href={item.lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-white/60 hover:underline mt-2 truncate"
              >
                {item.lead.websiteUrl}
              </a>
            ) : (
              <p className="text-sm text-white/20 mt-2">None</p>
            )}
          </div>
        </div>

        <div>
          <label className="text-[13px] font-medium text-white/50">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add your notes..."
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
            <label className="text-[13px] font-medium text-white/50">
              Phone
            </label>
            <p className="text-sm text-white/70 mt-1">{item.lead.phone}</p>
          </div>
        )}

        {opp && (
          <div className="border-t border-white/10 pt-3">
            <button
              onClick={() => setAnalysisOpen(!analysisOpen)}
              className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors w-full"
            >
              {analysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              AI Analysis Results
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

        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={handleToggleReviews}
              className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              {reviewsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Google Reviews
              {reviews.length > 0 && (
                <span className="text-xs text-white/30">
                  ({reviews.length} reviews
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
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Refresh
                  </>
                )}
              </Button>
            )}
          </div>

          {reviewsOpen && (
            <div className="mt-3 space-y-3">
              {reviewsLoading && reviews.length === 0 && (
                <div className="text-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-white/50 mx-auto" />
                  <p className="text-xs text-white/30 mt-2">
                    Loading reviews...
                  </p>
                </div>
              )}

              {!reviewsLoading && reviews.length === 0 && (
                <p className="text-sm text-white/30 text-center py-3">
                  No Google reviews found for this business.
                </p>
              )}

              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5"
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
                        <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-medium text-white/50">
                          {review.authorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-white/70">
                        {review.authorName}
                      </span>
                    </div>
                    <span className="text-xs text-white/30">
                      {review.relativeTime}
                    </span>
                  </div>
                  <StarRating rating={review.rating} />
                  {review.text && (
                    <p className="text-sm text-white/60 leading-relaxed">
                      {review.text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <WebsitePlanPanel item={item} onPlanUpdate={onPlanUpdate} />

        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <Link href={`/app/leads/${item.lead.id}`}>
            <Button size="sm" variant="ghost">
              Details
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
                  Analyzing...
                </>
              ) : (
                "Re-analyze"
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-[#FF453A] hover:text-[#FF453A] hover:bg-[#FF453A]/10 ml-auto"
            onClick={() => setRemoveDialogOpen(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>

    <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription className="text-left pt-1">
            You are about to remove <span className="font-medium text-white/70">{item.lead.businessName}</span>{" "}
            from your shortlist. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setRemoveDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onRemove(item.id);
              setRemoveDialogOpen(false);
            }}
          >
            Yes, remove
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
