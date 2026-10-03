# Runbook — HubSpot write-back (FineDine beta)

Amaç: bir lead'in analizi (`LEAD_INTELLIGENCE_BRIEF`) başarıyla bittiğinde Revint'in 14 `revint_*` alanını HubSpot'taki **Company** (restoran) ve varsa **Contact** kaydına yazması, App Card'ın company/contact/deal kayıtlarında görünmesi.

Portal 148499892'deki üretim testinde hiçbir şey yazılmamıştı. Kök nedenler ve düzeltmeler bu dalda (`prod/f-hubspot`) — özet en altta.

---

## 1. Akış (kod tarafı)

```
agent-runs kuyruğu (BullMQ)
  └─ src/workers/agent-run-worker.ts  processJob → executeAgentRun(runId)
       └─ başarılı dönüşten sonra: writebackAfterBriefRun(prisma, runId)
            src/lib/integrations/hubspot/brief-hook.ts
              - run LEAD_INTELLIGENCE_BRIEF + SUCCEEDED/SUCCEEDED_NO_MEMORY mi?
              - workspace'in HubSpot bağlantısı ACTIVE mi? (workspaceId run satırından)
              └─ enqueueCrmWriteback({ reason: "analysis", briefRunId })
                   src/lib/integrations/hubspot/writeback.ts
                   - brief çıktısı TAM bu run'dan okunur
                   - Company (crmCompanyId, yoksa contact'ın primary company'si) + Contact PATCH
                   - crm_sync_logs satırı run id ile anahtarlanır → retry'da çift yazma yok
                   - hata: crm_sync_logs.status = FAILED + lastError; brief run'ı ASLA düşürmez
```

- Yeni kuyruk yok; mevcut `agent-runs` + `crm_sync_logs` outbox kullanılıyor.
- Başarısız yazımlar: Ayarlar → Entegrasyonlar'da "Retry failed write-backs" butonu, ya da cron (`GET /api/integrations/hubspot/reconcile`, `Authorization: Bearer $CRON_SECRET`).
- Not: Redis yokken API'nin "inline fallback" ile çalıştırdığı brief'ler (dev ortamı) worker hook'undan geçmez; bunlar için backfill script'i kullanılır.

### 14 alan ve kaynakları

| Alan | Kaynak |
|---|---|
| `revint_sales_confidence` | `Lead.salesConfidence` (= head agent confidence = SalesOpportunity.opportunityScore) |
| `revint_lead_temperature` | `Lead.leadTemperature` (HOT/WARM/COLD) |
| `revint_today_priority` | Workspace içinde salesConfidence sırası (yazım anındaki anlık görüntü, 1 = en yüksek) |
| `revint_recommended_angle` | `headAgent.primaryAngle` ("<wedge> → <plan>") → wedge etiketi + paket → `SalesOpportunity.recommendedPackageReason` / `bestSalesAngle` → playbook açısı |
| `revint_next_best_action` | head agent brief'inde yalnızca `headAgent.talkTrack`, düz kartta boş (eski brief şeklinde: `LeadNextAction.openingHook` → `headAgent.talkTrack`) |
| `revint_qualification_status` | `LeadQualification.status`, yoksa `not_started` |
| `revint_no_show_risk` | `LeadQualification.noShowRisk` (yalnızca varsa) |
| `revint_detected_sub_niche` | `Lead.subNicheSlug` (yalnızca varsa) |
| `revint_evidence_summary` | Head agent güveni + paket + wedge + evidenceRefs; yoksa deterministik sinyaller |
| `revint_source_conflicts` | Head agent sourceConflicts; head agent çalıştıysa ve çelişki yoksa "No cross-source conflicts detected" |
| `revint_do_not_pitch` | Oda 1 yasakları (`roomOne.bans`) + hariç tutulan modüller (`excludedModules`) |
| `revint_open_questions` | Bilinmeyen kural girdileri (`openQuestions`) + eksik kaynaklar (`missingSources`) |
| `revint_analyzed_at` | `headAgent.generatedAt` |
| `revint_action_sheet_url` | `${NEXT_PUBLIC_APP_URL}/app/leads/<leadId>` |

`no_show_risk` ve `detected_sub_niche` veri yoksa boş kalır — bu beklenen durumdur.

---

## 2. Gerekli HubSpot uygulaması ve izinler

Uygulama: **revint-app** (`hubspot-app/hsproject.json` → `"name": "revint-app"`, `hubspot-app/src/app/app-hsmeta.json` → `"uid": "revint-app"`). Bağlantı **mutlaka** bu uygulamanın Client ID/Secret'ı ile yapılmalı. Eski/legacy uygulama ile verilmiş token'da şema yazma izni yok → property oluşturma 403 → hiçbir şey yazılmaz (148499892'de yaşanan buydu).

Zorunlu scope'lar (kod: `src/lib/integrations/hubspot/oauth.ts` `HUBSPOT_SCOPES`, manifest: `app-hsmeta.json` `requiredScopes`):

```
oauth
crm.objects.contacts.read   crm.objects.contacts.write
crm.objects.companies.read  crm.objects.companies.write
crm.objects.deals.read      crm.objects.deals.write
crm.objects.owners.read
crm.schemas.contacts.read   crm.schemas.contacts.write
crm.schemas.companies.read  crm.schemas.companies.write
crm.schemas.deals.read
```

Write-back için kritik olanlar (bağlantı anında kontrol edilir, `REQUIRED_WRITEBACK_SCOPES`):
`crm.objects.contacts.write`, `crm.objects.companies.write`, `crm.schemas.contacts.write`, `crm.schemas.companies.write`.

Bunlardan biri eksikse:
- OAuth callback property oluşturmayı denemez, `crm_connections.last_error = "missing_scope:<eksikler>"` yazar, `propertiesProvisionedAt` damgalanmaz;
- Ayarlar → Entegrasyonlar panelinde hangi izinlerin eksik olduğunu söyleyen uyarı görünür, yönlendirmede `hubspot_warning=missing_scope` toast'ı çıkar;
- Çözüm: HubSpot developer hesabında uygulamanın scope listesini kontrol et, `hs project upload` ile yayınla, sonra müşteri portalında **Reconnect** yapıp tüm izinleri onayla.

---

## 3. Ortam değişkenleri (Vercel + worker/Railway)

| Değişken | Nerede | Açıklama |
|---|---|---|
| `HUBSPOT_CLIENT_ID` | Vercel + worker | **revint-app**'in Client ID'si (Developer UI → Apps → revint-app → Auth) |
| `HUBSPOT_CLIENT_SECRET` | Vercel + worker | revint-app Client Secret (token refresh ve webhook/card imza doğrulaması için worker'da da gerekli) |
| `HUBSPOT_REDIRECT_URL` | Vercel | `https://app.revint.dev/api/integrations/hubspot/callback` (manifestteki `redirectUrls` ile birebir aynı olmalı) |
| `HUBSPOT_OAUTH_STATE_SECRET` | Vercel | (opsiyonel) OAuth state HMAC anahtarı; yoksa client secret kullanılır |
| `CRM_TOKEN_ENCRYPTION_KEY` | Vercel + worker | 32 byte (hex/base64). **İki tarafta aynı olmalı**; worker token'ı çözemezse write-back FAILED olur |
| `NEXT_PUBLIC_APP_URL` | Vercel + worker | `https://app.revint.dev` — `revint_action_sheet_url` bununla kurulur |
| `CRON_SECRET` | Vercel | Reconcile cron'u için |
| `HUBSPOT_WEBHOOK_URL`, `HUBSPOT_CARD_URL` | Vercel | (opsiyonel) proxy arkasında imza doğrulaması için dış URL override |
| `HUBSPOT_DEVELOPER_API_KEY` | Vercel | Yalnızca legacy kart → App Card migrate endpoint'i için |

Reconcile cron'u (önerilen): `vercel.json` → `"crons": [{ "path": "/api/integrations/hubspot/reconcile", "schedule": "0 * * * *" }]`. Hobby planda Vercel yalnızca günlük cron'a izin verir (`"0 6 * * *"`); plan doğrulanmadan saatlik cron eklemeyin, deploy'u bozar. Bu dalda `vercel.json` değiştirilmedi.

---

## 4. Deploy sırası

1. **Backend (Vercel)**: bu dalı merge et, deploy et. Env'leri yukarıdaki tabloya göre doğrula (`vercel env ls`).
2. **Worker (Railway / `npm run workers`)**: aynı commit'i deploy et. Hook worker'da çalışır — worker eski kalırsa write-back tetiklenmez (aa091fd'deki sorunun aynısı).
3. **HubSpot App (App Card + scope'lar)**:
   ```bash
   npm install -g @hubspot/cli@latest
   hs account auth            # Revint developer hesabı (müşteri portalı değil)
   cd hubspot-app
   hs project upload
   ```
   Developer UI → Projects → revint-app → son build'i **Deploy** et. Kart artık `contacts`, `companies`, `deals` kayıtlarında (`revint-card-hsmeta.json` → `objectTypes`).
4. Legacy CRM kartı hâlâ kuruluysa: App Card yeni build'de doğrulandıktan sonra `POST /api/integrations/hubspot/migrate-card` (`{ appId, legacyCrmCardId, appCardIds }`, `HUBSPOT_DEVELOPER_API_KEY` gerekli). Marketplace'te listeliyse önce `hs-release-app-cards` feature flag'ini sil. Legacy kartlar 31 Ekim 2026'da tamamen kapanıyor.
5. **Portalda yeniden bağlan**: FineDine admini Revint → Ayarlar → Entegrasyonlar → **Reconnect** → tüm izinleri onayla. Panelde "Custom properties: Provisioned" ve uyarı olmaması gerekir. Gerekirse onboarding'deki "provision" adımı ya da `POST /api/integrations/hubspot/provision` tekrar çalıştırılabilir (contacts + companies için 28 tanım). Yeni üç alan (`revint_do_not_pitch`, `revint_open_questions`, `revint_analyzed_at`) için `POST /api/integrations/hubspot/provision` çalıştır.

---

## 5. Portal 148499892 üzerinde doğrulama

```bash
# 1) Bağlantı, scope ve 14 tanım (contacts + companies)
npx tsx scripts/hubspot-verify.ts --portal 148499892

# 2) Belirli bir restoran (Company) için dolu alanlar
npx tsx scripts/hubspot-verify.ts --portal 148499892 --company <hubspotCompanyId>

# 3) Revint lead'i üzerinden (crmCompanyId/crmContactId + son crm_sync_logs satırları)
npx tsx scripts/hubspot-verify.ts --portal 148499892 --lead <leadId>
```

Beklenen: `scopes: OK`, her iki nesnede `14/14 defined`, company'de en az 8-9 alan dolu (`no_show_risk`, `detected_sub_niche` boş olabilir). Eksik tanım veya hiç dolu alan yoksa script `exit 1` döner.

Uçtan uca test:
1. Portalda company'si olan bir lead için Revint'te analizi tekrar çalıştır.
2. Worker loglarında `hubspot.writeback.after_brief` (status SUCCESS, targets `company:<id>`) görünmeli.
3. HubSpot'ta Company kaydı → "Revint" property grubu dolu; App Card sekmesi render oluyor.
4. `scripts/hubspot-verify.ts --lead <leadId>` → son sync satırı `SUCCESS`.

Mevcut lead'leri doldurmak (backfill):

```bash
npx tsx scripts/hubspot-backfill.ts <workspaceId>            # DRY RUN: yazılacak değerleri listeler
npx tsx scripts/hubspot-backfill.ts <workspaceId> --apply    # yazar (run id'ye göre idempotent)
```

Sık görülen hatalar (`crm_sync_logs.last_error` / panel):
- `403 ... MISSING_SCOPES` → yanlış uygulama ya da eksik izin; §2.
- `400 ... Property "revint_..." does not exist` → tanımlar oluşturulmamış; Reconnect veya provision.
- `CRM token is encrypted but CRM_TOKEN_ENCRYPTION_KEY is not set` → worker env eksik.
- `no_crm_linkage` (SKIPPED) → lead'in HubSpot company/contact/deal id'si yok; önce HubSpot'tan import.

---

## 6. Geri alma (rollback)

- **Write-back'i durdurmak (hızlı)**: Revint → Entegrasyonlar → **Disconnect** (bağlantı `REVOKED`; hook no-op olur, veri silinmez). Tekrar açmak için Reconnect.
- **Kod**: bu daldaki commit'leri revert edip Vercel + worker'ı yeniden deploy et. Hook tek satırlık bir çağrı (`agent-run-worker.ts`, `writebackAfterBriefRun`); yalnızca onu kaldırmak da yeterli.
- **App Card**: Developer UI → Projects → revint-app → Builds → önceki build'i **Deploy** et (ya da `companies`'i `objectTypes`'tan çıkarıp tekrar `hs project upload`).
- **HubSpot'taki veriler**: `revint_*` alanları müşterinin verisini ezmez (yalnızca Revint'in kendi alanları). Temizlemek gerekirse HubSpot → Settings → Properties → grup "Revint" → alanları arşivle (ya da boş değerle toplu güncelle). Property tanımlarını silmek geçmiş veriyi de siler; önce arşivle.

---

## 7. Bu dalda düzeltilenler (özet)

1. Analiz sonrası write-back tetikleyicisi brief'in **içinde**, run bitmeden çalışıyordu: çıktı henüz kaydedilmediği için bir önceki run'ın head-agent kararını okuyordu; ayrıca company-only lead'lerde `no_crm_linkage` ile atlanıyordu. Artık worker, run başarıyla bittikten sonra hook'u çağırıyor; brief içindeki eski çağrı çalışan run varken kendini erteliyor.
2. Hedefler: Company (+ contact'ın primary company'si) + Contact. Deal'e sadece stage yazılır.
3. `ensureRevintProperties`: contacts + companies; 409 = mevcut; 401/403 → `missingScope`; hata mesajları kaydedilir; yanlış "başarılı" damgası yok.
4. Bağlantı anında scope doğrulama + panelde net uyarı + write-back sağlık durumu (son başarılı yazım, son hata, tekrar dene).
5. Reconcile: başarılı retry sonrası eski FAILED satırı kapatılıyor (önceden sonsuz retry); Vercel Cron için `GET` eklendi.
6. App Card `companies` kayıtlarında da görünüyor.
