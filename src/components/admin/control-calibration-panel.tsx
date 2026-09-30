"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { diffValues } from "@/lib/control/diff";
import { calibrationStatusLabel } from "@/lib/control/labels";
import type { SalesClaim } from "@/lib/control/score";

type Snapshot = {
  icpJson: Record<string, unknown>;
  packagesJson: Array<Record<string, unknown>>;
  claimsJson: { claims: SalesClaim[] };
  playbookJson: Record<string, unknown>;
  pipelineJson: { preset: string; steps: unknown[]; enabled: boolean };
};

const TABS = [
  ["icp", "ICP"],
  ["packages", "Paketler"],
  ["playbook", "Oyun kitabı"],
  ["pipeline", "Boru hattı"],
  ["claims", "İddialar"],
] as const;

export function CalibrationPanel({
  workspaceId,
  role,
  actorUserId,
  tab,
  today,
  live,
  active,
  draft,
}: {
  workspaceId: string;
  role: string;
  actorUserId: string;
  tab: string;
  today: string;
  live: Snapshot;
  active: { version: number; status: string; activatedAt: string | null; activatedBy: string } | null;
  draft: { id: string; version: number; createdByUserId: string; reason: string; snapshot: Snapshot } | null;
}) {
  const router = useRouter();
  const source = draft?.snapshot ?? live;
  const [minRating, setMinRating] = useState(textOf(source.icpJson.minRating));
  const [priceMin, setPriceMin] = useState(textOf(source.icpJson.priceLevelMin));
  const [priceMax, setPriceMax] = useState(textOf(source.icpJson.priceLevelMax));
  const [minReviews, setMinReviews] = useState(textOf(source.icpJson.minReviewCount));
  const [description, setDescription] = useState(typeof source.icpJson.description === "string" ? source.icpJson.description : "");
  const [claims, setClaims] = useState<SalesClaim[]>(source.claimsJson.claims);
  const [reason, setReason] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [rollbackReason, setRollbackReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const canDraft = role === "REVIEWER" || role === "ADMIN";
  const isAuthor = draft?.createdByUserId === actorUserId;
  const canPublish = role === "ADMIN" && Boolean(draft) && !isAuthor;
  const canRollback = role === "ADMIN";
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;

  const editedIcp = {
    ...source.icpJson,
    minRating: numberOrNull(minRating),
    priceLevelMin: numberOrNull(priceMin),
    priceLevelMax: numberOrNull(priceMax),
    minReviewCount: numberOrNull(minReviews),
    description,
  };
  const lines = useMemo(
    () => [
      ...diffValues(live.icpJson, editedIcp),
      ...diffValues(
        { claims: live.claimsJson.claims.map((claim) => claim.text) },
        { claims: claims.map((claim) => claim.text) },
      ),
    ],
    [claims, editedIcp, live.claimsJson.claims, live.icpJson],
  );

  async function saveDraft() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/calibration/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          reason,
          icp: editedIcp,
          claims,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : "Taslak kaydedilemedi.");
        return;
      }
      setReason("");
      setMessage("Taslak kaydedildi.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function publish() {
    if (!draft) return;
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/calibration/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, versionId: draft.id, reason: publishReason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : "Yayın kabul edilmedi.");
        return;
      }
      setPublishReason("");
      setMessage("Yayınlandı.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function rollback() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/control/calibration/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reason: rollbackReason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(typeof result?.error === "string" ? result.error : "Geri alma kabul edilmedi.");
        return;
      }
      setRollbackReason("");
      setMessage("Canlı ayar önceki sürüme döndü.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
        {active ? (
          <p className="text-sm text-[var(--revint-text-1)]">
            Sürüm {active.version} · {calibrationStatusLabel(active.status)}
            {active.activatedBy ? ` · ${active.activatedBy}` : ""}
            {active.activatedAt ? ` · ${active.activatedAt}` : ""}
          </p>
        ) : (
          <p className="text-sm text-[var(--revint-text-2)]">Henüz yayın yok.</p>
        )}
      </section>
      <div className="flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`/admin/control/calibration?${query}&tab=${id}`} className={`rounded-lg border px-3 py-2 text-sm ${tab === id ? "border-[var(--revint-500)] bg-[var(--revint-hover)]" : "border-[var(--revint-border)]"}`}>
            {label}
          </Link>
        ))}
      </div>
      {tab === "icp" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Puan alt sınırı" value={minRating} onChange={setMinRating} />
          <Field label="Fiyat alt sınırı" value={priceMin} onChange={setPriceMin} />
          <Field label="Fiyat üst sınırı" value={priceMax} onChange={setPriceMax} />
          <Field label="Minimum yorum" value={minReviews} onChange={setMinReviews} />
          <label className="sm:col-span-2 text-sm text-[var(--revint-text-2)]">
            Açıklama
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]" />
          </label>
        </div>
      )}
      {tab === "packages" && <PackageList packages={live.packagesJson} />}
      {tab === "playbook" && <p className="text-sm text-[var(--revint-text-2)]">{playbookSummary(live.playbookJson)}</p>}
      {tab === "pipeline" && <p className="text-sm text-[var(--revint-text-2)]">{pipelineSummary(live.pipelineJson)}</p>}
      {tab === "claims" && (
        <ClaimsEditor claims={claims} today={today} onChange={setClaims} />
      )}
      {lines.length > 0 && (
        <ul className="space-y-1 text-sm text-[var(--revint-text-1)]">
          {lines.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
      <details className="rounded-xl border border-[var(--revint-border)] p-3 text-sm">
        <summary className="cursor-pointer text-[var(--revint-text-2)]">Ham JSON</summary>
        <pre className="mt-3 overflow-auto text-xs text-[var(--revint-text-3)]">{JSON.stringify({ icp: editedIcp, claims }, null, 2)}</pre>
      </details>
      <label className="block text-sm text-[var(--revint-text-2)]">
        Taslak gerekçesi
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} disabled={!canDraft} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm disabled:opacity-60" />
      </label>
      <button type="button" disabled={!canDraft || pending || reason.trim().length === 0} onClick={saveDraft} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
        Taslağı kaydet
      </button>
      {!canDraft && <p className="text-sm text-[var(--revint-text-2)]">Taslak yazmak İnceleyen işidir.</p>}
      <section className="space-y-2 rounded-xl border border-[var(--revint-border)] p-4">
        <p className="text-sm text-[var(--revint-text-2)]">ICP güncellenir, paketler bu alandakilerin yerine geçer, oyun kitabı ve boru hattı yazılır, önceki yayındaki sürüm yerini aldı olur.</p>
        <label className="block text-sm text-[var(--revint-text-2)]">
          Yayın gerekçesi
          <textarea value={publishReason} onChange={(event) => setPublishReason(event.target.value)} rows={2} disabled={!canPublish} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm disabled:opacity-60" />
        </label>
        <button type="button" disabled={!canPublish || pending || publishReason.trim().length === 0} onClick={publish} className="rounded-lg bg-[var(--revint-500)] px-3 py-2 text-sm text-white disabled:opacity-50">
          Yayınla
        </button>
        {role === "ADMIN" && isAuthor && <p className="text-sm text-[var(--revint-text-2)]">Bunu sen yazdın. Yayınlaması başka bir yönetici.</p>}
        {role !== "ADMIN" && <p className="text-sm text-[var(--revint-text-2)]">Yayınlamak Yönetici işidir.</p>}
      </section>
      <section className="space-y-2">
        <p className="text-sm text-[var(--revint-text-3)]">Canlı ayar bir önceki sürüme döner.</p>
        <label className="block text-sm text-[var(--revint-text-2)]">
          Geri alma gerekçesi
          <textarea value={rollbackReason} onChange={(event) => setRollbackReason(event.target.value)} rows={2} disabled={!canRollback} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm disabled:opacity-60" />
        </label>
        <button type="button" disabled={!canRollback || pending || rollbackReason.trim().length === 0} onClick={rollback} className="rounded-lg border border-[var(--revint-border)] px-3 py-2 text-sm disabled:opacity-50">
          Geri al
        </button>
        {!canRollback && <p className="text-sm text-[var(--revint-text-2)]">Geri almak Yönetici işidir.</p>}
      </section>
      {message && <p className="text-sm text-[var(--revint-text-1)]">{message}</p>}
    </div>
  );
}

function ClaimsEditor({ claims, today, onChange }: { claims: SalesClaim[]; today: string; onChange: (claims: SalesClaim[]) => void }) {
  if (claims.length === 0) return <p className="text-sm text-[var(--revint-text-2)]">İddia yok.</p>;
  return (
    <ul className="space-y-3">
      {claims.map((claim, index) => {
        const unused = claim.provisional || claim.expiresOn < today;
        return (
          <li key={claim.id} className={`rounded-xl border border-[var(--revint-border)] p-3 ${unused ? "text-[var(--revint-text-3)]" : ""}`}>
            <input value={claim.text} onChange={(event) => onChange(claims.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className="w-full bg-transparent text-sm" />
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <label>Son gün <input value={claim.expiresOn} onChange={(event) => onChange(claims.map((item, itemIndex) => itemIndex === index ? { ...item, expiresOn: event.target.value } : item))} className="ml-1 rounded border border-[var(--revint-border)] bg-[var(--revint-surface)] px-2 py-1" /></label>
              <label><input type="checkbox" checked={claim.provisional} onChange={(event) => onChange(claims.map((item, itemIndex) => itemIndex === index ? { ...item, provisional: event.target.checked } : item))} /> Geçici</label>
              {unused && <span>satışta kullanılmaz</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PackageList({ packages }: { packages: Array<Record<string, unknown>> }) {
  if (packages.length === 0) return <p className="text-sm text-[var(--revint-text-2)]">Paket yok.</p>;
  return (
    <ul className="space-y-2">
      {packages.map((pkg, index) => (
        <li key={`${String(pkg.name)}-${index}`} className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] px-4 py-3 text-sm">
          {typeof pkg.name === "string" ? pkg.name : "Paket"} · {typeof pkg.priceLabel === "string" ? pkg.priceLabel : "Fiyat yok"}
        </li>
      ))}
    </ul>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm text-[var(--revint-text-2)]">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--revint-border)] bg-[var(--revint-surface)] px-3 py-2 text-sm text-[var(--revint-text-1)]" />
    </label>
  );
}

function textOf(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function playbookSummary(playbook: Record<string, unknown>): string {
  const stages = Array.isArray(playbook.stages) ? playbook.stages.length : 0;
  const angles = Array.isArray(playbook.angles) ? playbook.angles.length : 0;
  if (stages === 0 && angles === 0) return "Oyun kitabı yok.";
  return `${stages} aşama, ${angles} açı. Taslak kaydı canlı kopyayı saklar.`;
}

function pipelineSummary(pipeline: { preset: string; steps: unknown[]; enabled: boolean }): string {
  const preset = pipeline.preset === "LITE" ? "hafif" : pipeline.preset === "AGGRESSIVE" ? "agresif" : pipeline.preset === "CUSTOM" ? "özel" : "dengeli";
  return `${preset} hazır ayar, ${pipeline.steps.length} adım, ${pipeline.enabled ? "açık" : "kapalı"}.`;
}
