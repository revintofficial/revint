import type { AgentWorkerKind, ReviewLens } from "@/generated/prisma/client";
import { moduleLabel, type DecisionCard } from "@/lib/control/decision";
import { TRACE_GROUPS } from "@/lib/control/trace-groups";
import { crmStatusLabel, formatControlDate, formatDuration, formatUsd, runStatusLabel } from "@/lib/control/labels";

export const LENS_QUESTION: Record<ReviewLens, string> = {
  TECHNICAL: "Sistem bu kararı hangi kaynaktan, hangi maliyetle üretti?",
  DOMAIN: "Bu hesapta modül sırası ve paket satışa uyar mı?",
  SALES: "Bir SDR bunu görünce ne yapmalı?",
};

export const LENS_ERROR_CLASSES: Record<ReviewLens, readonly string[]> = {
  TECHNICAL: ["STALE_SOURCE", "PIPELINE_OMISSION"],
  DOMAIN: ["PACKAGE_MISMATCH", "PLAYBOOK_VIOLATION", "SCORE_CALIBRATION", "PIPELINE_OMISSION"],
  SALES: ["IDENTITY_MISMATCH", "UNSUPPORTED_CLAIM", "STALE_SOURCE"],
};

// Groups come from the chain definition, not a copy of it. When a
// worker leaves the automatic chain it must leave this surface in the
// same commit, otherwise the control room shows a row that can never
// fill (SALES_OPPORTUNITY_SCORER was that row until 2026-09-29).

export type SourceRun = {
  workerKind: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  costUsdCents: number;
  errorMsg: string | null;
};

export type SourceCrm = {
  objectType: string;
  status: string;
  lastError: string | null;
};

function modeLabel(briefMode: string | null): string {
  if (briefMode === "head-agent") return "Head agent";
  if (briefMode) return "Brief analizi";
  return "Mod bilgisi yok";
}

export function lensDecisionRows(card: DecisionCard, lens: ReviewLens): Array<{ label: string; value: string }> {
  const modules = card.recommendedModules.map((id, index) => `${index + 1}. ${moduleLabel(id)}`).join(" · ") || "Modül yok";
  const excluded = card.excludedModules.map((item) => `${moduleLabel(item.module)}: ${item.why}`).join(" · ") || "Hariç yok";
  const claims = card.claimSentences.join(" · ") || "İddia yok";
  if (lens === "TECHNICAL") {
    return [
      { label: "İddialar", value: claims },
      { label: "Kaynak zamanı (brief bitişi)", value: card.finishedAt ? formatControlDate(card.finishedAt) : "Zaman yok" },
      { label: "Kanıt", value: card.evidenceRefs.join(" · ") || "Kanıt yok" },
      { label: "Karar üretimi", value: modeLabel(card.briefMode) },
    ];
  }
  if (lens === "DOMAIN") {
    const rows = [
      { label: "ICP uyumu", value: card.salesConfidence == null ? "Puan yok" : String(card.salesConfidence) },
      { label: "Karar güveni", value: card.confidence == null ? "Güven yok" : String(card.confidence) },
      { label: "Birincil modül", value: card.primaryModule ? moduleLabel(card.primaryModule) : "Birincil yok" },
      { label: "Modüller (öncelik sırası)", value: modules },
      { label: "Paket", value: card.recommendedPackage ?? "Paket yok" },
      { label: "Hariç tutulanlar", value: excluded },
    ];
    if (!card.hasHeadAgent) rows.push({ label: "Karar", value: "Head agent kararı yok" });
    return rows;
  }
  return [
    { label: "Konuşma", value: card.talkTrack ?? "Konuşma yok" },
    { label: "Aynı hesaptaki lokasyon", value: String(card.locationCount) },
    { label: "Paket", value: card.recommendedPackage ?? "Paket yok" },
    { label: "İddialar", value: claims },
    { label: "Açı", value: card.primaryAngle ?? "Açı yok" },
    { label: "ICP uyumu", value: card.salesConfidence == null ? "Puan yok" : String(card.salesConfidence) },
  ];
}

export function technicalSourceLines(runs: SourceRun[], crm: SourceCrm[]): Array<{ group: string; value: string }> {
  const workers = TRACE_GROUPS.flatMap(({ label, kinds }) => {
    const matched = runs.filter((run) => kinds.includes(run.workerKind as AgentWorkerKind));
    if (!matched.length) return [{ group: label, value: "Kayıt yok" }];
    return matched.map((run) => ({
      group: label,
      value: [runStatusLabel(run.status), formatDuration(run.startedAt, run.finishedAt), formatUsd(run.costUsdCents), run.errorMsg].filter(Boolean).join(" · "),
    }));
  });
  const crmLines = crm.length
    ? crm.map((row) => ({
        group: "CRM",
        value: [row.objectType, crmStatusLabel(row.status), row.lastError].filter(Boolean).join(" · "),
      }))
    : [{ group: "CRM", value: "Kayıt yok" }];
  return [...workers, ...crmLines];
}
