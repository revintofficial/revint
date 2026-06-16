# LeadAC MCP: GTM benchmark, tool tasarımı ve distribution araştırması

**Araştırma tarihi:** 4 Haziran 2026  
**Kapsam:** Başarılı SaaS ve GTM MCP ürünleri, gerçek kullanım workflow'ları, LeadAC'in ilk tool seti, positioning ve distribution planı  
**Önceki araştırma:** [MCP nedir ve LeadAC neden MCP yapmalı?](./leadac-mcp-temelleri.md)

## Kısa karar

LeadAC MCP yapılmalı, fakat pazara "bir GTM MCP daha" olarak çıkmamalı.

Apollo, Clay, Common Room, HubSpot ve Salesloft/Clari kendi verilerini AI araçlarına açıyor; Gong da aynı yüzeyi duyurdu ve kullanıma hazırlıyor. Account bulma, contact enrichment, CRM kaydı oluşturma ve outreach yazma alanları hızla kalabalıklaşıyor.

LeadAC'in savunulabilir alanı başka:

> **LeadAC, workspace'in geçmiş satış sonuçlarını ve operational account sinyallerini kullanarak bugün hangi accountun neden aranması gerektiğine karar verir.**

LeadAC MCP'nin ilk ürünü:

- Ham veri arama aracı olmamalı.
- Apollo veya Clay'in yaptığı enrichment işini tekrar etmemeli.
- CRM CRUD aracı olmamalı.
- Her iç workerı ayrı tool olarak açmamalı.
- İlk günden otonom outreach göndermemeli.

İlk ürün, birkaç yüksek seviyeli ve read-only karar tool'undan oluşmalı:

1. `find_priority_accounts`
2. `get_account_brief`
3. `explain_account_priority`
4. `analyze_outcome_patterns`
5. `get_workspace_playbook`

Ana kullanım senaryosu:

> "Geçen hafta neyin çalıştığına ve mevcut account sinyallerine göre bugün aramam gereken en iyi accountları bul ve nedenlerini açıkla."

---

## 1. Pazarda ne değişti?

MCP artık yalnızca developer araçlarının kullandığı deneysel bir protokol değil. 2025 sonu ve 2026'nın ilk yarısında önemli GTM ürünleri MCP yüzeyi açmaya başladı.

4 Haziran 2026 itibarıyla doğrulayabildiğimiz durum:

| Ürün | MCP durumu | MCP üzerinden açtığı temel değer |
|---|---|---|
| **Apollo** | Canlı | Prospect search, enrichment, record updates, sequences, performance reporting |
| **Clay** | Canlı | Contact research, enrichment ve Ops tarafından hazırlanan reusable Functions |
| **Common Room** | Canlı | Account intelligence, signals, prospecting, briefs ve record updates |
| **HubSpot** | Remote MCP GA | CRM records, activities, content ve read/write işlemleri |
| **Salesloft + Clari** | Nisan 2026'da duyuruldu; Agentic add-on kullanıcılarına sunuluyor | Live pipeline, calls, accounts, deal activity ve revenue context |
| **Gong** | Duyuruldu, resmi dokümana göre "coming soon" | Account/deal soruları ve structured briefs |
| **Unify** | Public resmi MCP ürünü bulunamadı | API ve outbound orchestration sunuyor |
| **11x** | Public resmi MCP ürünü bulunamadı | Kendi AI sales agentları ve execution sistemi içinde çalışıyor |

Bu tablo iki şeyi gösteriyor:

1. **MCP yapmak artık yenilik değil, dağıtım beklentisine dönüşüyor.**
2. **LeadAC'in fırsatı ilk GTM MCP olmak değil, farklı bir karar verisi açmak.**

Apollo ve Clay "veriyi ve workflow'u AI konuşmasına getiriyor." Common Room "signal intelligence'ı getiriyor." Gong ve Clari/Salesloft "revenue context'i getiriyor."

LeadAC'in cevaplaması gereken soru:

> "Bu ürünlerin AI'a vermediği, LeadAC'in verebileceği özel karar nedir?"

Cevap:

> **Vertical SaaS ekibinin local business accountlarında hangi operational pattern'ların gerçekten meeting ve closed-won ürettiği.**

---

## 2. Başarılı MCP ürünlerinden ne öğreniyoruz?

## Apollo MCP

### Ne sunuyor?

Apollo MCP, ChatGPT ve Claude gibi AI yüzeylerinden:

- İnsan ve şirket aramayı
- Contact bilgisini enrich etmeyi
- Contact ve account kayıtları oluşturmayı veya güncellemeyi
- Prospectleri sequence'e eklemeyi
- Email, call, meeting ve sequence performansını analiz etmeyi sağlıyor

Apollo'nun positioning'i çok net:

> AI chat çalışma alanı olarak kalır, Apollo system of record ve execution katmanı olarak kalır.

### Kullanıcı neden bağlıyor?

Apollo'nun yayınladığı 42.000 tool call analizinde en çok kullanılan workflow'lar şunlar:

- Bulk contact enrichment
- Domain üzerinden company ve contact bulma
- Job function headcount araştırması
- Email reveal
- CRM account oluşturma
- Lead qualification ve tagging
- Data coverage audit
- Domain bazlı şirket arama ve deduplication
- Scheduled enrichment
- Email ve activity performance reporting

Apollo'nun kendi verisine göre kullanıcıların yaklaşık üçte biri Apollo uygulamasını hiç açmadan bütün Apollo workflow'unu Claude veya ChatGPT içinden yapıyor. Kullanıcıların %30'u ise Apollo'yu Claude üzerinden keşfeden yeni müşteriler.

Bu rakamlar Apollo'nun kendi yayınladığı, bağımsız doğrulanmamış ürün verileridir. Yine de MCP'nin yalnızca retention değil, acquisition kanalı olabileceğini gösterir.

### LeadAC için ders

- Kullanıcılar MCP'yi büyük ve soyut "agent" projeleri için değil, günlük ve sık tekrar eden işler için kullanıyor.
- En güçlü mesaj "MCP'miz var" değil, "işini yaptığın yerde LeadAC çalışır" mesajı.
- Apollo'nun yaptığı search, enrichment ve sequence execution alanlarında LeadAC'in tekrar ürün geliştirmesi gereksiz.
- LeadAC, Apollo'nun öncesindeki kararı üretmeli: **Apollo'da kimi aramalıyız?**

Kaynaklar: [Apollo MCP](https://www.apollo.io/product/mcp), [Apollo'nun 42K query analizi](https://www.apollo.io/magazine/the-top-10-use-cases-of-apollo-mcp-based-on-42k-queries), [Apollo GTM workflow rehberi](https://knowledge.apollo.io/hc/en-us/articles/45119679436557-Use-Apollo-with-AI-Tools-to-Run-Your-GTM-Workflow)

---

## Clay MCP

### Ne sunuyor?

Clay, AI konuşması içinde:

- İnsan bulma ve enrich etme
- Account research
- Personalized outreach taslağı hazırlama
- Clay'in 150'den fazla veri sağlayıcısından bilgi kullanma
- Ops ekibinin hazırladığı Clay Functions'ı çalıştırma

Clay Functions, bu araştırmadaki en önemli benchmarklardan biri.

Ops ekibi bir workflow'u bir kez hazırlıyor:

- ICP scoring
- Company enrichment waterfall
- Account research
- Outbound message generation
- Sequence'e gönderme

Sonra bu workflow'u MCP için açıyor. Rep, Clay'e girmeden Claude veya ChatGPT'den tek prompt ile çalıştırabiliyor.

Clay ayrıca:

- Function bazında izin
- Kullanıcı başına aylık credit limiti
- Team default credit limiti
- Kullanım takibi
- Salesforce account ownership scope'u

sunuyor.

### Kullanıcı neden bağlıyor?

Clay'in resmi rehberi MCP'yi küçük batch ve ad-hoc işler için konumluyor:

- Claude veya ChatGPT: 1-20 contact, exploratory research, ad-hoc planning, individual email
- Clay platformu: 20+ contact, complex automation, deep CRM integration

Bu ayrım çok önemli. MCP her bulk workflow'un yeni çalışma alanı değildir.

### LeadAC için ders

- LeadAC'in içerideki karmaşık workflow'u kullanıcıya tek bir yüksek seviyeli tool olarak sunulmalı.
- MCP kullanıcıya kolay giriş verir; büyük account taraması LeadAC'in backend ve `agent-runs` altyapısında çalışmalıdır.
- Usage budget ve admin control, sonradan eklenecek enterprise özellikleri değil, ürünün güven katmanıdır.
- İleride LeadAC de manager veya RevOps'un takım için "approved playbook" açmasına izin verebilir.

Örnek:

```text
Ahmet Success Pattern

- Son 30 günlük Ahmet başarı pattern'larını kullan
- Sadece UK restoran accountlarını değerlendir
- Minimum evidence freshness: 30 gün
- Maksimum 50 account döndür
```

Bu playbook, bütün rep'ler tarafından MCP içinden çağrılabilir.

Kaynaklar: [Clay MCP settings](https://university.clay.com/docs/mcp-settings), [Clay in Claude](https://university.clay.com/docs/using-clay-in-claude), [Clay in ChatGPT](https://university.clay.com/docs/using-clay-in-chatgpt), [Clay MCP kullanım sınırı](https://university.clay.com/lessons/best-practices-for-clay-in-chatgpt)

---

## Common Room MCP

### Ne sunuyor?

Common Room, LeadAC'e en yakın güncel MCP benchmarkıdır.

Common Room MCP:

- Account research
- Contact research
- Call preparation
- Signal bazlı prospecting
- Personalized outreach composition
- Contact, organization, segment, activity ve note oluşturma
- Existing contact ve organization güncelleme

sunuyor.

Account brief içinde:

- Company snapshot
- Engaged contacts
- Product activity
- Community signals
- Intent data
- Open opportunities
- AI sourced research

bir araya getiriliyor.

Prospecting workflow'larında kullanıcı:

> "Top 10 müşterime benzeyen şirketleri bul."

veya:

> "Son 30 günde engagement'ı düşen enterprise accountları göster."

gibi sorular sorabiliyor.

### Tool tasarımı nasıl?

Common Room çok sayıda görev bazlı tool yerine beş generic tool açıyor:

- `commonroom_get_catalog`
- `commonroom_list_objects`
- `commonroom_create_object`
- `commonroom_update_object`
- `commonroom_submit_feedback`

Ürünün detaylı account research ve prospecting kabiliyeti, generic query tool'larının arkasında çalışıyor.

### LeadAC için ders

Common Room, LeadAC için doğrudan rekabet riskidir. Çünkü signal bazlı research, account scoring, similar customer ve outreach alanlarında güçlü bir MCP yüzeyi sunuyor.

LeadAC şu konularda net şekilde ayrışmalı:

- Local business operational signal library
- Vertical SaaS kullanımına özel account intelligence
- Closed-won ve closed-lost sonuçlarından öğrenme
- Rep ve takım seviyesinde başarılı satış pattern'larını çıkarma
- Her account için "why now" ve "neden bu workspace için?" açıklaması

Generic `list_objects` benzeri bir tool esnektir, fakat LeadAC'in özel değerini görünmez yapabilir. LeadAC'in ilk tool'ları ürünün kararını isimlerinde taşımalıdır.

`find_priority_accounts`, `analyze_outcome_patterns` ve `explain_account_priority` bu yüzden generic `search_accounts` tool'undan daha değerlidir.

Kaynak: [Common Room MCP Server docs](https://www.commonroom.io/docs/using-common-room/mcp-server/)

---

## Gong MCP

### Ne sunuyor?

Gong'un resmi dokümanına göre MCP server "coming soon" durumunda ve yalnızca üç read-only tool açmayı planlıyor:

- `ask_account`
- `ask_deal`
- `generate_brief`

`ask_account` ve `ask_deal`, belirli bir account veya deal hakkındaki hedefli soruları cevaplıyor.

`generate_brief`, stakeholder, risk, key theme ve next step gibi alanları içeren yapılandırılmış özet oluşturuyor.

Gong özellikle ham call transcript veya email body döndürmüyor. Kendi conversation intelligence katmanını kullanarak sentezlenmiş insight döndürüyor.

### LeadAC için ders

Gong'un yaklaşımı LeadAC için güçlü bir tasarım doğrulaması:

- İçeride onlarca veri kaynağı ve işlem olabilir.
- Dışarıya yalnızca birkaç yüksek seviyeli insight tool'u açılabilir.
- Kullanıcıya ham memory satmak yerine iş kararına hazır sonuç verilebilir.

LeadAC de ham review, crawl sonucu veya semantic memory satırı dökmemeli.

LeadAC'in Gong'a benzeyen ama pre-pipeline çalışan yüzeyi şu olabilir:

- `ask_account` yerine `explain_account_priority`
- `generate_brief` yerine `get_account_brief`
- Deal intelligence yerine pre-pipeline operational intelligence

Gong ayrıca MCP server ve MCP client'ı birlikte planlıyor. Server, Gong verisini dış AI'a açıyor. Client ise Gong AI Briefer'ın dış MCP serverlardan veri çekmesini sağlıyor.

Bu, LeadAC için ileride ikinci bir fırsat yaratır:

> Gong AI Briefer, LeadAC MCP'den operational account sinyali çekebilir.

Fakat ilk ürün bu enterprise partnership senaryosuna bağlı olmamalı.

Kaynaklar: [Gong MCP server](https://help.gong.io/docs/about-gong-mcp-server), [Gong MCP client](https://help.gong.io/docs/about-gong-mcp-client), [Gong MCP duyurusu](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others)

---

## HubSpot MCP

### Ne sunuyor?

HubSpot'un remote MCP serverı CRM verisini AI araçlarına açıyor.

Read access:

- Contacts
- Companies
- Deals
- Tickets
- Users
- Products, invoices, subscriptions ve başka CRM records
- Calls, emails, meetings, notes ve tasks
- Campaigns ve web content

Write access:

- Contacts, companies, deals, tickets, line items ve products
- Calls, emails, meetings, notes ve tasks

HubSpot mevcut kullanıcı yetkilerini MCP çağrılarına da uyguluyor.

HubSpot dokümanı ayrıca önemli bir sınırı açıkça belirtiyor: Remote MCP server CRM Search API üstünde çalışıyor ve şu anda vector search içermiyor.

### LeadAC için ders

- LeadAC, generic CRM access ile yarışmamalı.
- HubSpot veri kaynağı ve execution yüzeyi olabilir; LeadAC karar katmanı olmalı.
- LeadAC'in MCP cevabı, HubSpot'un kendisinin kolayca üretemediği operational ve semantic sonuçları taşımalı.
- HubSpot MCP + LeadAC MCP aynı prompt içinde çalışabilir.

Örnek:

```text
LeadAC'ten bu hafta aranması gereken en iyi 20 accountu bul.
HubSpot'tan account owner ve açık task durumlarını kontrol et.
Henüz taskı olmayanlar için takip taskı oluştur.
```

İlk LeadAC sürümünde HubSpot taskı oluşturmak için LeadAC'in tekrar HubSpot write tool'u açması gerekmeyebilir. Host doğrudan HubSpot MCP'yi kullanabilir.

Kaynaklar: [HubSpot remote MCP](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server), [HubSpot Spring 2026 Spotlight](https://developers.hubspot.com/changelog/spring-2026-spotlight)

---

## Salesloft + Clari MCP

### Ne sunuyor?

Salesloft ve Clari, Nisan 2026'da MCP serverlarını live revenue intelligence'ı dış AI araçlarına açan bir yüzey olarak duyurdu.

Açılan context:

- Pipeline movement
- Deal activity
- Customer interactions
- Calls
- Accounts
- Forecast ve revenue signals

Ürün tezi:

> Revenue insight, bulunduğu yerde kalmamalı; execution'a dönüşmeli ve diğer AI araçları tarafından kullanılabilmeli.

Salesloft MCP, Agentic add-on kullanan Salesloft kullanıcılarına sunuluyor ve admin tarafından açılıyor.

### LeadAC için ders

Salesloft/Clari'nin yönü, "memory ve context katmanı" positioning'ini doğruluyor. Fakat onların odağı enterprise pipeline ve mevcut deal'lardır.

LeadAC'in alanı daha erken başlıyor:

- Henüz opportunity olmayan accountlar
- Local business operational sinyalleri
- Hangi accountun ilk kez aranacağı
- Hangi pattern'ın yeni listeyi şekillendirmesi gerektiği

Net fark:

> **Clari/Salesloft, pipeline'da ne olduğunu ve ne yapılması gerektiğini bilir; LeadAC, pipeline'a hangi accountların girmesi gerektiğini ve nedenini bilir.**

Kaynaklar: [Salesloft + Clari MCP duyurusu](https://www.salesloft.com/company/newsroom/clari-salesloft-forecasting-execution-mcp-server), [Salesloft Nisan 2026 release notes](https://champions.salesloft.com/product-updates/april-2026-release-notes-566)

---

## SaaS dışı güçlü tasarım benchmarkları

GTM ürünleri use case'i gösteriyor. Diğer güçlü MCP ürünleri ise serverın nasıl güvenli ve kullanılabilir tasarlanacağını gösteriyor.

| Ürün | Tasarım kararı | LeadAC için ders |
|---|---|---|
| **Linear** | Remote, OAuth 2.1, object bulma/oluşturma/güncelleme | Bağlantı basit ve merkezi yönetilen remote server olmalı |
| **Notion** | Search, fetch ve content CRUD tool'ları birlikte çalışıyor | Küçük ve composable tool'lar multi-step workflow oluşturabilir |
| **Stripe** | OAuth, granular permissions, sandbox/live ayrımı, insan onayı uyarısı | Para veya external action gibi riskli write işlemleri ayrı korunmalı |
| **GitHub** | Kullanıcı toolset gruplarını açıp kapatabiliyor | Bütün tool'ları her kullanıcıya vermek yerine allow-list kullanılmalı |
| **Supabase** | Feature groups, `read_only=true`, project scope | Read-only ve workspace scope ürün seviyesinde görünür seçenek olmalı |

### En önemli tasarım sonucu

LeadAC'in ilk sürümü:

- Remote ve OAuth tabanlı olmalı.
- Workspace'e kesin şekilde scope edilmeli.
- Varsayılan olarak read-only olmalı.
- Tool sayısı küçük tutulmalı.
- Her tool açık safety annotation taşımalı.
- Kullanım ve maliyet görünür olmalı.

Kaynaklar: [Linear MCP](https://linear.app/docs/mcp), [Notion MCP](https://developers.notion.com/guides/mcp/overview), [Stripe MCP](https://docs.stripe.com/mcp), [GitHub MCP Server](https://github.com/github/github-mcp-server), [Supabase MCP](https://supabase.com/mcp)

---

## 3. Benchmarklardan çıkan ortak pattern'lar

## Insight 1: Kullanıcı MCP satın almıyor, bitmiş workflow satın alıyor

Hiçbir güçlü ürün ana mesajını "JSON-RPC destekli MCP server" olarak vermiyor.

Verdikleri sözler:

- Apollo: AI chat içinde prospect bul ve outreach başlat.
- Clay: Ops'un hazırladığı workflow'u rep tek prompt ile kullansın.
- Common Room: Accountu araştır, call'a hazırlan ve doğru prospecti bul.
- Gong: Deal veya account hakkında güvenilir insight al.
- Salesloft/Clari: Revenue context'i insight'tan action'a taşı.

LeadAC de şu şekilde anlatılmalı:

> "Claude'a bugün kimi araman gerektiğini sor. LeadAC, workspace'inde neyin gerçekten çalıştığına göre cevabı versin."

---

## Insight 2: En güçlü MCP tool'ları ürünün farklılaşmış sonucunu açıyor

Generic CRM ve database MCP'leri object search ve CRUD açıyor.

Intelligence ürünleri ise yüksek seviyeli sonuç açıyor:

- Gong: `ask_deal`, `generate_brief`
- Clay: Ops tarafından hazırlanan Functions
- Common Room: Kullanımda structured account brief ve signal prospecting

LeadAC'in farklılaşmış sonuçları:

- Prioritized account list
- Why-now explanation
- Similar wins ve losses
- Workspace playbook
- Outcome pattern analysis

Bu sonuçlar tool ismine ve output schema'ya yansımalı.

---

## Insight 3: MCP küçük batch ve ad-hoc kararlar için çok güçlü

Clay'in resmi sınırı, AI chat'i 1-20 contact ve exploratory işler için öneriyor. Daha büyük workflow'ları Clay platformuna yönlendiriyor.

LeadAC kullanıcısı "14.583 accountu konuşma içinde tek tek analiz et" dememeli.

Doğru akış:

1. MCP tool hedefi ve filtreleri alır.
2. LeadAC içeride account universe'ü tarar.
3. Mevcut `agent-runs` ve AI Core sistemi uzun işi yürütür.
4. MCP sonuç olarak kısa listeyi ve kanıtları döndürür.

MCP orchestration yüzeyidir; batch engine değildir.

---

## Insight 4: Governance ve cost control kullanımın ön şartı

MCP, ürün kullanımını AI host'a taşıdığı için maliyet ve izinler görünmez hale gelebilir.

Pazardaki cevaplar:

- Clay: per-user credit budget ve usage monitoring
- Gong: MCP call'ları için credits
- Stripe: granular OAuth ve sandbox/live ayrımı
- Supabase: read-only ve project scope
- GitHub: toolset allow-list

LeadAC şunları ölçmeli:

- Kullanıcı ve workspace bazında tool call
- Tool başına maliyet
- AI ve enrichment kullanım miktarı
- Başarılı/başarısız run
- Kullanılan host
- External write onayı

---

## Insight 5: Directory dağıtımı değerlidir, fakat ürün-market fit yerine geçmez

Apollo'nun vendor-reported verisi Claude'un acquisition kanalı olabileceğini gösteriyor.

Bugün üç önemli discovery yüzeyi var:

- Anthropic Connectors Directory
- ChatGPT App Directory
- Official MCP Registry

Ancak directory'de listelenmek, kullanıcının neden LeadAC'i bağlaması gerektiğini açıklamaz.

Kullanıcı "LeadAC MCP" aramaz. Kullanıcı:

- "Hangi accountları aramalıyım?"
- "Neden bu account yüksek skorlu?"
- "Geçen ay hangi pattern çalıştı?"

sorularının cevabını arar.

Distribution içeriği protokolü değil, bu sonuçları göstermeli.

---

## Insight 6: İlk MCP ürünü read-only başladığında güven daha hızlı oluşuyor

Gong'un planladığı server yalnızca insight döndürüyor ve ham transcript vermiyor. Supabase read-only mode sunuyor. Stripe riskli işlemler için insan onayı öneriyor.

LeadAC'in ilk değeri execution değil, doğru karardır.

Bu yüzden ilk beta:

- CRM değiştirmemeli.
- Sequence'e prospect eklememeli.
- Email göndermemeli.
- Kullanıcı onayı olmadan iş başlatmamalı.

Kullanıcı önce LeadAC'in kararına güvenmeli.

---

## 4. LeadAC'in rekabet alanı

## Ürünlerin MCP üzerinden sahip olduğu alan

| Ürün | MCP üzerinden ana rolü |
|---|---|
| Apollo | Bul, enrich et ve outbound'u çalıştır |
| Clay | Enrichment ve Ops workflow'larını çalıştır |
| Common Room | Signal bazlı account intelligence ve prospecting |
| HubSpot | CRM data ve CRM actions |
| Gong | Conversation ve deal intelligence |
| Salesloft + Clari | Pipeline, forecast ve revenue execution context |
| **LeadAC** | **Operational outcome memory ile hangi accountun neden aranacağına karar ver** |

### LeadAC'in beyaz alanı

LeadAC şu soruların sahibi olmalı:

- Bugün hangi accountları aramalıyım?
- Bu account neden şu anda yüksek priority?
- Bu account geçmişte kazandığımız hangi accountlara benziyor?
- Geçen ay hangi operational sinyaller meeting ve closed-won üretti?
- En başarılı SDR'ın pattern'ını diğer rep'lere nasıl uygularız?
- ICP'miz gerçek sonuçlara göre nasıl değişti?

### En yakın tehdit

**Common Room**, LeadAC'e en yakın doğrudan MCP tehdididir.

Common Room signals, fit score, health score, account briefs ve similar customer workflow'ları sunuyor. LeadAC'in farklılaşması yalnızca "signals" diyerek mümkün değil.

LeadAC'in kanıtlaması gereken fark:

> Common Room accountta ne olduğunu anlatır; LeadAC, bu workspace'te geçmişte neyin kapandığını kullanarak accountun bugün neden aranması gerektiğine karar verir.

Bu fark ürün output'unda görünmüyorsa positioning yalnızca slogan olarak kalır.

### Apollo ve Clay neden hem partner hem rakip?

Apollo ve Clay, LeadAC'in ihtiyaç duyduğu contact ve enrichment altyapısını sağlar.

Fakat ikisi de scoring, qualification, account research ve AI workflow alanına genişliyor.

LeadAC:

- Contact database olmaya çalışmamalı.
- Multi-provider enrichment builder olmaya çalışmamalı.
- Dikey operational sinyaller ve closed-loop outcome learning'de derinleşmeli.

En güçlü ortak workflow:

> **LeadAC karar verir, Apollo bulur ve çalıştırır, HubSpot sonucu kaydeder.**

---

## 5. LeadAC MCP'nin çözmesi gereken gerçek workflow'lar

Her mümkün use case ilk sürüme girmemeli. İlk ürün birkaç sık ve değerli workflow'u çok iyi çözmeli.

## Workflow 1: Bugünün call queue'sunu hazırla

### Kullanıcı sorusu

> "Geçen hafta Ahmet'in başarılı olduğu pattern'lara göre bugün aramam gereken en iyi 30 accountu bul."

### LeadAC'in yaptığı iş

- Ahmet'in son dönem meeting ve opportunity sonuçlarını analiz eder.
- Başarılı account ve outreach pattern'larını çıkarır.
- Workspace ICP ve closed-won memory ile karşılaştırır.
- Güncel operational sinyalleri değerlendirir.
- Accountları sıralar.
- Her accountun neden seçildiğini açıklar.

### Neden güçlü?

- Günlük tekrar eden bir karar.
- LeadAC'in memory tezini doğrudan gösteriyor.
- Sonuç kısa sürede action'a çevrilebilir.
- Apollo ve HubSpot MCP ile kolayca birleşebilir.

### İlk ürün önceliği

**P0: Hero workflow**

---

## Workflow 2: Bu accountu neden aramalıyım?

### Kullanıcı sorusu

> "Bella Vista neden 98 priority score aldı ve hangi kanıtlar bu skoru destekliyor?"

### LeadAC'in yaptığı iş

- Pozitif ve negatif score faktörlerini gösterir.
- Güncel operational sinyalleri listeler.
- Benzer wins ve losses getirir.
- Eksik veya eski veriyi belirtir.
- Accountun hangi koşulda daha yüksek veya düşük priority olacağını açıklar.

### Neden güçlü?

Score tek başına güven üretmez. Açıklama, rep'in accounta inanmasını ve doğru konuşma açısını seçmesini sağlar.

### İlk ürün önceliği

**P0**

---

## Workflow 3: Account brief ve call prep

### Kullanıcı sorusu

> "Yarınki Bella Vista görüşmesi için bana iki dakikalık brief hazırla."

### LeadAC'in yaptığı iş

- Account snapshot
- Operational pain
- Review ve website sinyalleri
- Benzer won accountlar
- Muhtemel objections
- En iyi opener angle
- Recommended next action

döndürür.

### Neden güçlü?

LeadAC'te bu output'u destekleyen intelligence workerları ve brief altyapısı zaten bulunuyor. MCP için uygulanabilir ilk değerlerden biridir.

### İlk ürün önceliği

**P0**

---

## Workflow 4: Geçmiş sonuçlardan yeni ICP çıkar

### Kullanıcı sorusu

> "Son 90 günlük closed-won ve closed-lost sonuçlarına göre ICP'mizde ne değişti?"

### LeadAC'in yaptığı iş

- Won ve lost account pattern'larını karşılaştırır.
- Hangi signal kombinasyonlarının sonuç ürettiğini gösterir.
- Sample size ve veri kalitesi uyarısı verir.
- Yeni veya zayıflayan ICP pattern'larını önerir.

### Neden güçlü?

LeadAC'in "remembers what closes" tezinin en saf halidir. Manager ve RevOps için değerlidir.

### İlk ürün önceliği

**P0/P1:** Yeterli outcome datası olan design partnerlarla beta

---

## Workflow 5: En iyi rep pattern'ını takıma dağıt

### Kullanıcı sorusu

> "Ahmet'in son 30 gündeki başarılı pattern'ını çıkar ve Mike'ın territory'sindeki uygun accountları bul."

### LeadAC'in yaptığı iş

- Rep-specific performance pattern çıkarır.
- Pattern'ı hedef territory'ye uygular.
- Seçilen accountlar için nedenleri gösterir.

### Neden güçlü?

En iyi SDR'ın bilgisinin kişide kalması pain point'ini doğrudan çözer.

### İlk ürün önceliği

**P1:** Rep attribution ve yeterli hacim doğrulandıktan sonra

---

## Workflow 6: Outreach hazırlama

### Kullanıcı sorusu

> "Bu account için email yaz."

### LeadAC'in yapması gereken

LeadAC doğrudan generic email yazmaktan önce:

- En güçlü evidence
- Why-now
- Benzer win
- Önerilen pitch angle
- Kaçınılması gereken iddialar

döndürmeli.

Host içindeki Claude veya ChatGPT bu context ile emaili yazabilir.

### Neden ilk ürün değil?

- Apollo, Clay, Common Room ve birçok host zaten outreach yazıyor.
- Generic copywriting LeadAC'in farklılaşmış değeri değil.
- LeadAC'in görevi doğru bağlamı ve kararı vermek.

### İlk ürün önceliği

**P2 veya hiç ayrı tool olmayabilir**

---

## 6. Önerilen V1 tool seti

## Tool 1: `find_priority_accounts`

### Görevi

Belirli bir hedefe göre workspace'teki en yüksek priority accountları bulur.

### Örnek input

```json
{
  "objective": "book_meetings",
  "limit": 30,
  "lookback_days": 30,
  "reference_rep_id": "rep_ahmet",
  "territory": "UK",
  "minimum_evidence_freshness_days": 45
}
```

### Örnek output

```json
{
  "recommendation_summary": "En güçlü pattern review düşüşü ve rezervasyon problemi yaşayan owner-led restoranlar.",
  "accounts": [
    {
      "account_id": "acc_123",
      "name": "Bella Vista London",
      "priority_score": 98,
      "why_now": [
        "Son 45 günde review skoru 0.3 düştü",
        "Mobil rezervasyon problemi tespit edildi"
      ],
      "matched_outcome_patterns": [
        "Ahmet'in son 30 gündeki başarılı segmentine benziyor"
      ],
      "similar_wins_count": 14,
      "recommended_next_action": "call"
    }
  ],
  "evidence_window": {
    "from": "2026-05-05",
    "to": "2026-06-04"
  },
  "run_id": "run_123"
}
```

### Neden ayrı tool?

Bu LeadAC'in hero ürünüdür. Tool adı doğrudan kullanıcı sonucunu anlatır.

---

## Tool 2: `get_account_brief`

### Görevi

Tek bir account için kanıtlı ve güncel account intelligence brief döndürür.

### Input

- `account_id` veya domain
- Objective
- İsteğe bağlı freshness threshold

### Output

- Account snapshot
- Fit ve opportunity değerlendirmesi
- Operational signals
- Pain points
- Similar wins/losses
- Suggested talking points
- Risks ve missing data
- Evidence citations

### Neden ayrı tool?

Brief, birden fazla iç workerın sonucunu tek ürün output'unda toplar. Gong'un `generate_brief` yaklaşımı bu tasarımı doğruluyor.

---

## Tool 3: `explain_account_priority`

### Görevi

Bir accountun neden yüksek veya düşük priority olduğunu açıklar.

### Output

- Positive factors
- Negative factors
- Why-now signals
- Similar wins
- Similar losses
- Missing evidence
- Score freshness
- Confidence band
- Counterfactual: "Hangi veri değişirse score değişir?"

### Neden ayrı tool?

Kullanıcıların skora güvenmesi için score'un açıklanması gerekir. Bu tool, LeadAC'i black-box lead scoring ürününden ayırır.

---

## Tool 4: `analyze_outcome_patterns`

### Görevi

Workspace'in gerçek sonuçlarından çalışan ve çalışmayan pattern'ları çıkarır.

### Input

```json
{
  "outcome": "meeting_booked",
  "lookback_days": 90,
  "scope": "team",
  "segment": "restaurants"
}
```

### Output

- Winning patterns
- Losing patterns
- Sample size
- Pattern'ın gözlendiği dönem
- Uplift yalnızca hesaplanabiliyorsa
- Supporting accounts
- Data quality ve confidence uyarıları
- Recommended playbook changes

### Kritik kural

Yeterli veri yoksa tool kesin iddia üretmemeli:

```text
Bu pattern için güvenilir sonuç çıkarmaya yetecek sample size bulunmuyor.
```

### Neden ayrı tool?

LeadAC'in memory positioning'ini doğrudan ürünleştirir.

---

## Tool 5: `get_workspace_playbook`

### Görevi

Workspace'in güncel ve öğrenilmiş satış playbook'unu döndürür.

### Output

- Current ICP definition
- Strongest operational signals
- Disqualifying patterns
- Recent pattern changes
- Best-performing pitch angles
- Evidence coverage
- Last updated date

### Neden tool, neden resource değil?

MCP resource desteği hostlar arasında aynı seviyede değil. İlk sürümde tool olarak sunmak daha tutarlı kullanım sağlar. İleride aynı veri resource olarak da açılabilir:

```text
leadac://workspace/playbook
```

---

## Utility: async run sonucu

`find_priority_accounts` gibi uzun işler doğrudan konuşma süresinde tamamlanmayabilir.

MCP katmanı mevcut LeadAC `agent-runs` sistemini kullanmalı:

- Hızlıysa sonuç doğrudan dönmeli.
- Uzunsa `run_id`, status ve estimated completion dönmeli.
- Client task desteği yeterli değilse `get_analysis_run` gibi utility tool kullanılmalı.

İçeride yeni bir AI queue kurulmamalı.

---

## Mevcut LeadAC altyapısına uyumu

Önerilen MCP ürününü sıfırdan ayrı bir intelligence sistemi olarak kurmak gerekmiyor.

Mevcut LeadAC altyapısındaki parçalar MCP tool'larının motoru olabilir:

| MCP tool | Mevcut LeadAC altyapısında kullanılabilecek parçalar |
|---|---|
| `find_priority_accounts` | Opportunity ve ICP scoring, workspace memory, account evidence, `agent-runs` |
| `get_account_brief` | `LEAD_DOSSIER_GENERATOR`, `LEAD_INTELLIGENCE_BRIEF` ve upstream intelligence workerları |
| `explain_account_priority` | `SALES_OPPORTUNITY_SCORER`, `ICP_SCORER`, evidence ve memory sonuçları |
| `analyze_outcome_patterns` | `OUTCOME_ATTRIBUTOR`, workspace-scoped semantic memory ve CRM outcomes |
| `get_workspace_playbook` | Workspace context, positive/negative memory ve recent outcomes |

Bu araştırmadan çıkan teknik yön:

> **MCP server, mevcut AI Core ve worker sisteminin üstünde ince bir façade olmalı; business logic MCP handlerların içine taşınmamalı.**

MCP katmanında esas yeni işler:

- OAuth ve MCP client session yönetimi
- Authenticated kullanıcıdan doğru `workspaceId` çözme
- Tool input/output schema'ları
- Safety annotation'ları
- Audit ve usage logları
- Tool çağrısını mevcut service veya `agent-runs` akışına yönlendirme
- Sonucu MCP host için kısa ve yapılandırılmış biçime çevirme

---

## V2 write tool'ları

Read-only kullanım doğrulandıktan sonra şu tool'lar düşünülebilir:

| Tool | Amaç | Not |
|---|---|---|
| `save_priority_list` | Sonucu LeadAC içinde kaydet | İlk güvenli write tool olabilir |
| `sync_account_brief_to_crm` | Brief'i mevcut CRM kaydına yaz | Kullanıcı onayı gerekir |
| `create_call_queue` | Seçilen accountlardan call queue oluştur | Limit ve dry-run gerekir |
| `record_recommendation_feedback` | Kullanıcının doğru/yanlış feedback'ini kaydet | Memory kalitesini geliştirir |

İlk aşamada eklenmemesi gereken write tool:

- `send_outreach`
- `add_accounts_to_sequence`
- Generic CRM create/update

Bu işler Apollo veya HubSpot MCP ile yapılabilir. LeadAC karar katmanı olarak kalmalıdır.

---

## 7. Açılmaması gereken tool'lar

## Her internal workerı ayrı MCP tool yapmak

LeadAC içinde website auditor, review analyst, scorer ve brief writer gibi çok sayıda worker bulunuyor.

Bunların her birini MCP tool yapmak:

- Modelin tool seçimini zorlaştırır.
- İç mimariyi dış contract'a dönüştürür.
- Worker isimleri değiştikçe MCP'yi kırar.
- Kullanıcıyı LeadAC'in kararından uzaklaştırır.

İçeride 20 worker olabilir. Dışarıda 5 ürün tool'u yeterlidir.

## Generic `search_accounts`

Apollo, HubSpot ve Common Room zaten generic search sunuyor.

LeadAC'in search tool'u ancak operational ve outcome-aware karar üretiyorsa değerlidir. Bu yüzden isim `find_priority_accounts` olmalı.

## Generic `generate_outreach`

AI host zaten yazı yazabiliyor. LeadAC'in farkı writing değil, grounded context.

## Raw memory access

`search_semantic_memory` veya `write_memory` gibi tool'lar:

- İç veri modelini açar.
- Güvenlik ve privacy riskini büyütür.
- Modelin memory'yi yanlış yorumlamasına izin verir.

Memory yalnızca ürün kararlarının içinde kullanılmalıdır.

## İlk günden external execution

Email göndermek veya yüzlerce prospecti sequence'e eklemek, yanlış tool call'ın etkisini büyütür.

Read-only karar güveni oluşmadan execution açılmamalı.

---

## 8. Cold-start problemi

LeadAC'in en güçlü tezi workspace outcome memory'dir. Fakat yeni bir workspace'te yeterli closed-won veya meeting datası olmayabilir.

MCP, bu problemi daha görünür hale getirir. Kullanıcı güçlü bir soru sorar, fakat memory boşsa cevap zayıf olur.

### Önerilen cold-start katmanları

1. **Explicit ICP:** Kullanıcının verdiği ICP ve disqualifier bilgileri
2. **Vertical pack:** LeadAC'in ilgili local-business vertical için bildiği default operational sinyaller
3. **Current account evidence:** Website, reviews, stack, owner activity ve başka observed sinyaller
4. **Workspace outcomes:** Meeting, opportunity, closed-won ve closed-lost sonuçları
5. **Rep-specific outcomes:** Yeterli hacim varsa belirli SDR pattern'ları

Her MCP cevabı hangi katmanı kullandığını açıkça belirtmeli.

Örnek:

```text
Recommendation basis:
- Workspace outcomes: limited, 6 meetings and 2 closed-won
- Vertical pack: strong coverage
- Current operational evidence: 87% fresh within 30 days
```

### Kritik kural

LeadAC, workspace evidence azsa "Ahmet'in başarılı pattern'ı" gibi kesin iddialar üretmemeli.

---

## 9. Positioning önerisi

## Kullanılmaması gereken positioning

> "LeadAC is an MCP server for GTM teams."

Bu cümle teknoloji anlatır, kullanıcı sonucunu anlatmaz.

## Önerilen positioning

> **Ask your AI who to call next. LeadAC answers from what your team actually wins.**

Türkçesi:

> **AI'ına sırada kimi araman gerektiğini sor. LeadAC, ekibinin gerçekten kazandığı pattern'lara göre cevap versin.**

## Stack positioning

> **Apollo finds. Clay enriches. Gong records. LeadAC remembers what closes. MCP puts that memory wherever your team asks the next question.**

## Rakiplere karşı kısa fark

- Apollo: Kimi bulabileceğini söyler.
- Clay: O account hakkında daha fazla veri getirir.
- Common Room: Account sinyallerini ve engagement'ı gösterir.
- Gong: Görüşmelerde ve deal'da ne olduğunu söyler.
- LeadAC: Bu workspace'in geçmiş sonuçlarına göre bugün kimi neden araman gerektiğini söyler.

## Kategori önerisi

LeadAC MCP için en doğru kategori:

> **Operational GTM memory for account prioritization**

"AI SDR" veya "agentic sales platform" positioning'i kullanılmamalı. Bu alan kalabalık ve LeadAC'in özel avantajını zayıflatır.

---

## 10. Distribution stratejisi

MCP'nin distribution fırsatı gerçektir, fakat sıralama önemlidir.

## Aşama 1: Design partner distribution

İlk kullanıcılar directory'den gelmemeli.

LeadAC mevcut veya hedef müşterilerden 5-10 AI-native GTM ekibi seçmeli.

İdeal design partner:

- Günlük Claude veya ChatGPT kullanıyor.
- HubSpot kullanıyor.
- Yeterli account ve outcome datası var.
- 5-30 seller aralığında.
- Local business'a satan vertical SaaS.
- Rep ve manager workflow'unu test etmeye hazır.

Onboarding:

1. LeadAC workspace'i bağla.
2. "Connect to Claude" butonuna bas.
3. OAuth ile giriş yap.
4. Hazır promptlardan birini çalıştır.
5. İlk priority listi al.

İlk activation hedefi:

> Kullanıcı bağlantıdan sonraki ilk 10 dakika içinde gerçek workspace verisiyle `find_priority_accounts` sonucunu görmeli.

---

## Aşama 2: In-product distribution

LeadAC içinde görünür bağlantı yüzeyi olmalı:

- Connect to Claude
- Connect to ChatGPT
- Copy MCP URL
- Connected users
- Last used date
- Tool usage
- Revoke access
- Read-only durumu

Kullanıcı MCP'nin varlığını ayrı developer dokümanından keşfetmek zorunda kalmamalı.

---

## Aşama 3: Anthropic Connectors Directory

Claude, LeadAC için ilk güçlü public distribution kanalıdır.

Anthropic directory submission için remote MCP serverın:

- Production-ready olması
- OAuth kullanması
- Tool safety annotation'larını taşıması
- Privacy policy ve support kanalına sahip olması
- Test account sağlaması
- En az üç örnek use case göstermesi
- Streamable HTTP desteklemesi

gerekiyor.

Directory inclusion:

- One-click connection sağlar.
- Güven sinyali verir.
- Web, desktop, mobile ve Claude Code yüzeylerine erişim sağlayabilir.

Fakat Anthropic bütün başvuruları kabul edeceğini veya cevaplayacağını garanti etmiyor.

Kaynaklar: [Anthropic Connectors Directory FAQ](https://support.anthropic.com/en/articles/11596036-anthropic-connectors-directory-faq), [Remote MCP submission guide](https://support.claude.com/en/articles/12922490), [Anthropic MCP Directory Policy](https://support.anthropic.com/en/articles/11697096-anthropic-mcp-directory-policy)

---

## Aşama 4: ChatGPT App Directory

ChatGPT distribution için yalnızca raw MCP URL vermek yerine Apps SDK ile directory-ready deneyim hazırlanmalı.

OpenAI review sürecinde:

- Verified developer account
- Çalışan MCP server
- Net test cases
- Doğru safety annotations
- Minimum gerekli PII
- Privacy policy
- Web ve mobile testleri

önemli.

ChatGPT app içinde LeadAC sonuçları basit kartlarla gösterilebilir:

- Priority account card
- Why-now evidence
- Similar wins
- Save list action

İlk V1'de UI şart değildir. Fakat public directory distribution için güçlü bir ikinci aşamadır.

Kaynaklar: [ChatGPT App Directory submission](https://help.openai.com/en/articles/20001040-submitting-apps-to-the-chatgpt-app-directory), [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)

---

## Aşama 5: Official MCP Registry

Official MCP Registry:

- Public MCP server metadata'sını yayınlar.
- DNS verification sağlar.
- MCP client ve aggregatorların serverı keşfetmesine izin verir.
- Şu anda preview durumundadır.

LeadAC registry'de listelenmeli, fakat registry ana acquisition kanalı olarak görülmemeli.

Registry listing teknik discoverability verir. Kullanıcı talebi ve trust için Claude ve ChatGPT directory'leri daha değerlidir.

Kaynak: [Official MCP Registry](https://modelcontextprotocol.io/registry/about)

---

## Workflow içerikleriyle distribution

LeadAC "MCP serverımız çıktı" diye launch etmemeli.

Şu workflow'ları gösteren kısa içerikler yayınlamalı:

- Claude + LeadAC: Bugünün call queue'sunu hazırla
- Claude + LeadAC + Apollo: En iyi accountları bul ve contactları enrich et
- ChatGPT + LeadAC + HubSpot: Won pattern'larına göre priority accountları bul ve task oluştur
- LeadAC: En iyi SDR'ın pattern'ını takıma dağıt
- LeadAC: Son 90 günlük sonuçlara göre ICP'yi yeniden değerlendir

Her içerik:

- Kullanıcı promptu
- LeadAC'in çağırdığı tool
- Dönen kanıt
- Alınan action
- Ölçülen sonuç

göstermeli.

---

## 11. Pricing ve packaging önerisi

İlk aşamada MCP ayrı bir standalone ürün olarak fiyatlandırılmamalı.

Pazardaki modeller:

- Apollo MCP'yi mevcut free ve paid planlara dahil ediyor.
- Clay mevcut credit modelini MCP kullanımına uyguluyor ve kullanıcılara budget veriyor.
- Gong MCP ve API çağrılarını aynı credit sistemiyle ölçüyor.
- Salesloft MCP'yi Agentic add-on ile sunuyor.

### LeadAC için öneri

- Read-only MCP access mevcut paid planların içinde sunulsun.
- Kullanım mevcut AI/research quota'sından düşsün.
- Kullanıcı ve workspace bazında limit görünür olsun.
- İlk design partnerlarda limitler yüksek tutulsun, kullanım öğrenilsin.
- External write ve admin governance özellikleri ileride üst paket özelliği olabilir.

MCP'nin ilk işi doğrudan yeni ücret yaratmak değil:

- Activation
- Retention
- Product usage
- Distribution
- LeadAC memory'nin daha sık kullanılması

yaratmak olmalı.

---

## 12. 90 günlük MVP planı

## Gün 1-15: Problem ve workflow doğrulama

### Yapılacaklar

- 5-10 design partner seç.
- Her partnerdan gerçek 20 soru topla.
- Soruları kategoriye ayır:
  - Daily prioritization
  - Account explanation
  - Account brief
  - Outcome analysis
  - Rep pattern transfer
- Mevcut LeadAC verisinin cevap kalitesini ölç.
- Cold-start workspacelerde hangi soruların cevaplanamadığını belirle.

### Çıktı

- İlk tool sözleşmeleri
- 50-100 promptluk evaluation seti
- Baseline cevap kalitesi
- İlk beta müşteri listesi

---

## Gün 16-45: Private read-only beta

### Yapılacaklar

- Remote Streamable HTTP MCP endpoint
- OAuth ve workspace-scoped authorization
- İlk dört tool:
  - `find_priority_accounts`
  - `get_account_brief`
  - `explain_account_priority`
  - `analyze_outcome_patterns`
- Structured output schema
- Audit log ve usage metrikleri
- Long-running işler için mevcut `agent-runs` entegrasyonu
- Claude bağlantı rehberi ve one-click onboarding

### Çıktı

- 5 workspace private beta
- Read-only çalışan production benzeri server
- Gerçek kullanıcı tool call kayıtları

---

## Gün 46-70: Kalite ve kullanım iyileştirme

### Yapılacaklar

- Tool açıklamalarını gerçek çağrılara göre düzelt.
- Yanlış tool selection vakalarını analiz et.
- Evidence ve freshness output'unu iyileştir.
- Low-data durumları için açık fallback ekle.
- Per-user ve workspace usage limitleri ekle.
- `get_workspace_playbook` tool'unu ekle.
- Claude ve ChatGPT davranış farklarını test et.

### Çıktı

- Stabil V1 tool seti
- Tool success ve latency dashboardu
- Kalibre edilmemiş confidence iddialarının kaldırılması
- Admin usage görünürlüğü

---

## Gün 71-90: Distribution hazırlığı

### Yapılacaklar

- Privacy policy ve MCP security docs
- Test workspace ve sample data
- En az üç resmi workflow örneği
- Anthropic Directory submission
- Official MCP Registry listing
- ChatGPT App Directory için Apps SDK prototipi
- "Claude + LeadAC + Apollo" workflow launch içeriği

### Çıktı

- Public beta
- Directory başvuruları
- İlk case study
- V2 write tool kararı

---

## 13. Başarı metrikleri

MCP başarısı yalnızca tool call sayısı değildir.

## Activation

- Bağlanan workspace sayısı
- Bağlantıdan ilk başarılı tool call'a geçen süre
- İlk hafta `find_priority_accounts` çalıştıran kullanıcı oranı
- İlk sonucu gören kullanıcı oranı

## Retention

- Weekly active MCP user
- Haftalık tekrar kullanan workspace oranı
- Kullanıcı başına haftalık karar workflow'u
- LeadAC uygulamasına girmeden tamamlanan workflow oranı

## Quality

- Tool call success rate
- Yanlış tool selection oranı
- Evidence coverage
- Fresh data coverage
- Kullanıcı tarafından doğru bulunan recommendation oranı
- Low-data durumlarında doğru uyarı oranı

## Business outcome

- Recommendation'dan action'a dönüşen account oranı
- MCP ile seçilen accountların meeting rate'i
- Baseline listeye göre opportunity lift
- Kullanılan recommendation'ların closed-won katkısı
- MCP üzerinden edinilen yeni LeadAC müşterileri

## Önerilen go/no-go kriteri

90 gün sonunda şu soruya cevap verilmeli:

> Kullanıcılar LeadAC MCP'yi tekrar tekrar "hangi accountu neden aramalıyım?" kararı için kullanıyor ve bu karar mevcut listeleme yönteminden daha iyi sonuç üretiyor mu?

Cevap hayırsa daha fazla tool veya directory yatırımı yapılmamalı.

---

## 14. Ana riskler

## Risk 1: Product moat yerine protocol launch yapmak

MCP kolay kopyalanır. LeadAC memory ve karar kalitesi zayıfsa MCP yalnızca zayıf ürünü daha görünür yapar.

### Cevap

Önce decision quality ve outcome learning doğrulanmalı.

---

## Risk 2: Common Room ve Clay ile aynı alana kaymak

Generic account research, enrichment ve outreach alanları zaten güçlü rakiplere sahip.

### Cevap

Tool isimleri ve output'lar outcome memory ve operational prioritization'a sabitlenmeli.

---

## Risk 3: Yetersiz outcome datasıyla güçlü iddialar üretmek

Az sayıda meeting veya closed-won ile "bu pattern %94 güvenilir" demek kullanıcı güvenini kaybettirir.

### Cevap

Sample size, data coverage, freshness ve uncertainty her cevapta görünmeli.

---

## Risk 4: MCP'yi bulk engine gibi kullanmak

Binlerce accountu konuşma içinde işlemek yavaş, pahalı ve hataya açıktır.

### Cevap

MCP sadece işi başlatmalı ve sonucu sunmalı; ağır işlem LeadAC'in mevcut backend sisteminde çalışmalı.

---

## Risk 5: External write işlemlerini erken açmak

Yanlış tool call yüzlerce prospecti sequence'e ekleyebilir veya CRM verisini değiştirebilir.

### Cevap

Read-only beta, explicit confirmation, dry-run, limit ve audit log.

---

## Risk 6: Directory listing'i distribution sanmak

Directory'de olmak kullanıcıların LeadAC'e ihtiyaç duyacağı anlamına gelmez.

### Cevap

Workflow-led launch, design partner sonuçları ve measurable case study.

---

## 15. Nihai öneri

LeadAC MCP yapılmalı ve mevcut ürün planında yüksek öncelik almalı. Fakat proje teknik bir entegrasyon olarak değil, LeadAC'in karar ürününü dış AI yüzeylerine taşıyan yeni bir kullanım ve distribution kanalı olarak yönetilmeli.

### İlk ürün

Remote, OAuth tabanlı, workspace-scoped ve read-only MCP server.

### İlk platform

Claude.

### İlk kullanıcı

Günlük işini Claude veya ChatGPT içinde yapan founder, SDR manager ve RevOps kullanıcısı.

### İlk hero workflow

> "Geçmiş başarı pattern'larına göre bugün aramam gereken en iyi accountları bul ve nedenlerini açıkla."

### İlk tool seti

- `find_priority_accounts`
- `get_account_brief`
- `explain_account_priority`
- `analyze_outcome_patterns`
- `get_workspace_playbook`

### İlk distribution yöntemi

Design partner beta, ardından Anthropic Connectors Directory ve ChatGPT App Directory.

### Yapılmaması gereken

Apollo ve Clay ile contact search/enrichment yarışına girmek, bütün internal workerları MCP tool yapmak veya ilk günden otonom outreach execution açmak.

### Net positioning

> **LeadAC MCP, workspace'in operational memory'sini ve neyin gerçekten satış getirdiğini AI araçlarına açar.**

### Net stack rolü

> **LeadAC karar verir. Apollo ve HubSpot uygular. MCP bunları aynı konuşmada bir araya getirir.**

---

## Kaynaklar

### GTM MCP ürünleri

- [Apollo MCP](https://www.apollo.io/product/mcp)
- [Apollo MCP: Top 10 use cases based on 42K queries](https://www.apollo.io/magazine/the-top-10-use-cases-of-apollo-mcp-based-on-42k-queries)
- [Apollo: Use Apollo with AI tools](https://knowledge.apollo.io/hc/en-us/articles/45119679436557-Use-Apollo-with-AI-Tools-to-Run-Your-GTM-Workflow)
- [Clay MCP settings](https://university.clay.com/docs/mcp-settings)
- [Clay in Claude](https://university.clay.com/docs/using-clay-in-claude)
- [Clay in ChatGPT](https://university.clay.com/docs/using-clay-in-chatgpt)
- [Clay MCP usage boundaries](https://university.clay.com/lessons/best-practices-for-clay-in-chatgpt)
- [Common Room MCP Server](https://www.commonroom.io/docs/using-common-room/mcp-server/)
- [Gong MCP server](https://help.gong.io/docs/about-gong-mcp-server)
- [Gong MCP client](https://help.gong.io/docs/about-gong-mcp-client)
- [Gong MCP announcement](https://www.gong.io/press/gong-introduces-model-context-protocol-mcp-support-to-unify-enterprise-ai-agents-from-hubspot-microsoft-salesforce-and-others)
- [HubSpot remote MCP server](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server)
- [HubSpot Spring 2026 Spotlight](https://developers.hubspot.com/changelog/spring-2026-spotlight)
- [Salesloft + Clari MCP announcement](https://www.salesloft.com/company/newsroom/clari-salesloft-forecasting-execution-mcp-server)
- [Salesloft April 2026 release notes](https://champions.salesloft.com/product-updates/april-2026-release-notes-566)
- [Unify API announcement](https://www.unifygtm.com/blog/introducing-the-unify-api)

### MCP tasarım benchmarkları

- [Linear MCP](https://linear.app/docs/mcp)
- [Notion MCP](https://developers.notion.com/guides/mcp/overview)
- [Notion MCP supported tools](https://developers.notion.com/guides/mcp/mcp-supported-tools)
- [Stripe MCP](https://docs.stripe.com/mcp)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Supabase MCP](https://supabase.com/mcp)

### Distribution

- [Anthropic Connectors Directory FAQ](https://support.anthropic.com/en/articles/11596036-anthropic-connectors-directory-faq)
- [Anthropic Remote MCP Submission Guide](https://support.claude.com/en/articles/12922490)
- [Anthropic MCP Directory Policy](https://support.anthropic.com/en/articles/11697096-anthropic-mcp-directory-policy)
- [Submitting apps to the ChatGPT App Directory](https://help.openai.com/en/articles/20001040-submitting-apps-to-the-chatgpt-app-directory)
- [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)
- [Official MCP Registry](https://modelcontextprotocol.io/registry/about)

---

## Araştırma notu

Bu rapor 4 Haziran 2026 itibarıyla public resmi ürün ve yardım merkezi kaynaklarına göre hazırlanmıştır. Gong MCP resmi dokümanlarda hala "coming soon" olarak işaretlenmiştir. Unify, 11x, Attention ve Scratchpad için bu araştırmada doğrulanabilen public resmi MCP ürün sayfası bulunamamıştır; bu durum ürünlerin private veya henüz duyurulmamış MCP çalışması olmadığı anlamına gelmez.
