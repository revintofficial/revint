import type { AgentWorkerKind } from "@/generated/prisma/client";

/**
 * The trace rows the control room renders, in chain order.
 *
 * One group per step of the automatic lead chain — keep in sync with
 * `getDefaultChain` and `LEAD_PIPELINE_ALLOWED_WORKERS` in
 * `src/lib/ai-core/chains.ts`. A group with no run for a lead renders
 * as "çalışmadı" rather than disappearing, so a missing step is
 * visible instead of silent.
 *
 * `kinds` is an array because a group may later cover more than one
 * worker (the site group is the candidate: audit plus page text).
 *
 * See docs/admin-paneli-son-karar.md §5 (Çelişki 1).
 */
export const TRACE_GROUPS: ReadonlyArray<{
  label: string;
  kinds: AgentWorkerKind[];
}> = [
  { label: "Harita", kinds: ["APIFY_GMAPS_DEEP"] },
  { label: "Site", kinds: ["WEBSITE_AUDITOR"] },
  { label: "Yorum", kinds: ["REVIEW_ANALYST"] },
  { label: "Karar", kinds: ["LEAD_INTELLIGENCE_BRIEF"] },
];

/**
 * Turkish group label for a worker kind, or null when the worker is
 * not part of the automatic chain (a click-triggered worker such as
 * OPENER_WRITER, or a retired one on an old run). Callers render
 * those under a separate heading instead of inventing a group.
 */
export function groupForKind(kind: AgentWorkerKind): string | null {
  for (const group of TRACE_GROUPS) {
    if (group.kinds.includes(kind)) return group.label;
  }
  return null;
}
