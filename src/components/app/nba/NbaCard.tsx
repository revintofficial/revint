"use client";

/**
 * SDR Brain v2 — Next Best Action card.
 *
 * One client component renders BOTH the preliminary (T1, BANT-only)
 * card and the final (T3, full SDR_BRAIN) card. The visual state
 * morphs as the API response changes:
 *
 *   - preliminary only → "Quick read" badge, dimmed border, polling spinner
 *   - final present     → "Final analysis" badge, full reasoning trail
 *
 * The page polls the next-action API every ~6s while final == null.
 * Once final arrives, the polling stops and the trace expands by
 * default (collapsed for the preliminary state — there's nothing to
 * trace yet).
 *
 * Lead Detail v2 reuses the *content render* (`NbaContent`) without
 * the surrounding card chrome — see `NextGestureBlock.tsx`. The
 * legacy default export keeps its existing card chrome wrapping
 * `<NbaContent>`, so the legacy DOM bytes are unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { ReasoningTraceExpandable } from "./ReasoningTraceExpandable";
import type {
  ReasoningGraph,
  ContradictionRecord,
} from "@/lib/sdr-brain/reasoning-graph";

export interface LeadNextActionDto {
  id: string;
  version: number;
  isPreliminary: boolean;
  actionKind: string;
  channel: string | null;
  primaryAngleId: string | null;
  triggerIds: string[];
  openingHook: string | null;
  whatNotToPitch: string[];
  predictedObjections: string[];
  recommendedFramework: string | null;
  confidence: number;
  reasoning: string;
  reasoningGraph: ReasoningGraph | null;
  arbitrationRecords: ContradictionRecord[] | null;
  timingWindowEnd: string | null;
  createdAt: string;
}

export interface LeadTriggerDto {
  id: string;
  type: string;
  severity: number;
  confidence: number;
  detectedAt: string;
  urgencyWindowDays: number | null;
}

export interface InsightDto {
  id: string;
  industryMyth: string;
  reframe: string;
  economicImpact: string | null;
}

export interface NextActionResponse {
  preliminary: LeadNextActionDto | null;
  final: LeadNextActionDto | null;
  triggers: LeadTriggerDto[];
  insight: InsightDto | null;
  reasoningGraph: ReasoningGraph | null;
  arbitrationRecords: ContradictionRecord[];
}

const ACTION_LABELS: Record<string, string> = {
  CALL_NOW: "Call now",
  EMAIL_FIRST: "Email first",
  BOOK_DISCOVERY: "Book discovery call",
  SEND_VIDEO_PITCH: "Send video pitch",
  SEND_MOCKUP: "Send mockup",
  WAIT_FOR_TRIGGER: "Wait for trigger",
  HANDOFF_TO_AE: "Handoff to AE",
  NURTURE: "Nurture",
};

const ACTION_ICONS: Record<string, typeof Phone> = {
  CALL_NOW: Phone,
  EMAIL_FIRST: Mail,
  BOOK_DISCOVERY: Calendar,
  SEND_VIDEO_PITCH: MessageSquare,
  SEND_MOCKUP: MessageSquare,
  WAIT_FOR_TRIGGER: Clock,
  HANDOFF_TO_AE: Sparkles,
  NURTURE: Sparkles,
};

/**
 * NbaContent — chrome-less content render extracted from `NbaCard`.
 *
 * Used by the legacy `NbaCard` (wrapped in the existing `Card` chrome)
 * AND by Lead Detail v2's `NextGestureBlock` (wrapped in the v2
 * `Block` primitive). The DOM the legacy wrapper outputs is identical
 * to before — the only change is that the inner `<CardContent>` body
 * now lives inside this named component.
 *
 * Legacy auto-expands the reasoning trace on first arrival of `final`.
 * That behavior is preserved by `autoExpandTraceOnFinal` (defaults to
 * true). v2 passes `hideReasoningTrace` because it surfaces evidence
 * inline as chips and renders a separate "open full graph" link.
 */
export interface NbaContentProps {
  data: NextActionResponse;
  /** When true, omit the reasoning trace toggle (Lead Detail v2 reuses inline evidence chips instead). */
  hideReasoningTrace?: boolean;
  /** When true (default), auto-expand the trace the first time `final` arrives. */
  autoExpandTraceOnFinal?: boolean;
}

export function NbaContent({
  data,
  hideReasoningTrace,
  autoExpandTraceOnFinal = true,
}: NbaContentProps) {
  const [traceOpen, setTraceOpen] = useState(false);
  const sawFinalRef = useRef(false);
  useEffect(() => {
    if (!autoExpandTraceOnFinal) return;
    if (data.final && !sawFinalRef.current) {
      sawFinalRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTraceOpen(true);
    }
  }, [data.final, autoExpandTraceOnFinal]);
  const active = data.final ?? data.preliminary!;
  const Icon = ACTION_ICONS[active.actionKind] ?? Sparkles;
  const actionLabel = ACTION_LABELS[active.actionKind] ?? active.actionKind;
  const timingWindow = active.timingWindowEnd
    ? new Date(active.timingWindowEnd).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <CardContent className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--leadac-500)]/10 text-[var(--leadac-500)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-[var(--leadac-text-1)]">
            {actionLabel}
            {active.channel ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-[var(--leadac-text-3)]">
                via {active.channel.toLowerCase()}
              </span>
            ) : null}
          </div>
          {timingWindow ? (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--leadac-text-3)]">
              <Clock className="h-3 w-3" /> Window closes {timingWindow}
            </div>
          ) : null}
          <div className="mt-2 text-sm text-[var(--leadac-text-2)]">
            {active.reasoning}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold text-[var(--leadac-text-1)]">
            {active.confidence}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            confidence
          </div>
        </div>
      </div>

      {active.openingHook ? (
        <div className="rounded-md border border-[var(--leadac-border)] bg-[var(--leadac-bg)] p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            <Lightbulb className="h-3 w-3" /> Opening hook
          </div>
          <p className="text-sm text-[var(--leadac-text-1)]">
            &ldquo;{active.openingHook}&rdquo;
          </p>
        </div>
      ) : null}

      {data.insight ? (
        <div className="rounded-md border border-[var(--leadac-border)] bg-[var(--leadac-bg)] p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            Commercial insight
          </div>
          <p className="text-sm text-[var(--leadac-text-2)]">
            <span className="font-medium text-[var(--leadac-text-1)]">Reframe:</span>{" "}
            {data.insight.reframe}
          </p>
          {data.insight.economicImpact ? (
            <p className="mt-1 text-xs text-[var(--leadac-text-3)]">
              {data.insight.economicImpact}
            </p>
          ) : null}
        </div>
      ) : null}

      {active.predictedObjections.length > 0 ? (
        <div>
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            <AlertTriangle className="h-3 w-3" /> Predicted objections
          </div>
          <ul className="space-y-1 text-sm text-[var(--leadac-text-2)]">
            {active.predictedObjections.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {active.whatNotToPitch.length > 0 ? (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-[var(--leadac-text-3)]">
            What NOT to pitch
          </div>
          <ul className="space-y-1 text-sm text-[var(--leadac-text-2)]">
            {active.whatNotToPitch.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {data.triggers.slice(0, 6).map((t) => (
            <Badge
              key={t.id}
              variant="outline"
              className="border-[var(--leadac-border)] text-xs text-[var(--leadac-text-2)]"
            >
              {t.type.replace(/_/g, " ").toLowerCase()}
              <span className="ml-1 text-[var(--leadac-text-3)]">
                · sev {t.severity}
              </span>
            </Badge>
          ))}
        </div>
      ) : null}

      {/* Reasoning trace — only present once SDR_BRAIN T3 finished. */}
      {!hideReasoningTrace && data.reasoningGraph ? (
        <div className="border-t border-[var(--leadac-border)] pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTraceOpen((v) => !v)}
            className="h-7 px-2 text-xs text-[var(--leadac-text-2)] hover:text-[var(--leadac-text-1)]"
          >
            {traceOpen ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" /> Hide reasoning trace
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" /> Why? Show reasoning trace
              </>
            )}
          </Button>
          {traceOpen ? (
            <div className="mt-2">
              <ReasoningTraceExpandable
                graph={data.reasoningGraph}
                contradictions={data.arbitrationRecords ?? []}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </CardContent>
  );
}

export function NbaCard({ leadId }: { leadId: string }) {
  const [data, setData] = useState<NextActionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/leads/${leadId}/next-action`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = (await res.json()) as NextActionResponse;
        if (cancelled) return;
        setData(json);
        setLoading(false);
        if (!json.final) {
          pollTimer = setTimeout(fetchOnce, 6000);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchOnce();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [leadId]);

  if (loading) {
    return (
      <Card className="border border-[var(--leadac-border)] bg-[var(--leadac-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--leadac-text-2)]">
            <Sparkles className="h-4 w-4" /> Next Best Action
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (!data.preliminary && !data.final)) {
    return (
      <Card className="border border-dashed border-[var(--leadac-border)] bg-[var(--leadac-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--leadac-text-2)]">
            <Sparkles className="h-4 w-4" /> Next Best Action
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--leadac-text-3)]">
          SDR Brain hasn&apos;t produced a recommendation for this lead yet.
          The first analysis runs automatically once enrichment completes.
        </CardContent>
      </Card>
    );
  }

  const active = data.final ?? data.preliminary!;
  const isPreliminary = !data.final && data.preliminary != null;

  return (
    <Card
      className={`border bg-[var(--leadac-card)] ${
        isPreliminary
          ? "border-dashed border-[var(--leadac-border)]"
          : "border-[var(--leadac-500)]/40 shadow-[0_0_24px_var(--leadac-glow-soft)]"
      }`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--leadac-500)]" />
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-[var(--leadac-text-2)]">
            Next Best Action
          </CardTitle>
        </div>
        <Badge
          variant="outline"
          className={
            isPreliminary
              ? "border-[var(--leadac-border)] text-[var(--leadac-text-3)]"
              : "border-[var(--leadac-500)] text-[var(--leadac-500)]"
          }
        >
          {isPreliminary ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Quick read · running deep analysis
            </>
          ) : (
            <>Final analysis · v{active.version}</>
          )}
        </Badge>
      </CardHeader>
      <NbaContent data={data} />
    </Card>
  );
}
