# FineDine karar döngüsü — üç mercek, test ve referans seti

**Tarih:** 2026-09-27  
**Ürün:** Revint Control Plane (`/admin/control`)  
**Durum:** İnceleme bekliyor  
**İlişkili plan:** `docs/superpowers/plans/2026-09-26-finedine-control-plane.md`

## 1. Amaç

FineDine hesapları üzerinde üretilen her analizi üç kişi aynı karttan okur, üç ayrı hüküm bırakır ve hemfikir oldukları davranışı referans vakaya çevirir. Prompt veya kural değişince sistem o vakaları yeniden karar üreterek sayar. FineDine SDR’ı bu ekranı görmez. Control Plane fabrikanın kalite döngüsüdür.

Döngü:

1. Brief kararı üretilir.
2. Teknik, alan ve satış mercekleri aynı koşu üzerinde hüküm verir.
3. Üç hüküm birikince beklenen davranış referans vaka olur.
4. Taban sayım, saklanan kararı kurallarla sayar.
5. Aday koşu, donmuş girdiden bugünkü head agent ile yeni karar üretir ve aynı kurallarla sayar.
6. Karşılaştırma bozulan, düzelen ve aynı kalan vakaları gösterir.

## 2. Kararlar


| Konu                | Seçim                                                                                           | Gerekçe                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Kişiler             | Üründe isim yok. Üç mercek: `TECHNICAL`, `DOMAIN`, `SALES`. Ekranda Teknik, Alan, Satış.        | Mert, Çınar ve Onur işletme rolü. Hesaplar değişebilir.               |
| Platform rolü       | `VIEWER` / `REVIEWER` / `ADMIN` durur. Mercek bunun üstüne eklenir.                             | Yetki ile bakış açısı ayrı şey.                                       |
| Kuyruk              | Başarılı `LEAD_INTELLIGENCE_BRIEF` koşuları. Düşen worker burada değil.                         | Çınar ve Onur embedding hatası okumaz. Mert düşenleri Trace’te görür. |
| Hüküm               | Koşu başına mercek başına bir güncel hüküm. Eski satır silinmez.                                | AI çıktısı değişmez. Tarihçe kalır.                                   |
| Referans vaka       | Üç merceğin güncel hükmü durmadan promote yok.                                                  | Tek kişi golden üretemez.                                             |
| Beklenen JSON       | İnsan yazar. AI çıktısının kopyası değildir.                                                    | Vaka “model ne dedi” değil, “ne demeli” kaydıdır.                     |
| Taban eval          | Model çağırmaz. `outputSnapshot` sayılır.                                                       | O günkü kararı kuralla ölçer.                                         |
| Aday eval           | Donmuş `inputSnapshot` ile head agent yeniden karar verir. Lead’e yazmaz. Canlı aracı çağırmaz. | Prompt değişiminin etkisini ölçer.                                    |
| Kalibrasyon editörü | Bu spec’te yok.                                                                                 | Döngünün çıkışı mevcut taslak / yayın kuralıdır. Editör ayrı spec.    |
| Müşteri kartı       | Bu spec’te yok.                                                                                 | FineDine Analysis Engine ayrı yüzey.                                  |


## 3. Mercekler

`PlatformRoleAssignment` satırına `lens` eklenir. Bir kullanıcının en fazla bir merceği vardır. Mercek yoksa kullanıcı okur, hüküm yazamaz, promote edemez.


| Mercek      | Ekran  | Soru                                                      | Tipik sınıf                                                   |
| ----------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| `TECHNICAL` | Teknik | Sistem bu kararı hangi kaynaktan, hangi maliyetle üretti? | `STALE_SOURCE`, `PIPELINE_OMISSION`                           |
| `DOMAIN`    | Alan   | Bu hesapta modül sırası ve paket F&B satışına uyar mı?    | `PACKAGE_MISMATCH`, `PLAYBOOK_VIOLATION`, `SCORE_CALIBRATION` |
| `SALES`     | Satış  | Bir SDR bunu görünce ne yapmalı?                          | `IDENTITY_MISMATCH`, `UNSUPPORTED_CLAIM`                      |


Hüküm yazmak `REVIEWER` veya `ADMIN` ve kendi merceğini ister. Başka merceğin formunu kimse dolduramaz.

Şiddet mevcut ölçekte kalır: P0 Bugün bakar, P1 Bu hafta, P2 Kayıt. `HIGH` diye bir değer yoktur.

`Kaldı` sınıf, şiddet ve bir cümle not ister. `Geçti` sınıf ve şiddeti temizler. `Tekrar bak` notsuz kalabilir. Koşunun `outputJson` alanı hiç güncellenmez.

## 4. Karar kartı

Kart, `LEAD_INTELLIGENCE_BRIEF` koşusunun `outputJson` alanından okunur. Aşağıdaki dört alan aranmaz: `icpFitScore`, `modules`, `claims`, `angle`.


| Satır            | Kaynak                                                                                        | Boşsa        |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------ |
| ICP uyum         | `salesConfidence` (0–100, tam sayı)                                                           | Puan yok     |
| Karar güveni     | `headAgent.confidence`                                                                        | Güven yok    |
| Modüller         | `headAgent.recommendedModules`, dizi sırası korunur                                           | Modül yok    |
| Birincil modül   | Listenin ilk elemanı                                                                          | Birincil yok |
| Açı              | `headAgent.primaryAngle`                                                                      | Açı yok      |
| Konuşma          | `headAgent.talkTrack`                                                                         | Konuşma yok  |
| Paket            | `headAgent.recommendedPackage`                                                                | Paket yok    |
| Hariç tutulanlar | `headAgent.excludedModules`                                                                   | Hariç yok    |
| İddialar         | `headAgent.sourceConflicts[].claim` artı talk track içinde yüzde veya “upsell” geçen cümleler | İddia yok    |
| Kanıt            | `headAgent.evidenceRefs`                                                                      | Kanıt yok    |
| Kaynak zamanı    | Bu brief koşusunun `finishedAt` değeri                                                        | Zaman yok    |
| Lokasyon         | Aynı `accountId` altındaki lead sayısı. Hesap yoksa 1.                                        | —            |
| Mod              | `briefMode`                                                                                   | —            |


`headAgent` yoksa kart ICP uyum, brief başlığı ve “Head agent kararı yok” satırını gösterir. Modül, açı ve iddia boş kalır. Bu koşu yine kuyruğa girer. Alan merceği bunu `PACKAGE_MISMATCH` veya `PIPELINE_OMISSION` ile işaretleyebilir.

Modül kimlikleri `FineDineModule` değerleridir: `order_and_pay`, `qr_menu`, `reservation`, `ai_menu_builder`, `crm_loyalty`, `multi_language`, `website`, `multi_location`. Ekran etiketi Türkçe kısa addır. Referans vakadaki `allowedModules` ve skorlama kimliği kullanır, etiketi değil.

Lokasyon sayısı talk track içinden okunmaz. Satış merceği “20 lokasyon” cümlesini karttaki sayı ile kendisi karşılaştırır ve `STALE_SOURCE` veya `UNSUPPORTED_CLAIM` seçer. Otomatik cümle ayrıştırma yoktur.

Kaynak zamanı, yorumların gerçek yılı değildir. Mert’in “Google Reviews 2025” görmesi için kanıt satırı brief koşusunun bitiş zamanını gösterir. Daha ince bir kaynak tarihi bu spec’te yoktur.

## 5. Kuyruk

İnceleme kuyruğu, workspace içindeki son 14 günün `SUCCEEDED` brief koşularıdır. Lead başına en yeni brief esas alınır.

Satır kuyrukta kalır, ta ki o `agentRunId` için üç merceğin de güncel bir `HumanReview` kaydı olana kadar. Bir mercek `Geçti` veya `Kaldı` dese de diğer iki mercek yazmadan satır düşmez.

Düşen worker, takılı oturum ve maliyet Trace ile Genel Bakış’ta kalır. İnceleme kuyruğuna girmez.

Kuyruk satırı işletme adını, ICP uyumu, birincil modülü ve eksik mercekleri gösterir: “Teknik baktı. Alan ve Satış bakmadı.”

## 6. Aynı hesapta üç hüküm

Örnek hesap The Burger House. Brief şunu üretmiş olsun: ICP uyum 87, sıra `order_and_pay`, `qr_menu`, `crm_loyalty`, açı “Improve repeat customer conversion”.

Teknik mercek Trace’te aynı kartı ve altında worker satırlarını görür. Worker grupları yalnızca etiket gruplarıdır. Yeni bir zincir motoru yoktur.


| Grup  | Worker                       |
| ----- | ---------------------------- |
| Site  | `WEBSITE_AUDITOR`            |
| Yorum | `REVIEW_ANALYST`             |
| ICP   | `SALES_OPPORTUNITY_SCORER`   |
| Karar | `LEAD_INTELLIGENCE_BRIEF`    |
| CRM   | Mevcut CRM senkron satırları |


Teknik mercek kaynak zamanı ile iddia cümlesini yan yana görür. Hüküm: `Kaldı`, `STALE_SOURCE`, P0, bir cümle. `AgentRun` durur.

Alan merceği aynı kartta sırayı görür. Ordering birinci, hesapta ordering zaten varsa hüküm: `Kaldı`, `PACKAGE_MISMATCH`, P0. İkinci satır birincinin üstüne yazılmaz. Güncel hüküm mercek başına son satırdır.

Satış merceği lokasyon sayısını ve paketi görür. “Zaten müşteri” veya “hedef profil değil” ise `IDENTITY_MISMATCH`. Dayanaksız ROI cümlesi ise `UNSUPPORTED_CLAIM`.

Üç güncel hüküm durunca “Referans vaka yap” açılır. Hükümler birbirine uymak zorunda değildir. Üçü de `Kaldı` diyebilir. Beklenen davranış forma yazılır. AI’ın ürettiği sıra forma kopyalanmaz.

## 7. Referans vaka

Promote `REVIEWER` veya `ADMIN` ister, üç güncel mercek hükmü ister, başlık ve beklenen kuralları ister.

`EvalCase` alanları:


| Alan                           | İçerik                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `sourceLeadId` / `sourceRunId` | Hükmün baktığı lead ve brief koşusu                                                       |
| `outputSnapshot`               | O koşunun `outputJson` kopyası. Sonradan değişmez.                                        |
| `inputSnapshot`                | Aşağıdaki donmuş girdi                                                                    |
| `expectedJson`                 | İnsan kuralları                                                                           |
| `severity`                     | Üç hüküm içindeki en sıkı şiddet. Eşitlikte P0, sonra P1, sonra P2. Hepsi `Geçti` ise P2. |


`inputSnapshot` promote anında, yalnızca bu workspace’ten okunur. Başka bir “substrat” alanı yoktur. Kopya şunları taşır:

- İşletme adı, adres, rating, yorum sayısı, fiyat seviyesi, lokasyon sayısı
- Site audit: url, reachable, `hasBookingSystem`, `crawlError`
- Yorum analizi: `painPhrases`, `weaknessKpis`, `strengthPhrases`
- Brief bağlamı: başlık, talking points, doğrulanmış acılar, `salesConfidence`
- `outputSnapshot` içindeki `headAgent.excludedModules` ve `evidenceRefs`

Replay bu kopyayı kullanır. Promote’tan sonra lead değişse vaka değişmez. Canlı crawl, canlı yorum çekimi ve head agent araçları (`get_lead_basics`, `get_full_reviews`, diğerleri) aday koşuda kapalıdır.

`expectedJson`:

```ts
{
  icpMin?: number;          // 0–100 tam sayı
  icpMax?: number;
  allowedModules?: string[]; // FineDineModule kimlikleri
  forbiddenClaims: string[];
  forbiddenAngles: string[];
}
```

Burger House için ekibin yazacağı örnek:

```json
{
  "icpMin": 70,
  "icpMax": 100,
  "allowedModules": ["crm_loyalty"],
  "forbiddenClaims": ["guaranteed revenue increase"],
  "forbiddenAngles": ["online ordering replacement"]
}
```

Bu örnekte birincil modül `crm_loyalty` olmak zorundadır. `order_and_pay` üçüncü sırada durabilir. Birincil `order_and_pay` ise vaka kalır. “guaranteed revenue increase” talk track veya iddia metninde geçerse vaka kalır. Açı “online ordering replacement” ifadesini içerirse vaka kalır.

Referans vaka `SemanticMemory` yazmaz.

Form, kaydetmeden önce saklanan `outputSnapshot` üzerinde sayımı gösterir: “Bu kurallarla donmuş çıktı geçer” veya kalış nedeni. Bu önizleme model çağırmaz.

## 8. Sayım kuralları

Skorlayıcı `src/lib/control/score.ts` karar kartının alanlarını okur.


| Kural       | Kalır kodu        | Koşul                                                                                                                  |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ICP bandı   | `ICP_BAND`        | `icpMin` veya `icpMax` doluysa `salesConfidence` yoksa veya bandın dışındaysa                                          |
| Modül       | `MODULE`          | `allowedModules` doluysa birincil modül (listenin ilki) bu kümede yoksa. Alttaki modüller küme dışında olsa da kalmaz. |
| Yasak iddia | `FORBIDDEN_CLAIM` | Yasak metin, büyük-küçük harf duyarsız, talk track, reasoning veya iddia dizisinde alt dizgi ise                       |
| Yasak açı   | `FORBIDDEN_ANGLE` | Yasak metin, büyük-küçük harf duyarsız, `primaryAngle` içinde alt dizgi ise                                            |


Boş yasak listeler kalır üretmez. `allowedModules` boşsa modül kuralı uygulanmaz. Band yoksa ICP kuralı uygulanmaz.

Ekrandaki kalış adları: Puan bandın dışında, Modül, Yasak iddia, Yasak açı.

## 9. Eval

İki tür vardır. İkisi de aynı `EvalRun` kaydına yazılır. `label` türü taşır: `taban` veya `aday`.

### Taban

`REVIEWER` başlatır. Veri kümesindeki her vakanın `outputSnapshot` değeri §8 ile sayılır. Claude ve Gemini çağrılmaz. `summaryJson` şudur: `{ "passed": number, "total": number, "failedCaseIds": string[] }`. Genel Bakış bu oranı basar.

### Aday

`ADMIN` başlatır. Onay cümlesi vaka sayısını ve “her vaka bugünkü head agent ile bir kez karar üretir, lead’e yazılmaz” der. Koşu `PENDING` doğar. API modeli çağırmaz. Mevcut `agent-runs` kuyruğuna `control_eval_replay` işi girer. Worker her vaka için `replayHeadAgentDecision(inputSnapshot)` çağırır.

Replay:

- Araç döngüsü kapalıdır.
- Sistem promptu bugünkü kodudur.
- Girdi yalnızca `inputSnapshot` olur.
- Çıktı `EvalCaseResult.outputJson` içine yazılır. Lead, brief ve kaynak `AgentRun` güncellenmez.
- Head agent kapalıysa veya F&B değilse vaka `HEAD_AGENT_UNAVAILABLE` ile kalır ve geçmez.
- Bitince `EvalRun.status = SUCCEEDED`.

Workspace başına aynı anda bir aday koşu vardır. İkincisi 409 döner.

### Karşılaştırma

Kişi iki başarılı koşu seçer. Eski olan taban, yeni olan aday sayılır. Ekran “N bozuldu, N düzeldi, N aynı” der. Bozulan: tabanda geçen, adayda kalan. Her satır işletme adı, kalış adı ve iki karar kartıdır.

Kabul düğmesi kalibrasyonu yayınlamaz. Metin: “Bu, kontrol sonucunu kabul eder. Canlı ICP, paket ve oyun kitabını yayınlamaz.” Audit eylemi `eval.accept` kalır.

## 10. Ekranlar

Mevcut rotalar durur. Yeni görsel dil yoktur. Metin Türkçe, rota İngilizce.


| Rota                                                      | Bu spec ile                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/admin/control`                                          | Son 14 günde üç merceği tamamlanmamış brief sayısı. Son taban ve son aday oranı.                                    |
| `/admin/control/reviews`                                  | §5 kuyruğu. Kart §4. Altta yalnızca oturum sahibinin merceği için hüküm formu. Diğer iki hüküm okunur, düzenlenmez. |
| `/admin/control/trace` ve `/admin/control/trace/[leadId]` | Aynı kart, sonra worker grupları, süre, USD, hata, CRM. Ham JSON kapalı `details` içinde kalır.                     |
| `/admin/control/golden`                                   | Vaka listesi. Üç mercek tamamlanmadan promote kapalı. Kapalıysa neden yazar.                                        |
| `/admin/control/golden/compare`                           | §9 karşılaştırması. Aday başlatma onay cümlesi burada durur.                                                        |
| `/admin/control/calibration`                              | Davranış değişmez.                                                                                                  |
| `/admin/control/audit`                                    | Yeni eylemler de buraya düşer: `review.record`, `golden.promote`, `eval.replay`.                                    |


İnceleme cümlesi durur: “Bu karar analizi değiştirmez. Çalıştırmanın çıktısı yerinde kalır.”

## 11. Veri

`ReviewLens` enum: `TECHNICAL`, `DOMAIN`, `SALES`.

`PlatformRoleAssignment.lens` nullable. Mevcut satırlar null kalır. Null mercek hüküm yazamaz.

`HumanReview.lens` nullable kalır. Backfill yoktur. Null mercek üçlü kapıya girmez. Yeni form merceksiz kayıt yazamaz. Eski satırlar tarihçede görünür, üçlü sayılmaz. Kapı, aynı `agentRunId` için `TECHNICAL`, `DOMAIN` ve `SALES` değerlerinin her birinde en az bir satır arar. Mercek başına güncel hüküm, o merceğin en yeni satırıdır.

`HumanReview` üzerinde ikinci bir zorunlu reviewer kolonu yoktur. Üç satır üç mercektir.

Her yazım `AdminAuditEvent` ekler. Güncelleme ve silme rotası yoktur.

Workspace sınırı: her okuma ve yazma `workspaceId` taşır. URL’deki kimlik, kontrol rolü geçmeden çocuk sorgularda kullanılmaz.

## 12. Bileşenler


| Birim                                    | İş                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/control/decision.ts`            | Brief `outputJson` → karar kartı. Saf fonksiyon.                       |
| `src/lib/control/score.ts`               | Kart + `expectedJson` → geçti / kalış listesi. Model yok.              |
| `src/lib/control/review.ts`              | Kuyruk, mercek hükmü, üçlü tamam mı.                                   |
| `src/lib/control/golden.ts`              | Üçlü kapı, snapshot, `EvalCase` yazımı. Hafıza yazmaz.                 |
| `src/lib/control/eval-run.ts`            | Taban sayımı. Aday koşusunu kuyruğa koyar, modeli çağırmaz.            |
| `src/lib/ai-core/agent/head-agent.ts`    | `replayHeadAgentDecision`. Araçsız, donmuş girdi.                      |
| `src/workers/agent-run-worker.ts`        | `control_eval_replay` işini çalıştırır, sonucu `EvalCaseResult` yazar. |
| `src/components/admin/decision-card.tsx` | §4 satırları.                                                          |
| İnceleme paneli                          | Eksik mercekler, tek mercek formu, promote kapısı.                     |


Yeni BullMQ kuyruğu yoktur. Yeni Gemini ucu yoktur. Replay Claude çağrısı head agent modülünün içindedir. Admin route yalnızca iş bırakır.

## 13. Hatalar


| Durum                       | Davranış                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Mercek atanmamış            | Form kapalı. “Sana bir mercek atanmadı.”                                                         |
| Başka merceğe yazma         | 403                                                                                              |
| Üç hüküm yokken promote     | 400. Ekranda eksik merceklerin adı.                                                              |
| İkinci aday koşu            | 409. “Bu alanda bir aday koşu zaten sürüyor.”                                                    |
| Replay’de head agent kapalı | Vaka kalır, kod `HEAD_AGENT_UNAVAILABLE`. Koşu yine `SUCCEEDED` biter ki karşılaştırma çalışsın. |
| Replay istisnası            | O vaka kalır, `failures` içine `REPLAY_FAILED`. Diğer vakalar sürer.                             |
| Lead bu workspace’te yok    | 404                                                                                              |
| `Kaldı` notasız             | 400                                                                                              |


## 14. Test

Birim testler model çağırmaz. Replay testi Claude’u mock’lar.

- Kart, örnek brief JSON’undan ICP 87, birincil `order_and_pay`, açıyı okur. `icpFitScore` alanı aranmaz.
- `headAgent` yokken “Head agent kararı yok” durumu boş modül listesi verir.
- Kuyruk, iki merceği yazılmış başarılı brief’i tutar. Üçüncü yazılınca bırakır. `FAILED` worker bu listeye girmez.
- `Kaldı` kaydı `agentRun.update` çağırmaz.
- Promote, iki mercekte reddeder. Üç mercekte `EvalCase` yazar ve `semanticMemory` çağırmaz.
- Skor, birincil modül `order_and_pay` ve `allowedModules: ["crm_loyalty"]` iken `MODULE` döner.
- Yasak iddia talk track alt dizgisinde `FORBIDDEN_CLAIM` döner.
- Taban eval `summaryJson.passed` değerini snapshot üzerinden üretir, Claude mock’u çağırmaz.
- Aday eval route’u kuyruğa `control_eval_replay` koyar ve Claude çağırmaz.
- Replay fonksiyonu araç listesi vermez ve lead update çağırmaz.
- Karşılaştırma, tabanda geçen ve adayda kalan vakayı bozulan sayar.

## 15. Bu spec bitince doğru olan

Bir FineDine workspace’inde yeni bir brief, İnceleme’de işletme adıyla durur. Teknik, Alan ve Satış aynı kartı görür. Üçü de hüküm yazınca referans vaka kaydolur. Taban, o günkü kararı kuralla sayar. Prompt değişince aday, donmuş girdiden yeni karar üretir ve “N bozuldu, N düzeldi, N aynı” gösterir. Lead’in brief’i yerinde kalır. FineDine müşteri ekranı değişmez. Calibration editörü değişmez.

## 16. Dışarıda bırakılanlar

- Calibration formunun oyun kitabı, paket sırası ve iddia ekleme eksikleri
- Taslağı yazanın yayınlayamaması kuralının değişmesi
- Hükmün SemanticMemory veya sonraki brief’e yazılması
- HubSpot sonuç panosu, cevap, toplantı, kazanıldı / kaybedildi
- Marketing admin (`/admin` oturum, huni, coğrafya)
- Talk track içinden lokasyon veya tarih çıkaran model
- Müşteriye giden FineDine Analysis kartı
- Yeni kuyruk, yeni Gemini ucu, `cancel-all-global` düğmesi

