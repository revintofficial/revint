import type { ReviewLens } from "@/generated/prisma/client";

/**
 * Active review rubric. Every lens verdict is stamped with this version
 * (`HumanReview.rubricVersion`) so agreement numbers are only compared
 * within one rubric. Bump the version whenever an include/exclude rule
 * changes meaning — wording fixes that do not change a decision keep it.
 */
export const RUBRIC_VERSION = "2026-09-29.1";

/** Rows written before the rubric existed carry this DB default. */
export const PRE_RUBRIC_VERSION = "pre-2026-09-29";

export const ERROR_CLASSES = [
  "IDENTITY_MISMATCH",
  "STALE_SOURCE",
  "UNSUPPORTED_CLAIM",
  "PACKAGE_MISMATCH",
  "SCORE_CALIBRATION",
  "PLAYBOOK_VIOLATION",
  "PIPELINE_OMISSION",
] as const;

export type ErrorClass = (typeof ERROR_CLASSES)[number];

export type RubricEntry = {
  code: ErrorClass;
  label: string;
  include: string;
  exclude: string;
  goodExample: string;
  badExample: string;
};

const ENTRIES: Record<ErrorClass, RubricEntry> = {
  IDENTITY_MISMATCH: {
    code: "IDENTITY_MISMATCH",
    label: "Yanlış işletme",
    include: "Kartın dayandığı işletme, şube, adres veya web sitesi bu lead değil: aynı isimli başka bir işletme, zincirin başka bir şubesi ya da genel merkez sayfası.",
    exclude: "İşletme doğru ama bilgi eski ya da eksikse bu sınıf seçilmez; Kaynak eski veya Boru hattında adım eksik seçilir.",
    goodExample: "Dishoom Covent Garden kartı Covent Garden şubesinin harita profiline ve o şubenin rezervasyon sayfasına dayanıyor. Kimlik doğru, bu sınıf seçilmez.",
    badExample: "Dishoom Covent Garden kartı Kensington şubesinin yorumlarını ve adresini kullanıyor. Yanlış işletme.",
  },
  STALE_SOURCE: {
    code: "STALE_SOURCE",
    label: "Kaynak eski",
    include: "Karar bugün artık doğru olmayan bir kaynağa dayanıyor: değişmiş rezervasyon sağlayıcısı, kaldırılmış menü dosyası, on iki aydan eski yorumlar.",
    exclude: "Kaynak hiç yoksa ya da iddia kaynaksızsa İddia dayanaksız seçilir. Kaynak güncel ama yanlış okunmuşsa bu sınıf seçilmez.",
    goodExample: "Dishoom kartı sitenin bugünkü rezervasyon sayfasında görünen üçüncü taraf sağlayıcıyı kaynak gösteriyor ve rezervasyon kaçağını ona bağlıyor.",
    badExample: "Dishoom kartı sitede artık bulunmayan eski bir rezervasyon bağlantısına dayanıyor; site bugün başka bir sağlayıcıya yönlendiriyor. Kaynak eski.",
  },
  UNSUPPORTED_CLAIM: {
    code: "UNSUPPORTED_CLAIM",
    label: "İddia dayanaksız",
    include: "Kartta kanıt rafında dayanağı olmayan bir iddia var (yüzde, gelir artışı, 'misafirler şikâyet ediyor'), ya da dayanak iddiayı taşıyamayacak kadar zayıf.",
    exclude: "Dayanak var ama eskiyse Kaynak eski seçilir. İddia doğru ama önerilen paket yanlışsa Paket uymuyor seçilir.",
    goodExample: "Honest Burgers örneklemi beş yorum, eşiğin altında. Kart yorumlardan iddia kurmuyor, yalnızca harita ve site kanıtıyla konuşuyor.",
    badExample: "Honest Burgers kartı beş yorumdan 'misafirler hesap beklemekten sürekli şikâyet ediyor' diyor ve hesap bekleme kaçağını buna dayandırıyor. İddia dayanaksız.",
  },
  PACKAGE_MISMATCH: {
    code: "PACKAGE_MISMATCH",
    label: "Paket uymuyor",
    include: "Önerilen paket işletmenin ölçeğine veya seçilen kaçağa uymuyor: tek şubeye Premium, çok şubeli zincire Starter, kaçağı kapatmayan bir paket.",
    exclude: "Paket doğru ama puan bandın dışındaysa Puan bandın dışında seçilir. Modül sırası farklı ama paket aynıysa bu sınıf seçilmez.",
    goodExample: "Bianco43 kartı menü yüzeyi kaçağını görüyor ve kaçağı kapatan en küçük paketi öneriyor; gerekçede şube sayısı yazıyor.",
    badExample: "Bianco43 kartı yalnızca metin menüsünün yerine geçecek bir yüzey için Premium öneriyor; kaçak daha küçük pakette kapanıyor. Paket uymuyor.",
  },
  SCORE_CALIBRATION: {
    code: "SCORE_CALIBRATION",
    label: "Puan bandın dışında",
    include: "Satış güveni puanı kanıtın gücüyle uyumsuz: zayıf ya da eksik kanıtla 85 ve üstü, açık ve güncel bir kaçakla 40'ın altı.",
    exclude: "Puan makul ama iddia dayanaksızsa İddia dayanaksız seçilir. Puanı yalnızca beğenmemek bu sınıf değildir; puan bandın açıkça dışında olmalı.",
    goodExample: "Honest Burgers kartında yorum örneklemi beş; güven puanı orta bantta kalıyor ve kart örneklemin küçük olduğunu yazıyor.",
    badExample: "Honest Burgers kartı beş yorumluk örneklemle 92 güven puanı veriyor. Puan bandın dışında.",
  },
  PLAYBOOK_VIOLATION: {
    code: "PLAYBOOK_VIOLATION",
    label: "Oyun kitabına aykırı",
    include: "Kart oyun kitabının açıkça yasakladığı bir şey yapıyor: yasak açı, garanti gelir vaadi, dışlanan modülü satmak, mevcut sağlayıcıyı kötülemek.",
    exclude: "Oyun kitabında yer almayan ama yasak da olmayan zayıf bir açı bu sınıf değildir; tercih farkı Tekrar bak ile not edilir.",
    goodExample: "Dishoom konuşması rezervasyon kaçağını kanıtıyla anlatıyor, gelir garantisi vermiyor, mevcut sağlayıcı hakkında yargı cümlesi kurmuyor.",
    badExample: "Dishoom konuşması 'rezervasyon sağlayıcınız sizi soyuyor, %20 ciro artışı garanti' diyor. Oyun kitabına aykırı.",
  },
  PIPELINE_OMISSION: {
    code: "PIPELINE_OMISSION",
    label: "Boru hattında adım eksik",
    include: "Karar için gereken bir adım koşmamış, düşmüş ya da boş dönmüş ve kart bunu söylemeden hüküm veriyor: site denetimi yok, yorum analizi atlanmış.",
    exclude: "Adım koştu ama çıktısı yanlış yorumlandıysa ilgili içerik sınıfı seçilir. Kart atlanan adımı açıkça yazıyorsa bu sınıf seçilmez.",
    goodExample: "Bianco43 menü sinyali 'bilinmiyor' dönmüş. Kart QR menü hakkında hüküm kurmuyor, sitede metin menü olduğunu ve QR'ın doğrulanamadığını yazıyor.",
    badExample: "Bianco43 site denetimi düşmüş; kart yine de 'QR menüsü yok' diyerek menü yüzeyi kaçağı kuruyor. Boru hattında adım eksik.",
  },
};

/**
 * Error classes each lens may pick. Mirrors `LENS_ERROR_CLASSES` in
 * lens-card.ts (the review form filters by it); a test keeps them equal.
 * Together the three lenses cover all seven classes.
 */
export const RUBRIC_LENS_CLASSES: Record<ReviewLens, readonly ErrorClass[]> = {
  TECHNICAL: ["STALE_SOURCE", "PIPELINE_OMISSION"],
  DOMAIN: ["PACKAGE_MISMATCH", "PLAYBOOK_VIOLATION", "SCORE_CALIBRATION", "PIPELINE_OMISSION"],
  SALES: ["IDENTITY_MISMATCH", "UNSUPPORTED_CLAIM", "STALE_SOURCE"],
};

export const RUBRIC: Record<ReviewLens, RubricEntry[]> = {
  TECHNICAL: RUBRIC_LENS_CLASSES.TECHNICAL.map(code => ENTRIES[code]),
  DOMAIN: RUBRIC_LENS_CLASSES.DOMAIN.map(code => ENTRIES[code]),
  SALES: RUBRIC_LENS_CLASSES.SALES.map(code => ENTRIES[code]),
};

/** All seven entries, in ERROR_CLASSES order, independent of lens. */
export const RUBRIC_ENTRIES: readonly RubricEntry[] = ERROR_CLASSES.map(code => ENTRIES[code]);

export function rubricEntry(code: string): RubricEntry | null {
  return (ERROR_CLASSES as readonly string[]).includes(code) ? ENTRIES[code as ErrorClass] : null;
}

export function isErrorClass(value: unknown): value is ErrorClass {
  return typeof value === "string" && (ERROR_CLASSES as readonly string[]).includes(value);
}
