# FineDine Beta — canlıya çıkış runbook'u

Bu belge FineDine beta çalışma alanını üretimde açmak için adım adım yapılacakları anlatır.
Sırayla ilerle; her adımın sonunda "Kontrol" satırını doğrula.

Mimari özet:

| Parça | Nerede | Başlatma |
|---|---|---|
| Web (Next.js 16) | Vercel | `npx prisma generate && next build` (vercel.json) |
| Worker'lar (BullMQ) | Railway | `npm run workers` (railway.json) |
| Veritabanı + auth | Supabase Postgres (+ pgvector) | — |
| Kuyruk | Redis (Railway/Upstash) | — |

---

## 0. Ön koşullar

- Deploy edilecek commit'te `npx tsc --noEmit -p .`, `npx vitest run`, `npm run lint` ve `npx next build` temiz geçmiş olmalı.
- Supabase projesine `DIRECT_URL` ile bağlanabiliyor olmalısın (port 5432, pooler değil).
- Üç inceleyici (Teknik, Alan, Satış) uygulamaya **en az bir kez kayıt olmuş** olmalı (`/signup`). Script'ler `auth.users` içinde e-postayı arar.
- **Sızmış anahtarları yenile:** 14 Temmuz ekran kaydında Resend API anahtarı ve Supabase DB şifresi göründü (Notion). Resend'de yeni anahtar üret, eskisini iptal et; Supabase → Database → Reset password; yeni değerleri Vercel ve Railway'e yaz (`RESEND_API_KEY`, `DATABASE_URL`, `DIRECT_URL`).
- Veritabanının yedeği: Supabase → Database → Backups'tan son otomatik yedeğin tarihini not al; migration'dan hemen önce manuel bir yedek al (`pg_dump "$DIRECT_URL" -Fc -f revint-pre-beta.dump`).

## 1. Ortam değişkenleri

Tam liste ve açıklamalar: `.env.example` (her değişkenin yanında `[web]`, `[worker]`, `[both]` etiketi var).
Başlangıç kontrolü `src/lib/env-check.ts` içindedir: web eksik değişkende **uyarı** basar, worker üretimde **başlamayı reddeder**.

### Vercel (web) — zorunlu
`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `GEMINI_API_KEY` (veya `GEMINI_API_KEY_1..N`),
`ADMIN_DASHBOARD_EMAILS`, `HEALTH_ADMIN_EMAILS`, `CRON_SECRET`, `APIFY_WEBHOOK_SECRET`, `CRM_TOKEN_ENCRYPTION_KEY`.

Faturalama açıksa: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`.
E-posta: `RESEND_API_KEY`, `EMAIL_FROM`. HubSpot kullanılıyorsa `HUBSPOT_*`.

> **Dikkat — site kapısı:** `src/proxy.ts` pazarlama sayfalarını Basic Auth ile kilitler ve
> `SITE_GATE_DISABLED` tam olarak `true` olmadıkça açıktır (varsayılan şifre `revint-preview`).
> Beta'da pazarlama sitesi herkese açık olacaksa `SITE_GATE_DISABLED=true` yap; kapalı kalacaksa
> `SITE_GATE_PASSWORD`'u güçlü bir değere çek. `/app`, `/api`, `/auth`, `/login`, `/signup` hiçbir zaman kilitlenmez.

### Railway (worker) — zorunlu
`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` (localhost **olamaz**), `GEMINI_API_KEY` (veya havuz),
`GOOGLE_PLACES_API_KEY`, `APIFY_TOKEN`, `APIFY_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NODE_ENV=production`.
FineDine HubSpot kullandığı için zorunlu: `CRM_TOKEN_ENCRYPTION_KEY` (Vercel'dekiyle **aynı** değer), `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` (revint-app). HubSpot writeback worker'da çalışır.
Opsiyonel: `ZEROBOUNCE_API_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`.

### Head agent bayrakları (her iki tarafta da aynı olmalı)
Head agent worker tarafında çalışır; bayrakları yine de iki tarafta aynı tut ki web'den tetiklenen yollar (ör. eval replay) aynı modu görsün.
İlk deploy'da **kapalı** bırak (bkz. Adım 6):

```
CLAUDE_HEAD_AGENT=off
CLAUDE_HEAD_AGENT_WORKSPACES=
CLAUDE_HEAD_AGENT_SHADOW=off
CLAUDE_HEAD_AGENT_SHADOW_WORKSPACES=
```

**Kontrol:** Vercel → Settings → Environment Variables (Production) ve Railway → Variables ekranlarında listeyi `.env.example` ile karşılaştır.

## 2. Veritabanı migration'ları

Şema kaynağı `prisma/schema.prisma`. Prisma'nın üretemediği parçalar (`pgvector`, RLS, enum'lar, kontrol odası tabloları) `prisma/migrations/*.sql` dosyalarıyla uygulanır.
Her dosya şu komutla uygulanır (`DIRECT_URL` kullanır):

```bash
npx tsx prisma/migrations/apply.ts <dosya.sql>
```

### Sıra

Mevcut üretim veritabanında 1–6 büyük ihtimalle zaten uygulanmıştır; bunlar idempotenttir, tekrar çalıştırmak güvenlidir.
**7 ve sonrası bu beta için yeni.**

| # | Dosya | Not |
|---|---|---|
| 1 | `bootstrap_multitenant.sql` | İdempotent. |
| 2 | `add_pgvector_extension.sql` | `prisma db push`'tan **önce**. |
| 3 | `npx prisma db push --skip-generate` | Sadece taze veritabanında. Üretimde `db push` çalıştırma; aşağıdaki SQL'leri kullan. |
| 4 | `add_ai_core.sql` | İdempotent. HNSW index. |
| 5 | `add_pipeline_stage.sql` | İdempotent. |
| 6 | `add_agent_run_idempotency_key.sql` | İdempotent. |
| 7 | `add_control_plane.sql` | **İdempotent değil** (tek transaction; zaten varsa tamamen geri alınır, zarar vermez ama hata verir). Önce kontrol et. |
| 8 | `add_control_review_lenses.sql` | İdempotent. 7'ye bağlı. |
| 9 | `add_review_source_rubric.sql` | **Zorunlu.** `HumanReview.source`, `rubricVersion`, `reviewSeconds` ve `ReviewSource` enum'u. İnceleme kaydı, SDR geri bildirimi ve Uyum ekranı bunlar olmadan 500 döner. Tekrar çalıştırılabilir. |

7 için ön kontrol:

```sql
select to_regclass('public.platform_role_assignments') as control_plane,
       exists (select 1 from pg_type where typname = 'ReviewLens') as lenses;
```

`control_plane` boş (null) ise 7'yi uygula; doluysa atla ve 8'e geç.

**Kontrol:** migration'lardan sonra

```sql
select column_name from information_schema.columns
 where table_name = 'platform_role_assignments';   -- id, user_id, role, created_at, lens
select count(*) from human_reviews;                  -- hata vermemeli
```

## 3. Deploy

Sıra önemli: önce veritabanı (Adım 2), sonra worker, en son web. Böylece yeni kod eski şemaya hiç denk gelmez.

1. **Railway (worker):** servisi ilgili commit'e yeniden deploy et. Loglarda şunları gör:
   - `[boot] worker supervisor v2 | REDIS_URL=set | ... | DATABASE_URL=set | NODE_ENV=production`
   - `[env:worker] required env not set` **olmamalı** (olursa servis zaten başlamaz).
   - `worker.supervisor.started`
   - Dakikada bir `worker.heartbeat` satırı (pid, uptime, bellek).
2. **Vercel (web):** Production'a deploy et (Git push ya da `vercel --prod`).
3. Sağlık kontrolü:
   ```bash
   curl -i https://app.revint.dev/api/health
   ```
   Anonim çağrı `{"ok":true}` + 200 döner. DB veya Redis erişilemezse 503.
   `HEALTH_ADMIN_EMAILS` içindeki bir hesapla tarayıcıdan açınca ayrıntılı çıktı gelir:
   `db`, `redis`, `workerHeartbeatAgeSec`. **`workerHeartbeatAgeSec` 180'den küçük olmalı**; `null` ise worker Redis'e yazamıyor ya da çalışmıyor.

> Not: `vercel.json` içinde `crons: []`; hiçbir zamanlanmış iş yok. HubSpot reconcile (`CRON_SECRET` ile korunur) kullanılacaksa
> Vercel Cron ya da harici bir zamanlayıcı ekle. Takılı kalan AI koşuları için `/api/agent-runs/cleanup-stale`
> oturum açmış kullanıcının çalışma alanında elle çağrılır (cron değil); worker içindeki stuck-session watchdog da otomatik çalışır.

## 4. FineDine Beta çalışma alanını oluştur

```bash
npx tsx scripts/seed-finedine-beta.ts \
  --owner <sahip@finedine.com> \
  --tester <inceleyici1@...> --tester <inceleyici2@...> --tester <inceleyici3@...> \
  --name "FineDine Beta" --slug finedine-beta \
  --country TR --language tr
```

- Kullanıcılar zaten kayıtlıysa `--create-users` verme. Vermezsen tüm e-postalar `auth.users` içinde olmalı.
- Script AGENCY planı, RESTAURANT_TECH nişi, BALANCED pipeline ve F&B teklif varsayılanlarını kurar; tekrar çalıştırmak güvenlidir.
- Çıktıdaki **workspace id**'yi not al (Adım 5'te lazım). Yoksa:
  ```sql
  select id, name from workspaces where slug = 'finedine-beta';
  ```

## 5. İnceleyicilere kontrol odası rolü ve mercek ata

Üç inceleyici, üç mercek. Her komut idempotenttir; tekrar çalıştırılabilir ve sonucu JSON olarak basar (`before`, `after`, `changed`).

```bash
npx tsx scripts/control-assign-reviewer.ts --email <teknik@...> --role REVIEWER --lens TECHNICAL --workspace finedine-beta
npx tsx scripts/control-assign-reviewer.ts --email <alan@...>   --role REVIEWER --lens DOMAIN    --workspace finedine-beta
npx tsx scripts/control-assign-reviewer.ts --email <satis@...>  --role REVIEWER --lens SALES     --workspace finedine-beta
```

- `--role`: `VIEWER | REVIEWER | ADMIN`. İnceleyiciler için `REVIEWER`.
- `--lens`: `TECHNICAL | DOMAIN | SALES | none` (`none` merceği kaldırır; verilmezse mevcut mercek korunur).
- `--workspace`: kullanıcıyı çalışma alanına `MEMBER` olarak ekler (zaten üyeyse dokunmaz).
- Kurucular `ADMIN_DASHBOARD_EMAILS` üzerinden zaten ADMIN'dir; onlara rol atamaya gerek yok.

**Kontrol:** `/admin/control/mercekler` ekranında üç kişi ve mercekleri görünür.

## 6. Head agent'ı FineDine için canlıya al

Önce gölge modda en az bir lead koştur, sonra canlıya al.

1. Gölge (opsiyonel, önerilir): her iki tarafta `CLAUDE_HEAD_AGENT_SHADOW_WORKSPACES=<finedine-workspace-id>` → worker + web redeploy → bir lead koştur → Vaka izi'nde head agent kararını gör. Gölgede kart düz yazılır (paket, kaçak, kanıt; konuşma boş), Claude'un taslağı yalnızca `roomTwo.draftTalkTrack` içinde durur.
2. Canlı: her iki tarafta
   ```
   CLAUDE_HEAD_AGENT_WORKSPACES=<finedine-workspace-id>
   ```
   `CLAUDE_HEAD_AGENT` global olarak `off` kalır; izin listesi global değeri ezer, diğer müşteriler etkilenmez.
   Gölge listesinden aynı id'yi çıkar. Worker'ı ve web'i yeniden deploy et (env değişikliği ancak yeni süreçte okunur).
3. `ANTHROPIC_API_KEY` worker'da tanımlı olmalı; değilse Oda 2 (Claude) çalışmaz ve kart düz yazılır: paket, kaçak ve kanıt dolu, konuşma boş.

## 7. Smoke test (tek lead, uçtan uca)

FineDine Beta çalışma alanında, bir inceleyici hesabıyla:

- [ ] `/app` açılıyor, aktif çalışma alanı "FineDine Beta".
- [ ] Bilinen, web sitesi ve Google yorumları olan bir restoranı ekle (keşif ya da manuel ekleme).
- [ ] **Harita:** lead'de adres, puan, yorum sayısı, Google Places bilgisi dolu.
- [ ] **Site:** web sitesi denetimi tamamlandı (WebsiteAudit), sayfada site bulguları görünüyor.
- [ ] **Yorumlar:** yorum analizi tamamlandı (Apify koşusu + ReviewAnalysis), ağrı/güç ifadeleri görünüyor.
- [ ] **Brief:** `briefMode = head-agent`; kartta paket (Starter/Growth/Premium), kaçak ve kanıt satırları var. Rezervasyon sağlayıcısı olan restoranda `reservation` hariç listede.
- [ ] **SDR geri bildirimi:** lead sayfasında "Bu brief'i kullandım / Kullanmadım" görünüyor; "Kullanmadım" + sebep kaydedilince İnceleme kuyruğunda o brief başa geçiyor ve SDR rozeti taşıyor.
- [ ] **HubSpot:** `npx tsx scripts/hubspot-verify.ts --portal <portal>` 11 `revint_*` alanını dolu gösteriyor (bkz. `hubspot-writeback.md`).
- [ ] Railway loglarında ilgili `worker.ai_runs.job_completed` satırları var, `job_failed` yok.
- [ ] `/admin/control` → Genel Bakış'ta FineDine çalışma alanı seçilebiliyor.
- [ ] `/admin/control/reviews` (**İnceleme**) kuyruğunda bu lead'in brief'i işletme adıyla görünüyor.
- [ ] Teknik merceğindeki inceleyici bir hüküm kaydedebiliyor; kayıt `/admin/control/audit`'te görünüyor.
- [ ] `/admin/control/trace/<leadId>` (Vaka izi) Harita · Site · Yorum · Karar adımlarının süre ve maliyetini gösteriyor.
- [ ] Başka bir çalışma alanının kullanıcısı bu lead'i `/app/leads/<id>` ile açmaya çalışınca 404 alıyor (tenant izolasyonu).
- [ ] `/api/health` ayrıntılı çıktıda `workerHeartbeatAgeSec` < 180.

## 8. Geri alma (rollback)

Sorunun türüne göre en hafif adımdan başla:

1. **Head agent sorunlu:** her iki tarafta `CLAUDE_HEAD_AGENT_WORKSPACES` değerini boşalt (ya da id'yi `..._SHADOW_WORKSPACES`'a taşı), worker + web redeploy. Veri değişikliği gerekmez. **Dikkat:** restoran çalışma alanlarında eski (legacy) brief'e dönüş yoktur; id'yi listeden silmek o çalışma alanında brief üretimini tamamen durdurur (`skipped: head_agent_off`). Kartı tutup sadece Claude'u susturmak için id'yi gölge listesine taşı.
2. **Web sorunlu:** Vercel → Deployments → önceki sağlıklı deploy → "Promote to Production" (ya da `vercel rollback`).
3. **Worker sorunlu:** Railway → Deployments → önceki deploy → "Redeploy". Kuyruktaki işler Redis'te bekler, kaybolmaz.
   Acil durumda tüm pipeline'ı durdurmak için: `POST /api/admin/pipeline/cancel-all-global` (header `x-leadac-global-pipeline-secret: $LEADAC_GLOBAL_PIPELINE_SECRET`).
4. **Migration sorunlu:** kontrol odası migration'ları eklemelidir (yeni tablo/kolon/enum); eski kod bunları görmezden gelir, bu yüzden kodu geri almak genelde yeter. Şemayı gerçekten geri almak gerekirse Adım 0'daki yedekten `pg_restore` ile dön; elle `DROP` yapma.
5. **İnceleyici erişimini geri al:**
   ```sql
   delete from platform_role_assignments
    where user_id = (select id from users where email = '<email>');
   ```

## Ekler

- Ortam değişkeni listesi: `.env.example`
- Başlangıç env kontrolü: `src/lib/env-check.ts`
- Worker heartbeat: `src/workers/heartbeat.ts` (Redis anahtarı `revint:worker:heartbeat`, TTL 3 dk)
- Sağlık uç noktası: `src/app/api/health/route.ts`
- Kontrol odası rol/mercek script'i: `scripts/control-assign-reviewer.ts`
