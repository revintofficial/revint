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
  Download,
  AlertTriangle,
} from "lucide-react";

interface KpiBar {
  label: string;
  /**
   * Distinct review count behind this KPI. Beta finding §2: required
   * so we can render "3 of 12 reviews" alongside the percentage. Older
   * ReviewAnalysis rows (pre-stabilization) may not have it; the panel
   * falls back to inferring from `examples.length` in that case.
   */
  count?: number;
  percent: number;
  examples: string[];
}

/**
 * Beta finding §3: when fewer than this many reviews were analyzed,
 * percentages on KPI bars are statistically meaningless. The panel
 * shows a red disclaimer and offers the "fetch more reviews via Apify"
 * button as the primary CTA in that regime.
 */
const LOW_SAMPLE_THRESHOLD = 10;

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
  /** How many GoogleReview rows we actually have in the DB for this lead. */
  storedReviewCount?: number;
  /** Total reviews on Google Maps (lead.reviewCount from Places API). */
  totalReviewCount?: number;
  onAnalysisReady?: (analysis: ReviewAnalysis) => void;
}

type Status = "PENDING" | "ANALYZING" | "ANALYZED" | "FAILED" | "NO_REVIEWS";

/**
 * Batch size for Review Intelligence "fetch more" (Apify `maxReviews` cap).
 * 500 matches `APIFY_GMAPS_DEEP`'s server-side `DEFAULT_MAX_REVIEWS` and
 * the slice cap inside `analyzeReviewsWithGemini`, so the deep-scrape
 * button pulls (and the analyzer consumes) the full corpus rather than
 * the previous truncated 60-review batch.
 */
const APIFY_EXTRA_REVIEWS = 500;

export function ReviewIntelligencePanel({
  leadId,
  hasReviews,
  storedReviewCount = 0,
  totalReviewCount = 0,
  onAnalysisReady,
}: Props) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [fetchingDeep, setFetchingDeep] = useState(false);

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

  const runDeepReviews = async () => {
    setFetchingDeep(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/workers/APIFY_GMAPS_DEEP`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxReviews: APIFY_EXTRA_REVIEWS }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Couldn't trigger deep review fetch.");
        return;
      }
      toast.success(
        `Fetching up to ${APIFY_EXTRA_REVIEWS} Google Maps reviews via Apify — this can take a few minutes; refresh analysis after it finishes.`,
      );
    } catch {
      toast.error("Couldn't trigger deep review fetch.");
    } finally {
      setFetchingDeep(false);
    }
  };

  // Show "Get More Reviews" banner whenever we have meaningfully fewer
  // reviews stored than Google Maps reports for the lead. The bar is
  // capped at 500 (Apify cap), so we compare against
  // min(totalReviewCount, 500). We still show it if we have <500 stored
  // and Google has more — so a lead with 200 reviews on Maps and only 5
  // stored gets the prompt to pull the rest.
  const showDeepReviewsBanner =
    totalReviewCount > 0 &&
    totalReviewCount > storedReviewCount &&
    storedReviewCount < Math.min(totalReviewCount, APIFY_EXTRA_REVIEWS);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-(--revint-300)" />
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
            <Sparkles className="w-5 h-5 text-(--revint-300)" />
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
            <Sparkles className="w-5 h-5 text-(--revint-300)" />
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
            <Sparkles className="w-5 h-5 text-(--revint-300)" />
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
        <CardContent className="space-y-3">
          {showDeepReviewsBanner && (
            <div
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
              style={{
                background: "color-mix(in oklab, var(--revint-warning) 10%, transparent)",
                borderColor: "color-mix(in oklab, var(--revint-warning) 20%, transparent)",
                color: "var(--revint-warning-soft)",
              }}
            >
              <span>
                {storedReviewCount} reviews saved — pull up to {APIFY_EXTRA_REVIEWS} from Google Maps via
                Apify
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-3 h-6 px-2 text-[11px]"
                style={{
                  borderColor: "color-mix(in oklab, var(--revint-warning) 30%, transparent)",
                  color: "var(--revint-warning-soft)",
                }}
                onClick={runDeepReviews}
                disabled={fetchingDeep}
              >
                {fetchingDeep ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                <span className="ml-1">Pull {APIFY_EXTRA_REVIEWS} (Apify)</span>
              </Button>
            </div>
          )}
          <p className="text-sm text-white/50 leading-relaxed">
            Run up to 500 Google reviews for this lead through Gemini in a KPI-bar format.
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
            <Sparkles className="w-5 h-5 text-(--revint-300)" />
            Review Intelligence
          </CardTitle>
          <p className="text-xs text-white/30 mt-1">
            {analysis.reviewsAnalyzedCount} of {storedReviewCount || analysis.reviewsAnalyzedCount} reviews analyzed
            {totalReviewCount > storedReviewCount && totalReviewCount > 0
              ? ` · ${totalReviewCount - storedReviewCount} more on Google Maps`
              : ""}
            {" "}· Lead Score {analysis.leadScore}/100
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showDeepReviewsBanner && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              style={{
                borderColor: "color-mix(in oklab, var(--revint-warning) 30%, transparent)",
                color: "var(--revint-warning-soft)",
              }}
              onClick={runDeepReviews}
              disabled={fetchingDeep}
            >
              {fetchingDeep ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              <span className="ml-1">Pull {APIFY_EXTRA_REVIEWS} (Apify)</span>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={runAnalysis} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {analysis.reviewsAnalyzedCount > 0 &&
          analysis.reviewsAnalyzedCount < LOW_SAMPLE_THRESHOLD && (
            <div
              className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              style={{
                background: "color-mix(in oklab, var(--revint-error) 10%, transparent)",
                borderColor: "color-mix(in oklab, var(--revint-error) 30%, transparent)",
                color: "var(--revint-error-soft)",
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <div>
                <p className="font-medium">
                  Low sample size — {analysis.reviewsAnalyzedCount} reviews
                </p>
                <p
                  className="text-[11px] mt-0.5 leading-relaxed"
                  style={{ color: "color-mix(in oklab, var(--revint-error-soft) 85%, transparent)" }}
                >
                  Percentages below are derived from a tiny pool and can be
                  misleading. Pull more reviews via Apify before relying on
                  these KPIs for outreach.
                </p>
              </div>
            </div>
          )}

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

        {(() => {
          // Beta finding §2: derive negative/positive pool sizes for
          // tooltip context. We only know the sentiment shares, not the
          // raw counts, so back out the pool from
          // `reviewsAnalyzedCount × sentiment.{negative|positive}`.
          // Rounded to the nearest integer; the tooltip caveats this
          // already by showing the raw KPI count alongside.
          const negativePool = Math.round(
            (analysis.sentimentBreakdown?.negative ?? 0) *
              analysis.reviewsAnalyzedCount,
          );
          const positivePool = Math.round(
            (analysis.sentimentBreakdown?.positive ?? 0) *
              analysis.reviewsAnalyzedCount,
          );
          return (
            <>
              {analysis.weaknessKpis.length > 0 && (
                <div>
                  <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-[var(--revint-error)]" />{" "}
                    What customers complain about
                  </p>
                  <div className="space-y-2">
                    {analysis.weaknessKpis.map((k) => (
                      <KpiBarRow
                        key={k.label}
                        kpi={k}
                        variant="weakness"
                        poolCount={negativePool}
                        poolLabel="negative reviews"
                      />
                    ))}
                  </div>
                </div>
              )}

              {analysis.strengthKpis.length > 0 && (
                <div>
                  <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--revint-success)]" />{" "}
                    What customers praise
                  </p>
                  <div className="space-y-2">
                    {analysis.strengthKpis.map((k) => (
                      <KpiBarRow
                        key={k.label}
                        kpi={k}
                        variant="strength"
                        poolCount={positivePool}
                        poolLabel="positive reviews"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {analysis.switchSignals.length > 0 && (
          <div>
            <p className="text-[13px] font-medium text-white/60 mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-(--revint-300)" /> Competitor switch signals
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
              <Star className="w-3.5 h-3.5 text-[var(--revint-warning)]" /> Most common praise
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

function KpiBarRow({
  kpi,
  variant,
  poolCount,
  poolLabel,
}: {
  kpi: KpiBar;
  variant: "weakness" | "strength";
  /**
   * Beta finding §2: total negative pool (for weakness) or positive
   * pool (for strength) used to compute the percent. Surfaced in the
   * tooltip so the rep can see "3 of 12 negative reviews" instead of
   * just "25%". Optional — older ReviewAnalysis rows pass undefined
   * and the tooltip falls back to "out of N reviews analysed".
   */
  poolCount?: number;
  poolLabel?: string;
}) {
  const color = variant === "weakness" ? "var(--revint-error)" : "var(--revint-success)";
  const bg =
    variant === "weakness"
      ? "color-mix(in oklab, var(--revint-error) 12%, transparent)"
      : "color-mix(in oklab, var(--revint-success) 12%, transparent)";
  const percent = Math.max(0, Math.min(100, kpi.percent));
  const count = typeof kpi.count === "number" ? kpi.count : undefined;
  const tooltip =
    typeof count === "number" && typeof poolCount === "number" && poolCount > 0
      ? `${kpi.label} — ${count} of ${poolCount} ${poolLabel ?? "reviews"} (${percent}%)`
      : typeof count === "number"
        ? `${kpi.label} — ${count} reviews mention this`
        : `${kpi.label} — ${percent}% of ${poolLabel ?? "reviews"}`;
  return (
    <div title={tooltip}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/75 font-medium">{kpi.label}</span>
        <span className="text-white/55 tabular-nums">
          {typeof count === "number" ? `${count} · %${percent}` : `%${percent}`}
        </span>
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
        <div style={{ width: `${pos}%`, backgroundColor: "var(--revint-success)" }} />
        <div className="bg-white/30" style={{ width: `${neu}%` }} />
        <div style={{ width: `${neg}%`, backgroundColor: "var(--revint-error)" }} />
      </div>
      <div className="flex justify-between text-[11px] text-white/45 mt-1.5">
        <span>{pos}% positive</span>
        <span>{neu}% neutral</span>
        <span>{neg}% negative</span>
      </div>
    </div>
  );
}
