import type { ReviewLens } from "@/generated/prisma/client";
import { skipReasonText } from "@/lib/control/evidence-shelf";
import { LENS_LABELS } from "@/lib/control/lenses";
import { isSkippedBrief, listRecentBriefs } from "@/lib/control/review";
import { formatRate } from "@/lib/control/stats";
import { prisma } from "@/lib/prisma";

/**
 * The control room is one pipeline: brief → three verdicts → reference case
 * → baseline count → candidate run. Each stage feeds the next, so an empty
 * screen further down is always explained by a stage above it. This module
 * says where a workspace stands and which single step is next.
 */
export type FlowState = "done" | "next" | "open" | "locked";
export type FlowStage = {
  key: "brief" | "verdict" | "case" | "baseline" | "candidate";
  title: string;
  /** The number that matters at this stage. */
  count: string;
  /** What the number means, or why the stage is locked. */
  detail: string;
  /** Path under /admin/control (no query string). */
  path: string;
  action: string;
  state: FlowState;
};

export type FlowInput = {
  lens: ReviewLens | null;
  /** Briefs of the last 14 days that carry a decision, with the lenses each still misses. */
  briefs: Array<{ agentRunId: string; missingLenses: ReviewLens[] }>;
  /** `skipped` reason of the newest brief when it stopped before deciding, else null. */
  latestSkip: string | null;
  /** sourceRunId of every reference case in the workspace. */
  caseSourceRunIds: Array<string | null>;
  lastBaseline: { passed: number; total: number } | null;
  lastCandidate: { passed: number; total: number } | null;
};

type Draft = Omit<FlowStage, "state"> & { status: "done" | "pending" | "locked" };

export function buildFlowStages(input: FlowInput): FlowStage[] {
  const briefs = input.briefs.length;
  const complete = input.briefs.filter((b) => b.missingLenses.length === 0);
  const mineOpen = input.lens ? input.briefs.filter((b) => b.missingLenses.includes(input.lens!)).length : 0;
  const cases = input.caseSourceRunIds.length;
  const promoted = new Set(input.caseSourceRunIds.filter(Boolean));
  const promotable = complete.filter((b) => !promoted.has(b.agentRunId)).length;
  const skipNote = input.latestSkip ? ` En yeni brief karar üretmeden durdu: ${skipReasonText(input.latestSkip)}` : "";

  const drafts: Draft[] = [
    {
      key: "brief",
      title: "1 · Brief",
      count: String(briefs),
      detail: briefs > 0
        ? `Son 14 günde karar taşıyan brief.${skipNote}`
        : `Son 14 günde karar taşıyan brief yok; aşağıdaki her adım bunu bekler.${skipNote}`,
      path: briefs > 0 ? "/trace" : "/deneme",
      action: briefs > 0 ? "Vaka izini aç" : "Deneme'de zinciri çalıştır",
      status: briefs > 0 ? "done" : "pending",
    },
    {
      key: "verdict",
      title: "2 · Üç mercek hükmü",
      count: `${complete.length}/${briefs}`,
      detail: briefs === 0
        ? "Bakılacak brief olmadan hüküm yazılamaz."
        : input.lens
          ? mineOpen > 0
            ? `${mineOpen} brief senin merceğini (${LENS_LABELS[input.lens]}) bekliyor.`
            : complete.length === briefs
              ? "Bütün brief'lerde üç mercek tamam."
              : "Senin merceğin tamam; kalanlar diğer mercekleri bekliyor."
          : "Sana mercek atanmadı. Hüküm yazmak için yöneticinin Mercekler'den atama yapması gerekir.",
      path: "/reviews",
      action: "İncelemeyi aç",
      status: briefs === 0 ? "locked" : complete.length === briefs ? "done" : "pending",
    },
    {
      key: "case",
      title: "3 · Referans vaka",
      count: String(cases),
      detail: promotable > 0
        ? `${promotable} brief üç merceği tamamladı ve vakaya çevrilmeyi bekliyor. İncelemede "Referans vaka yap" ile beklenen kuralları yaz.`
        : complete.length === 0
          ? "Bir brief'te üç mercek tamamlanmadan vaka açılmaz."
          : "Üç merceği tamamlanan her brief vakaya çevrildi.",
      path: "/golden",
      action: "Referans vakaları aç",
      status: promotable > 0 ? "pending" : cases > 0 ? "done" : "locked",
    },
    {
      key: "baseline",
      title: "4 · Taban sayımı",
      count: input.lastBaseline ? formatRate(input.lastBaseline.passed, input.lastBaseline.total) : "Koşulmadı",
      detail: cases === 0
        ? "Referans vaka olmadan sayılacak bir şey yok."
        : input.lastBaseline
          ? "Saklanan çıktıların beklenen kurallara uyma oranı. Model çağırmaz."
          : "Referans vakalar hazır; saklanan çıktıları kurallarla say.",
      path: "/golden",
      action: "Taban sayımını başlat",
      status: cases === 0 ? "locked" : input.lastBaseline ? "done" : "pending",
    },
    {
      key: "candidate",
      title: "5 · Aday koşu",
      count: input.lastCandidate ? formatRate(input.lastCandidate.passed, input.lastCandidate.total) : "Koşulmadı",
      detail: !input.lastBaseline
        ? "Karşılaştırılacak taban sayımı olmadan aday koşulmaz."
        : input.lastCandidate
          ? "Bugünkü head agent'ın donmuş girdiden ürettiği kararların geçme oranı."
          : "Taban hazır; bugünkü head agent'ı aynı vakalarda koştur ve bozulanı gör.",
      path: "/golden/compare",
      action: "Karşılaştırmayı aç",
      status: !input.lastBaseline ? "locked" : input.lastCandidate ? "done" : "pending",
    },
  ];

  // Exactly one stage is "next": the first one that is neither done nor locked.
  let nextTaken = false;
  return drafts.map(({ status, ...stage }) => {
    if (status !== "pending") return { ...stage, state: status };
    const state: FlowState = nextTaken ? "open" : "next";
    nextTaken = true;
    return { ...stage, state };
  });
}

/** The one-line answer to "what do I do now?". */
export function flowHeadline(stages: FlowStage[]): string {
  const next = stages.find((stage) => stage.state === "next");
  if (!next) return "Akışın bütün adımları tamam. Kapılara bak.";
  return `Sıradaki adım: ${next.title.replace(/^\d+ · /, "")}. ${next.detail}`;
}

function rate(summary: unknown): { passed: number; total: number } | null {
  if (typeof summary !== "object" || summary === null) return null;
  const { passed, total } = summary as { passed?: unknown; total?: unknown };
  return typeof passed === "number" && typeof total === "number" ? { passed, total } : null;
}

export async function getFlowStages(workspaceId: string, lens: ReviewLens | null, now = new Date()): Promise<FlowStage[]> {
  const [briefs, latest, cases, baseline, candidate] = await Promise.all([
    listRecentBriefs(workspaceId, now),
    prisma.agentRun.findFirst({
      where: { workspaceId, workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED" },
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
      select: { outputJson: true },
    }),
    prisma.evalCase.findMany({ where: { workspaceId }, select: { sourceRunId: true } }),
    prisma.evalRun.findFirst({ where: { workspaceId, status: "SUCCEEDED", label: "taban" }, orderBy: { createdAt: "desc" }, select: { summaryJson: true } }),
    prisma.evalRun.findFirst({ where: { workspaceId, status: "SUCCEEDED", label: "aday" }, orderBy: { createdAt: "desc" }, select: { summaryJson: true } }),
  ]);
  const skipped = latest && isSkippedBrief(latest.outputJson) ? (latest.outputJson as { skipped: unknown }).skipped : null;
  return buildFlowStages({
    lens,
    briefs,
    latestSkip: skipped == null ? null : typeof skipped === "string" ? skipped : "unknown",
    caseSourceRunIds: cases.map((row) => row.sourceRunId),
    lastBaseline: rate(baseline?.summaryJson),
    lastCandidate: rate(candidate?.summaryJson),
  });
}
