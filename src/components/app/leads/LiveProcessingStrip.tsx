"use client";

/**
 * LiveProcessingStrip — visible heartbeat for background AI work.
 *
 * After a Discovery run, the actual analysis (audit → classifier →
 * scorer → dossier → mockup → intelligence brief) runs asynchronously
 * via the AI Core chain on BullMQ. The Discovery + Leads pages used
 * to silently sit there while N leads chewed through the pipeline,
 * so reps thought the app was frozen and either bailed or hammered
 * the Build sales brief button.
 *
 * This strip polls /api/leads/processing-status every 3s when there
 * is any activity and surfaces:
 *   - "Crawling N websites" / "Analyzing M leads" counts
 *   - The currently running AgentRun workers (chip per worker kind)
 *   - A "X just finished in the last minute" pulse
 *
 * Once the workspace is fully idle the strip auto-collapses to nothing
 * (returns null) so it doesn't add noise to a finished workspace.
 *
 * It accepts an optional `onTransitionToIdle` callback so the parent
 * can refetch the lead list when the last worker drains — that way
 * the table refreshes with brand-new salesConfidence / opportunity
 * scores without the rep needing to hit the page.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProcessingWorker {
  id: string;
  kind: string;
  leadId: string | null;
  leadName: string | null;
  status: "PENDING" | "RUNNING";
  ageSeconds: number;
}

interface ProcessingStatus {
  idle: boolean;
  totals: {
    crawling: number;
    analyzing: number;
    /** Leads with crawl or analysis still in flight (each lead counted once). From API v2 of processing-status. */
    pipelinePending?: number;
    recentlyAnalyzed: number;
    total: number;
  };
  activity: {
    running: number;
    oldestStartedAt: string | null;
    recentlyCompleted: number;
  };
  workers: ProcessingWorker[];
}

const POLL_INTERVAL_MS = 3000;
// Once everything goes idle we keep showing the "X just finished"
// pulse for a short tail so the rep registers that the queue actually
// completed, not that the app silently dropped the work.
const IDLE_TAIL_MS = 8000;

const WORKER_LABELS: Record<string, string> = {
  WEBSITE_AUDITOR: "Auditing site",
  REVIEW_ANALYST: "Reading reviews",
  SALES_OPPORTUNITY_SCORER: "Scoring fit",
  SOCIAL_SCRAPER: "Checking socials",
  EMAIL_VERIFIER: "Verifying email",
  GOOGLE_PLACES_REVIEWS: "Pulling reviews",
  SUBVERTICAL_CLASSIFIER: "Classifying niche",
  WEBSITE_PLAN_GENERATOR: "Drafting site plan",
  WEBSITE_MOCKUP_GENERATOR: "Building mockup",
  OPENER_WRITER: "Writing opener",
  VIDEO_SCRIPT_WRITER: "Scripting video",
  VOICE_NOTE_TRANSCRIBER: "Transcribing voice note",
  LEAD_DOSSIER_GENERATOR: "Researching dossier",
  LEAD_INTELLIGENCE_BRIEF: "Building sales brief",
  AI_RECEPTIONIST_BUILDER: "Building receptionist",
  REVIEW_REPLY_AGENT: "Drafting review reply",
  LEAD_RESPONSE_AGENT: "Drafting reply",
  BOOKING_WIDGET_BUILDER: "Building booking widget",
  GBP_AUTOPOST_AGENT: "Drafting GBP post",
  COPILOT_CHAT: "Copilot thinking",
  INBOX_REPLY_ATTRIBUTOR: "Matching inbox replies",
  OUTREACH_SENDER: "Sending outreach",
  CONTAINMENT_RATE_TRACKER: "Tracking containment",
  APIFY_GMAPS_DEEP: "Deep Maps scrape",
  APIFY_WEB_CRAWL_DEEP: "Deep crawl",
  APIFY_INSTAGRAM_DEEP: "Instagram scrape",
  APIFY_FACEBOOK_DEEP: "Facebook scrape",
  APIFY_TIKTOK_DEEP: "TikTok scrape",
  APIFY_SERP_RANK: "SERP check",
  APIFY_COMPETITOR_ADS: "Competitor ads",
  APIFY_LINKEDIN_COMPANY: "LinkedIn lookup",
  APIFY_REDDIT_MENTIONS: "Reddit mentions",
};

function workerLabel(kind: string): string {
  return WORKER_LABELS[kind] ?? kind.replace(/_/g, " ").toLowerCase();
}

interface LiveProcessingStripProps {
  /**
   * Called when the strip transitions from "active" to "idle". Use it
   * to refetch the parent's data so the rep sees the freshly-scored
   * leads as soon as the queue drains.
   */
  onTransitionToIdle?: () => void;
  className?: string;
}

export function LiveProcessingStrip({
  onTransitionToIdle,
  className,
}: LiveProcessingStripProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [showIdleTail, setShowIdleTail] = useState(false);
  const wasActiveRef = useRef(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch("/api/leads/processing-status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: ProcessingStatus = await res.json();
        if (cancelled) return;
        setStatus(data);

        const isActive = !data.idle;

        // Edge: active -> idle. Show a short success pulse and fire
        // the parent refetch hook so the table updates with the new
        // scores / briefs.
        if (wasActiveRef.current && !isActive) {
          setShowIdleTail(true);
          if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
          idleTimeoutRef.current = setTimeout(() => {
            if (!cancelled) setShowIdleTail(false);
          }, IDLE_TAIL_MS);
          onTransitionToIdle?.();
        }
        wasActiveRef.current = isActive;
      } catch {
        // Network blip — keep the last status visible, retry on next tick.
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [onTransitionToIdle]);

  if (!status) return null;
  const { totals, activity, workers, idle } = status;
  const active = !idle;
  const visible = active || showIdleTail;

  if (!visible) return null;

  const totalPending =
    totals.pipelinePending ??
    totals.analyzing + totals.crawling;

  // Dedup worker kinds so a fan-out across 30 leads doesn't render 30
  // identical chips. Keep a count badge per kind for the "x4" hint.
  const kindCounts = workers.reduce<Record<string, number>>((acc, w) => {
    acc[w.kind] = (acc[w.kind] ?? 0) + 1;
    return acc;
  }, {});
  const uniqueKinds = Object.entries(kindCounts).slice(0, 6);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={active ? "active" : "idle-tail"}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "rounded-2xl border px-4 py-3",
          active
            ? "border-(--leadac-500)/25 bg-(--leadac-500)/[0.06]"
            : "border-[hsl(152_48%_50%)]/25 bg-[hsl(152_48%_50%)]/[0.06]",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {active ? (
              <Loader2 className="w-4 h-4 shrink-0 text-(--leadac-500) animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[hsl(152_48%_50%)]" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold truncate",
                  active
                    ? "text-(--leadac-500)"
                    : "text-[hsl(152_48%_50%)]",
                )}
              >
                {active
                  ? totalPending > 0
                    ? `Analyzing ${totalPending} lead${totalPending === 1 ? "" : "s"}…`
                    : `Running ${activity.running} background task${activity.running === 1 ? "" : "s"}…`
                  : totals.recentlyAnalyzed > 0 ||
                      activity.recentlyCompleted > 0
                    ? `Just finished ${
                        totals.recentlyAnalyzed || activity.recentlyCompleted
                      } lead${
                        (totals.recentlyAnalyzed || activity.recentlyCompleted) === 1
                          ? ""
                          : "s"
                      } — refreshed below.`
                    : "All caught up."}
              </p>
              <p className="text-[12px] text-white/55 mt-0.5">
                {active ? (
                  <>
                    {totals.crawling > 0 && (
                      <span>{totals.crawling} crawling</span>
                    )}
                    {totals.crawling > 0 && totals.analyzing > 0 && (
                      <span className="text-white/30"> · </span>
                    )}
                    {totals.analyzing > 0 && (
                      <span>{totals.analyzing} pending AI</span>
                    )}
                    {(totals.crawling > 0 || totals.analyzing > 0) &&
                      activity.running > 0 && (
                        <span className="text-white/30"> · </span>
                      )}
                    {activity.running > 0 && (
                      <span>{activity.running} running now</span>
                    )}
                    {totalPending === 0 &&
                      activity.running === 0 &&
                      "Wrapping up…"}
                  </>
                ) : (
                  <span>Sales briefs are ready.</span>
                )}
              </p>
            </div>
          </div>

          {active && uniqueKinds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
              <Sparkles className="w-3.5 h-3.5 text-white/30 shrink-0" />
              {uniqueKinds.map(([kind, count]) => (
                <Badge
                  key={kind}
                  variant="outline"
                  className="border-(--leadac-500)/30 text-[11px] text-white/70"
                  title={kind}
                >
                  {workerLabel(kind)}
                  {count > 1 && (
                    <span className="ml-1 text-white/45">×{count}</span>
                  )}
                </Badge>
              ))}
              {workers.length > uniqueKinds.length && (
                <span className="text-[11px] text-white/30">
                  +{workers.length - uniqueKinds.length} more
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
