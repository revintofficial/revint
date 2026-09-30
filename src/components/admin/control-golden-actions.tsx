"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function StartEvalForm({ workspaceId, canStart, candidate = false, caseCount = 0, active = false }: { workspaceId: string; canStart: boolean; candidate?: boolean; caseCount?: number; active?: boolean }) {
 const router = useRouter();
 const [confirmed,setConfirmed] = useState(false), [pending,setPending] = useState(false), [message,setMessage] = useState("");
 async function start() {
  setPending(true); setMessage("");
  try {
   const response = await fetch("/api/admin/control/golden/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, label: candidate ? "aday" : "taban", confirmed, caseCount }) });
   const result = await response.json();
   if (!response.ok) { setMessage(result.error || "Koşu başlamadı."); return; }
   setMessage(candidate ? "Aday kuyruğa alındı. Tamamlandığında koşu listesini yenile." : `Taban sayımı tamamlandı: ${result.passed}/${result.total} geçti.`);
   setConfirmed(false); router.refresh();
  } catch { setMessage("Bağlantı kurulamadı. Koşu durumunu yenileyerek kontrol et."); }
  finally { setPending(false); }
 }
 return <div className="space-y-3 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
  {candidate ? <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!canStart || active || !caseCount} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{caseCount} vaka: her vaka bugünkü head agent ile bir kez karar üretir, lead’e yazılmaz. Model kullanımı oluşur. Onaylıyorum.</label> : <p className="text-sm">Saklanan cevaplar insanın yazdığı kurallarla sayılır. Model çağrılmaz.</p>}
  <button disabled={!canStart || pending || active || (candidate && (!confirmed || !caseCount))} onClick={start} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">{candidate ? "Donmuş girdiden aday kararları üret" : "Saklanan çıktıları taban olarak say"}</button>
  {!canStart && <p className="text-sm">{candidate ? "Aday koşuyu Yönetici başlatır." : "Taban sayımını İnceleyen başlatır."}</p>}
  {candidate && !caseCount && <p className="text-sm">Önce üç merceğin baktığı brief için bir İnceleyen referans vaka kaydetmeli.</p>}
  {active && <p className="text-sm">Bu alanda bir aday koşu zaten sürüyor. Tamamlanmasını bekle.</p>}
  {candidate && <button onClick={() => router.refresh()} className="ml-3 rounded-lg border border-[var(--revint-border)] px-3 py-2 text-sm">Koşu durumunu yenile</button>}
  {message && <p role="status" className="text-sm">{message}</p>}
 </div>;
}
