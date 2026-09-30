const FIELD_LABELS: Record<string, string> = {
  minRating: "puan alt sınırı",
  priceLevelMin: "fiyat alt sınırı",
  priceLevelMax: "fiyat üst sınırı",
  minReviewCount: "minimum yorum",
  digitalMaturityFloor: "dijital olgunluk alt sınırı",
  description: "açıklama",
  name: "ad",
  highValueSignals: "yüksek değer sinyalleri",
  negativeSignals: "olumsuz sinyaller",
  industryWeights: "sektör ağırlıkları",
  subNicheWeights: "alt niş ağırlıkları",
  locationFit: "konum uyumu",
  meddpiccRequiredFields: "zorunlu yeterlilik alanları",
  preset: "hazır ayar",
  steps: "adımlar",
  enabled: "açık",
  stages: "aşamalar",
  angles: "açılar",
  qualificationChecklist: "yeterlilik listesi",
  temperatureRules: "sıcaklık kuralları",
  noShowRiskRules: "gelmeme riski",
  claims: "iddialar",
  text: "iddia metni",
  provisional: "geçici",
  expiresOn: "son gün",
  priceLabel: "fiyat",
  features: "özellikler",
  isPopular: "öne çıkan",
  packages: "paketler",
  playbook: "oyun kitabı",
  pipeline: "boru hattı",
  icp: "ICP",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "yok";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "yok";
    if (value.every((item) => typeof item === "string" || typeof item === "number")) return value.join(", ");
    return `${value.length} kayıt`;
  }
  return "kayıt";
}

export function diffValues(before: unknown, after: unknown, key = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((child) => diffValues(before[child], after[child], child));
  }
  const label = FIELD_LABELS[key] ?? "alan";
  return [`${label} ${formatValue(before)} → ${formatValue(after)}`];
}
