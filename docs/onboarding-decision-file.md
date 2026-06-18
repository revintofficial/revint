# Revint onboarding karar dosyası

Tarih: 2026-06-18

Bu dosya, önerilen onboarding akışını Revint'in mevcut mimarisiyle eşleştiren bir ürün ve uygulama karar dokümanıdır. Amaç sadece "kullanıcı onboarding'i tamamladı" demek değil; asıl amaç şu:

> Workspace, Revint'in leadleri doğru skorlayıp doğru insight, öneri ve sonraki aksiyonları yazabilmesi için yeterince kalibre edilmiş olmalı.

Önerilen ana yön: **kalibrasyon odaklı onboarding + kullanıcı tarafından düzenlenebilir AI taslakları**.

## 1. Kısa karar özeti

Hesap oluşturma ve e-posta doğrulama mevcut Supabase auth akışında kalmalı. Ürün onboarding'i, kullanıcı doğrulandıktan sonra başlamalı.

Onboarding'in kalbi şu iki taslak olmalı:

1. **ICP taslağı**: Kullanıcının şirket domain'i crawl edilir, Revint hedef müşteri profilini tahmin eder, kullanıcı aynı akış içinde düzenleyip onaylar.
2. **Paket / teklif taslağı**: Pricing page crawl edilir, şirketin sattığı planlar/paketler çıkarılır, kullanıcı bunları düzenleyip onaylar.

Bu iki taslak doğrudan analiz kalitesini etkiler:

- `IdealCustomerProfile` üzerinden `ICP_SCORER`, leadlere 0-100 ICP fit skoru verir.
- `ServicePackage` üzerinden `SALES_OPPORTUNITY_SCORER` ve `package-selector.ts`, hangi paketin hangi leade önerileceğini belirler.
- Mevcut sistemde `ServicePackage` yoksa `lead_created` zinciri lead'i `BLOCKED_NEEDS_PACKAGES` yapıp analizi başlatmaz.

Bu yüzden pricing-page'den çıkarılan paketleri onboarding'de onaylatmak sadece UX detayı değil, pipeline'ın çalışması için kritik bir ön koşul.

## 2. İnternetten araştırma notları

Kullanılan kaynaklar:

- NN/g, progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Auth0, progressive profiling: https://auth0.com/blog/progressive-profiling/
- Descope, doğru bilgiyi doğru anda isteme: https://www.descope.com/learn/post/progressive-profiling
- Appcues, activation metric: https://www.appcues.com/blog/product-activation-metric
- Appcues, time to value: https://www.appcues.com/blog/time-to-value
- Nunes & Dreze, endowed progress effect: https://academic.oup.com/jcr/article-abstract/32/4/504/1787425
- Userpilot, onboarding psikolojisi örüntüleri: https://userpilot.com/blog/app-onboarding-psychology/

Bu kaynaklardan Revint için çıkan ilkeler:

- **Signup kısa kalmalı.** Kullanıcıdan hesap için şart olmayan stratejik bilgileri signup formunda istemek drop-off riskini artırır.
- **Progressive profiling kullanılmalı.** Company domain, pricing page, ICP gibi bilgiler kullanıcı ürüne girdikten sonra ve nedeni açıkken istenmeli.
- **Boş form yerine taslak onayı daha iyi çalışır.** Kullanıcıdan sıfırdan ICP yazmasını istemek yerine Revint'in tahmin ettiği taslağı düzenletmek daha az bilişsel yük yaratır.
- **Progress bar gerçek ilerlemeyi göstermeli.** E-posta doğrulandıktan sonra "hesap oluşturuldu" ve "workspace oluşturuldu" adımları tamamlanmış gösterilebilir.
- **Activation, onboarding completion değildir.** Revint için activation metriği ilk analiz edilmiş lead'in görünmesi olmalı.
- **Tutorial, gerçek objenin üstünde olmalı.** Genel bir ürün turu yerine Leads panelinde ilk gerçek lead, ICP fit, önerilen paket ve next action üzerinden eğitim verilmeli.

## 3. Mevcut sistemden çıkan gerçekler

### Auth ve workspace lifecycle

İlgili dosyalar:

- `src/components/site/auth/auth-form.tsx`
- `src/app/auth/callback/route.ts`
- `src/lib/auth.ts`
- `src/app/app/layout.tsx`

Mevcut durum:

- Signup formu ad, e-posta, parola veya magic link destekliyor.
- Supabase e-posta doğrulama ve OAuth callback `/auth/callback` üzerinden ilerliyor.
- `requireUser()` ilk girişte kullanıcı için otomatik workspace oluşturuyor.
- Owner rolündeki kullanıcıda `onboardingCompletedAt` yoksa `/app/onboarding` sayfasına yönlendiriliyor.
- Eski workspace'te lead varsa sistem onboarding'i otomatik tamamlanmış işaretliyor.

Karar:

- Aşama 1 ve 2 ayrı ürün wizard adımları gibi yeniden yazılmamalı.
- Bunlar auth ön koşulu olarak kalmalı.
- Ürün onboarding'i doğrulama sonrası başlamalı.

### Mevcut onboarding sayfası

İlgili dosya:

- `src/app/app/onboarding/page.tsx`

Mevcut akış:

1. Workspace name
2. Country
3. Your offer
4. Packages
5. Team invite
6. HubSpot connect
7. First leads discovery

Bu iskelet kullanılabilir ama merkez değişmeli. Eski akış "ülke + teklif + paket + keşif" merkezli. Yeni akış "şirketi kalibre et + HubSpot'tan gerçek leadleri getir" merkezli olmalı.

### Workspace ve şirket bilgileri

Mevcut `Workspace` alanları:

- `name`
- `country`
- `offerName`
- `valueProposition`
- `socialProof`
- `offerHook`
- `objective`
- `tone`
- `length`
- `language`
- `senderName`
- `conversionLink`
- `niche`
- `targetSubNiches`
- `onboardingCompletedAt`

Eksikler:

- Kullanıcının gerçek şirket adı.
- Kullanıcının şirket domain'i.
- Kullanıcının pricing page URL'i.
- AI tarafından çıkarılan ama kullanıcı onayından geçmemiş onboarding taslakları.

Karar:

- `Workspace.name` iç uygulama/workspace etiketi olarak kalmalı.
- Şirket adını Revint'in yazılarında kullanmak için ayrı alan gerekir: `Workspace.companyName`.
- Domain ve pricing URL de workspace seviyesinde tutulmalı: `companyDomain`, `pricingPageUrl`.

### ICP sistemi

İlgili dosyalar:

- `prisma/schema.prisma`
- `src/lib/agent-workers/icp-scorer.ts`
- `src/lib/sdr-brain/icp-scorer.ts`

Mevcut model:

- `IdealCustomerProfile`
- `Lead.icpFitScore`
- `Lead.icpReasons`
- `Lead.icpVersion`

Mevcut `IdealCustomerProfile` alanları:

- `industryWeights`
- `subNicheWeights`
- `priceLevelMin`
- `priceLevelMax`
- `minReviewCount`
- `minRating`
- `digitalMaturityFloor`
- `highValueSignals`
- `negativeSignals`
- `locationFit`
- `meddpiccRequiredFields`
- `version`

Eksik:

- Kullanıcının okuyup düzenleyebileceği düz metin ICP tanımı.
- AI tahmininin kaynak ve güven bilgisi.

Karar:

- Onboarding'de ana düzenleme yüzeyi plain-text ICP olmalı.
- Ancak kaydedilen veri sadece plain text olmamalı; `ICP_SCORER` çalışsın diye mevcut structured alanlar da doldurulmalı.
- `IdealCustomerProfile` modeline `description String? @db.Text` eklemek mantıklı.
- Kaynak/güven bilgisi için `sourceJson Json @default("{}")` veya ayrı draft tablosu kullanılabilir.

### Paketler ve campaign kavramı

İlgili dosyalar:

- `src/app/app/campaigns/page.tsx`
- `src/app/api/campaigns/route.ts`
- `src/components/app/packages-form.tsx`
- `src/app/api/workspace/packages/route.ts`
- `src/lib/agent-workers/package-selector.ts`
- `src/lib/lead-detail/recommended-package.ts`

Mevcut durum:

- Kalıcı `Campaign` modeli yok.
- `/app/campaigns` bugün computed segmentler gösteriyor: no website, weak website, no booking, high potential.
- Aynı sayfa `ServicePackage` kartlarını da gösteriyor.
- `ServicePackage` analizin kritik parçası.

Mevcut `ServicePackage` alanları:

- `name`
- `priceLabel`
- `features`
- `isPopular`
- `sortOrder`

Karar:

- Pricing page'den çıkarılacak "campaign/plan/paket" bilgisi v1'de `ServicePackage` olarak ele alınmalı.
- Yeni kalıcı `Campaign` modeli hemen eklenmemeli.
- İleride kampanya gerçekten cadence, segment, mesaj, hedef liste gibi ayrı davranışlar kazanırsa ayrı model düşünülmeli.

### HubSpot entegrasyonu

İlgili dosyalar:

- `src/app/api/integrations/hubspot/connect/route.ts`
- `src/app/api/integrations/hubspot/status/route.ts`
- `src/app/api/integrations/hubspot/sync/route.ts`
- `src/lib/integrations/hubspot/ingest.ts`
- `src/app/api/webhooks/hubspot/route.ts`

Mevcut durum:

- HubSpot OAuth workspace-scoped.
- Connect sonrası mevcut contact/company kayıtları otomatik import edilmiyor.
- Import için `/api/integrations/hubspot/sync` çağrılmalı.
- Sync route contacts ve companies sayfalar, dedupe yapar, `ingestHubspotLead` üzerinden lead oluşturur/günceller.
- Place match varsa `lead_created` event'i emit edilir.
- CRM-only leadlerde place match yoksa tam analiz başlamaz.
- HubSpot connect ve import PRO+ plan gerektirir.

Karar:

- Onboarding'de "Connect HubSpot" sonrası mutlaka "Import leads from HubSpot" adımı olmalı.
- Kullanıcıya connected/imported/analyzing farkı açık gösterilmeli.
- PRO altı planda HubSpot kartı locked görünmeli, skip ve upgrade path olmalı.

## 4. Önerilen v1 onboarding akışı

### Auth öncesi: hesap oluşturma

Mevcut signup korunur:

- Ad soyad
- E-posta
- Parola veya magic link
- Google OAuth opsiyonu

Bu aşamada şirket domain'i, pricing URL, ICP gibi stratejik alanlar istenmez.

### Auth sonrası: e-posta doğrulama

Mevcut Supabase doğrulama korunur:

- Confirmation link veya magic link.
- Callback sonrası `/app/onboarding`.

Wizard progress içinde "Account created" ve "Email verified" tamamlanmış gösterilebilir ama bunlar ayrı form adımı olmamalı.

### Adım 1: Workspace setup

Alanlar:

- Workspace name
- Country
- Skippable team invite

Yazılacak veriler:

- `Workspace.name`
- `Workspace.country`
- `WorkspaceMember` invite route üzerinden yeni üyeler

UX notu:

- Workspace name'in uygulama içi takım/proje adı olduğu söylenmeli.
- Team invite onboarding akışını yavaşlatıyorsa dashboard checklist'e alınabilir.

### Adım 2: Company calibration input

Alanlar:

- Company name
- Company website domain
- Pricing page URL

Kullanıcıya gösterilecek neden:

- Company name: Revint'in insight ve yazı dilinde kullanılacak.
- Website domain: ICP taslağı çıkarmak için kullanılacak.
- Pricing page URL: satılan paketleri/planları çıkarmak ve leadlere doğru teklifi önermek için kullanılacak.

Yazılacak veriler:

- `Workspace.companyName`
- `Workspace.companyDomain`
- `Workspace.pricingPageUrl`

Bu adım tamamlanınca workspace calibration worker başlatılmalı.

### Adım 3: ICP taslağını gözden geçir

Sistem aksiyonu:

- Company domain crawl edilir.
- Şirketin hedef müşterisi, use case'leri, dışarıda bırakılması gereken müşteri tipleri, vertical dili ve value proposition çıkarılır.
- Bunlardan editable ICP taslağı üretilir.

UI:

- Ana alan: büyük editable textarea.
- Yardımcı alanlar:
  - Target vertical / sub-niche chipleri.
  - High-value signals.
  - Negative signals.
  - Review/rating/price threshold alanları, sadece güven yeterliyse.
- Source drawer:
  - Hangi sayfalardan çıkarıldığı.
  - Kısa evidence snippet'leri.
  - "Draft, edit before it affects scoring" mesajı.

Kaydetme:

- `IdealCustomerProfile` upsert edilir.
- `description` plain text olarak saklanır.
- Structured alanlar `ICP_SCORER` için doldurulur.
- Edit olduğunda `version` artar.

UX ilkesi:

- Kullanıcının structured scoring alanlarını anlaması beklenmemeli.
- Plain text ana deneyim, structured alanlar advanced/optional olmalı.

### Adım 4: Pricing / packages review

Sistem aksiyonu:

- Pricing page crawl edilir.
- Plan/paket isimleri, fiyat etiketleri, özellikler, popular tier ve belirsizlikler çıkarılır.

UI:

- Draft package cards.
- Kullanıcı şunları yapabilir:
  - Paket adı düzenleme.
  - Fiyat etiketi düzenleme.
  - Feature ekleme/silme.
  - Paket ekleme/silme.
  - Popular tier işaretleme.
  - "Confirm packages" ile onaylama.

Kaydetme:

- Onaydan sonra `ServicePackage` satırları oluşturulur/güncellenir.
- Crawl fail olursa manuel package editor gösterilir.

Bu adım HubSpot import'tan önce gelmeli.

Sebep:

- `lead_created` zinciri paketsiz workspace'te çalışmıyor.
- Lead analizi ve recommended package bu veriye ihtiyaç duyuyor.

### Adım 5: HubSpot connect + import

Akış:

1. Connect HubSpot.
2. OAuth callback onboarding'e geri döner.
3. Connection status gösterilir.
4. "Import leads from HubSpot" CTA gösterilir.
5. `/api/integrations/hubspot/sync` çağrılır.
6. Özet gösterilir:
   - scanned
   - created
   - updated
   - matched
   - skipped
   - failed
   - hasMore
7. `hasMore` varsa "Import next batch" veya "Continue, import later" opsiyonu.

Copy net olmalı:

- Connected: HubSpot yetkisi verildi.
- Imported: contact/company kayıtları Revint Leads'e geldi.
- Matched: Google Place ile eşleşti ve analiz başladı.
- CRM-only: kayıt geldi ama tam analiz için eşleşme bekliyor.

Plan gate:

- FREE veya düşük planda HubSpot locked card olarak gösterilmeli.
- Upgrade CTA ve "Continue without HubSpot" opsiyonu olmalı.

### Adım 6: First leads ve tutorial

Varsayılan yönlendirme:

- `/app/leads`

HubSpot import başarılıysa:

- Leads panel açılır.
- Live processing strip görünür.
- İlk yeni leadler veya yüksek confidence leadler öne alınır.
- Contextual tutorial gerçek liste üstünde çalışır:
  - ICP fit badge.
  - Recommended package.
  - Next best action.
  - HubSpot context.

HubSpot skip edildiyse:

- Leads empty state:
  - Connect/import HubSpot.
  - Discover leads manually.

Onboarding complete:

- Şirket kalibrasyonu ve package confirmation tamamlandıktan sonra,
- HubSpot import yapıldıysa veya açıkça skip edildiyse,
- `onboardingCompletedAt` set edilir.

## 5. Alternatif onboarding tasarımları

### Seçenek A: Calibration-first wizard

Önerilen v1.

Akış:

1. Workspace
2. Company domain + pricing URL
3. ICP taslağı review
4. Package taslağı review
5. HubSpot connect/import
6. Leads panel tutorial

En uygun olduğu durum:

- Mevcut Revint mimarisi.
- AI çıktısını güvenilir hale getirme.
- `BLOCKED_NEEDS_PACKAGES` riskini önleme.
- Kullanıcıya "Revint ağır işi yaptı, sen doğru mu kontrol et" hissi verme.

Artıları:

- Her istenen bilgi doğrudan sistem davranışına bağlanır.
- ICP ve paketler kullanıcı onayından geçer.
- HubSpot import sonrası analiz kalitesi daha iyi olur.

Eksileri:

- Dashboard checklist'e göre daha uzun.
- Draft state, polling ve crawl failure handling gerekir.
- İlk implementasyonu daha zahmetli.

### Seçenek B: Dashboard setup checklist

Akış:

1. Minimal wizard: workspace + company domain.
2. Kullanıcı dashboard'a düşer.
3. Checklist kartları:
   - Review ICP.
   - Add packages.
   - Connect HubSpot.
   - Import leads.
   - Open first lead brief.

En uygun olduğu durum:

- Forced wizard drop-off yüksekse.
- Birden fazla admin farklı setup parçalarını yapacaksa.
- Crawler'ın arkada çalışması isteniyorsa.

Artıları:

- İlk giriş daha hafif.
- Kullanıcı ürün UI'ını daha erken görür.
- Async işler daha doğal akar.

Eksileri:

- Kullanıcı kritik kalibrasyonu atlayabilir.
- Paketsiz leadler blocked olabilir.
- İlk değer daha dağınık hissedebilir.

Ne zaman seçilmeli:

- Seçenek A'da kullanıcıların HubSpot adımına gelmeden ciddi drop-off yaptığı görülürse.

### Seçenek C: HubSpot-first onboarding

Akış:

1. Workspace
2. Connect HubSpot
3. Import leads
4. Import çalışırken company domain/pricing input
5. ICP/packages review
6. Leads panel

En uygun olduğu durum:

- Paid kullanıcılar.
- HubSpot entegrasyonu için gelen kullanıcılar.
- Sales-assisted onboarding.

Artıları:

- CRM-native positioning çok güçlü hissedilir.
- Kullanıcı "HubSpot içindeki değer" vaadini erken görür.
- Paid acquisition path için iyi olabilir.

Eksileri:

- Package onayı import'tan sonra kalırsa analiz blocked olabilir.
- PRO gating yüzünden free/trial kullanıcıda dead end yaratabilir.
- HubSpot erişimi olmayan evaluator için kötü.

Ne zaman seçilmeli:

- Genel default olarak değil, HubSpot landing/pricing üzerinden gelen paid kullanıcı branch'i olarak.

### Seçenek D: Assisted concierge onboarding

Akış:

1. Kullanıcı domain, pricing URL ve HubSpot niyetini girer.
2. Revint taslak üretir.
3. Founder/admin taslakları kontrol eder.
4. Kullanıcı onboarding call ile workspace'i teslim alır.

En uygun olduğu durum:

- Agency+.
- Design partner.
- Yüksek değerli hesaplar.

Artıları:

- AI tahmin hataları müşteriye yansımadan düzeltilir.
- Daha premium hissettirir.
- Strategic account için daha güvenli.

Eksileri:

- Self-serve değil.
- Operasyonel maliyetli.
- Time-to-value daha yavaş.

## 6. Önerilen implementation şekli

### Prisma / veri modeli

`Workspace` için önerilen alanlar:

```prisma
companyName    String? @map("company_name")
companyDomain  String? @map("company_domain")
pricingPageUrl String? @map("pricing_page_url")
```

`IdealCustomerProfile` için önerilen alanlar:

```prisma
description String? @db.Text
sourceJson  Json    @default("{}") @map("source_json")
```

Draft persistence için önerilen yeni model:

```prisma
model WorkspaceOnboardingDraft {
  id                 String   @id @default(cuid())
  workspaceId        String   @unique @map("workspace_id")
  companyContextJson Json     @default("{}") @map("company_context_json")
  icpDraftJson       Json     @default("{}") @map("icp_draft_json")
  packagesDraftJson  Json     @default("[]") @map("packages_draft_json")
  status             String
  error              String?  @db.Text
  lastRunId          String?  @map("last_run_id")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@map("workspace_onboarding_drafts")
}
```

Neden draft table:

- Crawl/extract uzun sürebilir.
- Kullanıcı sayfayı refresh edebilir.
- AI tahmini kullanıcı onayından önce gerçek `IdealCustomerProfile` veya `ServicePackage` satırlarına yazılmamalı.

### Worker / AI flow

Yeni worker önerisi:

- `src/lib/agent-workers/workspace-context-extractor.ts`
- Enum adı: `WORKSPACE_CONTEXT_EXTRACTOR`

Sorumluluk:

- Company domain crawl.
- Pricing page crawl.
- Structured JSON output üretme.
- `WorkspaceOnboardingDraft` içine yazma.
- Source URL, confidence ve warning bilgilerini saklama.

Kurallar:

- Gemini API route içinde çağrılmamalı.
- Yeni BullMQ queue eklenmemeli.
- `agent-runs` kullanılmalı.
- `leadId = null` desteklenmeli.
- Tüm DB yazımları `workspaceId` scoped olmalı.

Başlatma seçenekleri:

1. Yeni event: `workspace_calibration_requested`
   - Daha temiz.
   - Gelecekte DAG gerekirse iyi.
2. Direkt AgentRun enqueue eden onboarding API route
   - v1 için daha hızlı.
   - Tek worker ise yeterli.

Benim önerim:

- v1'de direkt AgentRun route yeterli.
- Calibration daha sonra çok adımlı hale gelirse event/chain'e taşınır.

### API endpoint önerileri

Yeni endpointler:

- `GET /api/onboarding/state`
  - Workspace fields, draft status, existing ICP, packages, HubSpot status döner.
- `PATCH /api/onboarding/company`
  - `companyName`, `companyDomain`, `pricingPageUrl` kaydeder.
  - Calibration worker başlatır.
- `POST /api/onboarding/confirm-icp`
  - Edited draft'tan `IdealCustomerProfile` upsert eder.
- `POST /api/onboarding/confirm-packages`
  - Edited draft'tan `ServicePackage` create/update yapar.
- `POST /api/onboarding/complete`
  - Mevcut endpoint korunur ama çağrılma koşulu sıkılaştırılır.

Mevcut endpointler tekrar kullanılmalı:

- `/api/workspace`
- `/api/workspace/packages`
- `/api/team/invite`
- `/api/integrations/hubspot/connect`
- `/api/integrations/hubspot/status`
- `/api/integrations/hubspot/sync`

### UI component yapısı

Mevcut tek büyük onboarding component'i yerine önerilen parçalar:

- `OnboardingShell`
- `WorkspaceStep`
- `CompanyCalibrationStep`
- `IcpReviewStep`
- `PackagesReviewStep`
- `HubspotImportStep`
- `ActivationStep`

Kullanılacak mevcut UI:

- `Button`
- `Input`
- `Textarea`
- `Card`
- `Progress`
- `Skeleton`
- `Badge`
- `Tooltip`
- `sonner` toast
- `lucide-react` iconlar

UX kuralları:

- AI output her zaman "draft" olarak etiketlenmeli.
- Crawl pending state skeleton/progress ile gösterilmeli.
- Hata durumunda kullanıcı manuel girebilmeli.
- "Skip" sadece downstream etkisi anlatılarak sunulmalı.
- Paket yokken HubSpot import sonrası analiz başlayamayacağı için package adımı soft değil hard-gated olmalı.

## 7. Extraction output kontratı

ICP draft örnek JSON:

```json
{
  "description": "Best-fit customers are multi-location restaurants using legacy booking and ordering tools...",
  "industryWeights": {},
  "subNicheWeights": {},
  "priceLevelMin": null,
  "priceLevelMax": null,
  "minReviewCount": null,
  "minRating": null,
  "digitalMaturityFloor": null,
  "highValueSignals": [],
  "negativeSignals": [],
  "locationFit": {},
  "confidence": 0.78,
  "sources": [
    {
      "url": "https://example.com/",
      "evidence": "..."
    }
  ]
}
```

Package draft örnek JSON:

```json
[
  {
    "name": "Starter",
    "priceLabel": "From $499/mo",
    "features": ["1 location", "Basic reporting", "Email support"],
    "isPopular": false,
    "sortOrder": 0,
    "confidence": 0.82,
    "sourceUrl": "https://example.com/pricing"
  }
]
```

Not:

- `confidence` ve `sourceUrl` draft state'te kalabilir.
- `ServicePackage` schema genişletilmeden gerçek package satırına yazılmaları gerekmez.

## 8. Copy önerileri

İyi copy:

- "We use this domain to draft your ICP. You can edit it before it affects scoring."
- "These packages power lead recommendations. Confirm them before we import leads."
- "HubSpot stays your system of record. Revint imports leads and starts analysis on matched accounts."
- "This is a draft, not a decision. Edit anything that looks off."

Kaçınılacak copy:

- "Tell us about yourself."
- "Complete your profile."
- "Personalize your experience."
- "AI will optimize your workspace."

Step label önerisi:

1. Workspace
2. Company
3. ICP draft
4. Packages
5. HubSpot
6. First leads

## 9. Edge case listesi

- **Pricing page yok**: manuel package editor göster.
- **Pricing crawl fail**: domain'den tahmini paket önermek yerine manuel editor + örnek placeholder ver.
- **Company crawl fail**: plain-text ICP manual entry göster.
- **HubSpot configured değil**: step skip edilebilir, kullanıcı Leads empty state'e gider.
- **Plan PRO altında**: HubSpot locked card + upgrade CTA + skip.
- **HubSpot connected ama import yapılmadı**: onboarding completed sayılmamalı, kullanıcı explicit skip seçerse tamamlanabilir.
- **HubSpot import'ta CRM-only leadler geldi**: "analysis waits for place match" açıklaması göster.
- **Mevcut workspace'te ICP/package var**: draft yerine mevcut değerler prefill edilir, kullanıcı confirm eder.
- **Kullanıcı ICP'yi sonradan değiştirir**: `IdealCustomerProfile.version` artmalı, ileride "re-score existing leads" CTA eklenmeli.
- **Duplicate package name**: save öncesi dedupe veya rename prompt.
- **Worker timeout**: polling ekranı manuel entry fallback göstermeli.

## 10. Başarı metrikleri

Ana metrik:

- Verified signup'tan ilk analiz edilmiş lead'in görünmesine kadar geçen süre.

Funnel eventleri:

- signup_started
- email_verified
- onboarding_started
- workspace_step_completed
- company_domain_submitted
- calibration_worker_started
- calibration_worker_succeeded
- calibration_worker_failed
- icp_draft_viewed
- icp_draft_edited
- icp_draft_confirmed
- packages_draft_viewed
- packages_draft_edited
- packages_confirmed
- hubspot_connect_started
- hubspot_connected
- hubspot_import_started
- hubspot_import_completed
- first_lead_created
- first_lead_analysis_started
- first_analyzed_lead_visible
- onboarding_completed

İzlenecek risk metrikleri:

- `BLOCKED_NEEDS_PACKAGES` sayısı.
- HubSpot import failure oranı.
- ICP edit rate.
- Package edit rate.
- Step drop-off oranları.
- Calibration worker fail oranı.

## 11. Test planı

Unit test:

- Domain URL normalization.
- Pricing URL validation.
- ICP draft -> `IdealCustomerProfile` mapping.
- Package draft validation.
- Duplicate package handling.

API test:

- `/api/onboarding/company` sadece current `workspaceId` yazar.
- Non-admin onboarding company/ICP/package mutate edemez.
- Confirm ICP başka workspace'e yazamaz.
- Confirm packages başka workspace package'larını update edemez.
- HubSpot PRO gate doğru response döner.

Worker test:

- `WORKSPACE_CONTEXT_EXTRACTOR` config yokken graceful skip döner.
- Worker output schema validation yapar.
- Worker `WorkspaceOnboardingDraft` satırını workspace scoped yazar.
- Pricing page'de fiyat yoksa package draft warning üretir.

E2E test:

- Yeni kullanıcı signup -> email callback -> company domain/pricing -> ICP confirm -> package confirm -> HubSpot skip -> Leads empty state.
- Paid/admin kullanıcı HubSpot connect -> import -> Leads processing state.
- Crawl fail -> manual ICP/package entry -> onboarding complete.
- Existing package olan workspace -> package step prefilled.

Regression:

- `npm run lint`
- `npm run test`
- Targeted tests: auth, onboarding API, packages, ICP scorer, HubSpot sync.

## 12. Karar tablosu

| Konu | Öneri | Sebep |
|---|---|---|
| Default flow | Seçenek A: calibration-first wizard | Mevcut ICP/package/HubSpot mimarisine en uyumlu |
| Signup alanları | Minimal kalsın | Auth friction düşük kalır |
| Company name | `Workspace.companyName` ekle | Workspace name ile seller company aynı şey değil |
| ICP UI | Plain text + advanced structured fields | Kullanıcı tahmini düzenleyebilir, scorer yine çalışır |
| Pricing output | Draft `ServicePackage` kartları | Mevcut analiz ve campaigns sayfası bunu kullanıyor |
| HubSpot sırası | Package confirmation sonrası | Paketsiz lead analysis blocked oluyor |
| Tutorial | Leads panel üstünde contextual | Gerçek objeyle öğrenme daha güçlü |
| Draft storage | `WorkspaceOnboardingDraft` | AI tahmini onaydan önce production veriye yazılmamalı |

## 13. Fazlı rollout önerisi

### Faz 1: Manual-first güvenli akış

- Company fields ekle.
- Onboarding sırasını yeni mantığa göre değiştir.
- ICP/package girişini manuel ama yeni copy ile sun.
- HubSpot connect sonrası import CTA entegre et.

Bu fazda crawler/extractor olmadan bile daha doğru onboarding çıkar.

### Faz 2: AI draft generation

- `WorkspaceOnboardingDraft` ekle.
- `WORKSPACE_CONTEXT_EXTRACTOR` worker ekle.
- ICP ve package taslaklarını üret.
- Source/confidence UI ekle.

### Faz 3: Activation polish

- Leads panel tutorial.
- Import progress.
- Live analysis status.
- ICP edit sonrası re-score CTA.

### Faz 4: Experiment

- Option A vs dashboard checklist A/B.
- Paid HubSpot landing'den gelenler için HubSpot-first branch.
- Agency+ için assisted concierge branch.

## 14. Son öneri

İlk ürünleştirilecek onboarding:

> **Calibration-first wizard: domain + pricing URL al, Revint ICP ve paket taslağı çıkarsın, kullanıcı düzeltsin/onaylasın, sonra HubSpot import başlasın ve Leads panelinde ilk analizler görünsün.**

Bu Revint için en doğru psikolojik sözleşme:

- Revint ağır işi yapıyor.
- Kullanıcı son karar merci olmaya devam ediyor.
- Sistem, kullanıcı onayı olmadan scoring ve package recommendation davranışını değiştirmiyor.

Bu aynı zamanda mevcut teknik mimariyle de en uyumlu yol:

- `IdealCustomerProfile` zaten lead scoring'e bağlı.
- `ServicePackage` zaten package recommendation ve pipeline gate için kritik.
- HubSpot import zaten mevcut.
- Leads panel zaten activation yüzeyi.

