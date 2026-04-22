/**
 * P0.1 - Review Intelligence v1 UI.
 *
 * Renders the Mapileads-style KPI bar view of a lead's GoogleReview corpus:
 * weakness bars (red), strength bars (green), sentiment pie summary, switch
 * signals, lead score, and a one-line narrative.
 *
 * Polls /api/reviews/[leadId]/analyze every 3s while status is ANALYZING.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/progress";
import {
  Sparkles,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Loader2,
  RefreshCw,
  Star,
} from "lucide-react";

interface KpiBar {
  label: string;
  percent: number;
  examples: string[];
}

interface SwitchSignal {
  from: string;
  to: string;
  reason: string;
}

interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

interface ReviewAnalysis {
  reviewsAnalyzedCount: number;
  weaknessKpis: KpiBar[];
  strengthKpis: KpiBar[];
  sentimentBreakdown: SentimentBreakdown;
  painPhrases: string[];
  strengthPhrases: string[];
  switchSignals: SwitchSignal[];
  leadScore: number;
  summary: string | null;
  analyzedAt: string;
}

interface Props {
  leadId: string;
  hasReviews: boolean;
  onAnalysisReady?: (analysis: ReviewAnalysis) => void;
}

type Status = "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";

export function ReviewIntelligencePanel({ leadId, hasReviews, onAnalysisReady }: Props) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews/${leadId}/analyze`);
      if (!res.ok) return null;
      const data = await res.json();
      setStatus(data.status);
      if (data.analysis) {
        setAnalysis(data.analysis);
        onAnalysisReady?.(data.analysis);
      }
      return data.status as Status;
    } catch (err) {
      console.error("Review analysis fetch failed:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [leadId, onAnalysisReady]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  // Poll while analyzing
  useEffect(() => {
    if (status !== "ANALYZING" && status !== "PENDING") return;
    if (!running && status === "PENDING") return;
    const id = setInterval(() => {
      fetchAnalysis();
    }, 3000);
    return () => clearInterval(id);
  }, [status, running, fetchAnalysis]);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const res = await fetch(`/api/reviews/${leadId}/analyze`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 422) {
          toast.error(err.message || "Pull the Google reviews first.");
        } else if (res.status === 402) {
          toast.error(err.message || "AI quota reached. Upgrade your plan.");
        } else {
          toast.error(err.error || "Couldn't start review analysis.");
        }
        setRunning(false);
        return;
      }
      setStatus("ANALYZING");
      toast.success("Review analysis queued.");
    } catch (err) {
      console.error("Run analysis failed:", err);
      toast.error("Couldn't trigger the analysis.");
      setRunning(false);
    }
  };

  // After completion stop the running flag
  useEffect(() => {
    if (status === "ANALYZED" || status === "FAILED" || status === "NO_REVIEWS") {
      setRunning(false);
    }
  }, [status]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
            Review Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/40">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasReviews) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
            Review Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50">
            Google reviews haven't been pulled yet. Refresh reviews first, then start the analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "NO_REVIEWS") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
            Review Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50">No reviews available to analyze for this business.</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
            Review Intelligence
          </CardTitle>
          <Button size="sm" onClick={runAnalysis} disabled={running || status === "ANALYZING"}>
            {running || status === "ANALYZING" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Run analysis
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-white/50 leading-relaxed">
            Run up to 50 Google reviews for this lead through Gemini in a KPI-bar format.
            The strongest play here: the thing customers complain about most lands straight
            in the mockup hero, praise goes into Services, and switch signals feed the pitch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#A5B4FC]" />
            Review Intelligence
          </CardTitle>
          <p className="text-xs text-white/30 mt-1">
            {analysis.reviewsAnalyzedCount} reviews analyzed · Lead Score{" "}
            {analysis.leadScore}/100
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runAnalysis} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {analysis.summary && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white/70 leading-relaxed">
            {analysis.summary}
          </div>
        )}

        <div className="flex items-center gap-4">
          <CircularProgress value={analysis.leadScore} size={56} strokeWidth={5} />
          <div className="flex-1">
            <p className="text-[13px] font-medium text-white/50 mb-1">Lead Score</p>
            <p className="text-xs text-white/40">
              {analysis.leadScore >= 70
                ? "Hot prospect — our solution maps directly onto their problem"
                : analysis.leadScore >= 40
                ? "Warm — a few pain points we can address"
                : "Cold — our solution doesn't directly address their problem"}
            </p>
          </div>
        </div>

        <SentimentBar breakdown={analysis.sentimentBreakdown} />

        {analysis.weaknessKpis.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-[#FF453A]" /> What customers complain about
            </p>
            <div className="space-y-2">
              {analysis.weaknessKpis.map((k) => (
                <KpiBarRow key={k.label} kpi={k} variant="weakness" />
              ))}
            </div>
          </div>
        )}

        {analysis.strengthKpis.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#34D399]" /> What customers praise
            </p>
            <div className="space-y-2">
              {analysis.strengthKpis.map((k) => (
                <KpiBarRow key={k.label} kpi={k} variant="strength" />
              ))}
            </div>
          </div>
        )}

        {analysis.switchSignals.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-[#A5B4FC]" /> Competitor switch signals
            </p>
            <div className="space-y-2">
              {analysis.switchSignals.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-white/70"
                >
                  <span className="text-white/50">{s.from}</span>{" "}
                  <ArrowRight className="w-3 h-3 inline mx-1 text-white/30" />{" "}
                  <span className="font-medium text-white/85">{s.to}</span>
                  <p className="text-xs text-white/45 mt-1">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.painPhrases.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2">Most common pain phrases</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.painPhrases.map((p) => (
                <Badge key={p} variant="destructive" className="text-xs font-normal">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {analysis.strengthPhrases.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-[#FBBF24]" /> Most common praise
            </p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.strengthPhrases.map((p) => (
                <Badge key={p} variant="success" className="text-xs font-normal">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiBarRow({ kpi, variant }: { kpi: KpiBar; variant: "weakness" | "strength" }) {
  const color = variant === "weakness" ? "#FF453A" : "#34D399";
  const bg = variant === "weakness" ? "rgba(255,69,58,0.12)" : "rgba(52,211,153,0.12)";
  const percent = Math.max(0, Math.min(100, kpi.percent));
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/75 font-medium">{kpi.label}</span>
        <span className="text-white/55 tabular-nums">%{percent}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${percent}%`, background: color, boxShadow: `0 0 12px ${bg}` }}
        />
      </div>
      {kpi.examples && kpi.examples.length > 0 && (
        <p className="text-[11px] text-white/35 mt-1 italic">
          &quot;{kpi.examples[0]}&quot;
        </p>
      )}
    </div>
  );
}

function SentimentBar({ breakdown }: { breakdown: SentimentBreakdown }) {
  const pos = Math.round(breakdown.positive * 100);
  const neu = Math.round(breakdown.neutral * 100);
  const neg = Math.round(breakdown.negative * 100);
  return (
    <div>
      <p className="text-[13px] font-medium text-white/60 mb-2">Sentiment breakdown</p>
      <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
        <div className="bg-[#34D399]" style={{ width: `${pos}%` }} />
        <div className="bg-white/30" style={{ width: `${neu}%` }} />
        <div className="bg-[#FF453A]" style={{ width: `${neg}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/45 mt-1.5">
        <span>{pos}% positive</span>
        <span>{neu}% neutral</span>
        <span>{neg}% negative</span>
      </div>
    </div>
  );
}
