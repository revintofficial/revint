/**
 * AI Workers panel - the lead detail "AI Workers" surface.
 *
 * Groups the 19 registered workers into Intelligence / Pitch /
 * Deliverable / Ops sections. Phase 1 only the 4 new workers (Mockup,
 * Receptionist, Review Reply, Lead Response) are interactive from
 * this panel; the rest render as informational badges pointing the
 * user to the existing dedicated widgets (review-intelligence-panel,
 * website-plan section, etc.).
 *
 * Flow per generate click:
 *   1. POST /api/leads/{id}/workers/{kind} -> { runId }
 *   2. Poll GET /api/agent-runs/{runId} every 2s until SUCCEEDED/FAILED
 *   3. On SUCCEEDED render "Open" + "Export" buttons scoped to the
 *      worker's export formats.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Loader2,
  Globe,
  Phone,
  MessageSquare,
  Zap,
  RefreshCw,
  Download,
  ExternalLink,
  Eye,
  Lock,
  CircleCheck,
  CircleX,
  AlertTriangle,
  Wrench,
  BrainCircuit,
  Star,
  Megaphone,
  MailSearch,
  Send,
  Mic,
  FileVideo,
  Calendar,
  LineChart,
  ShieldCheck,
} from "lucide-react";

type AgentWorkerKind =
  | "WEBSITE_AUDITOR"
  | "REVIEW_ANALYST"
  | "SALES_OPPORTUNITY_SCORER"
  | "SOCIAL_SCRAPER"
  | "EMAIL_VERIFIER"
  | "WEBSITE_PLAN_GENERATOR"
  | "WEBSITE_MOCKUP_GENERATOR"
  | "OPENER_WRITER"
  | "VIDEO_SCRIPT_WRITER"
  | "VOICE_NOTE_TRANSCRIBER"
  | "AI_RECEPTIONIST_BUILDER"
  | "REVIEW_REPLY_AGENT"
  | "LEAD_RESPONSE_AGENT"
  | "BOOKING_WIDGET_BUILDER"
  | "GBP_AUTOPOST_AGENT"
  | "COPILOT_CHAT"
  | "INBOX_REPLY_ATTRIBUTOR"
  | "OUTREACH_SENDER"
  | "CONTAINMENT_RATE_TRACKER";

type Plan = "FREE" | "PRO" | "PRO_TEAM" | "AGENCY";
type AgentRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
type Group = "intelligence" | "pitch" | "deliverable" | "ops" | "enrichment";

interface WorkerItem {
  kind: AgentWorkerKind;
  group: Group;
  displayName: string;
  description: string;
  minPlan: Plan;
  phase1Enabled: boolean;
  estimatedDurationMs: number;
  exportFormats: string[];
  locked: boolean;
  used: number;
  limit: number;
  remaining: number;
  latestRun: {
    id: string;
    status: AgentRunStatus;
    artifactUrl: string | null;
    errorMsg: string | null;
    createdAt: string;
    finishedAt: string | null;
  } | null;
}

interface WorkersResponse {
  leadId: string;
  plan: Plan;
  cycleResetAt: string;
  workers: WorkerItem[];
}

const ICONS: Partial<Record<AgentWorkerKind, typeof Sparkles>> = {
  WEBSITE_AUDITOR: ShieldCheck,
  REVIEW_ANALYST: Star,
  SALES_OPPORTUNITY_SCORER: BrainCircuit,
  SOCIAL_SCRAPER: MailSearch,
  EMAIL_VERIFIER: MailSearch,
  WEBSITE_PLAN_GENERATOR: Wrench,
  WEBSITE_MOCKUP_GENERATOR: Globe,
  OPENER_WRITER: Megaphone,
  VIDEO_SCRIPT_WRITER: FileVideo,
  VOICE_NOTE_TRANSCRIBER: Mic,
  AI_RECEPTIONIST_BUILDER: Phone,
  REVIEW_REPLY_AGENT: Star,
  LEAD_RESPONSE_AGENT: Zap,
  BOOKING_WIDGET_BUILDER: Calendar,
  GBP_AUTOPOST_AGENT: Megaphone,
  COPILOT_CHAT: MessageSquare,
  INBOX_REPLY_ATTRIBUTOR: MailSearch,
  OUTREACH_SENDER: Send,
  CONTAINMENT_RATE_TRACKER: LineChart,
};

const GROUP_COPY: Record<Group, { title: string; hint: string }> = {
  intelligence: {
    title: "Intelligence",
    hint: "Runs automatically when a lead is ingested.",
  },
  pitch: {
    title: "Pitch",
    hint: "Artifacts you send to the prospect.",
  },
  deliverable: {
    title: "Deliverables",
    hint: "Install packs for your client's own AI stack (Synthflow, GHL, Retell).",
  },
  ops: {
    title: "Ops",
    hint: "Platform-level agents on your side.",
  },
  enrichment: {
    title: "Enrichment",
    hint: "External data sources (Apify scrapers). Pay-per-use on PRO+.",
  },
};

interface Props {
  leadId: string;
}

export function AiWorkersPanel({ leadId }: Props) {
  const [data, setData] = useState<WorkersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningKinds, setRunningKinds] = useState<Set<AgentWorkerKind>>(new Set());
  const pollersRef = useRef<Map<AgentWorkerKind, number>>(new Map());

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/workers`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const d: WorkersResponse = await res.json();
      setData(d);
    } catch (err) {
      console.error("Failed to load workers:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    return () => {
      // Clear any outstanding polling intervals on unmount.
      for (const id of pollersRef.current.values()) window.clearInterval(id);
      pollersRef.current.clear();
    };
  }, []);

  const pollRun = useCallback(
    (kind: AgentWorkerKind, runId: string) => {
      const existing = pollersRef.current.get(kind);
      if (existing) window.clearInterval(existing);
      const intervalId = window.setInterval(async () => {
        try {
          const res = await fetch(`/api/agent-runs/${runId}`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const run = await res.json();
          if (run.status === "SUCCEEDED" || run.status === "FAILED" || run.status === "CANCELLED") {
            window.clearInterval(intervalId);
            pollersRef.current.delete(kind);
            setRunningKinds((prev) => {
              const next = new Set(prev);
              next.delete(kind);
              return next;
            });
            // Optimistically merge the resolved run into local `data`
            // so the spinner / badge flips immediately, without
            // waiting for the fetchWorkers roundtrip. If fetchWorkers
            // later returns a newer snapshot (e.g. quota counter
            // bumped) we overwrite this on that pass.
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                workers: prev.workers.map((w) =>
                  w.kind === kind
                    ? {
                        ...w,
                        latestRun: {
                          id: run.id,
                          status: run.status,
                          artifactUrl: run.artifactUrl ?? null,
                          errorMsg: run.errorMsg ?? null,
                          createdAt: run.createdAt,
                          finishedAt: run.finishedAt ?? null,
                        },
                      }
                    : w,
                ),
              };
            });
            if (run.status === "SUCCEEDED") {
              toast.success("Generation complete.");
            } else if (run.status === "FAILED") {
              toast.error(
                "Generation failed: " + (run.errorMsg ?? "unknown error"),
              );
            }
            fetchWorkers();
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 2000);
      pollersRef.current.set(kind, intervalId);
    },
    [fetchWorkers],
  );

  // If the initial fetch surfaces any worker whose latest run is
  // still PENDING/RUNNING (e.g. user navigated away and came back
  // mid-generation, or hot-reload wiped in-memory state), attach a
  // poller for it so the UI eventually flips to SUCCEEDED/FAILED
  // without requiring a manual page refresh.
  useEffect(() => {
    if (!data) return;
    for (const w of data.workers) {
      const lr = w.latestRun;
      if (!lr) continue;
      if (lr.status !== "PENDING" && lr.status !== "RUNNING") continue;
      if (pollersRef.current.has(w.kind)) continue;
      setRunningKinds((prev) => {
        if (prev.has(w.kind)) return prev;
        const next = new Set(prev);
        next.add(w.kind);
        return next;
      });
      pollRun(w.kind, lr.id);
    }
    // We intentionally exclude pollRun from deps: it's stable per
    // fetchWorkers, and re-running this effect only when `data`
    // changes is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const triggerWorker = useCallback(
    async (worker: WorkerItem) => {
      if (!worker.phase1Enabled) {
        toast.info("This worker is coming in the next launch.");
        return;
      }
      if (worker.locked) {
        toast.error(`Upgrade required: ${worker.minPlan}`);
        return;
      }
      if (worker.remaining <= 0) {
        toast.error(
          `Quota exhausted (${worker.used}/${worker.limit}). Upgrade or wait for cycle reset.`,
        );
        return;
      }

      setRunningKinds((prev) => new Set(prev).add(worker.kind));
      try {
        const res = await fetch(`/api/leads/${leadId}/workers/${worker.kind}`, {
          method: "POST",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setRunningKinds((prev) => {
            const next = new Set(prev);
            next.delete(worker.kind);
            return next;
          });
          if (res.status === 402) {
            toast.error(err.message || "Plan or quota insufficient.");
          } else {
            toast.error(err.error || "Failed to start");
          }
          return;
        }
        const { runId } = await res.json();
        // Refetch workers so the UI clears any "stuck" badge left
        // over from the cancelled orphan run before polling begins.
        void fetchWorkers();
        pollRun(worker.kind, runId);
      } catch (err) {
        console.error(err);
        setRunningKinds((prev) => {
          const next = new Set(prev);
          next.delete(worker.kind);
          return next;
        });
        toast.error("Connection error");
      }
    },
    [leadId, pollRun, fetchWorkers],
  );

  const grouped = useMemo(() => {
    if (!data) return null;
    const g: Record<Group, WorkerItem[]> = {
      intelligence: [],
      pitch: [],
      deliverable: [],
      ops: [],
      enrichment: [],
    };
    for (const w of data.workers) {
      const bucket = g[w.group];
      if (bucket) bucket.push(w);
    }
    return g;
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0A84FF]" />
            AI Workers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !grouped) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#0A84FF] shrink-0" />
              AI Workers
            </CardTitle>
            <p className="text-xs text-white/30 mt-1">
              AI worker packs generated per lead.
            </p>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {data.plan}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(["pitch", "deliverable", "intelligence", "enrichment", "ops"] as Group[]).map((group) => {
          const items = grouped[group];
          if (!items.length) return null;
          const copy = GROUP_COPY[group];
          return (
            <section key={group} className="space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-white/70">
                  {copy.title}
                </h3>
                <p className="text-[11px] text-white/30">
                  {copy.hint}
                </p>
              </div>
              <div className="space-y-2">
                {items.map((w) => (
                  <WorkerRow
                    key={w.kind}
                    worker={w}
                    running={runningKinds.has(w.kind)}
                    onGenerate={() => triggerWorker(w)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function WorkerRow({
  worker,
  running,
  onGenerate,
}: {
  worker: WorkerItem;
  running: boolean;
  onGenerate: () => void;
}) {
  const Icon = ICONS[worker.kind] ?? Sparkles;
  const name = worker.displayName;
  const desc = worker.description;
  const latest = worker.latestRun;
  const succeeded = latest?.status === "SUCCEEDED";
  const failed = latest?.status === "FAILED";
  const pendingStatus = latest?.status === "PENDING" || latest?.status === "RUNNING";
  // A run is considered "stuck" if it's been inflight past 2x its
  // estimated duration (server auto-cancels at 3 minutes). In that
  // window the UI surfaces a "Force retry" button so the user can
  // bypass the disable without waiting for the server timeout.
  const ageMs = latest && pendingStatus
    ? Date.now() - new Date(latest.createdAt).getTime()
    : 0;
  const stuck = pendingStatus && ageMs > Math.max(worker.estimatedDurationMs * 2, 60_000);
  const pending = pendingStatus && !stuck;
  const showSpinner = running || pending;

  const limitLabel = worker.limit > 0 ? `${worker.used}/${worker.limit}` : "-";
  const canGenerate =
    worker.phase1Enabled && !worker.locked && worker.remaining > 0 && !showSpinner;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-[#0A84FF]">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white/90">{name}</span>
                {worker.locked && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Lock className="w-3 h-3" /> {worker.minPlan}
                  </Badge>
                )}
                {!worker.phase1Enabled && !worker.locked && (
                  <Badge variant="outline" className="text-[10px]">
                    Soon
                  </Badge>
                )}
                {succeeded && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CircleCheck className="w-3 h-3" /> Ready
                  </Badge>
                )}
                {failed && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <CircleX className="w-3 h-3" /> Failed
                  </Badge>
                )}
                {stuck && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> Stuck
                  </Badge>
                )}
              </div>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">{desc}</p>
              {failed && latest?.errorMsg && (
                <p className="text-[11px] text-[#FF453A] mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  {latest.errorMsg}
                </p>
              )}
              {stuck && (
                <p className="text-[11px] text-[#FF9F0A] mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  Generation has been waiting over 2 minutes. Click &quot;Force retry&quot; to restart.
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[10px] text-white/30 tabular-nums">{limitLabel}</span>
            </div>
          </div>

          {worker.phase1Enabled && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {succeeded && latest?.artifactUrl && (
                <a
                  href={latest.artifactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </Button>
                </a>
              )}
              {succeeded && latest && (
                <ViewRunButton runId={latest.id} workerName={name} />
              )}
              {succeeded && latest && worker.exportFormats.length > 0 && (
                <ExportMenu
                  runId={latest.id}
                  formats={worker.exportFormats}
                />
              )}
              <Button
                size="sm"
                onClick={onGenerate}
                disabled={!canGenerate && !succeeded && !stuck}
                className="h-7 gap-1.5 text-xs"
                variant={succeeded || stuck ? "outline" : undefined}
              >
                {showSpinner ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Running...
                  </>
                ) : stuck ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Force retry
                  </>
                ) : succeeded ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AgentRunDetail {
  id: string;
  workerKind: string;
  status: string;
  outputJson: unknown;
  artifactUrl: string | null;
  errorMsg: string | null;
  costTokens: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

function ViewRunButton({
  runId,
  workerName,
}: {
  runId: string;
  workerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [run, setRun] = useState<AgentRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || run) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/agent-runs/${runId}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as AgentRunDetail;
        if (!cancelled) setRun(data);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, run, runId]);

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        <Eye className="w-3 h-3" />
        View
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{workerName}</DialogTitle>
            <DialogDescription className="text-xs text-white/40 font-mono">
              {runId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 pb-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            )}
            {error && (
              <div className="text-sm text-[#FF453A]">
                Failed to load: {error}
              </div>
            )}
            {run && <RunOutputView run={run} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RunOutputView({ run }: { run: AgentRunDetail }) {
  const finished = run.finishedAt ? new Date(run.finishedAt) : null;
  const started = run.startedAt ? new Date(run.startedAt) : null;
  const durationMs = finished && started ? finished.getTime() - started.getTime() : null;

  const output = run.outputJson;
  const summary = useMemo(() => extractRunSummary(output), [output]);

  let prettyOutput: string;
  try {
    prettyOutput = JSON.stringify(output, null, 2);
  } catch {
    prettyOutput = String(output);
  }
  const truncated = prettyOutput.length > 200_000;
  const displayed = truncated ? `${prettyOutput.slice(0, 200_000)}\n...[truncated]` : prettyOutput;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-[11px] text-white/50">
        <span>
          Status: <span className="text-white/80">{run.status}</span>
        </span>
        {finished && (
          <span>
            Finished: <span className="text-white/80">{finished.toLocaleString()}</span>
          </span>
        )}
        {durationMs !== null && (
          <span>
            Duration: <span className="text-white/80">{(durationMs / 1000).toFixed(1)}s</span>
          </span>
        )}
        {typeof run.costTokens === "number" && run.costTokens > 0 && (
          <span>
            Tokens: <span className="text-white/80">{run.costTokens.toLocaleString()}</span>
          </span>
        )}
      </div>

      {summary.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-1.5">
          {summary.map((row) => (
            <div key={row.label} className="flex items-baseline gap-2 text-xs">
              <span className="text-white/50 min-w-[120px]">{row.label}</span>
              <span className="text-white/90 break-all">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {run.artifactUrl && (
        <a
          href={run.artifactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#0A84FF] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {run.artifactUrl}
        </a>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">
          Raw output
        </div>
        <pre className="text-[11px] leading-relaxed bg-black/40 border border-white/5 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-[50vh] overflow-y-auto font-mono text-white/80">
          {displayed}
        </pre>
      </div>
    </div>
  );
}

/**
 * Pull a few human-readable rows out of an AgentRun.outputJson so the
 * dialog leads with useful facts (counts, costs, slugs) before the raw
 * JSON dump. Worker-agnostic: walks the top-level fields and surfaces
 * primitives + array lengths.
 */
function extractRunSummary(output: unknown): Array<{ label: string; value: string }> {
  if (!output || typeof output !== "object") return [];
  const o = output as Record<string, unknown>;
  const rows: Array<{ label: string; value: string }> = [];
  const seenLabels = new Set<string>();
  const push = (label: string, value: string) => {
    if (seenLabels.has(label)) return;
    seenLabels.add(label);
    rows.push({ label, value });
  };

  if (typeof o.skipped === "boolean" && o.skipped) {
    push("skipped", "true");
    if (typeof o.reason === "string") push("reason", o.reason);
  }
  if (typeof o.count === "number") push("count", String(o.count));
  if (typeof o.costUsdCents === "number") {
    push("cost", `$${(o.costUsdCents / 100).toFixed(4)}`);
  }
  if (typeof o.leadScore === "number") push("leadScore", String(o.leadScore));
  if (typeof o.summary === "string") {
    push("summary", o.summary.length > 240 ? `${o.summary.slice(0, 240)}...` : o.summary);
  }
  if (typeof o.reviewsAnalyzedCount === "number") {
    push("reviewsAnalyzed", String(o.reviewsAnalyzedCount));
  }
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v) && rows.length < 12) push(`${k}.length`, String(v.length));
  }
  return rows;
}

function ExportMenu({
  runId,
  formats,
}: {
  runId: string;
  formats: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="w-3 h-3" />
        Export
      </Button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-20 rounded-lg border border-white/10 bg-[#121214] p-1 min-w-[140px] shadow-xl"
          onMouseLeave={() => setOpen(false)}
        >
          {formats.map((f) => (
            <a
              key={f}
              href={`/api/agent-runs/${runId}/export?format=${f}`}
              className="block px-3 py-1.5 text-xs rounded-md hover:bg-white/5 text-white/70"
              onClick={() => setOpen(false)}
            >
              {f}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
