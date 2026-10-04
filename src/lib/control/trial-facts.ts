import { moduleLabel, object, strings, toDecisionCard } from "@/lib/control/decision";
import { skipReasonText } from "@/lib/control/evidence-shelf";
import { packageText, wedgeLabel } from "@/lib/control/labels";

/**
 * A worker output as a short list of plain facts, for the trial screen.
 * The reader never sees a field name or a JSON value: each fact is a Turkish
 * label and a sentence-sized value. Two runs are compared fact by fact.
 */
export type Fact = { label: string; value: string };
export type ComparedFact = Fact & {
  /** The value in the previous successful run when it differs; null when unchanged or when there is no previous run. */
  before: string | null;
};

const LIST_MAX = 5;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function list(items: string[], none: string): string {
  if (items.length === 0) return none;
  const shown = items.slice(0, LIST_MAX).join(" · ");
  return items.length > LIST_MAX ? `${shown} · +${items.length - LIST_MAX} tane daha` : shown;
}

/** A phrase list where each entry is a string or an object carrying its wording. */
function phrases(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    const o = object(item);
    const found = text(o.phrase) ?? text(o.label) ?? text(o.text) ?? text(o.quote) ?? text(o.category);
    return found ? [found] : [];
  });
}

function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

const SKIP_KNOWN = "Atlandı.";

const ERROR_TEXT: Array<[RegExp, string]> = [
  [/concurrent-runs-limit/i, "Harita servisi (Apify) aynı anda çalışabilecek iş sınırına takıldı. Birkaç dakika sonra daha az işletmeyle tekrar dene."],
  [/apify[\s\S]*\b(402|403)\b|\b(402|403)\b[\s\S]*apify|usage.*limit|monthly.*limit/i, "Harita servisinin (Apify) kotası dolmuş. Kota yenilenmeden bu adım çalışmaz."],
  [/GoogleGenerativeAI|generativelanguage/i, "Yapay zekâ servisi (Gemini) yanıt vermedi ya da kota sınırına takıldı."],
  [/anthropic|claude/i, "Yapay zekâ servisi (Claude) yanıt vermedi ya da kota sınırına takıldı."],
  [/timeout|timed out|ETIMEDOUT|deadline/i, "İş zaman aşımına uğradı; servis süresinde yanıt vermedi."],
  [/ENOTFOUND|ECONNREFUSED|ECONNRESET|fetch failed|network/i, "Bağlantı kurulamadı; karşı taraftaki servise ulaşılamadı."],
];

/** A stored error message as one plain sentence. Unknown errors keep their first line, without the JSON body. */
export function plainError(message: string | null | undefined): string {
  const raw = (message ?? "").trim();
  if (!raw) return "Hata mesajı kaydedilmemiş.";
  for (const [pattern, sentence] of ERROR_TEXT) if (pattern.test(raw)) return sentence;
  const firstLine = raw.split(/\r?\n/)[0].replace(/[{\[].*$/, "").replace(/[:\s]+$/, "").trim();
  const short = firstLine || "Beklenmeyen bir hata oluştu";
  return `${short.length > 160 ? `${short.slice(0, 160)}…` : short}. Ayrıntısı Vaka izi'nde.`;
}

/** Facts for a run that stopped early, or null when the run did its work. */
function skipFacts(output: Record<string, unknown>): Fact[] | null {
  const reason = typeof output.skipped === "string" && output.skipped ? output.skipped : output.skipped === true ? text(output.reason) ?? "unknown" : null;
  if (!reason) return null;
  const sentence = skipReasonText(reason);
  const facts: Fact[] = [{ label: "Sonuç", value: sentence === SKIP_KNOWN ? `Çalışmadan durdu (${reason}).` : `Çalışmadan durdu: ${sentence}` }];
  const count = num(output.count);
  const min = num(output.min);
  if (count != null && min != null) facts.push({ label: "Yorum sayısı", value: `${count} yorum var, analiz için en az ${min} gerekir` });
  if (text(output.errorMsg)) facts.push({ label: "Sebep", value: plainError(text(output.errorMsg)) });
  return facts;
}

const SOCIAL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", twitter: "X (Twitter)",
  youtube: "YouTube", linkedin: "LinkedIn", whatsapp: "WhatsApp", pinterest: "Pinterest",
};

const COVERAGE_STATUS: Record<string, string> = {
  complete: "Tamamlandı",
  partial: "Yarıda kaldı",
  blocked: "Site botu engelledi",
  failed: "Başarısız",
};

const NOT_OPENED_REASON: Record<string, string> = {
  http_error: "sayfa hata verdi",
  timeout: "zaman aşımı",
  budget: "süre bütçesi doldu",
  robots: "site izin vermiyor",
  blocked: "engellendi",
};

function siteFacts(o: Record<string, unknown>): Fact[] {
  const facts: Fact[] = [
    { label: "Adres", value: text(o.url) ?? "Adres yok" },
    { label: "Siteye erişim", value: o.reachable === true ? "Site açıldı" : "Site açılmadı" },
    { label: "Rezervasyon sistemi", value: o.hasBookingSystem === true ? "Var" : "Görünmüyor" },
    { label: "İletişim formu", value: o.hasContactForm === true ? "Var" : "Görünmüyor" },
    { label: "E-posta adresleri", value: list(strings(o.contactEmails), "Bulunamadı") },
    {
      label: "Sosyal hesaplar",
      value: list(Object.entries(object(o.socialProfiles)).filter(([, v]) => text(v)).map(([k]) => SOCIAL[k] ?? k), "Bulunamadı"),
    },
    { label: "Sitede görülen hizmetler", value: list(phrases(o.servicesDetected), "Bulunamadı") },
  ];
  const c = object(o.coverage);
  const opened = num(c.opened);
  if (opened != null) {
    facts.push({ label: "Okunan sayfalar", value: `${opened} sayfa açıldı · ${num(c.failed) ?? 0} açılamadı · ${num(c.skipped) ?? 0} atlandı` });
    facts.push({ label: "Tarama durumu", value: COVERAGE_STATUS[text(c.status) ?? "complete"] ?? "Bilinmiyor" });
    const notOpened = Array.isArray(c.notOpened)
      ? c.notOpened.flatMap((entry) => {
          const e = object(entry);
          const url = text(e.url);
          return url ? [`${pathOf(url)} (${NOT_OPENED_REASON[text(e.reason) ?? ""] ?? "açılamadı"})`] : [];
        })
      : [];
    facts.push({ label: "Okunamayan sayfalar", value: list(notOpened, "Yok") });
  } else {
    facts.push({ label: "Okunan sayfalar", value: "Sığ denetim: ana sayfa ve birkaç alt sayfa" });
  }
  return facts;
}

function mapFacts(o: Record<string, unknown>): Fact[] {
  return [
    { label: "Çekilen yorum", value: num(o.reviewsCount) == null ? "Bilinmiyor" : `${num(o.reviewsCount)} yorum` },
    { label: "Bulunan e-posta", value: num(o.emailsFound) == null ? "Bilinmiyor" : `${num(o.emailsFound)} adres` },
    { label: "Bulunan sosyal hesap", value: num(o.socialsFound) == null ? "Bilinmiyor" : `${num(o.socialsFound)} hesap` },
  ];
}

function reviewFacts(o: Record<string, unknown>): Fact[] {
  return [
    { label: "Okunan yorum", value: num(o.reviewsAnalyzedCount) == null ? "Bilinmiyor" : `${num(o.reviewsAnalyzedCount)} yorum` },
    { label: "Özet", value: text(o.summary) ?? "Özet yok" },
    { label: "Müşterilerin şikâyet ettiği konular", value: list(phrases(o.painPhrases), "Bulunamadı") },
    { label: "Müşterilerin övdüğü konular", value: list(phrases(o.strengthPhrases), "Bulunamadı") },
  ];
}

function briefFacts(output: unknown): Fact[] {
  const d = toDecisionCard(output);
  const o = object(output);
  const facts: Fact[] = [
    { label: "Kararı kim üretti", value: d.briefMode === "head-agent" ? "Head agent" : d.briefMode ? "Eski brief analizi (head agent değil)" : "Bilinmiyor" },
    { label: "Uygunluk puanı", value: d.salesConfidence == null ? "Puan yok" : `${d.salesConfidence} / 100` },
    { label: "Başlık", value: d.headline ?? "Başlık yok" },
  ];
  if (!d.hasHeadAgent) {
    return [
      ...facts,
      { label: "Açılış cümlesi", value: text(o.openerSeed) ?? "Yok" },
      { label: "Konuşma maddeleri", value: list(strings(o.talkingPoints), "Yok") },
      { label: "Uyarılar", value: list(strings(o.redFlags), "Yok") },
    ];
  }
  return [
    ...facts,
    { label: "Önerilen paket", value: d.recommendedPackage ? packageText(d.recommendedPackage) : "Paket yok" },
    { label: "Satış konusu (kaçak)", value: d.wedge ? wedgeLabel(d.wedge) : "Belirlenmedi" },
    { label: "Modül sırası", value: d.recommendedModules.map((m, i) => `${i + 1}. ${moduleLabel(m)}`).join(" · ") || "Modül yok" },
    { label: "Satış açısı", value: d.primaryAngle ?? "Açı yok" },
    { label: "Konuşma", value: d.talkTrack ?? "Konuşma yok" },
    { label: "Önerilmeyen modüller", value: d.excludedModules.map((m) => `${moduleLabel(m.module)}: ${m.why}`).join(" · ") || "Yok" },
  ];
}

/** true when the run stopped before doing its work (its output carries a skip reason). */
export function isStoppedOutput(output: unknown): boolean {
  return Boolean(object(output).skipped);
}

/** The facts a reader cares about in one run's output. */
export function runFacts(kind: string, output: unknown): Fact[] {
  const o = object(output);
  const skipped = skipFacts(o);
  if (skipped) return skipped;
  if (kind === "WEBSITE_AUDITOR") return siteFacts(o);
  if (kind === "APIFY_GMAPS_DEEP") return mapFacts(o);
  if (kind === "REVIEW_ANALYST") return reviewFacts(o);
  if (kind === "LEAD_INTELLIGENCE_BRIEF") return briefFacts(output);
  return [];
}

/** Newest run's facts, each carrying the previous value when it changed. Facts only the previous run had are appended as removed. */
export function compareFacts(previous: Fact[] | null, latest: Fact[]): ComparedFact[] {
  if (!previous) return latest.map((fact) => ({ ...fact, before: null }));
  const old = new Map(previous.map((fact) => [fact.label, fact.value]));
  const now = new Set(latest.map((fact) => fact.label));
  return [
    ...latest.map((fact) => {
      const was = old.get(fact.label);
      return { ...fact, before: was === undefined ? "Önceki koşuda bu bilgi yoktu" : was === fact.value ? null : was };
    }),
    ...previous.filter((fact) => !now.has(fact.label)).map((fact) => ({ label: fact.label, value: "Bu koşuda yok", before: fact.value })),
  ];
}
