"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DecisionCardView } from "@/components/admin/decision-card";
import { ERROR_CLASS_OPTIONS, SEVERITY_OPTIONS, severityLabel, stayLabel, verdictLabel } from "@/lib/control/labels";
import { parseExpected, scoreOutput, type ScoredOutput } from "@/lib/control/score";
import { currentLensReviews, LENSES, LENS_LABELS } from "@/lib/control/lenses";
import { LENS_ERROR_CLASSES, type SourceCrm, type SourceRun } from "@/lib/control/lens-card";
import { MODULE_LABELS, moduleLabel } from "@/lib/control/decision";
import type { ReviewLens } from "@/generated/prisma/client";
import type { DecisionCard } from "@/lib/control/trace";

type QueueRow = {
  leadId: string;
  businessName: string;
  salesConfidence: number | null;
  primaryModule: string | null;
  missingLenses: ReviewLens[];
};

type PriorReview = {
  lens: ReviewLens | null;
  id: string;
  verdict: string;
  errorClass: string | null;
  severity: string | null;
  note: string | null;
  createdAt: string;
};

export function ReviewInbox({
  workspaceId,
  canReview,
  queue,
  lens,
  selectedLeadId,
  selected,
}: {
  workspaceId: string;
  canReview: boolean;
  queue: QueueRow[];
  lens: ReviewLens | null;
  selectedLeadId: string | null;
  selected: {
    missingLenses: ReviewLens[];
    businessName: string;
    decision: DecisionCard;
    runs: SourceRun[];
    crm: SourceCrm[];
    output: ScoredOutput;
    agentRunId: string | null;
    reviews: PriorReview[];
    nextLeadId: string | null;
  } | null;
}) {
  const router = useRouter();
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;

  if (queue.length === 0 && !selected) {
    return <p className="text-sm text-[var(--revint-text-2)]">İncelemesi eksik brief yok. FineDine ekibi başarılı bir brief ürettiğinde burada görünür; Teknik, Alan ve Satış aynı kartı değerlendirir.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-2">
        {queue.map((row) => {
          const active = row.leadId === selectedLeadId;
          return (
            <button
              key={row.leadId}
              type="button"
              onClick={() => router.push(`/admin/control/reviews?${query}&lead=${row.leadId}`)}
              className={`block w-full rounded-xl border px-3 py-3 text-left ${active ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)] bg-[var(--revint-card)]"}`}
            >
              <span className="block text-sm font-medium text-[var(--revint-text-1)]">{row.businessName || "İsimsiz işletme"}</span>
              <span className="mt-1 block text-xs text-[var(--revint-text-2)]">ICP {row.salesConfidence ?? "puan yok"} · {row.primaryModule ? moduleLabel(row.primaryModule) : "Birincil yok"}</span>
              <span className="mt-1 block text-xs text-[var(--revint-text-3)]">{LENSES.filter(l => !row.missingLenses.includes(l)).map(l => `${LENS_LABELS[l]} baktı.`).join(" ")} Beklenen: {row.missingLenses.map(l => LENS_LABELS[l]).join(", ")}</span>
            </button>
          );
        })}
      </aside>
      {selected && (
        <section className="flex min-h-[70vh] flex-col rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)]">
          <div className="flex-1 space-y-4 p-4">
            <h2 className="text-lg font-semibold">{selected.businessName || "İsimsiz işletme"}</h2>
            <p className="text-sm text-[var(--revint-text-2)]">Bu karar analizi değiştirmez. Çalıştırmanın çıktısı yerinde kalır.</p>
            <DecisionCardView decision={selected.decision} lens={lens} runs={selected.runs} crm={selected.crm} />
            <div className="space-y-2">
              {selected.reviews.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Henüz hüküm yok. Teknik, Alan ve Satış bu kartı okuyup kendi hükmünü kaydetmeli.</p>}
              <h3 className="text-sm font-medium">Güncel mercek hükümleri</h3>
              {currentLensReviews(selected.reviews).map((review) => (
                <p key={review.id} className="text-sm text-[var(--revint-text-2)]">
                  {review.lens ? LENS_LABELS[review.lens] : "Eski merceksiz kayıt (kapıya sayılmaz)"}: {verdictLabel(review.verdict)}{review.errorClass ? ` · ${ERROR_CLASS_OPTIONS.find(o => o.value === review.errorClass)?.label ?? "İnceleme sınıfı"}` : ""}{review.severity ? ` · ${severityLabel(review.severity)}` : ""}
                  {review.note ? ` — ${review.note}` : ""}
                </p>
              ))}
            </div>
            <details className="text-sm"><summary>Önceki hükümleri ve merceksiz kayıtları göster</summary>{selected.reviews.map(review => <p key={review.id}>{review.lens ? LENS_LABELS[review.lens] : "Eski merceksiz kayıt (kapıya sayılmaz)"}: {verdictLabel(review.verdict)} · {review.note || "Not yok"}</p>)}</details>
            <PromoteForm
              key={selected.agentRunId}
              workspaceId={workspaceId}
              canPromote={canReview && selected.missingLenses.length === 0}
              missing={selected.missingLenses}
              output={selected.output}
              businessName={selected.businessName}
              agentRunId={selected.agentRunId}
              reviewId={selected.reviews[0]?.id ?? null}
            />
          </div>
          <ReviewForm
            key={selected.agentRunId}
            lens={lens}
            workspaceId={workspaceId}
            leadId={selectedLeadId ?? ""}
            agentRunId={selected.agentRunId}
            canReview={canReview}
            nextLeadId={selected.nextLeadId}
          />
        </section>
      )}
    </div>
  );
}

function ReviewForm({
  lens,
  workspaceId,
  leadId,
  agentRunId,
  canReview,
}: {
  workspaceId: string;
  leadId: string;
  agentRunId: string | null;
  canReview: boolean;
  nextLeadId: string | null;
  lens: ReviewLens | null;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "NEEDS_REVIEW">("PASS");
  const [errorClass, setErrorClass] = useState("");
  const [severity, setSeverity] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fail = verdict === "FAIL";

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          leadId,
          agentRunId,
          verdict,
          lens,
          errorClass: fail ? errorClass : null,
          severity: fail ? severity : null,
          note,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(typeof result?.error === "string" ? result.error : "Karar kaydedilemedi.");
        return;
      }
      const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
      router.push(`/admin/control/reviews?${query}&lead=${leadId}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="sticky bottom-0 space-y-3 border-t border-[var(--revint-border)] bg-[var(--revint-surface)] p-4">
      <p className="text-sm">{lens ? `${LENS_LABELS[lens]} merceği: yalnızca kendi hükmünü kaydet.` : "Sana bir mercek atanmadı."}</p>
      <div className="flex flex-wrap gap-2">
        {([
          ["PASS", "Geçti"],
          ["FAIL", "Kaldı"],
          ["NEEDS_REVIEW", "Tekrar bak"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" disabled={!canReview} onClick={() => setVerdict(value)} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${verdict === value ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {fail && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[var(--revint-text-2)]">
            Sınıf
            <select value={errorClass} disabled={!canReview} onChange={(event) => setErrorClass(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-3 py-2 text-sm">
              <option value="">Sınıf seç</option>
              {ERROR_CLASS_OPTIONS.filter((option) => !lens || LENS_ERROR_CLASSES[lens].includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--revint-text-2)]">
            Ciddiyet
            <select value={severity} disabled={!canReview} onChange={(event) => setSeverity(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-3 py-2 text-sm">
              <option value="">Ciddiyet seç</option>
              {SEVERITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      )}
      <label className="block text-sm text-[var(--revint-text-2)]">
        Not
        <textarea value={note} disabled={!canReview} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-card)] px-3 py-2 text-sm text-[var(--revint-text-1)] disabled:opacity-60" />
      </label>
      <button type="button" disabled={!canReview || pending || (fail && (!errorClass || !severity || note.trim().length === 0))} onClick={save} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
        Kararı kaydet
      </button>
      {!canReview && <p className="text-sm text-[var(--revint-text-2)]">Karar yazmak İnceleyen işidir.</p>}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}

function PromoteForm({
  missing,
  workspaceId,
  canPromote,
  output,
  businessName,
  agentRunId,
  reviewId,
}: {
  workspaceId: string;
  canPromote: boolean;
  missing: ReviewLens[];
  output: ScoredOutput;
  businessName: string;
  agentRunId: string | null;
  reviewId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(businessName);
  const [icpMin, setIcpMin] = useState("");
  const [icpMax, setIcpMax] = useState("");
  const [modules, setModules] = useState("");
  const [claims, setClaims] = useState("");
  const [angles, setAngles] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => {
    try {
    const result = scoreOutput(output, parseExpected({
      icpMin: icpMin.trim() ? Number(icpMin) : undefined,
      icpMax: icpMax.trim() ? Number(icpMax) : undefined,
      allowedModules: splitList(modules),
      forbiddenClaims: splitList(claims),
      forbiddenAngles: splitList(angles),
    }));
    if (result.passed) return "Bu kurallarla donmuş çıktı geçer";
    return result.failures.map(f => stayLabel(f.code)).join(" · ");
    } catch { return "Kurallar geçersiz: puan aralığını kontrol et."; }
  }, [angles, claims, icpMax, icpMin, modules, output]);

  async function save() {
    if (!reviewId) {
      setMessage("Önce bir karar yaz. Referans vaka o karardan çıkar.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/golden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          reviewId,
          title,
          agentRunId,
          expected: {
            icpMin: icpMin.trim() ? Number(icpMin) : undefined,
            icpMax: icpMax.trim() ? Number(icpMax) : undefined,
            allowedModules: splitList(modules),
            forbiddenClaims: splitList(claims),
            forbiddenAngles: splitList(angles),
          },
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(result?.error || "Referans vaka kaydedilemedi.");
        return;
      }
      setMessage("Referans vaka kaydedildi.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" disabled={!canPromote} onClick={() => setOpen((value) => !value)} className="rounded-lg border border-[var(--revint-border)] px-3 py-2 text-sm disabled:opacity-50">
        Referans vaka yap
      </button>
      {!canPromote && <p className="text-sm text-[var(--revint-text-2)]">{missing.length ? `Eksik mercekler: ${missing.map(l => LENS_LABELS[l]).join(", ")}. Her mercek kendi hükmünü kaydetmeli.` : "Referans vaka eklemek merceği atanmış İnceleyen işidir."}</p>}
      {open && (
        <div className="space-y-3 rounded-xl border border-[var(--revint-border)] p-3">
          <p className="text-sm text-[var(--revint-text-2)]">Beklenen davranışı sen yaz. AI çıktısı kurallara kopyalanmaz. Önizleme donmuş çıktıyı sayar; model çağırmaz.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Vaka başlığı" value={title} onChange={setTitle} />
            <Field label="Puan alt sınırı" value={icpMin} onChange={setIcpMin} />
            <Field label="Puan üst sınırı" value={icpMax} onChange={setIcpMax} />
          </div>
          <fieldset className="space-y-2"><legend className="text-sm">İzinli birincil modüller (boşsa modül kuralı uygulanmaz)</legend>{Object.entries(MODULE_LABELS).map(([id,label]) => <label key={id} className="mr-3 inline-flex gap-2 text-sm"><input type="checkbox" checked={splitList(modules).includes(id)} onChange={e => setModules((e.target.checked ? [...splitList(modules),id] : splitList(modules).filter(m => m !== id)).join(","))} />{label}</label>)}</fieldset>
          <Field label="Yasak iddialar (virgülle ayır)" value={claims} onChange={setClaims} />
          <Field label="Yasak açılar (virgülle ayır)" value={angles} onChange={setAngles} />
          <p className="text-sm text-[var(--revint-text-1)]">{preview}</p>
          <button type="button" disabled={pending || !title.trim() || !canPromote || preview.startsWith("Kurallar geçersiz")} onClick={save} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">Referans vakayı kaydet</button>
        </div>
      )}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm text-[var(--revint-text-2)]">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]" />
    </label>
  );
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
