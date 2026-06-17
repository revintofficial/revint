/**
 * DeepResearchProgressPanel - lead detail "AI Workers" tab surface.
 *
 * Polls the most recent `USER_DEEP_RESEARCH` PlannerSession for the
 * lead via `GET /api/leads/[id]/deep-research-session` and renders a
 * single unified progress card that replaces the otherwise-confusing
 * "six independent worker tiles polling separately" UX.
 *
 * Behaviour:
 *   - On mount, fetches the latest deep-research session for this lead.
 *     If none exists, renders nothing (the panel is invisible until a
 *     session is started elsewhere — typically via PlannerActions).
 *   - When a session is non-terminal (PLANNING / EXECUTING), polls
 *     every 2s and renders an animated progress bar + per-step list.
 *   - When the session reaches a terminal status (COMPLETED / FAILED /
 *     CANCELLED), renders a final summary frame and stops polling.
 *     A 30s grace window keeps the summary visible after completion
 *     so the user has time to read it; after that the panel collapses
 *     itself.
 *
 * Step rows mirror PlanStepRow in `planner-actions.tsx` so the live
 * DAG looks consistent across surfaces.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDotDashed,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

type SessionStatus = "PLANNING" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED";
type StepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";

interface PlanStep {
  stepId: string;
  workerKind: string;
  dependsOn: string[];
  optional?: boolean;
  status: StepStatus;
  runId?: string;
}

interface SessionResponse {
  session: {
    id: string;
    leadId: string | null;
    goal: string;
    status: SessionStatus;
    plan: PlanStep[];
    triggeredBy: string;
    errorMsg: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  runs: Array<{
    id: string;
    workerKind: string;
    status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
    errorMsg: string | null;
    finishedAt: string | null;
  }>;
  hasActiveSession: boolean;
}

interface Props {
  leadId: string;
}

const POLL_INTERVAL_MS = 2000;

/**
 * Window after a session reaches terminal state during which the
 * panel keeps the summary visible before auto-hiding. Long enough to
 * read; short enough to free the surface for the next research run.
 */
const TERMINAL_GRACE_MS = 30_000;

/**
 * Pretty labels for the most common deep-research workers. Falls
 * back to the raw kind for anything not in the map (e.g. additions
 * from later Apify scrapers wired into the chain).
 */
const WORKER_LABELS: Record<string, string> = {
  APIFY_GMAPS_DEEP: "Google Maps reviews (deep)",
  APIFY_WEB_CRAWL_DEEP: "Website crawl (50 pages)",
  APIFY_INSTAGRAM_DEEP: "Instagram profile",
  APIFY_FACEBOOK_DEEP: "Facebook profile",
  APIFY_TIKTOK_DEEP: "TikTok profile",
  APIFY_LINKEDIN_COMPANY: "LinkedIn company",
  APIFY_REDDIT_MENTIONS: "Reddit mentions",
  APIFY_SERP_RANK: "Search rank snapshot",
  APIFY_COMPETITOR_ADS: "Competitor ads",
  REVIEW_ANALYST: "Review intelligence (re-run)",
  SALES_OPPORTUNITY_SCORER: "Score (re-run)",
  LEAD_DOSSIER_GENERATOR: "Dossier (re-run)",
};

export function DeepResearchProgressPanel({ leadId }: Props) {
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchSession = useCallback(async (): Promise<SessionResponse | null> => {
    try {
      const res = await fetch(`/api/leads/${leadId}/deep-research-session`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const body: SessionResponse = await res.json();
      return body;
    } catch {
      return null;
    }
  }, [leadId]);

  // Initial fetch + decide whether to subscribe to polling.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const body = await fetchSession();
      if (cancelled) return;
      setData(body);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSession]);

  // Polling loop while session is non-terminal.
  useEffect(() => {
    stopPolling();
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!data?.session) return;
    const status = data.session.status;
    const isTerminal =
      status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";

    if (isTerminal) {
      // Schedule auto-hide after the grace window so the user has
      // time to read the summary, then the surface frees itself.
      hideTimerRef.current = setTimeout(() => {
        setHidden(true);
      }, TERMINAL_GRACE_MS);
      return;
    }

    pollRef.current = setInterval(async () => {
      const body = await fetchSession();
      if (body) setData(body);
    }, POLL_INTERVAL_MS);

    return () => {
      stopPolling();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [data?.session, fetchSession, stopPolling]);

  // Cleanup intervals/timers on unmount regardless of state.
  useEffect(() => {
    return () => {
      stopPolling();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [stopPolling]);

  if (loading) return null;
  if (!data?.session) return null;
  if (hidden) return null;

  const session = data.session;
  const steps = (session.plan ?? []) as PlanStep[];
  if (steps.length === 0) return null;

  const completed = steps.filter(
    (s) => s.status === "SUCCEEDED" || s.status === "SKIPPED",
  ).length;
  const failed = steps.filter((s) => s.status === "FAILED").length;
  const running = steps.filter((s) => s.status === "RUNNING").length;
  const total = steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const isTerminal =
    session.status === "COMPLETED" ||
    session.status === "FAILED" ||
    session.status === "CANCELLED";

  return (
    <Card
      className={
        session.status === "FAILED"
          ? "border-[color-mix(in_oklab,var(--revint-error)_30%,transparent)] bg-[color-mix(in_oklab,var(--revint-error)_5%,transparent)]"
          : session.status === "COMPLETED"
            ? "border-[color-mix(in_oklab,var(--revint-success)_25%,transparent)] bg-[color-mix(in_oklab,var(--revint-success)_5%,transparent)]"
            : "border-(--revint-500)/30 bg-(--revint-500)/5"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[15px] flex items-center gap-2">
              {session.status === "FAILED" ? (
                <XCircle className="w-4 h-4 text-[var(--revint-error)] shrink-0" />
              ) : session.status === "COMPLETED" ? (
                <CheckCircle2 className="w-4 h-4 text-[var(--revint-success)] shrink-0" />
              ) : (
                <Search className="w-4 h-4 text-(--revint-500) shrink-0 animate-pulse" />
              )}
              {session.status === "COMPLETED"
                ? "Deep research complete"
                : session.status === "FAILED"
                  ? "Deep research failed"
                  : session.status === "CANCELLED"
                    ? "Deep research cancelled"
                    : "Deep research in progress"}
            </CardTitle>
            <p className="text-[12px] text-white/45 mt-1 truncate">
              {summarizeStatus({ completed, total, running, failed, status: session.status })}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className="text-[11px] h-5 px-1.5">
              {completed}/{total}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </Button>
            {isTerminal && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-white/50 hover:text-white/80"
                onClick={() => setHidden(true)}
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar — animated stripe while running, solid when terminal */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              session.status === "FAILED"
                ? "bg-[var(--revint-error)]"
                : session.status === "COMPLETED"
                  ? "bg-[var(--revint-success)]"
                  : "bg-(--revint-500)"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-1.5 pt-0">
          {steps.map((step) => (
            <DeepStepRow key={step.stepId} step={step} />
          ))}

          {session.status === "FAILED" && session.errorMsg && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-[12px]"
              style={{
                background: "color-mix(in oklab, var(--revint-error) 10%, transparent)",
                borderColor: "color-mix(in oklab, var(--revint-error) 20%, transparent)",
                color: "var(--revint-error-soft)",
              }}
            >
              {session.errorMsg}
            </div>
          )}

          {session.status === "COMPLETED" && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-[12px] flex items-center gap-2"
              style={{
                background: "color-mix(in oklab, var(--revint-success) 5%, transparent)",
                borderColor: "color-mix(in oklab, var(--revint-success) 20%, transparent)",
                color: "var(--revint-success-soft)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Reviews, dossier, and score have been refreshed with the new evidence.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function DeepStepRow({ step }: { step: PlanStep }) {
  const Icon = stepIcon(step.status);
  const label = WORKER_LABELS[step.workerKind] ?? step.workerKind;
  return (
    <div className="flex items-center gap-2.5 text-[12px] py-0.5">
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${
          step.status === "RUNNING" ? "animate-spin" : ""
        } ${stepColor(step.status)}`}
      />
      <span className="text-white/75 truncate flex-1">{label}</span>
      {step.optional && step.status === "SKIPPED" && (
        <Badge variant="outline" className="text-[10px] h-4 px-1 border-white/10 text-white/40">
          skip
        </Badge>
      )}
      {step.status === "FAILED" && (
        <Badge variant="destructive" className="text-[10px] h-4 px-1">
          failed
        </Badge>
      )}
      {step.status === "RUNNING" && (
        <Badge variant="outline" className="text-[10px] h-4 px-1 border-(--revint-500)/30 text-(--revint-500)">
          running
        </Badge>
      )}
    </div>
  );
}

function stepIcon(status: StepStatus) {
  switch (status) {
    case "SUCCEEDED":
      return CheckCircle2;
    case "FAILED":
      return XCircle;
    case "RUNNING":
      return Loader2;
    case "SKIPPED":
      return CircleDotDashed;
    default:
      return CircleDotDashed;
  }
}

function stepColor(status: StepStatus): string {
  switch (status) {
    case "SUCCEEDED":
      return "text-[var(--revint-success)]";
    case "FAILED":
      return "text-[var(--revint-error)]";
    case "RUNNING":
      return "text-(--revint-500)";
    case "SKIPPED":
      return "text-[var(--revint-warning-soft)]";
    default:
      return "text-white/30";
  }
}

function summarizeStatus({
  completed,
  total,
  running,
  failed,
  status,
}: {
  completed: number;
  total: number;
  running: number;
  failed: number;
  status: SessionStatus;
}): string {
  if (status === "COMPLETED") {
    return `${completed} of ${total} steps finished — pipeline refreshed.`;
  }
  if (status === "FAILED") {
    return `${failed} step${failed === 1 ? "" : "s"} failed; partial enrichment may still be available.`;
  }
  if (status === "CANCELLED") {
    return "Cancelled before all steps finished.";
  }
  if (running > 0) {
    return `${running} running · ${completed}/${total} done · pipeline auto-refreshes when finished.`;
  }
  return `${completed}/${total} done · waiting for the next worker to start.`;
}
