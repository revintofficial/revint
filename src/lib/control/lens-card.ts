import type { ReviewLens } from "@/generated/prisma/client";
import { moduleLabel, type DecisionCard } from "@/lib/control/decision";
import { formatControlDate, packageText } from "@/lib/control/labels";

export const LENS_QUESTION: Record<ReviewLens, string> = {
  TECHNICAL: "Bu bulgu hangi kaynaktan, ne zaman geldi?",
  DOMAIN: "Bu hesapta bu sıra ve bu paket uyar mı?",
  SALES: "Bu cümleyi yarın söyler miyim?",
};

export const LENS_ERROR_CLASSES: Record<ReviewLens, readonly string[]> = {
  TECHNICAL: ["STALE_SOURCE", "PIPELINE_OMISSION"],
  DOMAIN: ["PACKAGE_MISMATCH", "PLAYBOOK_VIOLATION", "SCORE_CALIBRATION", "PIPELINE_OMISSION"],
  SALES: ["IDENTITY_MISMATCH", "UNSUPPORTED_CLAIM", "STALE_SOURCE"],
};

// Worker run status, duration and cost are not on the review card any
// more: the evidence shelf (evidence-shelf.ts) shows each worker's claim
// next to its source, and duration / dollars stay in Vaka izi.

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
      { label: "Paket", value: card.recommendedPackage ? packageText(card.recommendedPackage) : "Paket yok" },
      { label: "Hariç tutulanlar", value: excluded },
    ];
    if (!card.hasHeadAgent) rows.push({ label: "Karar", value: "Head agent kararı yok" });
    return rows;
  }
  return [
    { label: "Konuşma", value: card.talkTrack ?? "Konuşma yok" },
    { label: "Aynı hesaptaki lokasyon", value: String(card.locationCount) },
    { label: "Paket", value: card.recommendedPackage ? packageText(card.recommendedPackage) : "Paket yok" },
    { label: "İddialar", value: claims },
    { label: "Açı", value: card.primaryAngle ?? "Açı yok" },
    { label: "ICP uyumu", value: card.salesConfidence == null ? "Puan yok" : String(card.salesConfidence) },
  ];
}
