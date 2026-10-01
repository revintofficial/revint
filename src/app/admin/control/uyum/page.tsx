import Link from "next/link";
import { AdjudicateControl } from "@/components/admin/control-adjudicate";
import { ControlFrame } from "@/components/admin/control-frame";
import {
  KAPPA_TARGET,
  MIN_KAPPA_ITEMS,
  REVIEW_SECONDS_TARGET,
  VERDICTS,
  getAgreementReport,
  listDisagreements,
  listRubricVersions,
  type AgreementReport,
} from "@/lib/control/agreement";
import { errorClassLabel, severityLabel, verdictLabel } from "@/lib/control/labels";
import { LENSES, LENS_LABELS } from "@/lib/control/lenses";
import { requireControlRole, roleAtLeast } from "@/lib/control/roles";
import { RUBRIC_VERSION } from "@/lib/control/rubric";
import { formatRate, percent } from "@/lib/control/stats";

export default async function AgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string; surum?: string }>;
}) {
  const { workspaceId, surum } = await searchParams;
  return (
    <ControlFrame workspaceId={workspaceId}>
      {workspaceId ? <AgreementBody workspaceId={workspaceId} version={surum || undefined} /> : null}
    </ControlFrame>
  );
}

/** §6.2 bands. The label is the reading, the number stays next to it. */
function kappaBand(kappa: number): string {
  if (kappa < 0.4) return "zayıf";
  if (kappa < 0.6) return "rubrik düzeltilmeli";
  if (kappa < 0.75) return "keşif için kullanılabilir";
  if (kappa < 0.9) return "iyi";
  return "güçlü";
}

function seconds(value: number | null): string {
  return value === null ? "Süre ölçülmedi" : `${Math.round(value)} sn`;
}

async function AgreementBody({ workspaceId, version }: { workspaceId: string; version?: string }) {
  const actor = await requireControlRole("VIEWER");
  const [report, disagreements, versions] = await Promise.all([
    getAgreementReport(workspaceId, version),
    listDisagreements(workspaceId, version),
    listRubricVersions(workspaceId),
  ]);
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  const canAdjudicate = roleAtLeast(actor.role, "ADMIN");
  const mixed = report.rubricVersions.length > 1;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Uyum</h1>
        <p className="text-sm text-[var(--revint-text-2)]">
          Üç merceğin aynı brief için bağımsız verdiği hükümler ne kadar örtüşüyor? Yalnızca üç merceği de tamamlanmış brief&apos;ler sayılır; her mercek için en yeni hüküm esas alınır. SDR geri bildirimi bu sayıma girmez.
        </p>
        <p className="text-sm text-[var(--revint-text-1)]">
          Aktif rubrik sürümü: <strong>{RUBRIC_VERSION}</strong>
          {version ? <> · Gösterilen: <strong>{version}</strong></> : <> · Gösterilen: tüm sürümler</>}
        </p>
        {mixed && (
          <p role="alert" className="rounded-lg border border-[var(--revint-border)] bg-[var(--revint-warning-soft)] p-3 text-sm text-[var(--revint-text-1)]">
            Bu rapor {report.rubricVersions.length} rubrik sürümünü karıştırıyor ({report.rubricVersions.join(", ")}). Ölçüm karışık; bir sürüm seç.
          </p>
        )}
        {versions.length > 1 && (
          <nav aria-label="Rubrik sürümü" className="flex flex-wrap gap-2 text-sm">
            <VersionLink href={`/admin/control/uyum?${query}`} active={!version} label="Tüm sürümler" />
            {versions.map((v) => (
              <VersionLink key={v} href={`/admin/control/uyum?${query}&surum=${encodeURIComponent(v)}`} active={version === v} label={v === RUBRIC_VERSION ? `${v} (aktif)` : v} />
            ))}
          </nav>
        )}
      </header>

      <NumbersBlock report={report} />
      <PairsBlock report={report} />

      <section className="space-y-3" aria-labelledby="disagreements">
        <h2 id="disagreements" className="text-lg font-semibold">Anlaşmazlıklar</h2>
        <p className="text-sm text-[var(--revint-text-2)]">
          Üç merceğin aynı fikirde olmadığı brief&apos;ler. Uzlaştırma orijinal hükümleri silmez; vakaya ayrı bir uzlaştırılmış hüküm ekler ve denetime yazar.
        </p>
        {disagreements.length === 0 && <p className="text-sm text-[var(--revint-text-2)]">Anlaşmazlık yok.</p>}
        {disagreements.map((row) => (
          <article key={row.agentRunId} className="space-y-3 rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {row.leadId ? (
                <Link href={`/admin/control/trace/${encodeURIComponent(row.leadId)}?${query}`} className="text-sm font-medium underline">{row.businessName}</Link>
              ) : (
                <span className="text-sm font-medium">{row.businessName}</span>
              )}
              <span className="text-xs text-[var(--revint-text-2)]">
                {row.adjudicatedVerdict ? `Uzlaştırılmış hüküm: ${verdictLabel(row.adjudicatedVerdict)}` : "Henüz uzlaştırılmadı"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {row.verdicts.map((v) => (
                <div key={v.lens} className="rounded-lg border border-[var(--revint-border)] p-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{LENS_LABELS[v.lens]}</p>
                  <p className="mt-1 font-medium text-[var(--revint-text-1)]">{verdictLabel(v.verdict)}</p>
                  {(v.errorClass || v.severity) && (
                    <p className="mt-1 text-xs text-[var(--revint-text-2)]">
                      {[v.errorClass ? errorClassLabel(v.errorClass) : null, v.severity ? severityLabel(v.severity) : null].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-2 text-[var(--revint-text-2)]">{v.note || "Not yok."}</p>
                </div>
              ))}
            </div>
            <AdjudicateControl workspaceId={workspaceId} agentRunId={row.agentRunId} canAdjudicate={canAdjudicate} />
          </article>
        ))}
      </section>

      <DurationBlock report={report} />
    </section>
  );
}

function VersionLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg border border-[var(--revint-border)] px-3 py-1 ${active ? "bg-[var(--revint-hover)] text-[var(--revint-text-1)]" : "text-[var(--revint-text-2)] hover:bg-[var(--revint-hover)]"}`}
    >
      {label}
    </Link>
  );
}

function Stat({ label, value, caption, warn }: { label: string; value: string; caption?: string; warn?: string }) {
  return (
    <div className="rounded-xl border border-[var(--revint-border)] bg-[var(--revint-card)] p-4">
      <span className="block text-xs uppercase tracking-wider text-[var(--revint-text-3)]">{label}</span>
      <strong className="mt-2 block text-xl text-[var(--revint-text-1)]">{value}</strong>
      {caption && <span className="mt-2 block text-xs text-[var(--revint-text-2)]">{caption}</span>}
      {warn && <span className="mt-2 block text-xs font-semibold text-[var(--revint-error)]">{warn}</span>}
    </div>
  );
}

function NumbersBlock({ report }: { report: AgreementReport }) {
  const unanimous = Math.round(report.rawAgreement * report.items);
  const kappa = report.fleissKappa;
  return (
    <section className="space-y-3" aria-labelledby="numbers">
      <h2 id="numbers" className="text-lg font-semibold">Sayılar</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Üç merceği tamamlanmış brief" value={String(report.items)} caption="Kapı B için en az 50." />
        <Stat label="Ham uyum" value={report.items ? formatRate(unanimous, report.items) : "Veri yok"} caption="Üç merceğin aynı hükmü verdiği brief oranı." />
        <Stat
          label="Fleiss kappa"
          value={kappa === null ? "Ölçüm için yeterli vaka yok" : `${kappa.toFixed(2)} · ${kappaBand(kappa)}`}
          caption={kappa === null ? `En az ${MIN_KAPPA_ITEMS} vaka gerekir; şu an ${report.items}.` : `Şansa göre düzeltilmiş uyum. Hedef ≥ ${KAPPA_TARGET.toFixed(2)}.`}
          warn={kappa !== null && kappa < KAPPA_TARGET ? "Rubrik düzeltilmeli" : undefined}
        />
        <Stat
          label="Etiket sıklığı"
          value={report.items ? VERDICTS.map((v) => `${verdictLabel(v)} ${percent(report.prevalence[v])}`).join(" · ") : "Veri yok"}
          caption="Bir etiket çok nadirse kappa yanıltır; ham uyumla birlikte oku."
        />
      </div>
    </section>
  );
}

function PairsBlock({ report }: { report: AgreementReport }) {
  return (
    <section className="space-y-3" aria-labelledby="pairs">
      <h2 id="pairs" className="text-lg font-semibold">Mercek çiftleri</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {report.confusion.map((pair) => (
          <Stat
            key={`${pair.a}-${pair.b}`}
            label={`${LENS_LABELS[pair.a]} – ${LENS_LABELS[pair.b]}`}
            value={pair.total ? formatRate(pair.agreed, pair.total) : "Veri yok"}
            caption="İki merceğin aynı hükmü verdiği brief oranı."
          />
        ))}
      </div>
    </section>
  );
}

function DurationBlock({ report }: { report: AgreementReport }) {
  const slow = (value: number | null) => (value !== null && value > REVIEW_SECONDS_TARGET ? "Kart sadeleştirilmeli" : undefined);
  return (
    <section className="space-y-3" aria-labelledby="duration">
      <h2 id="duration" className="text-lg font-semibold">Süre</h2>
      <p className="text-sm text-[var(--revint-text-2)]">Kartın açılışından hükmün kaydına kadar geçen medyan süre. Hedef ≤ {REVIEW_SECONDS_TARGET} sn.</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Tüm mercekler" value={seconds(report.medianSeconds)} warn={slow(report.medianSeconds)} />
        {LENSES.map((lens) => (
          <Stat key={lens} label={LENS_LABELS[lens]} value={seconds(report.medianSecondsByLens[lens])} warn={slow(report.medianSecondsByLens[lens])} />
        ))}
      </div>
    </section>
  );
}
