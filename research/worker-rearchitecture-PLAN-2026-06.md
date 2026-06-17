# Worker Mimarisi — Baştan Planlama Araştırması (SI.AI.Workers)

> **Tarih:** 17 Haziran 2026
> **Kapsam:** `src/lib/agent-workers/` (45 worker) + `src/lib/ai-core/` (orchestrator/planner/chains) + `src/lib/sdr-brain/`. Notion `leadac notion` export'u (SI.AI / Head of Agents / K1211–K1219 spec'leri + FineDine pilot kararları) ile kod gerçeğini karşılaştırıp **worker katmanını baştan nasıl planlamalı** sorusuna cevap verir.
> **Kaynaklar:** Notion Architecture Hub + Registry CSV + SI.AI vizyon dokümanı; `research/finedine/beta-test-analysis-report.md`; `research/finedine/round2-plans/agent-3-ai-workers.md`; `src/lib/ai-core/chains.ts`; `src/lib/agent-workers/registry.ts`; 2026 agent-orchestration literatürü (Anthropic "Building Effective Agents", arXiv 2603.22386 workflow-optimization survey, Zylos/2026 production landscape).
> **Statü:** RESEARCH / DRAFT — kod değiştirmez. Karar gerektiren noktalar §10'da.

---

## 0 · TL;DR (Yönetici Özeti)

1. **İki ayrı "doğru" var ve birbirinden uzaklaşmışlar.** Notion (v1.0, Haziran 2026) **9 worker + tek bir agentic "Head of Agents"** öngörüyor. Kod ise **45 worker + statik preset DAG (LITE/BALANCED/AGGRESSIVE)** ile çalışan, methodology-ağır (MEDDPICC/SPIN/Challenger/BANT) bir "SDR Brain v2" sistemi. Bu **drift** kasıtlı değil; ürün FineDine pilotuyla evrildi ama Notion mimari kaydı güncellenmedi.

2. **Notion'un "tek agentic Head of Agents" hayali, 2026 prod konsensüsüne göre yanlış default.** Anthropic, arXiv survey ve prod landscape'in hepsi aynı şeyi söylüyor: **statik workflow kabuğu + sadece gerçekten gereken tek-iki düğümde sınırlı (bounded) agentic davranış.** Gartner agentic projelerin %40'ının 2027'de iptal olacağını, başlıca sebebin "kontrolsüz akış → maliyet patlaması" olduğunu söylüyor. Yani **kodun statik-DAG yönü doğru**; Notion'un "her lead için tek serbest agent run" hayali olduğu gibi uygulanırsa maliyet + debug + non-determinism cehennemi olur.

3. **Asıl problem worker *sayısı* değil, worker *disiplini*.** Beta raporu sistemi felç eden 6 P0 bug'ın hiçbirinin "yanlış worker mimarisi" olmadığını gösteriyor — hepsi **evidence/grounding eksikliği** (Instagram-as-website hallucination, small-sample %100 KPI patlaması, premium-default, embedding-FAILED karışması). Notion'un en değerli ama kodda **yarım uygulanmış** fikri tam da bu: **Evidence System (T1–T4 kanıt seviyeleri) + QA Worker gate'i.**

4. **Önerilen yön:** Worker'ları sıfırdan icat etme; **mevcut 45 worker'ı Notion'un kavramsal modeline (SI / OI / CH + Evidence + Learning) göre yeniden grupla, ~18 çekirdek worker'a indir, T1–T4 evidence kontratını ZORUNLU kıl, statik DAG kabuğunu koru ve sadece TEK bir bounded agentic "gap-filler" düğümü ekle.** Detay §6–§8.

---

## 1 · İki Kaynak, Tek Sistem

LeadAC worker katmanını iki yerden okuyabiliyoruz; ikisi de "doğru" ama **zaman olarak farklı katmanlar**:

| | **Notion (mimari kaydı, v1.0)** | **Kod (çalışan sistem, SDR Brain v2)** |
|---|---|---|
| Worker sayısı | 9 (K1211–K1219) | 45 (`registry.ts`) |
| Orkestrasyon | Tek agentic "Head of Agents" — tool'ları graph gibi runtime'da seçer | Statik preset DAG (LITE/BALANCED/AGGRESSIVE), `chains.ts` |
| Final çıktı | "Account Intelligence Brief" (tek doğruluk kaynağı) | `LEAD_INTELLIGENCE_BRIEF` → final NBA + reasoning graph |
| Kanıt modeli | Evidence System T1–T4 (zorunlu) | Kısmi: `isGroundedInCorpus`, `confirmedPainPoints` — ama tutarsız |
| Öğrenme | OI Learning Layer (deal outcome → playbook) | `OUTCOME_ATTRIBUTOR` → `InsightPerformance` → `COMMERCIAL_INSIGHT_MATCHER` (Wilson lower-bound) |
| Satış metodolojisi | Sadece "Sales Angle worker" | MEDDPICC, SPIN, Challenger committee, BANT, Objection, Why-Now |
| Bağlam | F&B / FineDine, restoran röntgeni | F&B / FineDine, **call-first lead action sheet** (HubSpot overlay) |

**Sonuç:** Kod, Notion'un OI Learning Layer + Sales Angle vizyonunu beklenenden çok daha ileri taşımış (bu iyi); ama bunu yaparken worker sayısı 5x'lenmiş ve Notion'un en kritik iki disiplinini (Evidence System + QA gate) yarım bırakmış (bu kötü). Beta bug'larının kaynağı tam burası.

### 1.1 Notion'un kavramsal modeli (korunmalı)

Notion'un **bounded-context** modeli mimari olarak hâlâ doğru ve kodun yeniden gruplanması için iskelet olmalı:

- **SI — Sales Intelligence** (eski K1): leadi bulma + analiz. İçinde `SI.AI` (eski K12) → `HeadOfAgents` (orkestrasyon) + `Workers` (9 worker ailesi).
- **OI — Operational Intelligence** (eski K2): `EvidenceSystem` + `LearningLayer` + `PatternRecognition`. "Hangi sinyal gerçekten satışa döndü?" öğrenmesi.
- **CH — Customer Channel** (eski K11): `UI` + `Integrations` (HubSpot) + `MCP`. Üç katman; SDR ister LeadAC UI, ister HubSpot içinde, ister kendi AI agent'ından (MCP) aynı tek motoru kullanır.

> Kritik FineDine kararı (Notion `SI.AI` + `CH.UI.Lead-Detail` + beta): **LeadAC bir "restoran raporu aracı" değil, HubSpot üstünde çalışan bir karar/aksiyon katmanı.** Worker'ların nihai çıktısı bir dosya değil, SDR'ın "bugün bu lead'le ne yapacağım?" sorusunun 10 saniyede cevabı: **fit reason + FineDine angle + next action + confidence + evidence.** North star: **rep başına haftalık qualified action** (lead sayısı değil).

---

## 2 · Notion'un 9 Worker'ı vs Kodun 45 Worker'ı

### 2.1 Notion spec'leri (K1211–K1219 + Evidence + Learning)

| # | Worker | Notion'daki rolü |
|---|---|---|
| K1211 | **Enrichment** | Openmart API + Google/Yelp/TripAdvisor review datası çekimi |
| K1212 | **SERP** | Google arama → dış gerçeklik kontrolü, eksik bilgi tamamlama |
| K1213 | **Website Audit** | Dijital operasyon röntgeni: rezervasyon/sipariş/menü/CTA/tech stack → revenue opportunity |
| K1214 | **Review Audit** (Review Analyst) | Yorumları satılabilir pain/switch sinyaline çevirir (customer truth layer) |
| K1215 | **Social Analyse** | Marka algısı + dijital aktiflik + outbound tone signal |
| K1216 | **Sub-Vertical Classifier** | Alt-sektör (fnb-bar-club, fine-dining…) etiketleme |
| K1217 | **ICP Scorer** | Onboarding Tier-1 ICP'ye göre fit skoru + breakdown + reasoning |
| K1218 | **Sales Angle** | Tüm sinyalleri satış mesajına çevirir; OI'dan kazanan pattern'leri alır (revenue messaging engine) |
| K1219 | **QA** | 3 katmanlı gerçeklik filtresi: (1) Final QA Gate, (2) Tool QA, (3) Source QA |
| — | **Evidence System** | Her bilgi T1 (raw) / T2 (rule) / T3 (model) / T4 (assumption). Kural: T4 tek başına kullanılamaz; T3 mutlaka T1/T2 destekli. |
| — | **MVP eklentileri** | Booking Friction Detector, Source Reconciliation, Opportunity Scorer, Account Brief Writer |

### 2.2 Kodun 45 worker'ı, gruplara göre

`registry.ts`'ten (gruplar: intelligence / pitch / deliverable / ops / enrichment + "SDR Brain v2"):

- **Intelligence (data + skor):** `WEBSITE_AUDITOR`, `REVIEW_ANALYST`, `GOOGLE_PLACES_REVIEWS` (deprecated), `SALES_OPPORTUNITY_SCORER`, `SUBVERTICAL_CLASSIFIER`, `SOCIAL_SCRAPER`, `EMAIL_VERIFIER`, `LEAD_INTELLIGENCE_BRIEF`, `ICP_SCORER`, `STAKEHOLDER_DISCOVERER` (placeholder), `ACCOUNT_TIER_RANKER`, `BANT_INFERRER`, `TRIGGER_DETECTOR`, `COMMERCIAL_INSIGHT_MATCHER`, `WHY_NOW_SYNTHESIZER`, `BUYING_COMMITTEE_MAPPER`, `OBJECTION_PREDICTOR`, `MEDDPICC_EXTRACTOR`, `SPIN_EXTRACTOR`
- **Pitch (artifact):** `WEBSITE_PLAN_GENERATOR` (hidden), `WEBSITE_MOCKUP_GENERATOR`, `OPENER_WRITER`, `VIDEO_SCRIPT_WRITER` (hidden), `VOICE_NOTE_TRANSCRIBER` (hidden), `LEAD_DOSSIER_GENERATOR`
- **Deliverable (kapanış sonrası install pack — hepsi hidden):** `AI_RECEPTIONIST_BUILDER`, `REVIEW_REPLY_AGENT`, `LEAD_RESPONSE_AGENT`, `BOOKING_WIDGET_BUILDER`, `GBP_AUTOPOST_AGENT`
- **Ops (server-internal):** `COPILOT_CHAT`, `INBOX_REPLY_ATTRIBUTOR`, `OUTREACH_SENDER`, `CONTAINMENT_RATE_TRACKER`, `OUTCOME_ATTRIBUTOR`
- **Enrichment (Apify):** `APIFY_GMAPS_DEEP`, `APIFY_WEB_CRAWL_DEEP`, `APIFY_INSTAGRAM_DEEP`, `APIFY_FACEBOOK_DEEP`, `APIFY_TIKTOK_DEEP` (hidden), `APIFY_SERP_RANK`, `APIFY_COMPETITOR_ADS`, `APIFY_LINKEDIN_COMPANY` (hidden), `APIFY_REDDIT_MENTIONS`

### 2.3 Eşleme: Notion → Kod

| Notion | Kod karşılığı | Durum |
|---|---|---|
| Enrichment | `APIFY_GMAPS_DEEP` + `SOCIAL_SCRAPER` + (Openmart yok, GMaps ikame) | ✅ var, daha güçlü |
| SERP | `APIFY_SERP_RANK` | ✅ var (async-apify) |
| Website Audit | `WEBSITE_AUDITOR` + `APIFY_WEB_CRAWL_DEEP` | ✅ var |
| Review Audit | `REVIEW_ANALYST` | ✅ var |
| Social Analyse | `SOCIAL_SCRAPER` + `APIFY_INSTAGRAM/FACEBOOK_DEEP` | ✅ var |
| Sub-Vertical | `SUBVERTICAL_CLASSIFIER` | ✅ var |
| ICP Scorer | `ICP_SCORER` (+ `ACCOUNT_TIER_RANKER`) | ✅ var |
| Sales Angle | `SALES_OPPORTUNITY_SCORER` + `OPENER_WRITER` + `COMMERCIAL_INSIGHT_MATCHER` + `WHY_NOW_SYNTHESIZER` | ✅ dağınık, 4 worker'a yayılmış |
| QA Worker | **YOK** (gömülü `isGroundedInCorpus` / `kpi-filter` parçaları var, merkezi gate yok) | ❌ **eksik** |
| Evidence System | **Kısmi** (`confirmedPainPoints`, grounding) — T1–T4 kontratı yok | ⚠️ **yarım** |
| Booking Friction Detector | `WEBSITE_AUDITOR` içine gömülü | ⚠️ ayrı değil |
| Account Brief Writer | `LEAD_INTELLIGENCE_BRIEF` | ✅ var |
| Head of Agents (orkestrasyon) | `orchestrator.ts` + `planner.ts` + statik `chains.ts` | ⚠️ statik, agentic değil |
| OI Learning Layer | `OUTCOME_ATTRIBUTOR` + `InsightPerformance` | ✅ var, Notion'dan ileri |
| — (kodda fazlalık) | MEDDPICC/SPIN/Challenger/BANT/Objection, 6 deliverable, 9 Apify | Notion'da yok |

**Çıkarım:** Notion'un 9 worker'ının 8'i kodda zaten var (çoğu daha güçlü). **Eksik olan tek şey QA Worker + tam Evidence System.** Buna karşılık kod, Notion'da olmayan ~30 worker eklemiş — bunların bir kısmı değerli (learning loop), bir kısmı pilot için fazlalık (6 deliverable, TikTok/LinkedIn/Reddit/CompetitorAds Apify, methodology katmanı).

---

## 3 · Boşluk Analizi (Gap Analysis)

### G1 — QA Worker / merkezi gerçeklik gate'i YOK *(en kritik)*
Notion QA Worker'ı 3 seviyede kontrol öngörüyor (Final QA Gate, Tool QA, Source QA). Kodda bu yok; grounding mantığı `kpi-filter.ts` + `isGroundedInCorpus` gibi parçalara dağılmış ve her worker kendi içinde tutarsız uyguluyor. **Beta P0 bug'larının %80'i bunun sonucu:** Instagram-as-website (Source QA olsa yakalardı), small-sample %100 KPI (Tool QA olsa düşürürdü), label=example hallucination (Tool QA olsa block ederdi).

### G2 — Evidence System (T1–T4) yarım
Notion her claim'i T1–T4 kanıt seviyesine bağlamayı, T4'ü tek başına yasaklamayı, T3'ü T1/T2 ile desteklemeyi şart koşuyor. Kodda `confirmedPainPoints` whitelist'i ve 3-gram grounding var ama **kontrat tipi seviyesinde yok** — yani worker çıktıları "bu bilgi hangi seviye kanıta dayanıyor?" sorusunu taşımıyor. Sonuç: model inference (T3) ile raw data (T1) UI'da aynı görünüyor; SDR neyin gerçek neyin tahmin olduğunu ayırt edemiyor.

### G3 — Worker dağınıklığı (Sales Angle 4 worker'a yayılmış)
Notion'un tek "Sales Angle worker"ı kodda `SALES_OPPORTUNITY_SCORER` + `OPENER_WRITER` + `COMMERCIAL_INSIGHT_MATCHER` + `WHY_NOW_SYNTHESIZER`'a dağılmış. Bu kötü değil ama **tek bir mantıksal birim 4 ayrı DAG düğümü** = `chains.ts` 1000 satır, dependency rewiring karmaşası (`filterByPlan` transitive closure), debug zorluğu.

### G4 — Orkestrasyon statik, ama Notion agentic istiyor
Notion `SI.AI`: *"Mevcut sistemdeki sabit worker akışını kaldırıp tek bir AI-native analysis layer getir... agent tool'ları graph gibi kullanır... eksik bilgiyi tespit eder, yeni tool çağırır."* Kod ise **author-time'da sabitlenmiş** preset DAG. **2026 best-practice'e göre kod doğru, Notion fazla iddialı** (§4). Ama kod da bir uçta: hiç runtime adaptasyon yok — eksik veri varsa düğüm SKIP olur, agent "şunu da çekeyim" diyemez.

### G5 — Pilot odağı ile worker envanteri uyumsuz
FineDine pilotu = F&B, HubSpot overlay, call-first. Ama registry'de TikTok/LinkedIn/Reddit/CompetitorAds Apify worker'ları, 6 client-deliverable, Challenger buying-committee mapper gibi pilot için gereksiz ağırlık var (çoğu zaten `hiddenFromPanel`). Bu **bakım maliyeti + bilişsel yük** (45 worker'ı kim kafasında tutuyor?).

### G6 — Çoklu skor karmaşası
`review_analyses.lead_score` + `sales_opportunities.opportunity_score` + `salesConfidence` + `icpFitScore` + `account.tier`. Beta raporu (Sorun #8): SDR hangi sayıya güveneceğini bilmiyor. Notion "tek Account Intelligence Brief / tek confidence" diyor; kod `LEAD_INTELLIGENCE_BRIEF` ile bunu hedefliyor ama eski skorlar hâlâ UI'da yan yana.

---

## 4 · Dış Araştırma — 2026 Orkestrasyon Konsensüsü

Notion'un "tek serbest Head of Agents" hayalini mi yoksa kodun "statik DAG"ını mı baz almalı? 2026 literatürü net:

> **"2026'da ship eden agent-şekilli sistemler genellikle içine TEK agentic düğüm gömülmüş bir workflow'dur — dışarıdan predictable, sadece gerçekten gereken o tek karar noktasında adaptif."** — Agentic Workflows vs AI Agents 2026 Decision Guide

Konsolide bulgular:

1. **Anthropic (Building Effective Agents):** "En basit çözümle başla, sadece gerektiğinde karmaşıklık ekle." Workflow = predefined code paths (predictable); Agent = LLM kendi akışını yönetir (esnek ama pahalı/non-deterministik). **Orchestrator-Workers** pattern'i ancak subtask'lar önceden bilinemiyorsa kullan.
2. **arXiv 2603.22386 (workflow-optimization survey):** "Statik scaffold + küçük operator kütüphanesiyle başla. Graph-level search'ü ancak trace analizi *yapısal* failure mode gösterirse ekle. Heterojen koşullarda full workflow generation yerine **runtime selection/pruning** tercih et."
3. **Zylos 2026 production landscape:** "Deterministik dış yapı + dinamik iç döngü prod deployment'lara hakim. Statik başla, gözlemlenen failure mode'a göre artımlı dinamizm ekle. Token budget + tool-use cap + pre-execution validation ile sınırsız agent loop'u engelle. Gün 1'den observability (tracing) şart."
4. **Gartner:** Agentic AI projelerinin %40'ı 2027'de iptal; başlıca sebep **maliyet patlaması + belirsiz değer + yetersiz kontrol** — hepsi kontrol akışı açık (open-ended) bırakıldığında en sert vurur.

**LeadAC için sonuç:**
- ✅ Kodun **statik DAG kabuğu doğru** (predictable, auditable, ucuz, FineDine'ın <10–15s P95 latency beklentisine uygun).
- ❌ Notion'un "her lead için tek serbest agent run"ı **olduğu gibi uygulanmamalı** — token explosion + compound reliability decay (her ekstra adım failure olasılığını çarpar).
- ✅ Doğru orta yol: **statik DAG kabuğu + TEK bounded agentic "gap-filler" düğümü** (sadece kanıt eksikse, açık bütçeyle ek tool çağırır). Bu, Notion'un "agent eksik bilgiyi görür, yeni tool çağırır" vizyonunu, prod-güvenli şekilde verir.

---

## 5 · Tasarım İlkeleri (Re-Plan'in Anayasası)

1. **Statik rail + tek bounded agentic düğüm.** DAG kabuğu kalır; "Gap Resolver" tek esnek nokta, açık tool-call ceiling (örn. ≤3 ekstra çağrı) ve token budget ile.
2. **Evidence-first.** Her worker çıktısı her claim'i bir `EvidenceRef` (tier T1–T4 + source + locator) ile taşır. T4 tek başına kullanılamaz; T3 ⇒ T1/T2 destekli. Bu bir *kontrat tipi*, opsiyonel değil.
3. **Tek QA gate, merkezi.** Notion'un 3-seviyeli QA'sı tek `QA_GATE` worker'ı olarak DAG'ın sonunda (Final), her worker sonrası (Tool QA hook) ve cross-source noktada (Source QA) çalışır; geçmeyen claim ya düşer ya "partial" işaretlenir.
4. **Mantıksal birim = tek worker.** "Sales Angle" gibi bir kavram 4 DAG düğümüne değil tek worker'a (içinde alt-adımlar olabilir) denk gelmeli.
5. **Pilot-first envanter.** FineDine F&B + HubSpot + call-first için gereken worker'lar "core"; geri kalanı `experimental`/`deferred` flag'iyle registry'de durur ama default chain'e girmez.
6. **Tek rep-facing sayı.** `LEAD_INTELLIGENCE_BRIEF`'in `salesConfidence`'i tek PRIMARY skor; diğerleri "advanced" altında.
7. **North star hizası.** Her worker çıktısı nihayetinde "qualified action" üretimine hizmet etmeli (fit reason / angle / next action / confidence / evidence). Buna katkısı olmayan worker pilot-core değildir.
8. **Observability gün 1.** Her run trace'lenebilir; `AgentRun` zaten bunu tutuyor — Evidence + QA verdict'leri de trace'e yazılmalı.

---

## 6 · Önerilen Worker Taksonomisi (sıfırdan, ama mevcut koddan türetilmiş)

Notion'un SI/OI/CH modeline oturtulmuş **5 katman, ~18 çekirdek worker.** Her katman = bir DAG fazı.

```
                         ┌─────────────────────────────────────────────┐
  CH (Customer Channel)  │  LeadAC UI · HubSpot Integration · MCP        │  ← tüketim
                         └───────────────▲─────────────────────────────┘
                                         │ tek Account Intelligence Brief
                         ┌───────────────┴─────────────────────────────┐
  SI.AI.HeadOfAgents     │  Orchestrator (statik DAG) + Gap Resolver    │  ← orkestrasyon
                         │  (tek bounded agentic düğüm)                  │
                         └───────────────▲─────────────────────────────┘
   ┌─────────────────────────────────────┼──────────────────────────────────────┐
   │ L1 GATHER          L2 ANALYZE        L3 SCORE/FIT      L4 DECIDE/ANGLE  L5 QA │
   │ (enrichment)       (intelligence)    (fit)             (pitch/decision)       │
   └──────────────────────────────────────────────────────────────────────────────┘
                                         │ outcome
                         ┌───────────────┴─────────────────────────────┐
  OI (Operational Int.)  │  Evidence Store · Learning Layer · Patterns  │  ← öğrenme
                         └───────────────────────────────────────────── ┘
```

### L1 — GATHER (veri toplama / enrichment)
| Worker | Mevcut koddan | Not |
|---|---|---|
| `ENRICH_PLACES_DEEP` | `APIFY_GMAPS_DEEP` | Reviews + emails + social + photos. T1 kaynak. |
| `ENRICH_WEB_CRAWL` | `APIFY_WEB_CRAWL_DEEP` | KB chunk (RAG). T1. |
| `ENRICH_SERP` | `APIFY_SERP_RANK` | Dış gerçeklik + hiring/expansion sinyali. T1/T2. |
| `ENRICH_SOCIAL` | `SOCIAL_SCRAPER` (+ deep variant'lar deferred) | Profil keşfi + tone. T1. |
| `VERIFY_WEBSITE` | yeni gate (beta P0.1) | **Instagram-as-website gate burada;** social URL → `crawlError=SOCIAL_MEDIA_ONLY`. |

### L2 — ANALYZE (sinyal çıkarma / intelligence)
| Worker | Mevcut koddan | Not |
|---|---|---|
| `WEBSITE_AUDIT` | `WEBSITE_AUDITOR` | Booking Friction Detector'ı **alt-modül** olarak içerir (ayrı worker değil). Token-boundary keyword fix (beta P0.1). |
| `REVIEW_ANALYST` | `REVIEW_ANALYST` | Pool-floor + label-fusion + language gate'leri zorunlu (beta P0.4, agent-3 §3.10/§4.2/§4.4). |
| `SUBVERTICAL_CLASSIFIER` | aynı | Michelin/hybrid edge-case'leri (beta P1.2/P1.3). |
| `TRIGGER_DETECTOR` | aynı | "Why now" sinyalleri (rating drop, hiring, new location). |

### L3 — SCORE / FIT
| Worker | Mevcut koddan | Not |
|---|---|---|
| `ICP_SCORER` | aynı | Onboarding Tier-1 ICP. Deterministik, cost=0. |
| `ACCOUNT_TIER_RANKER` | aynı | Multi-location → tier. |
| `OPPORTUNITY_SCORER` | `SALES_OPPORTUNITY_SCORER` | **Deterministik package selector** içeride (beta P0.5 matrix); LLM'den paket okuma yok. |

### L4 — DECIDE / ANGLE (Notion'un "Sales Angle worker"ı, konsolide)
| Worker | Mevcut koddan | Not |
|---|---|---|
| `SALES_ANGLE` | `COMMERCIAL_INSIGHT_MATCHER` + `WHY_NOW_SYNTHESIZER` birleşik | OI learning'den kazanan pattern alır → primary angle + supporting angles + "pitch this / don't pitch this". |
| `OPENER_WRITER` | aynı | websiteContext + chain-aware + TR style rules (beta P0.3/agent-3 §3.8). |
| `OBJECTION_PREDICTOR` | aynı | İsteğe bağlı, BALANCED+. |

### L5 — QA + BRIEF (Notion QA Worker + Account Brief Writer)
| Worker | Mevcut koddan | Not |
|---|---|---|
| `QA_GATE` | **YENİ** (beta'daki dağınık grounding'i merkezileştir) | 3 seviye: Final QA Gate / Tool QA hook / Source QA. T3/T4 yanlış kullanımı + cross-source çelişki + label hallucination block eder. |
| `INTELLIGENCE_BRIEF` | `LEAD_INTELLIGENCE_BRIEF` | Tek Account Intelligence Brief + tek `salesConfidence` + final NBA + reasoning graph + evidence chain. |

### OI — LEARNING (event-driven, DAG dışı)
| Worker | Mevcut koddan | Not |
|---|---|---|
| `OUTCOME_ATTRIBUTOR` | aynı | Reply/disposition/stage → InsightPerformance (Wilson). Notion OI Learning Layer'ın motoru. KORU. |
| `INBOX_REPLY_ATTRIBUTOR` | aynı | Email reply attribution. |

### Deferred / Experimental (registry'de kalır, default chain'de DEĞİL)
- **Methodology katmanı:** `MEDDPICC_EXTRACTOR`, `SPIN_EXTRACTOR`, `BUYING_COMMITTEE_MAPPER`, `BANT_INFERRER` → sadece deal aktif + voice-note geldiğinde event chain'inde (zaten öyle). Pilot-core değil ama silmeyin; FineDine "qualification checklist" ihtiyacına bağlanabilir.
- **Client deliverables:** `AI_RECEPTIONIST_BUILDER`, `REVIEW_REPLY_AGENT`, `LEAD_RESPONSE_AGENT`, `BOOKING_WIDGET_BUILDER`, `GBP_AUTOPOST_AGENT` → kapanış-sonrası install pack, SDR cycle dışı. `deferred`.
- **Düşük-ROI Apify:** `APIFY_TIKTOK_DEEP`, `APIFY_LINKEDIN_COMPANY`, `APIFY_REDDIT_MENTIONS`, `APIFY_COMPETITOR_ADS` → niş-spesifik; pilot için kapalı.
- **Deprecated:** `GOOGLE_PLACES_REVIEWS` (5-review bias), `WEBSITE_PLAN_GENERATOR`, `VIDEO_SCRIPT_WRITER` → kaldırılabilir veya arşiv.

**Net:** 45 → **~18 pilot-core** (+ ~12 deferred/experimental registry'de durur). Yeni worker icat etmiyoruz; **`QA_GATE` tek gerçek yeni worker.** Geri kalan: birleştirme + evidence kontratı + flag.

---

## 7 · Worker-Bazlı Karar Tablosu (KEEP / MERGE / GATE / DEFER / CUT)

| Mevcut worker | Karar | Aksiyon |
|---|---|---|
| WEBSITE_AUDITOR | **KEEP+GATE** | Booking Friction alt-modül; token-boundary keyword fix; Evidence T1/T2 etiketi |
| REVIEW_ANALYST | **KEEP+GATE** | Pool-floor/label-fusion/language gate; her KPI'a EvidenceRef |
| SUBVERTICAL_CLASSIFIER | **KEEP** | primaryType genişletme + hybrid multi-tag |
| SOCIAL_SCRAPER | **KEEP** | L1 |
| EMAIL_VERIFIER | **KEEP** | L1, PRO+ |
| ICP_SCORER | **KEEP** | L3 |
| ACCOUNT_TIER_RANKER | **KEEP** | L3 |
| SALES_OPPORTUNITY_SCORER | **KEEP** | deterministik package selector matrix |
| TRIGGER_DETECTOR | **KEEP** | L2 |
| COMMERCIAL_INSIGHT_MATCHER | **MERGE→SALES_ANGLE** | tek L4 worker |
| WHY_NOW_SYNTHESIZER | **MERGE→SALES_ANGLE** | tek L4 worker |
| OPENER_WRITER | **KEEP+GATE** | websiteContext + chain-aware + TR style |
| OBJECTION_PREDICTOR | **KEEP (opt)** | BALANCED+ |
| LEAD_INTELLIGENCE_BRIEF | **KEEP** | tek brief + tek confidence |
| LEAD_DOSSIER_GENERATOR | **MERGE→BRIEF** veya KEEP | brief ile çakışıyor; tek artifact'e indir |
| APIFY_GMAPS_DEEP | **KEEP** | L1 |
| APIFY_WEB_CRAWL_DEEP | **KEEP** | L1 |
| APIFY_SERP_RANK | **KEEP** | L1 |
| APIFY_INSTAGRAM/FACEBOOK_DEEP | **KEEP (opt)** | BALANCED+ |
| APIFY_TIKTOK/LINKEDIN/REDDIT/COMPETITOR_ADS | **DEFER** | default chain dışı |
| OUTCOME_ATTRIBUTOR | **KEEP** | OI learning motoru |
| INBOX_REPLY_ATTRIBUTOR | **KEEP** | ops |
| MEDDPICC/SPIN/BANT/BUYING_COMMITTEE | **DEFER** | event-driven, pilot-core değil |
| AI_RECEPTIONIST/REVIEW_REPLY/LEAD_RESPONSE/BOOKING_WIDGET/GBP_AUTOPOST | **DEFER** | kapanış-sonrası deliverable |
| GOOGLE_PLACES_REVIEWS | **CUT** | 5-review bias, GMaps ikame |
| WEBSITE_PLAN_GENERATOR / VIDEO_SCRIPT_WRITER | **CUT/ARCHIVE** | kullanılmıyor |
| STAKEHOLDER_DISCOVERER | **CUT (placeholder)** | impl yok |
| **QA_GATE** | **NEW** | tek gerçek yeni worker |
| **VERIFY_WEBSITE** | **NEW (gate)** | L1, Instagram-as-website fix |
| **GAP_RESOLVER** | **NEW (bounded agentic)** | §8.2 |

---

## 8 · Orkestrasyon: Statik Kabuk + Tek Agentic Düğüm

### 8.1 Statik kabuk (mevcut `chains.ts` korunur, sadeleştirilir)
DAG fazları L1→L2→L3→L4→L5 sırasıyla; mevcut `LITE/BALANCED/AGGRESSIVE` preset mantığı kalır ama:
- 1000 satırlık `chains.ts`, katman-bazlı sadeleşir (her faz bir blok).
- `filterByPlan` transitive-closure karmaşası azalır çünkü düğüm sayısı düşer.
- Her DAG bitişinde `QA_GATE` zorunlu son adım.

### 8.2 `GAP_RESOLVER` — tek bounded agentic düğüm (Notion vizyonunun prod-güvenli hali)
Notion `SI.AI`: *"agent veriyi okur, eksiklik tespit eder, yeni tool çağırır, önceki çıktıyı yeniden değerlendirir."* Bunu **tüm pipeline'a değil, tek düğüme** veriyoruz:

- **Ne zaman çalışır:** L2/L3 sonrası, `QA_GATE` "yetersiz/çelişkili kanıt" işaretlerse (örn. website audit "booking yok" diyor ama review "rezervasyon karışıklığı" diyor → çelişki).
- **Ne yapar:** Açık bir tool listesinden (`ENRICH_SERP`, `ENRICH_WEB_CRAWL`, ek review pull) **en fazla N=3 ek çağrı** ile boşluğu/çelişkiyi kapatmaya çalışır, sonra L4'e döner.
- **Sınırlar (Gartner riskine karşı):** tool-call ceiling (3), token budget cap, timeout, her çağrı `AgentRun` + Evidence trace. Bütçe biterse "partial brief + unresolved conflict flag" ile çıkar.
- **Neden tek düğüm:** Anthropic/arXiv/Zylos hepsi "dinamizmi sadece gerçekten gereken yere göm" diyor. Çelişki çözümü tam da "subtask önceden bilinemez" durumu (Orchestrator-Workers pattern'inin meşru kullanımı).

### 8.3 Evidence kontratı (tip seviyesinde)
```ts
type EvidenceTier = "T1_RAW" | "T2_RULE" | "T3_MODEL" | "T4_ASSUMPTION";
interface EvidenceRef {
  tier: EvidenceTier;
  source: string;        // "google_review:rid_123" | "website:/menu" | "serp:q"
  locator?: string;      // URL, review id, DOM path
  quote?: string;        // T1 için verbatim
}
// Her worker çıktısındaki her claim opsiyonel değil ZORUNLU EvidenceRef[] taşır.
// QA_GATE kuralları: T4 alone → drop; T3 without T1|T2 → downgrade/drop; cross-source conflict → flag.
```
Bu, beta'daki `confirmedPainPoints` + `isGroundedInCorpus` parçalarını **tek kontrata** birleştirir ve Notion Evidence System'ini gerçekten uygular.

---

## 9 · Fazlı Yol Haritası

| Faz | Hedef | İçerik | Bağımlılık |
|---|---|---|---|
| **F0 — Stop the bleeding** | Beta P0 bug'ları | `VERIFY_WEBSITE` gate, review pool-floor/label gate, deterministic package matrix, embedding decouple (`SUCCEEDED_NO_MEMORY`), Gemini key rotation | beta-test-analysis P0 |
| **F1 — Evidence kontratı** | `EvidenceRef` tipi + worker çıktılarına ZORUNLU kılma | types.ts + her L1/L2 worker'a EvidenceRef; UI'da T1 vs T3 görsel ayrımı | F0 |
| **F2 — QA_GATE** | Merkezi 3-seviye QA worker | Final/Tool/Source QA; chains'e zorunlu son adım | F1 |
| **F3 — Konsolidasyon** | Worker birleştirme + flag | SALES_ANGLE merge; DOSSIER→BRIEF; deferred/experimental flag; CUT'lar | F2 |
| **F4 — GAP_RESOLVER** | Tek bounded agentic düğüm | tool-call ceiling + token budget + trace; QA conflict trigger | F2, F3 |
| **F5 — Tek skor + UI** | salesConfidence PRIMARY | eski skorları "advanced"a indir; explainability (claim → evidence popup) | F1 |

> F0–F1 acil (pilot güveni); F2–F3 yapısal; F4 "nice-to-have" — F2 conflict-flag'i tek başına bile değer verir, agentic resolver olmadan da SDR'a "çelişki var, manuel bak" diyebilir.

---

## 10 · Karar Gereken Açık Sorular

1. **Notion mimari kaydını güncelleyelim mi?** Kod 45 worker'da; Notion 9'da. Notion'u "kavramsal model" olarak mı tutalım yoksa kod gerçeğiyle mi senkronlayalım? (Öneri: Notion'u SI/OI/CH + 5-katman + ~18 worker'a güncelle.)
2. **Methodology katmanı (MEDDPICC/SPIN/Challenger) pilot-core mu, deferred mı?** FineDine "qualification checklist" istiyor — bu katman ona bağlanabilir. Yoksa pilot ağırlığı mı? (Öneri: deferred ama FineDine qualification checklist'e map et.)
3. **GAP_RESOLVER F4'te mi yoksa hiç mi?** Maliyet/karmaşıklık vs çelişki-çözme değeri. (Öneri: önce F2 conflict-flag; agentic resolver'ı ancak trace'te "çözülemeyen çelişki" sık çıkarsa ekle — arXiv "structural failure mode görünce ekle" kuralı.)
4. **DOSSIER vs BRIEF:** ikisi de "rollup" — tek artifact'e mi inelim? (Öneri: BRIEF primary, dossier'ı brief'in markdown render'ı yap.)
5. **Deferred worker'lar silinsin mi, flag'le mi kalsın?** (Öneri: `status: "experimental" | "deferred"` registry flag'i; sadece default chain'den çıkar, kod kalsın.)
6. **Bu plan kod değiştirmeli mi, yoksa sadece F0 mı ship?** Bu doküman research; uygulama ayrı PR'lar.

---

## Ek · Kaynak Haritası

- Notion export: `C:\Users\meert\Desktop\leadac notion\` — `SI AI`, `Leadac Architecture Hub`, `Leadac Architecture Registry.csv`, `K1211–K1219`, `CH UI Lead-Detail`, `CH Integrations Hubspot`, `Finedine M2`.
- Kod: `src/lib/agent-workers/{registry,types,execute}.ts`, `src/lib/ai-core/{chains,orchestrator,planner}.ts`, `src/lib/sdr-brain/*`.
- Beta: `research/finedine/beta-test-analysis-report.md`, `research/finedine/round2-plans/agent-3-ai-workers.md`, `research/finedine/beta-test-round-2-camden-report.md`.
- Dış: Anthropic "Building Effective Agents"; arXiv 2603.22386 (workflow-optimization survey); Zylos 2026 orchestration landscape; "Agentic Workflows vs AI Agents 2026 Decision Guide".
