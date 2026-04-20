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
  Sparkles,
  Loader2,
  Globe,
  Phone,
  MessageSquare,
  Zap,
  RefreshCw,
  Download,
  ExternalLink,
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
type Group = "intelligence" | "pitch" | "deliverable" | "ops";

interface WorkerItem {
  kind: AgentWorkerKind;
  group: Group;
  displayName: string;
  displayNameTr: string;
  description: string;
  descriptionTr: string;
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

const GROUP_COPY: Record<Group, { title: string; titleTr: string; hint: string; hintTr: string }> = {
  intelligence: {
    title: "Intelligence",
    titleTr: "Analiz",
    hint: "Runs automatically when a lead is ingested.",
    hintTr: "Lead eklendiginde otomatik calisir.",
  },
  pitch: {
    title: "Pitch",
    titleTr: "Pitch",
    hint: "Artifacts you send to the prospect.",
    hintTr: "Prospect'e gonderdigin uretimler.",
  },
  deliverable: {
    title: "Deliverables",
    titleTr: "Teslim Paketleri",
    hint: "Install packs for your client's own AI stack (Synthflow, GHL, Retell).",
    hintTr: "Musterinin kendi AI stack'ine (Synthflow, GHL, Retell) kurulum paketleri.",
  },
  ops: {
    title: "Ops",
    titleTr: "Operasyon",
    hint: "Platform-level agents on your side.",
    hintTr: "Senin tarafinda, platform seviyesinde calisan ajanlar.",
  },
};

interface Props {
  leadId: string;
  language?: string; // "tr" | "en"
}

export function AiWorkersPanel({ leadId, language = "tr" }: Props) {
  const tr = language === "tr";
  const [data, setData] = useState<WorkersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningKinds, setRunningKinds] = useState<Set<AgentWorkerKind>>(new Set());
  const pollersRef = useRef<Map<AgentWorkerKind, number>>(new Map());

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/workers`);
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
          const res = await fetch(`/api/agent-runs/${runId}`);
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
            if (run.status === "SUCCEEDED") {
              toast.success(tr ? "Uretim tamamlandi." : "Generation complete.");
            } else if (run.status === "FAILED") {
              toast.error(
                (tr ? "Uretim basarisiz: " : "Generation failed: ") +
                  (run.errorMsg ?? (tr ? "bilinmeyen hata" : "unknown error")),
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
    [fetchWorkers, tr],
  );

  const triggerWorker = useCallback(
    async (worker: WorkerItem) => {
      if (!worker.phase1Enabled) {
        toast.info(
          tr
            ? "Bu worker sonraki lansmanda geliyor."
            : "This worker is coming in the next launch.",
        );
        return;
      }
      if (worker.locked) {
        toast.error(
          tr
            ? `Plan yukseltilmeli: ${worker.minPlan}`
            : `Upgrade required: ${worker.minPlan}`,
        );
        return;
      }
      if (worker.remaining <= 0) {
        toast.error(
          tr
            ? `Kota doldu (${worker.used}/${worker.limit}). Plan yukseltin veya cycle reset'i bekleyin.`
            : `Quota exhausted (${worker.used}/${worker.limit}). Upgrade or wait for cycle reset.`,
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
            toast.error(
              err.message ||
                (tr
                  ? "Plan veya kota yetersiz."
                  : "Plan or quota insufficient."),
            );
          } else {
            toast.error(
              err.error ||
                (tr ? "Baslatilamadi" : "Failed to start"),
            );
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
        toast.error(tr ? "Baglanti hatasi" : "Connection error");
      }
    },
    [leadId, pollRun, tr],
  );

  const grouped = useMemo(() => {
    if (!data) return null;
    const g: Record<Group, WorkerItem[]> = {
      intelligence: [],
      pitch: [],
      deliverable: [],
      ops: [],
    };
    for (const w of data.workers) g[w.group].push(w);
    return g;
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#0A84FF]" />
            {tr ? "AI Agent" : "AI Workers"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {tr ? "Yukleniyor..." : "Loading..."}
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
              {tr ? "AI Agent" : "AI Workers"}
            </CardTitle>
            <p className="text-xs text-white/30 mt-1">
              {tr
                ? "Her lead icin uretilen AI worker paketleri. 4 grup, 14 is."
                : "AI worker packs generated per lead. 4 groups, 14 jobs."}
            </p>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {data.plan}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {(["pitch", "deliverable", "intelligence", "ops"] as Group[]).map((group) => {
          const items = grouped[group];
          if (!items.length) return null;
          const copy = GROUP_COPY[group];
          return (
            <section key={group} className="space-y-3">
              <div>
                <h3 className="text-[13px] font-semibold text-white/70">
                  {tr ? copy.titleTr : copy.title}
                </h3>
                <p className="text-[11px] text-white/30">
                  {tr ? copy.hintTr : copy.hint}
                </p>
              </div>
              <div className="space-y-2">
                {items.map((w) => (
                  <WorkerRow
                    key={w.kind}
                    worker={w}
                    tr={tr}
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
  tr,
  running,
  onGenerate,
}: {
  worker: WorkerItem;
  tr: boolean;
  running: boolean;
  onGenerate: () => void;
}) {
  const Icon = ICONS[worker.kind] ?? Sparkles;
  const name = tr ? worker.displayNameTr : worker.displayName;
  const desc = tr ? worker.descriptionTr : worker.description;
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
                    {tr ? "Yakinda" : "Soon"}
                  </Badge>
                )}
                {succeeded && (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CircleCheck className="w-3 h-3" /> {tr ? "Hazir" : "Ready"}
                  </Badge>
                )}
                {failed && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <CircleX className="w-3 h-3" /> {tr ? "Basarisiz" : "Failed"}
                  </Badge>
                )}
                {stuck && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" /> {tr ? "Takildi" : "Stuck"}
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
                  {tr
                    ? "Uretim 2 dakikadan uzundur bekliyor. Yeniden baslatmak icin 'Force retry' butonuna bas."
                    : "Generation has been waiting over 2 minutes. Click 'Force retry' to restart."}
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
                    {tr ? "Ac" : "Open"}
                  </Button>
                </a>
              )}
              {succeeded && latest && worker.exportFormats.length > 0 && (
                <ExportMenu
                  runId={latest.id}
                  formats={worker.exportFormats}
                  tr={tr}
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
                    {tr ? "Calisiyor..." : "Running..."}
                  </>
                ) : stuck ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    {tr ? "Force retry" : "Force retry"}
                  </>
                ) : succeeded ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    {tr ? "Yeniden uret" : "Regenerate"}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    {tr ? "Uret" : "Generate"}
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

function ExportMenu({
  runId,
  formats,
  tr,
}: {
  runId: string;
  formats: string[];
  tr: boolean;
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
        {tr ? "Export" : "Export"}
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
