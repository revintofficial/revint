"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EvidenceShelf } from "@/components/admin/evidence-shelf";
import {
  ERROR_CLASS_OPTIONS,
  PACKAGE_OPTIONS,
  SEVERITY_OPTIONS,
  WEDGE_OPTIONS,
  errorClassLabel,
  sdrFlagLabel,
  severityLabel,
  verdictLabel,
} from "@/lib/control/labels";
import { LENSES, LENS_LABELS } from "@/lib/control/lenses";
import { LENS_QUESTION } from "@/lib/control/lens-card";
import { MODULE_LABELS, moduleLabel } from "@/lib/control/decision";
import { RUBRIC, RUBRIC_ENTRIES, RUBRIC_VERSION, rubricEntry } from "@/lib/control/rubric";
import type { Drawer, ShelfLead } from "@/lib/control/evidence-shelf";
import type { ReviewView, ReviewViewRow } from "@/lib/control/review";
import type { ReviewLens } from "@/generated/prisma/client";
import type { DecisionCard } from "@/lib/control/trace";

type QueueRow = {
  leadId: string;
  businessName: string;
  salesConfidence: number | null;
  primaryModule: string | null;
  missingLenses: ReviewLens[];
  sdrFlag?: string | null;
};

export type ReviewSelection = {
  businessName: string;
  lead: ShelfLead;
  decision: DecisionCard;
  drawers: Drawer[];
  agentRunId: string;
  view: ReviewView;
  nextLeadId: string | null;
};

/** "Teknik", "Teknik ve Alan", "Teknik, Alan ve Satış". */
function joinTr(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}`;
}

/** Lenses still missing on this run, including the viewer's own lens when it has not voted. */
export function allMissingLenses(view: ReviewView): ReviewLens[] {
  const missing = new Set(view.missingLenses);
  if (view.lens && !view.ownReview) missing.add(view.lens);
  return LENSES.filter(l => missing.has(l));
}

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
  selected: ReviewSelection | null;
}) {
  const router = useRouter();
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;

  if (queue.length === 0 && !selected) {
    return <p className="text-sm text-[var(--revint-text-2)]">İncelemesi eksik brief yok. FineDine ekibi başarılı bir brief ürettiğinde burada görünür; Teknik, Alan ve Satış aynı kartı değerlendirir.</p>;
  }

  const missingAll = selected ? allMissingLenses(selected.view) : [];

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
              {row.sdrFlag && (
                <span className="mt-1 inline-block rounded-md border border-[var(--revint-warning)] px-1.5 py-0.5 text-xs text-[var(--revint-warning)]">{sdrFlagLabel(row.sdrFlag)}</span>
              )}
              <span className="mt-1 block text-xs text-[var(--revint-text-2)]">ICP {row.salesConfidence ?? "puan yok"} · {row.primaryModule ? moduleLabel(row.primaryModule) : "Birincil yok"}</span>
              <span className="mt-1 block text-xs text-[var(--revint-text-3)]">{LENSES.filter(l => !row.missingLenses.includes(l)).map(l => `${LENS_LABELS[l]} baktı.`).join(" ")} Beklenen: {row.missingLenses.map(l => LENS_LABELS[l]).join(", ")}</span>
            </button>
          );
        })}
      </aside>
      {selected && (
        <section className="flex min-h-[70vh] flex-col rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)]">
          <div className="flex-1 space-y-4 p-4">
            <LeadStrip name={selected.businessName} lead={selected.lead} />
            <p className="text-xs text-[var(--revint-text-3)]">Rubrik sürümü {selected.view.rubricVersion || RUBRIC_VERSION} · Bu karar analizi değiştirmez; çalıştırmanın çıktısı yerinde kalır.</p>
            {lens && <p className="text-sm text-[var(--revint-text-2)]">{LENS_QUESTION[lens]}</p>}
            <EvidenceShelf drawers={selected.drawers} lens={lens} />
            <Verdicts view={selected.view} />
            <PromoteForm
              key={`promote-${selected.agentRunId}`}
              workspaceId={workspaceId}
              canPromote={canReview && missingAll.length === 0}
              missing={missingAll}
              businessName={selected.businessName}
              agentRunId={selected.agentRunId}
              reviewId={selected.view.ownReview?.id ?? selected.view.priorReviews[0]?.id ?? null}
            />
          </div>
          <ReviewForm
            key={`review-${selected.agentRunId}`}
            lens={lens}
            workspaceId={workspaceId}
            leadId={selectedLeadId ?? ""}
            agentRunId={selected.agentRunId}
            canReview={canReview}
            ownReview={selected.view.ownReview}
          />
        </section>
      )}
    </div>
  );
}

function LeadStrip({ name, lead }: { name: string; lead: ShelfLead }) {
  return (
    <div className="space-y-1 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-surface)] p-3">
      <h2 className="text-lg font-semibold text-[var(--revint-text-1)]">{name || "İsimsiz işletme"}</h2>
      <p className="text-sm text-[var(--revint-text-2)]">
        {lead.address || "Adres yok"} · Puan {lead.rating == null ? "yok" : lead.rating.toLocaleString("tr-TR")} · {lead.reviewCount == null ? "Yorum sayısı yok" : `${lead.reviewCount} yorum`}
      </p>
      <p className="flex flex-wrap gap-3 text-sm">
        {lead.websiteUrl
          ? <a href={lead.websiteUrl} target="_blank" rel="noreferrer noopener" className="text-[var(--revint-500)] underline">Siteyi aç</a>
          : <span className="text-[var(--revint-text-3)]">Site adresi yok</span>}
        {lead.googleMapsUri
          ? <a href={lead.googleMapsUri} target="_blank" rel="noreferrer noopener" className="text-[var(--revint-500)] underline">Haritada aç</a>
          : <span className="text-[var(--revint-text-3)]">Harita bağlantısı yok</span>}
      </p>
    </div>
  );
}

function reviewLine(row: ReviewViewRow): string {
  const parts = [verdictLabel(row.verdict)];
  if (row.errorClass) parts.push(errorClassLabel(row.errorClass));
  if (row.severity) parts.push(severityLabel(row.severity));
  if (row.rubricVersion !== RUBRIC_VERSION) parts.push(`rubrik ${row.rubricVersion}`);
  return parts.join(" · ") + (row.note ? ` — ${row.note}` : "");
}

/**
 * Independent verdicts: until this lens has written its own, other lens
 * verdicts, SDR feedback and adjudications stay hidden. Which lenses are
 * missing is always shown (that is not a verdict).
 */
function Verdicts({ view }: { view: ReviewView }) {
  const missingLine = view.missingLensNames.length
    ? `${joinTr(view.missingLensNames)} bakmadı.`
    : view.lens ? "Diğer mercekler baktı." : "Üç mercek de baktı.";
  return (
    <div className="space-y-2" data-testid="verdicts">
      <h3 className="text-sm font-medium">Mercek hükümleri</h3>
      <p className="text-sm text-[var(--revint-text-2)]">{missingLine}</p>
      {view.ownReview && view.lens && (
        <p className="text-sm text-[var(--revint-text-1)]">Senin hükmün ({LENS_LABELS[view.lens]}): {reviewLine(view.ownReview)}</p>
      )}
      {!view.revealed ? (
        <p className="text-sm text-[var(--revint-text-2)]">Diğer merceklerin hükmü, SDR geri bildirimi ve uzlaştırma sen kendi hükmünü kaydedince açılır. Böylece hükümler birbirinden bağımsız kalır.</p>
      ) : (
        <>
          {view.priorReviews.map(row => (
            <p key={row.id} className="text-sm text-[var(--revint-text-2)]">{row.lens ? LENS_LABELS[row.lens] : "Mercek"}: {reviewLine(row)}</p>
          ))}
          {view.sdrReviews.map(row => (
            <p key={row.id} className="text-sm text-[var(--revint-text-2)]">
              SDR geri bildirimi (kapıya sayılmaz): {row.verdict === "FAIL" ? sdrFlagLabel(row.errorClass ?? "") : "Brief'i kullandı."}{row.note ? ` — ${row.note}` : ""}
            </p>
          ))}
          {view.adjudications.map(row => (
            <p key={row.id} className="text-sm text-[var(--revint-text-2)]">Uzlaştırma (yönetici): {verdictLabel(row.verdict)}{row.note ? ` — ${row.note}` : ""}</p>
          ))}
        </>
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
  ownReview,
}: {
  workspaceId: string;
  leadId: string;
  agentRunId: string;
  canReview: boolean;
  lens: ReviewLens | null;
  ownReview: ReviewViewRow | null;
}) {
  const router = useRouter();
  // Card open time; reviewSeconds = save time − this. The server keeps 1–1800 s, else null.
  const openedAt = useRef<number | null>(null);
  useEffect(() => {
    openedAt.current = Date.now();
  }, [agentRunId]);
  const [verdict, setVerdict] = useState<"PASS" | "FAIL" | "NEEDS_REVIEW">("PASS");
  const [errorClass, setErrorClass] = useState("");
  const [severity, setSeverity] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fail = verdict === "FAIL";
  const entries = lens ? RUBRIC[lens] : RUBRIC_ENTRIES;

  const missingForFail = fail ? [!errorClass && "sınıf", !severity && "ciddiyet", note.trim().length === 0 && "not"].filter(Boolean) as string[] : [];
  const disabledReason = !canReview
    ? (lens ? "Karar yazmak İnceleyen işidir." : "Hüküm yazmak için yöneticinin sana bir mercek ataması gerekir.")
    : missingForFail.length ? `Kaldı için ${missingForFail.join(", ")} gerekir.` : null;

  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const reviewSeconds = openedAt.current ? Math.round((Date.now() - openedAt.current) / 1000) : null;
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
          reviewSeconds,
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
      {ownReview && <p className="text-xs text-[var(--revint-text-3)]">Bu brief için hükmünü yazdın. Yeniden kaydedersen en yenisi sayılır.</p>}
      <div className="flex flex-wrap gap-2">
        {([
          ["PASS", "Geçti"],
          ["FAIL", "Kaldı"],
          ["NEEDS_REVIEW", "Tekrar bak"],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" disabled={!canReview} aria-pressed={verdict === value} onClick={() => setVerdict(value)} className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${verdict === value ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
            {label}
          </button>
        ))}
      </div>
      {fail && (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm text-[var(--revint-text-2)]">Sınıf (rubrik {RUBRIC_VERSION})</legend>
            {entries.map(entry => (
              <label key={entry.code} className={`block rounded-lg border px-3 py-2 text-sm ${errorClass === entry.code ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
                <span className="flex items-center gap-2 text-[var(--revint-text-1)]">
                  <input type="radio" name={`error-class-${agentRunId}`} value={entry.code} checked={errorClass === entry.code} disabled={!canReview} onChange={() => setErrorClass(entry.code)} />
                  {ERROR_CLASS_OPTIONS.find(o => o.value === entry.code)?.label ?? entry.label}
                </span>
                <span className="mt-1 block text-xs text-[var(--revint-text-2)]">Seç: {entry.include}</span>
                <span className="mt-0.5 block text-xs text-[var(--revint-text-3)]">Seçme: {entry.exclude}</span>
              </label>
            ))}
          </fieldset>
          {errorClass && rubricEntry(errorClass) && (
            <details className="text-xs text-[var(--revint-text-2)]">
              <summary>Çapa örnekleri</summary>
              <p className="mt-1">Doğru: {rubricEntry(errorClass)!.goodExample}</p>
              <p className="mt-1">Yanlış: {rubricEntry(errorClass)!.badExample}</p>
            </details>
          )}
          <label className="block text-sm text-[var(--revint-text-2)]">
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
      <button type="button" disabled={Boolean(disabledReason) || pending} onClick={save} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
        Kararı kaydet
      </button>
      {disabledReason && <p className="text-sm text-[var(--revint-text-2)]">{disabledReason}</p>}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}

type Preview = { state: "idle" | "loading" | "ok" | "invalid" | "error"; text: string };

function parseScore(value: string): number | undefined | "invalid" {
  if (!value.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : "invalid";
}

function PromoteForm({
  missing,
  workspaceId,
  canPromote,
  businessName,
  agentRunId,
  reviewId,
}: {
  workspaceId: string;
  canPromote: boolean;
  missing: ReviewLens[];
  businessName: string;
  agentRunId: string;
  reviewId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(businessName);
  const [expectedPackage, setExpectedPackage] = useState("");
  const [expectedWedge, setExpectedWedge] = useState("");
  const [icpMin, setIcpMin] = useState("");
  const [icpMax, setIcpMax] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [claims, setClaims] = useState<string[]>([]);
  const [angles, setAngles] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview>({ state: "idle", text: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const min = parseScore(icpMin);
  const max = parseScore(icpMax);
  const localError = min === "invalid" || max === "invalid"
    ? "Kurallar geçersiz: puan 0–100 arası tam sayı olmalı."
    : min != null && max != null && min > max ? "Kurallar geçersiz: alt sınır üst sınırı geçemez." : null;
  const expected = localError ? null : {
    ...(expectedPackage ? { expectedPackage } : {}),
    ...(expectedWedge ? { expectedWedge } : {}),
    ...(min != null ? { icpMin: min } : {}),
    ...(max != null ? { icpMax: max } : {}),
    allowedModules: modules,
    forbiddenClaims: claims,
    forbiddenAngles: angles,
  };
  const expectedKey = JSON.stringify(expected);

  // Live preview: the server scores the frozen brief output against these rules. No model call, nothing saved.
  useEffect(() => {
    if (!open) return;
    if (localError) {
      setPreview({ state: "invalid", text: localError });
      return;
    }
    const controller = new AbortController();
    setPreview({ state: "loading", text: "Önizleme hesaplanıyor…" });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/admin/control/golden/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, agentRunId, expected: JSON.parse(expectedKey) }),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => null);
        if (response.status === 400) {
          setPreview({ state: "invalid", text: typeof result?.error === "string" ? result.error : "Kurallar geçersiz." });
          return;
        }
        if (!response.ok || !result) {
          setPreview({ state: "error", text: "Önizleme alınamadı; kaydetmeden önce yeniden dene." });
          return;
        }
        const failures: Array<{ message: string }> = Array.isArray(result.failures) ? result.failures : [];
        setPreview({ state: "ok", text: result.passed ? "Bu kurallarla donmuş çıktı geçer" : failures.map(f => f.message).join(" · ") || "Kalır" });
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return;
        setPreview({ state: "error", text: "Önizleme alınamadı; kaydetmeden önce yeniden dene." });
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, expectedKey, localError, workspaceId, agentRunId]);

  const saveBlocker = !canPromote ? "Referans vaka kapalı."
    : !reviewId ? "Önce bir hüküm yaz. Referans vaka o hükümden çıkar."
    : !title.trim() ? "Vaka başlığı gerekir."
    : preview.state === "invalid" ? preview.text
    : preview.state !== "ok" ? "Önizleme bitmeden kaydedilemez."
    : null;

  async function save() {
    if (saveBlocker || !expected) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/golden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reviewId, title, agentRunId, expected }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setMessage(typeof result?.error === "string" ? result.error : "Referans vaka kaydedilemedi.");
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
            <Choice label="Beklenen paket" value={expectedPackage} onChange={setExpectedPackage} options={PACKAGE_OPTIONS} />
            <Choice label="Beklenen kaçak" value={expectedWedge} onChange={setExpectedWedge} options={WEDGE_OPTIONS} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Puan alt sınırı" value={icpMin} onChange={setIcpMin} inputMode="numeric" />
              <Field label="Puan üst sınırı" value={icpMax} onChange={setIcpMax} inputMode="numeric" />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm">İzinli birincil modüller (ikincil sinyal; boşsa modül kuralı uygulanmaz)</legend>
            {Object.entries(MODULE_LABELS).map(([id, label]) => (
              <label key={id} className="mr-3 inline-flex gap-2 text-sm">
                <input type="checkbox" checked={modules.includes(id)} onChange={e => setModules(current => e.target.checked ? [...current, id] : current.filter(m => m !== id))} />
                {label}
              </label>
            ))}
          </fieldset>
          <ListField label="Yasak iddialar" items={claims} onChange={setClaims} />
          <ListField label="Yasak açılar" items={angles} onChange={setAngles} />
          <p role="status" className={`text-sm ${preview.state === "invalid" || preview.state === "error" ? "text-[var(--revint-warning)]" : "text-[var(--revint-text-1)]"}`}>{preview.text}</p>
          <button type="button" disabled={pending || Boolean(saveBlocker)} onClick={save} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">Referans vakayı kaydet</button>
          {saveBlocker && <p className="text-xs text-[var(--revint-text-3)]">{saveBlocker}</p>}
        </div>
      )}
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}

function Field({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "numeric" }) {
  return (
    <label className="block text-sm text-[var(--revint-text-2)]">
      {label}
      <input value={value} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]" />
    </label>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm text-[var(--revint-text-2)]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]">
        <option value="">Kural yok</option>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** One phrase per entry — commas inside a phrase stay intact (no comma-split, no JSON). */
function ListField({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  };
  return (
    <div className="space-y-1 text-sm text-[var(--revint-text-2)]">
      <div className="flex items-end gap-2">
        <label className="block w-full">
          {label} (her satır bir ifade)
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
            className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]"
          />
        </label>
        <button type="button" onClick={add} disabled={!draft.trim()} className="rounded-lg border border-[var(--revint-border)] px-3 py-2 text-sm disabled:opacity-50">Ekle</button>
      </div>
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {items.map(item => (
            <li key={item} className="inline-flex items-center gap-1 rounded-md border border-[var(--revint-border)] px-2 py-0.5 text-xs text-[var(--revint-text-1)]">
              {item}
              <button type="button" aria-label={`${item} kaldır`} onClick={() => onChange(items.filter(i => i !== item))} className="text-[var(--revint-text-3)]">×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
