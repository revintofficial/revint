"use client";

/**
 * Lead Pipeline Editor.
 *
 * Client-side configurator for `/app/settings/lead-pipeline`. Renders:
 *   1. Four preset cards (LITE / BALANCED / AGGRESSIVE / CUSTOM).
 *      Selecting a preset switches the workspace to that derivation
 *      and immediately fires a dry-run for live cost numbers.
 *   2. A "fine tune" panel listing every worker eligible for the
 *      lead pipeline grouped by registry group. Toggling a worker
 *      under any preset implicitly switches the workspace to CUSTOM.
 *   3. A footer summarising tokens, USD cents, and per-lead duration
 *      derived from the cost-estimator endpoint.
 *
 * State model:
 *   - `preset` is the active preset; CUSTOM means `steps` is the
 *     source of truth and presets are visual-only.
 *   - `steps` is what gets persisted on Save.
 *   - When the user toggles a worker, the editor flips preset to
 *     CUSTOM and rebuilds `steps` from the canonical defaults of the
 *     last named preset minus the toggled-off workers (or plus the
 *     toggled-on ones).
 *
 * Plan gating: workers whose `minPlan` exceeds the workspace plan
 * render with a lock + Upgrade badge and cannot be toggled on. They
 * already render disabled because the server-side filter never
 * surfaces them in `steps`, but we still show them so the user sees
 * what they unlock by upgrading.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Lock, Sparkles, Zap, Activity, Settings2 } from "lucide-react";
import type { Chain, ChainStep } from "@/lib/ai-core/chains";
import type { PipelineEstimate } from "@/lib/agent-workers/cost-estimator";
import type { AgentWorkerKind, Plan, PipelinePreset } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

interface WorkerSummary {
  kind: AgentWorkerKind;
  group: "intelligence" | "pitch" | "deliverable" | "ops" | "enrichment";
  displayName: string;
  description: string;
  minPlan: Plan;
  estimatedDurationMs: number;
}

interface InitialState {
  preset: PipelinePreset;
  enabled: boolean;
  steps: Chain;
  estimate: PipelineEstimate;
  updatedAt: string | null;
}

interface Props {
  workspaceId: string;
  plan: Plan;
  canEdit: boolean;
  initial: InitialState;
  workers: WorkerSummary[];
}

const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  PRO: 1,
  PRO_TEAM: 2,
  AGENCY: 3,
};

function planMeetsMinimum(plan: Plan, minPlan: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minPlan];
}

const PRESET_META: Record<PipelinePreset, {
  title: string;
  blurb: string;
  icon: typeof Sparkles;
  recommendedPlan: Plan;
}> = {
  LITE: {
    title: "Lite",
    blurb: "Bare-minimum scoring. Fastest, cheapest, FREE-friendly.",
    icon: Activity,
    recommendedPlan: "FREE",
  },
  BALANCED: {
    title: "Balanced",
    blurb: "Default. Adds social discovery + on-create dossier so the lead is rich the moment you open it.",
    icon: Sparkles,
    recommendedPlan: "FREE",
  },
  AGGRESSIVE: {
    title: "Aggressive",
    blurb: "Deep Apify enrichment + auto pitch-pack on every lead. Costs scale.",
    icon: Zap,
    recommendedPlan: "PRO",
  },
  CUSTOM: {
    title: "Custom",
    blurb: "Hand-pick exactly which workers run.",
    icon: Settings2,
    recommendedPlan: "FREE",
  },
};

const GROUP_LABELS: Record<WorkerSummary["group"], string> = {
  intelligence: "Intelligence",
  pitch: "Pitch",
  deliverable: "Deliverable",
  ops: "Ops",
  enrichment: "Enrichment (Apify)",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function formatCents(c: number): string {
  if (c === 0) return "$0";
  if (c < 100) return `$${(c / 100).toFixed(2)}`;
  return `$${(c / 100).toFixed(2)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export function LeadPipelineEditor({
  workspaceId,
  plan,
  canEdit,
  initial,
  workers,
}: Props) {
  const [preset, setPreset] = useState<PipelinePreset>(initial.preset);
  const [steps, setSteps] = useState<Chain>(initial.steps);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [estimate, setEstimate] = useState<PipelineEstimate>(initial.estimate);
  const [savedSnapshot, setSavedSnapshot] = useState<{
    preset: PipelinePreset;
    steps: Chain;
    enabled: boolean;
  }>({ preset: initial.preset, steps: initial.steps, enabled: initial.enabled });
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);

  const enabledKinds = useMemo(() => {
    const set = new Set<AgentWorkerKind>();
    for (const s of steps) set.add(s.workerKind);
    return set;
  }, [steps]);

  const dirty =
    preset !== savedSnapshot.preset ||
    enabled !== savedSnapshot.enabled ||
    JSON.stringify(steps) !== JSON.stringify(savedSnapshot.steps);

  // Live-estimate whenever the chain or preset changes locally.
  // Debounced to avoid hammering the API while the user clicks.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      setEstimating(true);
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/lead-pipeline/dry-run`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              preset,
              steps: preset === "CUSTOM" ? steps : undefined,
              leadCount: 100,
            }),
          },
        );
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { estimate: PipelineEstimate };
          setEstimate(data.estimate);
        }
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [preset, steps, workspaceId]);

  function selectPreset(next: PipelinePreset) {
    if (!canEdit || next === preset) return;
    setPreset(next);
    if (next !== "CUSTOM") {
      // When switching to a named preset, the server will recompute
      // the canonical chain. The optimistic local steps is the
      // current `initial.steps` for that preset; we rely on the
      // dry-run round-trip to refresh the cost footer.
      setSteps([]);
    }
  }

  /**
   * Toggling a single worker switches the workspace to CUSTOM and
   * mutates the local steps. Bringing a worker back to one of its
   * canonical positions re-creates a sensible step shell with safe
   * dependsOn defaults.
   */
  function toggleWorker(worker: WorkerSummary) {
    if (!canEdit) return;
    if (!planMeetsMinimum(plan, worker.minPlan)) {
      toast.error(`Upgrade to ${worker.minPlan} to enable ${worker.displayName}`);
      return;
    }
    // CUSTOM mode is implicit: any toggle flips the preset away from
    // a named one. The user can switch back via the preset cards.
    setPreset("CUSTOM");

    const baseline: Chain = preset === "CUSTOM" ? steps : initial.steps;
    if (enabledKinds.has(worker.kind)) {
      setSteps(removeStepByKind(baseline, worker.kind));
    } else {
      setSteps(addStepByKind(baseline, worker));
    }
  }

  async function save() {
    if (!canEdit || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/lead-pipeline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset,
          enabled,
          steps: preset === "CUSTOM" ? steps : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save pipeline");
        return;
      }
      const data = (await res.json()) as {
        preset: PipelinePreset;
        steps: Chain;
        enabled: boolean;
        estimate: PipelineEstimate;
      };
      setPreset(data.preset);
      setSteps(data.steps);
      setEnabled(data.enabled);
      setEstimate(data.estimate);
      setSavedSnapshot({
        preset: data.preset,
        steps: data.steps,
        enabled: data.enabled,
      });
      toast.success("Pipeline saved");
    } finally {
      setSaving(false);
    }
  }

  const groupedWorkers = useMemo(() => {
    const groups: Record<string, WorkerSummary[]> = {};
    for (const w of workers) {
      groups[w.group] = groups[w.group] ?? [];
      groups[w.group].push(w);
    }
    return groups;
  }, [workers]);

  return (
    <div className="space-y-6">
      {/* Preset cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(PRESET_META) as PipelinePreset[]).map((p) => {
          const meta = PRESET_META[p];
          const Icon = meta.icon;
          const active = preset === p;
          const recommended = !planMeetsMinimum(plan, meta.recommendedPlan);
          return (
            <button
              key={p}
              type="button"
              disabled={!canEdit}
              onClick={() => selectPreset(p)}
              className={cn(
                "text-left rounded-2xl p-4 transition-all border",
                active
                  ? "border-(--revint-500) shadow-[0_0_0_1px_var(--revint-500)]"
                  : "border-white/10 hover:border-white/20",
                !canEdit && "opacity-60 cursor-not-allowed",
              )}
              style={{
                background: active
                  ? "hsl(var(--revint-h) var(--revint-s) 50% / 0.10)"
                  : "hsl(var(--revint-h) var(--revint-ns) 11% / 0.5)",
              }}
              aria-pressed={active}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-white/80" />
                <span className="text-[14px] font-medium">{meta.title}</span>
                {recommended && (
                  <Badge variant="warning" className="ml-auto">
                    Upgrade
                  </Badge>
                )}
              </div>
              <p className="text-[12px] text-white/60 leading-snug">
                {meta.blurb}
              </p>
            </button>
          );
        })}
      </div>

      {/* Cost footer */}
      <Card>
        <CardContent className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="100 leads · Gemini tokens"
            value={formatTokens(estimate.totalTokens)}
            sublabel={`~${formatTokens(estimate.perLeadTokens)} per lead`}
            estimating={estimating}
          />
          <Stat
            label="100 leads · enrichment $"
            value={formatCents(estimate.totalCents)}
            sublabel={`~${formatCents(estimate.perLeadCents)} per lead`}
            estimating={estimating}
          />
          <Stat
            label="Per-lead wall clock"
            value={formatMs(estimate.perLeadDurationMs)}
            sublabel="longest path through DAG"
            estimating={estimating}
          />
        </CardContent>
      </Card>

      {/* Worker toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Fine tune</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedWorkers).map(([group, list]) => (
            <div key={group}>
              <div className="text-[11.5px] uppercase tracking-wider text-white/45 mb-2">
                {GROUP_LABELS[group as WorkerSummary["group"]] ?? group}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {list.map((w) => {
                  const isOn = enabledKinds.has(w.kind);
                  const locked = !planMeetsMinimum(plan, w.minPlan);
                  return (
                    <button
                      key={w.kind}
                      type="button"
                      disabled={!canEdit || locked}
                      onClick={() => toggleWorker(w)}
                      className={cn(
                        "text-left rounded-xl p-3 border transition-colors",
                        isOn ? "border-(--revint-500)/50" : "border-white/10",
                        (locked || !canEdit) && "opacity-60 cursor-not-allowed",
                      )}
                      style={{
                        background: isOn
                          ? "hsl(var(--revint-h) var(--revint-s) 50% / 0.08)"
                          : "transparent",
                      }}
                      aria-pressed={isOn}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">
                          {w.displayName}
                        </span>
                        {locked ? (
                          <Badge variant="warning" className="ml-auto inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> {w.minPlan}
                          </Badge>
                        ) : (
                          <Badge
                            variant={isOn ? "success" : "outline"}
                            className="ml-auto"
                          >
                            {isOn ? "On" : "Off"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11.5px] text-white/55 leading-snug">
                        {w.description}
                      </p>
                      <p className="mt-1 text-[10.5px] text-white/35">
                        ~{formatMs(w.estimatedDurationMs)} · min plan {w.minPlan}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 sticky bottom-3">
        <div className="text-[11.5px] text-white/50">
          {savedSnapshot.preset === preset && !dirty
            ? `Saved ${initial.updatedAt ? new Date(initial.updatedAt).toLocaleString() : "—"}`
            : dirty
              ? "Unsaved changes"
              : ""}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5"
            >
              {enabled ? "Disable pipeline" : "Enable pipeline"}
            </button>
          )}
          <Button onClick={save} disabled={!canEdit || !dirty || saving}>
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sublabel,
  estimating,
}: {
  label: string;
  value: string;
  sublabel: string;
  estimating: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-white/45 mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[22px] font-semibold tabular-nums">{value}</div>
        {estimating && <Loader2 className="w-3 h-3 animate-spin text-white/40" />}
      </div>
      <div className="text-[11px] text-white/40">{sublabel}</div>
    </div>
  );
}

/**
 * Removes every step whose worker matches `kind` and rewires the
 * dependsOn graph so dependents transitively connect to the removed
 * step's own dependencies. Mirrors the server's `filterByPlan`
 * helper so the UI graph stays consistent with what would be saved.
 */
function removeStepByKind(chain: Chain, kind: AgentWorkerKind): Chain {
  const removed = new Set(
    chain.filter((s) => s.workerKind === kind).map((s) => s.stepId),
  );
  if (removed.size === 0) return chain;

  function transitive(stepId: string, seen = new Set<string>()): string[] {
    if (seen.has(stepId)) return [];
    seen.add(stepId);
    const orig = chain.find((s) => s.stepId === stepId);
    if (!orig) return [];
    const out: string[] = [];
    for (const d of orig.dependsOn) {
      if (!removed.has(d)) out.push(d);
      else out.push(...transitive(d, seen));
    }
    return out;
  }

  return chain
    .filter((s) => !removed.has(s.stepId))
    .map((s) => ({
      ...s,
      dependsOn: Array.from(
        new Set(
          s.dependsOn.flatMap((d) => (removed.has(d) ? transitive(d) : [d])),
        ),
      ),
    }));
}

/**
 * Appends a step for `worker` at the end of the chain with empty
 * `dependsOn`. The orchestrator will treat it as a fan-out root which
 * is the safest default for a worker that the user just toggled on
 * without specifying ordering. The user can refine via "Custom" if
 * needed.
 */
function addStepByKind(chain: Chain, worker: WorkerSummary): Chain {
  if (chain.some((s) => s.workerKind === worker.kind)) return chain;
  const stepId = uniqueStepId(chain, worker.kind);
  const next: ChainStep = {
    stepId,
    workerKind: worker.kind,
    dependsOn: [],
    optional: true,
  };
  return [...chain, next];
}

function uniqueStepId(chain: Chain, kind: AgentWorkerKind): string {
  const base = kind.toLowerCase();
  if (!chain.some((s) => s.stepId === base)) return base;
  let i = 2;
  while (chain.some((s) => s.stepId === `${base}_${i}`)) i++;
  return `${base}_${i}`;
}
