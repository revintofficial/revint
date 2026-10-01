import { LENS_LABELS } from "@/lib/control/lenses";

const WORKER_LABELS: Record<string, string> = {
  WEBSITE_AUDITOR: "Site denetimi",
  REVIEW_ANALYST: "Yorum analizi",
  SALES_OPPORTUNITY_SCORER: "Satış fırsatı puanı",
  SOCIAL_SCRAPER: "Sosyal tarama",
  EMAIL_VERIFIER: "E-posta doğrulama",
  GOOGLE_PLACES_REVIEWS: "Google yorumları",
  SUBVERTICAL_CLASSIFIER: "Alt niş sınıflandırma",
  WORKSPACE_CONTEXT_EXTRACTOR: "Çalışma alanı bağlamı",
  WEBSITE_PLAN_GENERATOR: "Site planı",
  WEBSITE_MOCKUP_GENERATOR: "Site taslağı",
  OPENER_WRITER: "Açılış metni",
  VIDEO_SCRIPT_WRITER: "Video metni",
  VOICE_NOTE_TRANSCRIBER: "Ses notu çözümü",
  LEAD_DOSSIER_GENERATOR: "Lead dosyası",
  LEAD_INTELLIGENCE_BRIEF: "Satış özeti",
  AI_RECEPTIONIST_BUILDER: "Yapay resepsiyon",
  REVIEW_REPLY_AGENT: "Yorum yanıtı",
  LEAD_RESPONSE_AGENT: "Lead yanıtı",
  BOOKING_WIDGET_BUILDER: "Rezervasyon aracı",
  GBP_AUTOPOST_AGENT: "Google işletme paylaşımı",
  COPILOT_CHAT: "Kopilot sohbeti",
  INBOX_REPLY_ATTRIBUTOR: "Gelen kutusu eşlemesi",
  OUTREACH_SENDER: "İletişim gönderimi",
  CONTAINMENT_RATE_TRACKER: "Karşılama oranı",
  APIFY_GMAPS_DEEP: "Harita derin tarama",
  APIFY_WEB_CRAWL_DEEP: "Site derin tarama",
  APIFY_INSTAGRAM_DEEP: "Instagram derin tarama",
  APIFY_FACEBOOK_DEEP: "Facebook derin tarama",
  APIFY_TIKTOK_DEEP: "TikTok derin tarama",
  APIFY_SERP_RANK: "Arama sırası",
  APIFY_COMPETITOR_ADS: "Rakip reklamları",
  APIFY_LINKEDIN_COMPANY: "LinkedIn şirketi",
  APIFY_REDDIT_MENTIONS: "Reddit anmaları",
  ICP_SCORER: "ICP skoru",
  STAKEHOLDER_DISCOVERER: "İlgili kişiler",
  ACCOUNT_TIER_RANKER: "Hesap kademesi",
  BANT_INFERRER: "BANT çıkarımı",
  TRIGGER_DETECTOR: "Tetikleyici tespiti",
  COMMERCIAL_INSIGHT_MATCHER: "Ticari içgörü",
  WHY_NOW_SYNTHESIZER: "Neden şimdi",
  BUYING_COMMITTEE_MAPPER: "Satın alma komitesi",
  OBJECTION_PREDICTOR: "İtiraz tahmini",
  MEDDPICC_EXTRACTOR: "Yeterlilik çıkarımı",
  SPIN_EXTRACTOR: "Keşif çıkarımı",
  OUTCOME_ATTRIBUTOR: "Sonuç eşlemesi",
};

const RUN_STATUS: Record<string, string> = {
  PENDING: "Bekliyor",
  RUNNING: "Çalışıyor",
  SUCCEEDED: "Oldu",
  SUCCEEDED_NO_MEMORY: "Oldu, bellek yazılamadı",
  FAILED: "Düştü",
  CANCELLED: "İptal",
};

const PLANNER_STATUS: Record<string, string> = {
  PLANNING: "Planlama",
  EXECUTING: "Çalışıyor",
  COMPLETED: "Bitti",
  FAILED: "Düştü",
  CANCELLED: "İptal",
};

const VERDICT: Record<string, string> = {
  PASS: "Geçti",
  FAIL: "Kaldı",
  NEEDS_REVIEW: "Tekrar bak",
};

const ERROR_CLASS: Record<string, string> = {
  IDENTITY_MISMATCH: "Yanlış işletme",
  STALE_SOURCE: "Kaynak eski",
  UNSUPPORTED_CLAIM: "İddia dayanaksız",
  PACKAGE_MISMATCH: "Paket uymuyor",
  SCORE_CALIBRATION: "Puan bandın dışında",
  PLAYBOOK_VIOLATION: "Oyun kitabına aykırı",
  PIPELINE_OMISSION: "Boru hattında adım eksik",
  // SDR-only reasons (source = SDR rows); the lens form never offers them.
  ALREADY_CUSTOMER: "Zaten müşteri",
  OUT_OF_PROFILE: "Hedef profil değil",
};

const PACKAGE: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  premium: "Premium",
  none: "Paket yok",
};

const WEDGE: Record<string, string> = {
  reservation: "Rezervasyon",
  bill_wait: "Hesap bekleme",
  marketplace: "Pazaryeri komisyonu",
  menu_surface: "Menü yüzeyi",
  multi_location: "Çoklu lokasyon",
  guest_repeat: "Tekrar gelen misafir",
  none: "Kaçak yok",
};

export const PACKAGE_OPTIONS = (["starter", "growth", "premium", "none"] as const).map(value => ({ value, label: PACKAGE[value] }));
export const WEDGE_OPTIONS = (["reservation", "bill_wait", "marketplace", "menu_surface", "multi_location", "guest_repeat", "none"] as const).map(value => ({ value, label: WEDGE[value] }));

/** Options for the SDR "Kullanmadım" list, in SDR_REASONS order. */
export const SDR_REASON_OPTIONS = [
  { value: "IDENTITY_MISMATCH", label: "Yanlış işletme" },
  { value: "STALE_SOURCE", label: "Kaynak eski" },
  { value: "UNSUPPORTED_CLAIM", label: "İddia dayanaksız" },
  { value: "PACKAGE_MISMATCH", label: "Paket uymuyor" },
  { value: "ALREADY_CUSTOMER", label: "Zaten müşteri" },
  { value: "OUT_OF_PROFILE", label: "Hedef profil değil" },
] as const;

const SEVERITY: Record<string, string> = {
  P0: "Bugün bakar",
  P1: "Bu hafta",
  P2: "Kayıt",
};

const CALIBRATION: Record<string, string> = {
  DRAFT: "Taslak",
  IN_REVIEW: "İncelemede",
  APPROVED: "Onaylı",
  ACTIVE: "Yayında",
  SUPERSEDED: "Yerini aldı",
  ROLLED_BACK: "Geri alındı",
};

const FAILURE: Record<string, string> = {
  PACKAGE: "Paket yanlış",
  WEDGE: "Kaçak yanlış",
  ICP_BAND: "Puan bandın dışında",
  MODULE: "Modül",
  FORBIDDEN_CLAIM: "Yasak iddia",
  FORBIDDEN_ANGLE: "Yasak açı",
};

const ROLE: Record<string, string> = {
  VIEWER: "İzleyici",
  REVIEWER: "İnceleyen",
  ADMIN: "Yönetici",
};

const CRM: Record<string, string> = {
  PENDING: "Bekliyor",
  SUCCESS: "Oldu",
  FAILED: "Düştü",
  SKIPPED: "Atlandı",
};

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export const ERROR_CLASS_OPTIONS = [
  { value: "IDENTITY_MISMATCH", label: "Yanlış işletme" },
  { value: "STALE_SOURCE", label: "Kaynak eski" },
  { value: "UNSUPPORTED_CLAIM", label: "İddia dayanaksız" },
  { value: "PACKAGE_MISMATCH", label: "Paket uymuyor" },
  { value: "SCORE_CALIBRATION", label: "Puan bandın dışında" },
  { value: "PLAYBOOK_VIOLATION", label: "Oyun kitabına aykırı" },
  { value: "PIPELINE_OMISSION", label: "Boru hattında adım eksik" },
] as const;

export const SEVERITY_OPTIONS = [
  { value: "P0", label: "Bugün bakar" },
  { value: "P1", label: "Bu hafta" },
  { value: "P2", label: "Kayıt" },
] as const;

export function workerLabel(kind: string): string {
  return WORKER_LABELS[kind] ?? "İş";
}

export function runStatusLabel(status: string): string {
  return RUN_STATUS[status] ?? "Durum yok";
}

export function plannerStatusLabel(status: string): string {
  return PLANNER_STATUS[status] ?? "Durum yok";
}

export function verdictLabel(verdict: string): string {
  return VERDICT[verdict] ?? "Karar yok";
}

export function errorClassLabel(value: string): string {
  return ERROR_CLASS[value] ?? "Sınıf yok";
}

export function severityLabel(value: string): string {
  return SEVERITY[value] ?? "Ciddiyet yok";
}

export function calibrationStatusLabel(status: string): string {
  return CALIBRATION[status] ?? "Durum yok";
}

export function failureLabel(code: string): string {
  return FAILURE[code] ?? "Kural";
}

export function roleLabel(role: string): string {
  return ROLE[role] ?? "Rol yok";
}

export function crmStatusLabel(status: string): string {
  return CRM[status] ?? "Durum yok";
}

export function reviewReasonLabel(reason: string): string {
  if (reason === "needs_review") return "İnceleme istendi";
  if (reason === "failed_unpassed") return "Düştü, henüz geçmedi";
  return "Bakılacak";
}

export function formatControlDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Tarih yok";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function formatControlWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Tarih yok";
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
  return `${formatControlDate(iso)} ${time}`;
}

export function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt || !finishedAt) return "Süre yok";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Süre yok";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} sn`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} dk` : `${minutes} dk ${rest} sn`;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function packageLabel(value: string): string {
  return PACKAGE[value] ?? "Bilinmeyen paket";
}

export function wedgeLabel(value: string): string {
  return WEDGE[value] ?? "Bilinmeyen kaçak";
}

/** Queue badge for an SDR rejection, e.g. "SDR kullanmadı: iddia dayanaksız." */
export function sdrFlagLabel(errorClass: string): string {
  const label = ERROR_CLASS[errorClass];
  return label ? `SDR kullanmadı: ${label.toLocaleLowerCase("tr-TR")}.` : "SDR kullanmadı.";
}

export function stayLabel(code: string): string {
  if (code === "PACKAGE") return "Kalır, çünkü paket yanlış";
  if (code === "WEDGE") return "Kalır, çünkü kaçak yanlış";
  if (code === "FORBIDDEN_ANGLE") return "Kalır, çünkü açı yasak";
  if (code === "FORBIDDEN_CLAIM") return "Kalır, çünkü iddia yasak";
  if (code === "ICP_BAND") return "Kalır, çünkü puan bandın dışında";
  if (code === "MODULE") return "Kalır, çünkü modül izinli değil";
  return "Kalır";
}

export function auditSentence(actor: string, action: string, target: string, afterJson: unknown): string {
  const after = typeof afterJson === "object" && afterJson !== null ? afterJson as Record<string, unknown> : {};
  if (action === "trace.rerun") {
    const kind = typeof after.workerKind === "string" ? workerLabel(after.workerKind) : "işi";
    return `${actor}, ${target} için ${kind} yeniden çalıştırdı.`;
  }
  if (action === "review.record") return `${actor}, ${target} için bir inceleme kararı yazdı.`;
  if (action === "review.adjudicate") return `${actor}, ${target} için mercek anlaşmazlığını uzlaştırdı.`;
  if (action === "sdr.feedback") return after.used === true ? `${actor}, ${target} için brief'i kullandığını yazdı.` : `${actor}, ${target} için brief'i kullanmadığını yazdı.`;
  if (action === "lens.assign") {
    const label = after.lens === "TECHNICAL" || after.lens === "DOMAIN" || after.lens === "SALES" ? LENS_LABELS[after.lens] : null;
    return label ? `${actor}, ${target} için ${label} merceğini atadı.` : `${actor}, ${target} için merceği kaldırdı.`;
  }
  if (action === "golden.promote") return `${actor}, ${target} için referans vaka kaydetti.`;
  if (action === "eval.accept") return `${actor}, kontrol sonucunu kabul etti.`;
  if (action === "eval.replay") return `${actor}, aday koşu işlemini kaydetti.`;
  if (action === "eval.run") return `${actor}, bir kontrol koşusu başlattı.`;
  if (action === "calibration.activate") return `${actor}, ${target} sürümünü yayınladı.`;
  if (action === "calibration.rollback") return `${actor}, canlı ayarı önceki sürüme döndürdü.`;
  if (action === "calibration.draft") return `${actor}, ${target} için taslak yazdı.`;
  return `${actor}, ${target} üzerinde bir işlem yaptı.`;
}

export function auditTargetHref(workspaceId: string, targetType: string, targetId: string): string | null {
  const query = `workspaceId=${encodeURIComponent(workspaceId)}`;
  if (targetType === "Lead") return `/admin/control/trace/${targetId}?${query}`;
  if (targetType === "User") return `/admin/control/mercekler?${query}`;
  if (targetType === "WorkspaceCalibrationVersion") return `/admin/control/calibration?${query}`;
  if (targetType === "EvalRun" || targetType === "EvalCase") return `/admin/control/golden?${query}`;
  return null;
}
