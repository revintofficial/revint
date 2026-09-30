import type { FineDineModule } from "@/lib/playbook/vertical-pack";

export const MODULE_LABELS: Record<FineDineModule, string> = {
  order_and_pay: "Sipariş ve ödeme", qr_menu: "QR menü", reservation: "Rezervasyon",
  ai_menu_builder: "Yapay zekâ menüsü", crm_loyalty: "CRM ve sadakat", multi_language: "Çoklu dil", website: "Web sitesi", multi_location: "Çoklu lokasyon",
};
export function moduleLabel(id: string): string { return MODULE_LABELS[id as FineDineModule] ?? "Bilinmeyen modül"; }
export function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []; }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value : null; }
function score(value: unknown): number | null { return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null; }
export type DecisionCard = ReturnType<typeof toDecisionCard>;
export function toDecisionCard(outputJson: unknown, context: { finishedAt?: string | null; locationCount?: number } = {}) {
  const output = object(outputJson);
  const head = object(output.headAgent);
  const recommendedModules = Array.isArray(head.recommendedModules) ? head.recommendedModules.map(v => text(object(v).module)).filter((v): v is string => v !== null) : [];
  const talkTrack = text(head.talkTrack);
  const claimSentences = [
    ...(Array.isArray(head.sourceConflicts) ? head.sourceConflicts.map(v => text(object(v).claim)).filter((v): v is string => v !== null) : []),
    ...(talkTrack?.match(/[^.!?]+[.!?]*/g) ?? []).map(v => v.trim()).filter(v => /%|upsell/i.test(v)),
  ];
  return {
    salesConfidence: score(output.salesConfidence), headline: text(output.headline), hasHeadAgent: Object.keys(head).length > 0,
    confidence: score(head.confidence), recommendedModules, primaryModule: recommendedModules[0] ?? null,
    primaryAngle: text(head.primaryAngle), talkTrack, recommendedPackage: text(head.recommendedPackage),
    excludedModules: Array.isArray(head.excludedModules) ? head.excludedModules.map(v => ({ module: text(object(v).module) ?? "", why: text(object(v).why) ?? "" })) : [],
    claimSentences, reasoning: text(head.reasoning), evidenceRefs: strings(head.evidenceRefs),
    finishedAt: context.finishedAt ?? null, locationCount: context.locationCount ?? 1, briefMode: text(output.briefMode),
  };
}
