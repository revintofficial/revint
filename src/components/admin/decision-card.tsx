import type { ReviewLens } from "@/generated/prisma/client";
import { moduleLabel, type DecisionCard } from "@/lib/control/decision";
import { formatControlDate } from "@/lib/control/labels";
import { LENS_QUESTION, technicalSourceLines, lensDecisionRows, type SourceCrm, type SourceRun } from "@/lib/control/lens-card";
export function DecisionCardView({ decision: d, lens = null, runs = [], crm = [] }: { decision: DecisionCard; lens?: ReviewLens | null; runs?: SourceRun[]; crm?: SourceCrm[] }) {
 if (lens) {
  const rows = lensDecisionRows(d, lens);
  const sources = lens === "TECHNICAL" ? technicalSourceLines(runs, crm) : [];
  return (
   <div className="space-y-3">
    <p className="text-sm text-[var(--revint-text-2)]">{LENS_QUESTION[lens]}</p>
    <dl className="grid gap-3 sm:grid-cols-2">{rows.map((row) => <div key={row.label}><dt className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{row.label}</dt><dd className="whitespace-pre-wrap text-sm text-[var(--revint-text-1)]">{row.value}</dd></div>)}</dl>
    {sources.length > 0 && (
     <ul className="space-y-2">
      {sources.map((line, index) => (
       <li key={`${line.group}-${index}`} className="text-sm text-[var(--revint-text-1)]"><span className="text-[var(--revint-text-3)]">{line.group}</span> · {line.value}</li>
      ))}
     </ul>
    )}
   </div>
  );
 }
 const rows = [
  ["ICP uyumu", d.salesConfidence == null ? "Puan yok" : String(d.salesConfidence)],
  ["Brief başlığı", d.headline ?? "Başlık yok"],
  ...(d.hasHeadAgent ? [
   ["Karar güveni", d.confidence == null ? "Güven yok" : String(d.confidence)],
   ["Birincil modül", d.primaryModule ? moduleLabel(d.primaryModule) : "Birincil yok"],
   ["Modüller (öncelik sırası)", d.recommendedModules.map((m,i) => `${i+1}. ${moduleLabel(m)}`).join(" · ") || "Modül yok"],
   ["Açı", d.primaryAngle ?? "Açı yok"], ["Konuşma", d.talkTrack ?? "Konuşma yok"],
   ["Paket", d.recommendedPackage ?? "Paket yok"],
   ["Hariç tutulanlar", d.excludedModules.map(m => `${moduleLabel(m.module)}: ${m.why}`).join(" · ") || "Hariç yok"],
   ["İddialar", d.claimSentences.join(" · ") || "İddia yok"],
   ["Kanıt", d.evidenceRefs.join(" · ") || "Kanıt yok"],
  ] : [["Karar", "Head agent kararı yok"]]),
  ["Kaynak zamanı (brief bitişi)", d.finishedAt ? formatControlDate(d.finishedAt) : "Zaman yok"],
  ["Aynı hesaptaki lokasyon", String(d.locationCount)],
  ["Karar üretimi", d.briefMode === "head-agent" ? "Head agent" : d.briefMode ? "Brief analizi" : "Mod bilgisi yok"],
 ];
 return <dl className="grid gap-3 sm:grid-cols-2">{rows.map(([label,value]) => <div key={label}><dt className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{label}</dt><dd className="whitespace-pre-wrap text-sm text-[var(--revint-text-1)]">{value}</dd></div>)}</dl>;
}
