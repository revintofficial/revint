import type { AgentWorkerKind } from "@/generated/prisma/client";
import { rerunLeadWorker } from "@/lib/control/rerun";
import type { ControlRole } from "@/lib/control/roles";
import { TRACE_GROUPS } from "@/lib/control/trace-groups";
import { prisma } from "@/lib/prisma";

/**
 * Worker trial ("Deneme"): run one chain worker again on a handful of leads
 * and read what changed, without opening the database. The comparison is the
 * newest finished run against the successful run before it, field by field.
 */

export const TRIAL_MAX_LEADS = 10;
const LEAD_LIST_LIMIT = 60;
const VALUE_MAX = 220;
const DIFF_MAX = 40;

/** The workers a trial may run: the four steps of the automatic chain. */
export const TRIAL_KINDS: AgentWorkerKind[] = TRACE_GROUPS.flatMap((group) => group.kinds);

export function isTrialKind(value: string): value is AgentWorkerKind {
  return (TRIAL_KINDS as string[]).includes(value);
}

export type FieldChange = { path: string; before: string; after: string; kind: "added" | "removed" | "changed" };

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0 && prefix) out.set(prefix, "{}");
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, out);
    return;
  }
  // Arrays are compared whole: an index-by-index diff of a reordered list reads as noise.
  if (prefix) out.set(prefix, value === undefined ? "yok" : typeof value === "string" ? value : JSON.stringify(value));
}

function clip(text: string): string {
  return text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX)}… (${text.length} karakter)` : text;
}

/** Field-level difference between two worker outputs. Unchanged fields are left out. */
export function diffOutputs(before: unknown, after: unknown): { changes: FieldChange[]; hidden: number } {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flatten(before, "", a);
  flatten(after, "", b);
  const changes: FieldChange[] = [];
  for (const path of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const from = a.get(path);
    const to = b.get(path);
    if (from === to) continue;
    changes.push({
      path,
      before: from === undefined ? "—" : clip(from),
      after: to === undefined ? "—" : clip(to),
      kind: from === undefined ? "added" : to === undefined ? "removed" : "changed",
    });
  }
  return { changes: changes.slice(0, DIFF_MAX), hidden: Math.max(0, changes.length - DIFF_MAX) };
}

type RunLite = { id: string; status: string; createdAt: string; startedAt: string | null; finishedAt: string | null; costUsdCents: number; errorMsg: string | null };

export type TrialRow = {
  leadId: string;
  businessName: string;
  websiteUrl: string | null;
  /** Newest run of this worker for the lead, any status. null = the worker never ran here. */
  latest: RunLite | null;
  /** true while the newest run is still queued or running. */
  inFlight: boolean;
  /** The successful run the newest finished run is compared against. */
  previousFinishedAt: string | null;
  /** null when there is nothing to compare (first run, or the newest run did not succeed). */
  diff: { changes: FieldChange[]; hidden: number } | null;
  /** Plain reason when `diff` is null. */
  note: string | null;
};

const OK = new Set(["SUCCEEDED", "SUCCEEDED_NO_MEMORY"]);

export async function listTrialRows(workspaceId: string, kind: AgentWorkerKind): Promise<TrialRow[]> {
  const [leads, runs] = await Promise.all([
    prisma.lead.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: LEAD_LIST_LIMIT,
      select: { id: true, businessName: true, websiteUrl: true },
    }),
    prisma.agentRun.findMany({
      where: { workspaceId, workerKind: kind, leadId: { not: null } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 600,
      select: { id: true, leadId: true, status: true, createdAt: true, startedAt: true, finishedAt: true, costUsdCents: true, errorMsg: true, outputJson: true },
    }),
  ]);

  const byLead = new Map<string, typeof runs>();
  for (const run of runs) {
    if (!run.leadId) continue;
    const bucket = byLead.get(run.leadId) ?? [];
    bucket.push(run);
    byLead.set(run.leadId, bucket);
  }

  const rows = leads.map((lead): TrialRow => {
    const mine = byLead.get(lead.id) ?? [];
    const newest = mine[0] ?? null;
    const base = { leadId: lead.id, businessName: lead.businessName, websiteUrl: lead.websiteUrl };
    if (!newest) return { ...base, latest: null, inFlight: false, previousFinishedAt: null, diff: null, note: "Bu worker bu lead'de hiç çalışmadı." };
    const latest: RunLite = {
      id: newest.id,
      status: newest.status,
      createdAt: newest.createdAt.toISOString(),
      startedAt: newest.startedAt?.toISOString() ?? null,
      finishedAt: newest.finishedAt?.toISOString() ?? null,
      costUsdCents: newest.costUsdCents,
      errorMsg: newest.errorMsg,
    };
    const inFlight = newest.status === "PENDING" || newest.status === "RUNNING";
    if (inFlight) return { ...base, latest, inFlight, previousFinishedAt: null, diff: null, note: "Çalışıyor; bitince fark burada görünür." };
    if (!OK.has(newest.status)) return { ...base, latest, inFlight, previousFinishedAt: null, diff: null, note: newest.errorMsg || "Son koşu başarısız; hata mesajı yok." };
    const previous = mine.slice(1).find((run) => OK.has(run.status)) ?? null;
    if (!previous) return { ...base, latest, inFlight, previousFinishedAt: null, diff: null, note: "İlk başarılı koşu; karşılaştırılacak önceki sonuç yok." };
    return {
      ...base,
      latest,
      inFlight,
      previousFinishedAt: previous.finishedAt?.toISOString() ?? null,
      diff: diffOutputs(previous.outputJson, newest.outputJson),
      note: null,
    };
  });

  // Leads with a recent run first, so the trial just started stays on top.
  return rows.sort((x, y) => (y.latest?.createdAt ?? "").localeCompare(x.latest?.createdAt ?? ""));
}

export type TrialStart = { started: string[]; notQueued: string[]; rejected: Array<{ leadId: string; error: string }> };

/** Queue one new run per lead. Old results stay; every run is audited by `rerunLeadWorker`. */
export async function startWorkerTrial(input: {
  actorUserId: string;
  actorRole: ControlRole;
  workspaceId: string;
  workerKind: AgentWorkerKind;
  leadIds: string[];
  reason: string;
}): Promise<TrialStart> {
  const result: TrialStart = { started: [], notQueued: [], rejected: [] };
  for (const leadId of [...new Set(input.leadIds)].slice(0, TRIAL_MAX_LEADS)) {
    const run = await rerunLeadWorker({
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      workspaceId: input.workspaceId,
      leadId,
      workerKind: input.workerKind,
      reason: input.reason,
    });
    if (!run.ok) result.rejected.push({ leadId, error: run.error });
    else if (run.enqueued) result.started.push(leadId);
    else result.notQueued.push(leadId);
  }
  return result;
}
