/**
 * App Card "decision" block for a head-agent brief. The card used to
 * build these rows from the playbook angle and an older LeadNextAction,
 * which could contradict the brief shown two rows above.
 */
import type { HeadAgentWritebackView } from "./writeback";

export interface CardDecision {
  recommendedAngle: string | null;
  recommendedAngleKey: string | null;
  pitchThis: string | null;
  whatNotToPitch: string | null;
  nextBestAction: string | null;
  evidenceSummary: string | null;
  openQuestions: string | null;
}

function bullets(lines: string[]): string | null {
  return lines.length > 0 ? lines.map((l) => `- ${l}`).join("\n") : null;
}

/** `null` = not a head-agent brief; the caller keeps its playbook fallback. */
export function headAgentCardDecision(view: HeadAgentWritebackView | null): CardDecision | null {
  if (!view || view.briefMode !== "head-agent") return null;
  return {
    recommendedAngle: view.primaryAngle,
    recommendedAngleKey: view.wedge,
    pitchThis: view.talkTrack,
    whatNotToPitch: bullets([...view.bans, ...view.excludedModules.map((m) => `${m.module}: ${m.why}`)]),
    nextBestAction: view.talkTrack,
    evidenceSummary: bullets(view.evidenceRefs),
    openQuestions: bullets([...view.openQuestions, ...view.missingSources.map((s) => `Eksik kaynak: ${s}`)]),
  };
}
