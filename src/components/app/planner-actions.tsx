/**
 * Planner actions panel - lead detail surface.
 *
 * Three buttons that trigger AI Core chains:
 *   - One-click pitch pack: WEBSITE_MOCKUP_GENERATOR + OPENER_WRITER
 *     + optional VIDEO_SCRIPT_WRITER
 *   - Deep research: all nine APIFY_* workers + REVIEW_ANALYST re-run
 *     + SALES_OPPORTUNITY_SCORER re-run
 *   - Receptionist with KB: APIFY_WEB_CRAWL_DEEP + AI_RECEPTIONIST_BUILDER
 *
 * Each button POSTs /api/planner/start and then polls
 * /api/planner/[id] every 2s until the session reports completed /
 * failed. The inline step list renders per-step status so the user
 * can see the DAG walking in real time.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Search,
  PhoneCall,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDotDashed,
} from "lucide-react";

type EventKind =
  | "user_one_click_pitch"
  | "user_deep_research"
  | "user_receptionist_with_kb";

type RunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "SUCCEEDED_NO_MEMORY" | "FAILED" | "CANCELLED";

interface PlanStep {
  stepId: string;
  workerKind: string;
  dependsOn: string[];
  optional?: boolean;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "SUCCEEDED_NO_MEMORY" | "FAILED" | "SKIPPED";
  runId?: string;
}

interface PlannerSessionResponse {
  session: {
    id: string;
    status: "PLANNING" | "EXECUTING" | "COMPLETED" | "FAILED" | "CANCELLED";
    goal: string;
    plan: PlanStep[];
    errorMsg: string | null;
  };
  runs: Array<{
    id: string;
    workerKind: string;
    status: RunStatus;
    artifactUrl: string | null;
    errorMsg: string | null;
  }>;
}

interface PlannerActionsProps {
  leadId: string;
  plan: "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
  /**
   * When false, the deep research button is disabled with an upgrade
   * prompt. The caller computes this from the current plan + remaining
   * Apify budget.
   */
  enrichmentAllowed?: boolean;
}

const EVENT_META: Record<
  EventKind,
  { title: string; subtitle: string; icon: typeof Sparkles; costNote?: string }
> = {
  user_one_click_pitch: {
    title: "One-click pitch pack",
    subtitle: "Mockup + opener + video script",
    icon: Sparkles,
  },
  user_deep_research: {
    title: "Deep research",
    subtitle: "Apify: Maps, site crawl, Instagram, SERP, competitor ads",
    icon: Search,
    costNote: "~$1-2 per lead",
  },
  user_receptionist_with_kb: {
    title: "Receptionist + KB",
    subtitle: "Website crawl → knowledge base → AI receptionist config",
    icon: PhoneCall,
    costNote: "~$0.50 per lead",
  },
};

export function PlannerActions({ leadId, plan, enrichmentAllowed = true }: PlannerActionsProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<PlannerSessionResponse | null>(null);
  const [starting, setStarting] = useState<EventKind | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/planner/${sessionId}`);
        if (!res.ok) return false;
        const data: PlannerSessionResponse = await res.json();
        setSessionData(data);
        const terminal =
          data.session.status === "COMPLETED" ||
          data.session.status === "FAILED" ||
          data.session.status === "CANCELLED";
        if (terminal) {
          if (data.session.status === "COMPLETED") {
            toast.success("AI chain completed");
          } else {
            toast.error(
              `Chain ${data.session.status.toLowerCase()}${
                data.session.errorMsg ? `: ${data.session.errorMsg}` : ""
              }`,
            );
          }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [],
  );

  const onStart = async (event: EventKind) => {
    if (event === "user_deep_research" && !enrichmentAllowed) {
      toast.error("Enrichment not allowed on this plan. Upgrade to Pro or higher.");
      return;
    }
    setStarting(event);
    try {
      const res = await fetch("/api/planner/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event, leadId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(errBody.error ?? `Failed (${res.status})`);
        setStarting(null);
        return;
      }
      const body = (await res.json()) as { sessionId: string };
      setActiveSessionId(body.sessionId);
      setSessionData(null);
      toast.info(`${EVENT_META[event].title} started`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStarting(null);
    }
  };

  useEffect(() => {
    stopPolling();
    if (!activeSessionId) return;
    // Fire an immediate poll + then 2s cadence until terminal.
    void pollSession(activeSessionId);
    pollRef.current = setInterval(async () => {
      const terminal = await pollSession(activeSessionId);
      if (terminal) stopPolling();
    }, 2000);
    return stopPolling;
  }, [activeSessionId, pollSession, stopPolling]);

  const steps = sessionData?.session.plan ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">AI actions</CardTitle>
        {plan === "FREE" && (
          <Badge variant="secondary" className="text-xs">Free plan: limited</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {(Object.keys(EVENT_META) as EventKind[]).map((evt) => {
            const meta = EVENT_META[evt];
            const Icon = meta.icon;
            const isDeep = evt === "user_deep_research";
            const disabled = !!starting || (isDeep && !enrichmentAllowed);
            return (
              <Button
                key={evt}
                variant="outline"
                size="sm"
                className="justify-start h-auto py-2 px-3 text-left"
                onClick={() => onStart(evt)}
                disabled={disabled}
              >
                {starting === evt ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{meta.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {meta.subtitle}
                    {meta.costNote ? ` · ${meta.costNote}` : ""}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        {activeSessionId && steps.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <div className="text-[11px] font-medium text-muted-foreground mb-1">
              Session {activeSessionId.slice(0, 8)}...
            </div>
            {steps.map((s) => (
              <PlanStepRow key={s.stepId} step={s} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlanStepRow({ step }: { step: PlanStep }) {
  const Icon = stepIcon(step.status);
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <Icon
        className={`h-3 w-3 shrink-0 ${
          step.status === "RUNNING" ? "animate-spin" : ""
        } ${stepColor(step.status)}`}
      />
      <span className="text-muted-foreground truncate">{step.workerKind}</span>
      {step.optional && step.status === "SKIPPED" && (
        <Badge variant="outline" className="text-[10px] h-4 px-1">skip</Badge>
      )}
    </div>
  );
}

function stepIcon(status: PlanStep["status"]) {
  switch (status) {
    case "SUCCEEDED":
    case "SUCCEEDED_NO_MEMORY":
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

function stepColor(status: PlanStep["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "text-[var(--revint-success)]";
    case "SUCCEEDED_NO_MEMORY":
      return "text-[var(--revint-warning)]";
    case "FAILED":
      return "text-[var(--revint-error)]";
    case "RUNNING":
      return "text-(--revint-400)";
    case "SKIPPED":
      return "text-[var(--revint-warning)]";
    default:
      return "text-[var(--revint-muted)]";
  }
}
