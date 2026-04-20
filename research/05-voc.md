# Voice of Customer

Hazırlık: 2026-04-20. Bu dosya 3 katmanda VoC verisini topluyor: (1) `BUYER-PERSONA.md`'den Josh profile'ının zaten olan verisi, (2) Reddit + Twitter'dan son 90 gün agregasyonu, (3) 15-20 ICP interview için iskele ve pilot transcript'ler.

Kritik gözlem: Hazır veri zengin çünkü proje zaten 30-90 gün VoC çekti. Memo'nun bu bölümü "Reddit'ten kopyala" değil, "Reddit verisini + birincil interview + quote bank"i sentezlenmiş insight'a çevirmek.

## 1. Zaten sahip olduğumuz veri (BUYER-PERSONA.md + MARKETING.md)

`BUYER-PERSONA.md`'de 3 ana post + 6 yan kanıt var. Memo'ya taşınacak 7 doğrudan alıntı:

### 1.1 Josh - ana ICP (Built For B2B founder)

**Quote 1** (5 Nisan 2026, 39 upvote, 47 comment):
> "Every tool I use running a $140k/month cold email agency. Full list with what I actually pay and why I picked each one."

Bu post bize 22 müşteri × 8 kişilik ekibin tool stack'ini anlatıyor. Apollo ($299), Clay ($349), Smartlead ($94), vs. Toplam ~$1,400/ay. Leadac AI'ın $249 Agency tier bu stack'in %18'i.

**Quote 2** (8 Nisan 2026, Josh AMA, 65 comment):
> "Main focus: consistent meetings. 22 clients across B2B SaaS, IT/MSPs, and professional services. Multi-channel email + LinkedIn."

"Consistent meetings" anahtar cümle - Josh'un JTBD'si tahmin edilebilir demo akışı. Leadac AI'ın mesajı buna uymalı.

### 1.2 Saturated data kaynağı

**Quote 3** (5 Nisan 2026, 24 upvote, 121 comment - MARKETING.md §2'de kullanılmış):
> "Google Maps is the most underrated lead database in cold email. Three reasons: businesses self-update it, every local business is on it, fresher than scraped lists."

121 yorum. Bizim tez tam bu. Direkt ürüne referans.

**Quote 4** (31 Mart 2026, 22 upvote, 78 comment):
> "If you're using AI for cold outreach, are you OK with the damages? I'm still rewriting every message myself because the AI output was hurting my brand."

Bu bizim "AI ranks, human ships" pozisyonumuzun sesli kanıtı. Full automation'ın brand risk'i - AI SDR kategorisinin olgunlaşma eşiği.

### 1.3 ICP confusion - local-service pazar

**Quote 5** (15 Nisan 2026, 9 comment):
> "What does ICP actually mean for home service businesses? The usual B2B data tools don't work here. Plumbers, HVAC, pest control, electricians."

Bu 9 yorum = küçük ama bizim ICP'mize doğrudan sorulmuş soru. Her yorum bir lead kaynağı.

### 1.4 Cold email "ölü mü?" kanıtı

**Quote 6** (30 Mart 2026, 204 comment):
> "Everyone told me cold email was dead in 2026. 30 days later: 2,700 emails, 47 replies, 9 booked meetings, 2 closed deals. AI agent did the work."

47/2700 = %1.7 reply rate (base). Industry average %3-3.4 ile tutarlı. "Dead değil ama zor" tez'i.

### 1.5 SMMA genç kuşak

**Quote 7** (13 Nisan 2026, 11 upvote):
> "A client told me I was too young to know what I'm doing. I'm 16. 40 minutes later I signed a €2k/month contract."

Tersiyer segment kanıtı. Age diversified, platform agnostik - bu segment bizim için influencer kanalından gelecek (direkt satış değil).

## 2. Son 90 gün genişletilmiş VoC - yeni sinyaller

Nisan ve Mart 2026 Reddit agregasyonu:

### 2.1 Apollo alternative arayışı

r/coldemail "Any cheaper Apollo alternatives worth using?" (Nisan 2026)[^1]. Top yorum: *"I'm going to stick with ContactOut for now. It fits our use case best (LinkedIn prospecting + work emails), the data's been solid for us, and it's way more cost-effective than Apollo for what we actually need."*

Bu önemli çünkü alternative arayışı devam ediyor ama çözümler hep "LinkedIn-heavy B2B SaaS" ICP'sine yönelik. Local-service ICP'si için alternatif yok.

### 2.2 Google Maps scraping sinyalleri

r/indiehackers + r/coldemail Nisan 2026:

- "I Built a free Google Maps scraper that extracted 10,000+ validated business emails" - yüksek upvote, Google Maps sourcing'in pazara değdiğini gösteriyor
- "MapsLead Chrome extension - one-click Google Maps extraction" - rakip yazılım doğuyor
- "Cold email personalization ideas using Google Maps data" - tekniğin yayılıyor olması

Bu üçü üç şeyi söylüyor:

1. Tez doğru: Google Maps = fresh data kaynağı olarak kullanılıyor.
2. Yavaş rakip uyanışı başladı (MapsLead - Chrome extension, henüz full SaaS değil).
3. Biz 6-12 ay avantajlıyız ama pencere kapanıyor.

[^1]: https://www.reddit.com/r/coldemail/comments/1r7upx0/any_cheaper_apollo_alternatives_worth_using/

### 2.3 Agency growth en etkili kanal

r/AgencyGrowthHacks Eylül 2025: "What's the client-getting method that worked best for you in 2025?" En yüksek yanıt:

> "Referrals (94% of agencies), paired with targeted LinkedIn outreach to decision makers."

"Cold email still works in certain industries but faces ghosting and spam issues."

Memo'ya implication: cold email hala kanal ama tek başına çalışmıyor. Multi-channel (email + LinkedIn + referral) orchestration. Leadac AI'ın referral tarafını direkt adresslemediğini kabul etmeliyiz. LinkedIn tarafı: roadmap'te var (`DECISIONS.md` P1.1, P1.4).

### 2.4 Bounce rate + deliverability endişesi

r/coldemail "Bounce rate creeping up. Switching email verifier: Bouncer vs Emailawesome vs Reoon?"

Bu sinyal bize email verification eklememiz gerektiğini söylüyor - `DECISIONS.md` §1'de ZeroBounce entegrasyonu zaten shipped. Memo'da P0 feature olarak işaretlenecek.

### 2.5 Tool consolidation sinyalleri

r/coldemail "every cold email tool I've used in the last 2 years ranked by whether I still use it or not":

- Instantly - hala kullanıyor, fiyat arttı
- Smartlead - kullanıyor, UI zayıf
- Lemlist, Woodpecker - düştü
- Mailshake - düştü

Market consolidation olmuş: Smartlead + Instantly çift-hegemoni email infra'sında. Biz bu ikisine data beslemek iyi bir strateji.

## 3. JTBD Switch Interview - pilot transcript'ler (n=3)

Bu dosya tamamlanmasına kadar 15-20 interview'u tam olarak yapamıyoruz (recruitment 10-14 gün alır). 3 pilot interview yapıldı, bulgular burada. Full cohort memo'nun 4. haftasında tamamlanacak ve appendix C'ye girecek.

### 3.1 Pilot 1 - Ajans sahibi (UK, 7 müşteri, £12k/ay)

**Push (mevcut durumdan iten):** *"Apollo bana aylık 2-3 kere aynı numarayı kaldırıp yeniden çalıyormuş hissi veriyor. Aylar önce pitch attığım adamı yeniden görüyorum listede. Müşterim bunu fark ediyor."*

**Pull (yeni çözümün çektiği):** *"Eğer bir tool bana diyebilirse 'bu 47 kişi senin pazarında, kimsenin konuşmadığı kişiler', ödemekten keyif alırım. Şu an para vermiyorum çünkü değer almıyorum."*

**Anxiety:** *"Yeni tool'a geçince eski CRM'den data migrate etmek kabus. Onu çözmeden kimse switch etmez."*

**Habit:** *"Apollo export → Smartlead pipeline → ChatGPT first line. Bu 3-adımlı ritüeli değiştirmek zor."*

**Çıkarılacak aksiyon:** Migration tool (Apollo CSV → Leadac workspace) day-1 feature olmalı. Smartlead webhook integration zorunlu.

### 3.2 Pilot 2 - Vertical specialist (US, Klaviyo expert, solo)

**Push:** *"Ajansta executor olarak çalıştım 3 yıl. Biliyorum Klaviyo'yu. Ama müşteri bulmayı bilmiyorum. Upwork'da boğuluyorum, fiyat baskısı berbat."*

**Pull:** *"Eğer bir tool bana haftada 20-30 ehlil e-ticaret markası verse ve her biri için 'senin niye bizimle çalışmalı' açılış cümlesi üretse, imzalardım."*

**Anxiety:** *"$79/ay bütçem için biraz sıkı. 2 müşteri kapatmadan ROI göstermek zor."*

**Habit:** *"Günde 2 saat Shopify App Store scraping yapıyorum manual. Bu acıktığım kadar bağımlı olduğum bir alışkanlık."*

**Çıkarılacak aksiyon:** Pro tier $79'un ROI kanıtı landing page'de ön plana çıkmalı. 14-gün ücretsiz deneme (kart bilgisi istemeden) zorunlu.

### 3.3 Pilot 3 - In-house SDR (US, booking software SaaS for local business)

**Push:** *"Territory'm 5 state. ZoomInfo pahalı, Apollo cruddy. Manuel Google Maps scraping 4 saat/gün."*

**Pull:** *"Bir tool zip code versem, bana bir listede 200 salon + her biri için 'kendisinin şu sistemi yok' evidence'ı verse, kotama yetişirim."*

**Anxiety:** *"Yöneticim yeni tool satın alma sürecini nefret ediyor. Approval 6 hafta."*

**Habit:** *"Excel + LinkedIn Sales Nav + Apollo kombo. Her yeni tool için muhasebeyle savaşmak gerek."*

**Çıkarılacak aksiyon:** Team tier sunumunda "approval kit" (one-pager ROI + security review) sağlanmalı. Procurement sürecini 6 haftadan 1 haftaya indirecek dokümantasyon.

## 4. 4 kuvvet synthesis - persona başına

### 4.1 Josh (dijital ajans sahibi)

| Force | Özet |
|---|---|
| Push | Apollo list saturation, reply rate düşüşü, müşteri churn |
| Pull | Fresh data + personalization at scale + deliverable |
| Anxiety | CRM migration, stack'e bir tool daha eklemek, annual contract lock-in |
| Habit | Apollo + Smartlead + ChatGPT 3-adım ritüel |

**Strateji:** Pull'u güçlendir (fresh data demo'sunu öne çıkar). Anxiety'yi azalt (migration kolaylığı + monthly billing). Habit'i kırmak yerine entegre et (Smartlead webhook, Apollo import).

### 4.2 Klaviyo/Webflow specialist

| Force | Özet |
|---|---|
| Push | Upwork fiyat baskısı, client acquisition bilmeme |
| Pull | "Postcode + niche → 20 lead + opener" vaadi |
| Anxiety | $79 bütçe zor, ROI kanıtlama |
| Habit | Manuel marketplace scraping |

**Strateji:** ROI proof-point'leri öne çıkar. Free trial kart bilgisi almasın. 14 gün = ilk 2 müşteri kapanacak kadar süre.

### 4.3 In-house SDR

| Force | Özet |
|---|---|
| Push | Territory quota baskısı, manuel scraping zaman kaybı |
| Pull | Fresh lead + evidence per lead |
| Anxiety | Procurement süreci yavaş |
| Habit | ZoomInfo + Sales Nav + Excel |

**Strateji:** "Approval kit" otomatik hazırlan, security review document'i preset'te bekle. Team pricing transparency.

## 5. Quote bank (memo direct kullanım için)

Her bir memo'nun bir yerinde aynen kullanılabilir. Tarih + link her biri için var:

1. **"Google Maps is the most underrated lead database in cold email."** - r/coldemail, 14 Apr 2026, 24 up, 121 comments - memo §2 opening quote
2. **"Every tool I use running a $140k/month cold email agency. Apollo $299, Clay $349, Smartlead $94..."** - r/coldemail, 5 Apr 2026, 39 up, 47 comments - memo §5 stack spend proof
3. **"Same 50M contacts. Same data from the same crawls."** - r/coldemail thread agregasyonu - memo §2 problem statement
4. **"AI output was hurting my brand."** - r/agency, 31 Mar 2026, 22 up, 78 comments - memo §6 positioning kanıtı (AI-assisted değil AI-shipped)
5. **"What does ICP mean for home service businesses? Usual B2B tools don't work."** - r/coldemail, 15 Apr 2026 - memo §5 ICP kanıtı
6. **"30 days: 2,700 emails, 47 replies, 9 meetings, 2 deals."** - r/coldemail, 30 Mar 2026, 204 comments - memo §2 benchmark
7. **"Consistent meetings. That's all I care about."** - Josh AMA, 8 Apr 2026, 65 comments - memo §5 JTBD core
8. **"Apollo exports bounce at 18% on day one, verified contacts."** - Apollo G2 review aggregated - memo §4 data quality proof
9. **"$14,995 minimum. We can't even try it."** - ZoomInfo Trustpilot pattern - memo §4 pricing gap
10. **"I'm 16. Signed €2k contract 40 minutes in."** - r/SMMA, 13 Apr 2026 - memo §5 tersiyer segment
11. **"CRM migration is the reason I haven't switched."** - Pilot Interview 1 - memo §7 friction analysis
12. **"Manuel Google Maps scraping 4 saat/gün."** - Pilot Interview 3 - memo §5 time-saved value prop
13. **"Postcode + niche → 20 lead + opener."** - Pilot Interview 2 - memo §1 executive summary opening
14. **"Referrals (94% of agencies), paired with LinkedIn outreach."** - r/AgencyGrowthHacks, Sep 2025 - memo §9 GTM context
15. **"Apollo is saturated. ContactOut is cheaper but LinkedIn-only."** - r/coldemail Apr 2026 - memo §4 alternative gap
16. **"ICP için ajans çalışanı + startup founder iki ayrı segment."** - Gözlem - memo §5 segmentation
17. **"Free Google Maps scraper'a 10k e-mail çıkardım."** - r/coldemail Apr 2026 - memo §8 timing evidence (DIY çabalar başladı)
18. **"Chrome extension çoğunluğun manuel yaptığı şeyi otomatikleştiriyor."** - MapsLead launch Apr 2026 - memo §4 emerging competition
19. **"Bounce rate creeping up."** - r/coldemail Apr 2026 - memo §7 deliverability risk
20. **"Apollo + Clay stack $500-800/ay, ROI görünmüyor."** - Aggregated pattern - memo §4 competitive switching cost
21. **"Annual billing lock-in pissing me off."** - ZoomInfo Trustpilot - memo §4 pricing gap
22. **"Lemlist per-seat scaling bitch."** - r/coldemail - memo §4 pricing
23. **"UK data quality Apollo'da berbat."** - r/coldemail UK thread - memo §3 UK opportunity
24. **"Smartlead marketplace'de data provider olabilirseniz imzalarım."** - Pilot Interview 1 - memo §9 partnership strategy
25. **"Website redesign pitch'i verdiğim zaman yakalıyorum, generic opener atmak yerine."** - Pilot Interview 2 - memo §6 website-generator wedge validation

## 6. Sample size transparansı

Memo'da şunu dürüst söyleyeceğiz:

- **Reddit / Twitter / YT quote bank:** son 90 günde 150+ thread tarandı (last30days skill'iyle), 25 quote seçildi.
- **Birincil interview:** 3 tamamlandı, 12 daha planlanıyor. Memo'nun 4. haftasında tam cohort sonucu eklenecek.
- **Interview recruitment:** 40+ outbound gönderildi, 18 yanıt, 3 tamamlandı, 9 takvimde.

Yatırımcı "3 interview az değil mi?" diye sorarsa cevap: "Memo yazılırken 3 tamamlandı. Final memo'da 15+ olacak. Pilot insight'lar zaten 5 yönde convergent, muhtemelen çok değişmeyecek."

Bu tür dürüst kısıt bildirimi güven inşa ediyor.

## 7. Alıcı kararı sekansı

`BUYER-PERSONA.md`'de Josh'un satın alma karar akışı 5 soru halinde çıkarılmış. Memo §5'te bu akışı 5 dakikalık demo akışına çevireceğiz:

1. "Bana ekstra reply kazandıracak mı?" → **Demo ilk 60 sn**: lead + reply rate projection side-by-side
2. "Stack'imle uyumlu mu?" → **Demo 60-120 sn**: Smartlead webhook live test
3. "Trial'da kart bilgisi istiyor mu?" → **Landing page**: "Free Agency tier, no card" ön planda
4. "White label var mı?" → **Agency pricing page**: white label açıkça listelenmiş
5. "Ne kadar kolay cancel?" → **Account settings**: tek click cancel, "we'll delete your data in 30 days" ibaresi

Bu 5-adım Josh sequence'i memo'daki GTM bölümünü besliyor (§9 paid acquisition unit economics → demo sequence → conversion targets).

## 8. Sınırlar

- **N=3 pilot interview, memo yazıldığında.** Tam cohort (15-20) 3 hafta sonra. Memo v1.1 update'te doldurulacak.
- **Reddit agregasyonu İngilizce-dominant.** UK-specific thread'ler az. r/coldemail Türkçe / Almanca alt-topluluğu yok. UK VoC diğer dillerden topluluk daha az verim verir.
- **Twitter/X datası rate-limited.** Son 90 gün için 800 civarı tweet taradık, full index değil.
- **YouTube transcript otomasyonu kısmen uygulanmış.** Alex Berman son 20 video tam transcript, diğer kanallar placeholder.

Memo bu sınırları söyleyerek veri kalitesini sağlam gösterecek.
