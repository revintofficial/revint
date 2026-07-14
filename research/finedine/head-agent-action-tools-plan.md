# Head Agent — Canlı Aksiyon Tool'ları (re-crawl + web search) Planı

> Durum: TASLAK / karar bekliyor.
> Kapsam: Claude Head Agent'ın tool-use loop'una **canlı (yan etkili) tool** eklemek: `live_recrawl` ve `web_search`.
> İlgili kod: `src/lib/ai-core/agent/{head-agent,claude,tools}.ts`, `src/lib/agent-workers/{quota,registry}.ts`, `WEBSITE_AUDITOR`, Apify `serp-rank` / `bing-brand-search`.

---

## 1. Şu anki sistem (mevcut durum)

### 1.1 Akış
1. Lead gelir → `lead_created` chain → deterministik worker'lar (crawl, review, SERP, social, enrichment, skorlama) çalışır ve **substrate**'i DB'ye yazar.
2. Zincirin sonunda `LEAD_INTELLIGENCE_BRIEF` worker'ı deterministik brief'i üretir.
3. **Head Agent** (sadece F&B + flag açık workspace'lerde) devreye girer:
   - Deterministik vertical-pack shortlist'i hesaplar (`computeFnbModuleFit`).
   - Bounded **Claude tool-use loop** (`runClaudeToolLoop`, max 5 tur) çalışır.
   - Claude, ihtiyaç duydukça **read-only** tool'ları çağırır.
   - QA gate'ten geçerse karar brief'e iliştirilir; HubSpot write-back + UI kartı tüketir.

### 1.2 Bugünkü tool seti (`tools.ts`) — HEPSİ READ-ONLY
| Tool | Ne yapar | Yan etki |
|---|---|---|
| `get_lead_basics` | İşletme temel verisi | yok |
| `get_full_reviews` | Tam review analizi (pain/switch/strength) | yok |
| `get_website_audit` | **Daha önce çekilmiş** audit + feature'lar | yok |
| `get_dossier` | Uzun narrative | yok |
| `get_sales_opportunity` | Scorer rationale + paket | yok |
| `get_packages` | Workspace'in gerçek paket kataloğu | yok |
| `get_memory` | Semantic memory | yok |

### 1.3 Mevcut sistemin sınırı (bu planın gerekçesi)
- Head Agent yalnızca **pipeline'ın daha önce topladığı** veriyi okuyabilir.
- Web sitesi audit'i bayatsa (lead haftalar önce çekildi, site o zamandan beri değişti) Head Agent **tazeleyemez** → eski sinyalle karar verir.
- Yorumda/dış kaynakta geçen bir iddiayı (ör. "yeni şube açmışlar", "Michelin listesine girmiş") **canlı doğrulayamaz** → sadece elindeki veriyle sınırlı.
- Yani "agent her şeye karar verir, eksik gördüğünü gidip toplar" vizyonu **yarım**: okuyabiliyor ama **toplayamıyor**.

---

## 2. Önerilen ekleme: canlı aksiyon tool'ları

### 2.1 Yeni tool'lar
| Tool | Ne yapar | Maliyet | Yan etki |
|---|---|---|---|
| `live_recrawl` | Lead'in sitesini **şimdi** yeniden crawl eder (Playwright `WEBSITE_AUDITOR`), taze `WebsiteFeatures` döner | Playwright süresi (sunucu CPU) | DB'ye yeni audit yazar |
| `web_search` | Bir sorguyu **canlı** aratır (Apify SERP / Bing brand search), ilk N sonucu döner | **Apify USD** (`costUsdCents`) | dış API çağrısı |

### 2.2 Tasarım ilkeleri (read-only tool'lardan farkı)
Aksiyon tool'ları **quota + bütçe + idempotency**'ye bağlanmadan EKLENMEMELİ. Read-only tool'lar bedavaydı; bunlar değil. Kurallar:

1. **Quota gate.** Her aksiyon tool çağrısı `quota.ts` üzerinden kontrol edilir. Plan limiti (FREE/PRO/...) aşılırsa tool `{ error: "quota_exceeded" }` döner — loop çökmez, Claude bunu görüp deterministik kararla devam eder.
2. **Per-run bütçe tavanı.** Tek bir Head Agent loop'u en fazla **1 re-crawl + 2 web_search** çağırabilir (sabit `ACTION_TOOL_BUDGET`). Loop içi sayaç; aşılırsa tool reddeder. Claude'un sonsuz "bir daha ara" döngüsüne girmesini engeller.
3. **Maliyet metering.** Apify USD → `AgentRun.costUsdCents`; Playwright → süre log'u. Head Agent zaten `costTokens`'ı topluyor; `costUsdCents` de eklenir.
4. **Idempotency / tazelik.** `live_recrawl` son audit < 24 saat ise yeni crawl yapmaz, mevcut audit'i döner (`stale=false` der). Gereksiz crawl'ı önler.
5. **Multi-tenant.** Diğer tool'lar gibi `workspaceId` scope'lu; crawl/SERP yalnızca o lead için.
6. **Timeout.** Aksiyon tool'ları loop'un toplam süresini uzatır → Head Agent timeout'u (şu an 60s/call) ve worker timeout'u yeniden boyutlanmalı (re-crawl tek başına ~10-30s).

### 2.3 Mimari değişiklik (minimum)
- `tools.ts`: yeni iki `AgentToolDef` + bir `ActionToolContext` (quota/bütçe sayacı taşır).
- `executeAgentTool`: aksiyon tool'ları için bütçe sayacını decrement eden bir sarmalayıcı.
- `WEBSITE_AUDITOR`'ı doğrudan fonksiyon olarak çağıracak bir "inline run" yolu (yeni BullMQ job AÇMADAN — worker rule'una uygun; mevcut crawl fonksiyonunu re-use et).
- `web_search`: mevcut Apify `serp-rank` / `bing-brand-search` çağrısını **senkron** saracak ince bir helper.
- `quota.ts`: `HEAD_AGENT_ACTION` benzeri bir sayaç anahtarı (ya da mevcut WEBSITE_AUDITOR / SERP kotalarına yaz).

---

## 3. EKLENİRSE — yeni workflow

### 3.1 Örnek: bayat audit + doğrulama
```
Lead: "Bella Napoli" — audit 3 hafta önce, site o zaman "PDF menu" idi.

Head Agent loop:
 1. get_website_audit        → reachable:true ama audit 21 gün önce (stale)
 2. live_recrawl             → site ŞİMDİ yeniden crawl edilir
                               → artık QR menü TESPİT EDİLDİ (yeni eklemişler)
 3. get_packages             → gerçek katalog
 4. web_search "Bella Napoli yeni şube"  → "2. şubeyi açtı" haberi (T2 evidence)
 → KARAR: "QR zaten var → Order & Pay + Multi-location" (eski plan QR pitch'ti, artık YANLIŞ olurdu)
```
**Kazanç:** Head Agent bayat veriyle yanlış pitch yapmaz; canlı durumu görür.

### 3.2 Değişen davranış
- Brief artık **karar anında taze** olabilir (chain'in eski snapshot'ına bağımlı değil).
- `[head-agent-telemetry]`'ye `actionToolCalls`, `recrawled`, `costUsdCents` eklenir.
- QA gate'e yeni kural: "live_recrawl sonucu exclusion'ları değiştirdiyse, deterministik shortlist'i taze sinyalle yeniden hesapla" (aksi halde Claude tazeyi görür ama shortlist eskidir → tutarsızlık).
- Maliyet: lead başına potansiyel +1 Apify SERP (~birkaç cent) + crawl CPU. **Sadece Claude gerek görürse** harcanır.

### 3.3 Yeni guard'lar (ekleme ile gelen zorunlu işler)
1. Loop sonrası **shortlist re-compute**: re-crawl yeni feature döndürdüyse `computeFnbModuleFit` taze sinyalle tekrar çalışmalı; QA hallucination kontrolü taze shortlist'e göre yapılmalı.
2. Plan-bazlı kapı: FREE workspace'te aksiyon tool'ları kapalı (sadece PRO+).
3. Kötüye kullanım koruması: aynı lead için günlük aksiyon tool tavanı.

---

## 4. EKLENMEZSE — mevcut sistem nasıl idare eder (fallback kâğıdı)

Aksiyon tool'ları **eklenmezse** sistem hâlâ tamamen çalışır; sadece "canlı tazeleme" yeteneği olmaz. Boşluklar nasıl kapanıyor:

| İhtiyaç | Aksiyon tool olmadan mevcut çözüm |
|---|---|
| Taze website verisi | Lead'i yeniden işleme sok (manuel "re-run" / yeni chain) → `WEBSITE_AUDITOR` zaten çalışır, sonra Head Agent taze audit'i `get_website_audit` ile okur |
| Dış doğrulama (haber, şube) | Deterministik `serp-rank` / `bing-brand-search` worker'ları **zaten** chain'de çalışıp substrate'e yazıyor; Head Agent bunları dolaylı görür |
| Bayatlık | Chain periyodik/elle yeniden tetiklenince tüm substrate tazelenir; Head Agent bir sonraki brief run'ında taze veriyle karar verir |

**Sonuç:** Aksiyon tool'ları bir **kolaylık + tazelik** katmanı; **olmazsa-olmaz değil.** Maliyeti (Apify USD, crawl CPU, latency, quota karmaşası) düşünülünce, "önce read-only loop'u sahada ölç, gerçekten bayatlık problemi görülürse ekle" savunulabilir bir duruş. Mevcut deterministik pipeline veri toplama işini zaten yapıyor; Head Agent'ın görevi **karar**, veri toplama değil.

---

## 5. Karar matrisi

| Kriter | Eklemek lehine | Eklememek lehine |
|---|---|---|
| Karar kalitesi | Taze veri → daha doğru pitch | Pipeline verisi çoğu lead için yeterince taze |
| Maliyet | — | Apify USD + crawl CPU + latency artışı |
| Karmaşıklık | — | Quota/bütçe/idempotency/re-compute wiring riski |
| Mimari uyum | Worker rule: yeni queue yok, inline re-use | Read-only loop zaten worker rule'una temiz uyuyor |
| Risk | Loop latency, kötüye kullanım | Düşük (mevcut sistem stabil) |

**Öneri:** Önce mevcut read-only loop'u canary'de **2-4 hafta ölç** (`[head-agent-telemetry]`'de "bayat audit yüzünden yanlış karar" vakası çıkıyor mu?). Veriyle kanıtlanırsa **`live_recrawl`'ı tek başına** ekle (en yüksek değer/risk oranı), `web_search`'ü daha sonra.

---

## 6. Eklenirse — uygulama adımları (tahmini efor)

1. `quota.ts`: aksiyon tool sayaç anahtarı + plan gate. *(0.5g)*
2. `WEBSITE_AUDITOR` crawl çekirdeğini inline çağrılabilir fonksiyona ayır (yeni queue yok). *(1g)*
3. `web_search` helper: Apify SERP/Bing'i senkron sar + `costUsdCents` raporla. *(0.5g)*
4. `tools.ts`: `live_recrawl` + `web_search` `AgentToolDef`'leri + `ActionToolContext` (bütçe sayacı). *(0.5g)*
5. `claude.ts` / `head-agent.ts`: loop'a aksiyon-tool bütçesi + post-loop **shortlist re-compute**. *(1g)*
6. QA gate: taze sinyal → shortlist tutarlılık kuralı. *(0.5g)*
7. Telemetry + maliyet alanları + canary flag (`CLAUDE_HEAD_AGENT_ACTIONS`). *(0.5g)*
8. Test: golden case (bayat audit → re-crawl → değişen karar). *(0.5g)*

**Toplam: ~5 gün.** Sadece `live_recrawl` ile gidilirse ~3 gün.
