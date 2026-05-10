/**
 * TR dictionary stub — paired with `en/common.ts`.
 *
 * Lead Detail v2 (phase 0) is the first surface to require Turkish
 * copy alongside English. The full marketing-side TR catalog is
 * still pending (see `src/lib/i18n/config.ts` — the locale list
 * still ships `en` only); this file exists so any code that opts
 * into `loadDictionary("tr")` for v2 strings has a complete shape.
 *
 * Translation lag policy (build plan §5.4): copy-paste EN into TR
 * slots through phases 1–6, get human-reviewed TR before phase 7
 * ships. The marketing-only keys below are intentionally unchanged
 * from EN; only the `leadDetailV2` namespace has reviewed Turkish.
 */

import type { CommonDictionary } from "../en/common";

export const common = {
  nav: {
    pricing: "Fiyatlandırma",
    forAgencies: "Ajanslar için",
    forSmma: "SMMA için",
    forSpecialists: "Uzmanlar için",
    blog: "Blog",
    glossary: "Sözlük",
    tools: "Araçlar",
    login: "Giriş yap",
    signup: "Kayıt ol",
  },
  footer: {
    privacy: "Gizlilik",
    terms: "Şartlar",
    status: "Durum",
    about: "Hakkımızda",
  },
  cta: {
    getStarted: "Başla",
    bookDemo: "Demo al",
    seePricing: "Fiyatları gör",
  },
  leadDetailV2: {
    placeholderTitle: "Lead Detail v2 — yakında",
    placeholderSubtitle: "Yeniden tasarlanan lead ekranı sonraki aşamalarda burada açılacak. Eski sayfaya dönmek için ?v=1 kullanın.",
    backToLeads: "Lead listesine dön",
    header: {
      tierLabel: "Tier",
      stageLabel: "Pipeline aşaması",
      changeStage: "Aşama değiştir",
      dial: "Ara",
      email: "E-posta",
      voiceNote: "Sesli not",
      moreActions: "Diğer işlemler",
      edit: "Düzenle",
      archive: "Arşivle",
      discard: "Sil",
      powerTools: "Güçlü araçlar",
    },
    stages: {
      COLD: "Soğuk",
      CONTACTED: "İletişimde",
      REPLIED: "Cevap geldi",
      MEETING_BOOKED: "Toplantı ayarlı",
      PROPOSAL: "Teklif aşaması",
      NEGOTIATING: "Pazarlık",
      WON: "Kazanıldı",
      LOST: "Kaybedildi",
    },
    whyNow: {
      title: "Şimdi neden",
      empty: "Aktif tetikleyici yok. Bir aksiyon nedeni çıkarmak için keşif çalıştırın.",
      windowDays: "{days}g içinde hareket et",
      windowToday: "Bugün hareket et",
    },
    nextGesture: {
      title: "Sıradaki hamle",
      preliminary: "Ön okuma",
      final: "Nihai",
      empty: "Brain henüz öneriyi pişiriyor. İlk okuma birkaç saniyede iniyor.",
      openFullGraph: "Tüm grafiği aç",
      dial: "Ara",
      email: "E-posta",
      whatsapp: "WhatsApp",
      schedule: "Planla",
      snooze: "Ertele",
    },
    preliminaryBanner: {
      message: "Ön plan aranabilir — nihai akıl yürütme hâlâ yükleniyor.",
    },
    updatedToast: {
      message: "{seconds}sn önce güncellendi",
    },
    blocks: {
      who: "Kim",
      discovery: "Keşif",
      qualification: "Nitelik",
      history: "Geçmiş",
      account: "Hesap",
      whoStub: "Paydaşlar bir sonraki aşamada.",
      discoveryStub: "Sesli notlar + SPIN tablosu bir sonraki aşamada.",
      qualificationStub: "BANT + ICP + MEDDPICC bir sonraki aşamada.",
      historyStub: "Aktivite zaman çizelgesi bir sonraki aşamada.",
      accountStub: "Kardeş lead navigasyonu bir sonraki aşamada.",
      placeholderBody: "Bu blok bir sonraki aşamada açılacak.",
    },
    evidence: {
      sourceLabel: "Kaynak",
      dismiss: "Kapat",
      types: {
        linkedin: "LinkedIn",
        review: "Yorum",
        audit: "Denetim",
        "voice-note": "Sesli not",
        "prior-nba": "Önceki plan",
        contradiction: "Çelişki",
      },
    },
    qualification: {
      loading: "Niteliklendirme özeti yükleniyor…",
      empty: "Henüz niteliklendirme verisi yok. MEDDPICC için keşif görüşmesi yapın.",
      meddpiccTitle: "MEDDPICC",
      icp: {
        labels: {
          revenue: "Gelir",
          staff: "Personel",
          stack: "Teknoloji",
          geo: "Coğrafya",
          vertical: "Sektör",
          total: "ICP uyumu",
        },
        unknown: "yok",
      },
      bant: {
        overall: "BANT",
        labels: {
          budget: "Bütçe",
          authority: "Yetki",
          need: "İhtiyaç",
          timing: "Zamanlama",
        },
        status: {
          present: "Var",
          partial: "Kısmi",
          missing: "Yok",
        },
      },
      meddpicc: {
        labels: {
          metrics: "Metrikler",
          economicBuyer: "Karar verici",
          decisionCriteria: "Karar kriterleri",
          decisionProcess: "Karar süreci",
          identifyPain: "Acı noktası",
          champion: "Şampiyon",
          competition: "Rekabet",
        },
        status: {
          present: "Yakalandı",
          partial: "Kısmi",
          missing: "Eksik",
        },
      },
      meddpiccLocked: {
        title: "MEDDPICC kilitli",
        description: "Metrikler, karar verici, karar kriterleri ve MEDDPICC özetinin tamamı için yükseltin.",
        cta: "Yükselt",
        requiredPlan: "Pro ve üzeri planlarda mevcut.",
      },
    },
    discovery: {
      loading: "SPIN keşfi yükleniyor…",
      empty: "Henüz keşif maddesi yok. SPIN tablosunu başlatmak için sesli not bırakın.",
      voiceNoteFab: {
        recordLabel: "Sesli not kaydet",
        notWiredHint: "Kayıt eski panelde; tam FAB faz 5'te.",
      },
      spin: {
        columns: {
          SITUATION: "Durum",
          PROBLEM: "Sorun",
          IMPLICATION: "Sonuç",
          NEED_PAYOFF: "İhtiyaç-getiri",
        },
        emptyColumn: "Henüz madde yok.",
      },
      locked: {
        title: "SPIN tablosu kilitli",
        description: "Her keşif görüşmesi için durum/sorun/sonuç/ihtiyaç-getiri maddelerini yakalamak için yükseltin.",
        cta: "Yükselt",
        requiredPlan: "Pro ve üzeri planlarda mevcut.",
      },
    },
    who: {
      loading: "Karar verici grubu yükleniyor…",
      empty: "Henüz paydaş haritalanmadı. Power tools'tan karar verici eşleyiciyi çalıştırın.",
      card: {
        unknownName: "İsimsiz paydaş",
        rosette: {
          champion: "Şampiyon",
          "economic-buyer": "Karar verici",
          blocker: "Engelleyici",
          stakeholder: "Paydaş",
        },
        championLabel: "Şampiyon",
        influenceLabel: "Etki",
      },
    },
    history: {
      loading: "Aktivite zaman çizelgesi yükleniyor…",
      empty: "Henüz aktivite yok. Loglanan aramalar, e-postalar ve notlar burada görünecek.",
      timelineHeading: "Aktivite",
      objectionsHeading: "Tahmin vs. gerçek itirazlar",
      activityKindLabels: {
        CALL_LOGGED: "Arama loglandı",
        EMAIL_SENT: "E-posta gönderildi",
        EMAIL_OPENED: "E-posta açıldı",
        EMAIL_REPLIED: "E-posta cevaplandı",
        NOTE_ADDED: "Not eklendi",
        VOICE_NOTE_ADDED: "Sesli not eklendi",
        STATUS_CHANGED: "Durum değişti",
        STAGE_CHANGED: "Aşama değişti",
        TASK_CREATED: "Görev oluşturuldu",
        TASK_COMPLETED: "Görev tamamlandı",
      },
    },
    objections: {
      emptyDiff: "Henüz tahmin edilen ya da gerçekleşen itiraz yok.",
      predictedAndRealHeading: "Tahmin edildi ve gerçekleşti",
      predictedNotRealHeading: "Tahmin edildi ama atlandı",
      realOnlyHeading: "Canlıda çıktı (tahmin edilmedi)",
      rebuttalLanded: "İtiraza yanıt verildi.",
      rebuttalSkipped: "Alıcı bu konuyu hiç açmadı.",
      rebuttalMissing: "Yanıt kaydedilmedi.",
      noRebuttal: "Bir sonraki görüşmede yanıt yakalayın.",
    },
  },
} as const satisfies CommonDictionary;
