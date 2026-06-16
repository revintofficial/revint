# LeadAC'in sales ekibine katabilecegi yuzdesel deger modeli

Date: 2026-06-06  
Scope: FineDine activation meeting, restaurant-tech SDR/BD workflow  
Status: Source-backed planning model, not guaranteed ROI

## 1. Kisa cevap

Bugunku kaynaklara gore LeadAC'in FineDine gibi bir restaurant-tech sales ekibine katabilecegi deger en dogru sekilde tek bir "% ROI" olarak degil, 8 metrikte modellenmeli:

| Metrik | Kaynak destekli minimum | Kaynak destekli maksimum | Guven | Not |
|---|---:|---:|---|---|
| Prospect/account research time azalisi | 15% | 34% | High | Salesforce AI agents 34% research cut beklentisi; McKinsey sales automation selling time +15-20% destekliyor. |
| Email / opener / follow-up drafting time azalisi | 15% | 36% | High | Salesforce 2026: email drafting time -36% beklentisi. |
| Selling/customer-facing time artis | +6 pp | +8 pp | High | 40% selling baseline -> McKinsey +15-20% relative selling-time uplift = 46-48%. |
| Sales process efficiency | 10% | 15% | High | McKinsey early sales automation adopters. |
| Sales uplift / pipeline productivity | 2% | 10% | Medium-high | McKinsey data-driven decisions +2-5%; sales automation uplift potential up to 10%. |
| AI-enabled revenue uplift | 3% | 15% | Medium | McKinsey AI marketing/sales investors; broader than LeadAC, not FineDine-specific. |
| Sales ROI uplift | 10% | 20% | Medium | McKinsey AI marketing/sales investors; mature implementation only. |
| Sales-stage velocity | 5% | 40% | Medium | Gartner 40% faster by 2029 for mature AI-driven enablement; pilot should use lower range. |

Bottom line:

> FineDine pilotu icin en savunulabilir iddia su: LeadAC ilk versiyonda rep research/drafting islerinde 15-34% zaman kazanci, customer-facing time'da 6-8 percentage-point artis ve sales process efficiency'de 10-15% potansiyel yaratabilir. Revenue tarafinda 2-10% pipeline/sales uplift hedeflenebilir, ama bu ancak FineDine outcome datasiyla kanitlanir.

Bu bir garanti degil. Bu, mevcut benchmark'lara dayanarak kurulmus pilot hedef araligidir.

## 2. Metodoloji

Bu model uc seyi ayirir:

1. **Dogru kaynakli benchmark:** Salesforce, McKinsey, Gartner gibi kaynaklarda direkt yuzde var.
2. **LeadAC mekanizmasi:** LeadAC bu benchmark'in hangi parcasi uzerinden etki eder?
3. **FineDine pilot olcumu:** Bu yuzde FineDine'da nasil dogrulanir?

Kullanilan formuller:

```text
Yeni sure = mevcut sure x (1 - beklenen azalis)

Yeni selling time = mevcut selling time x (1 + relative uplift)

Pipeline uplift = baseline pipeline x (1 + uplift)

Meeting uplift = baseline meeting rate x (1 + reply/qualification uplift)
```

Salesforce baseline olarak 40 saatlik haftayi varsayarsak:

```text
Mevcut selling time = 40% x 40 saat = 16 saat / hafta
McKinsey +15-20% relative uplift:
16 x 1.15 = 18.4 saat
16 x 1.20 = 19.2 saat
Artis = +2.4 ile +3.2 saat / rep / hafta
Absolute selling-time payi = 46% ile 48%
```

Bu yuzden "selling time +15-20 percentage point artar" demek yanlis olur. Dogru ifade:

> Selling time relative olarak 15-20% artabilir; 40% baseline uzerinden bu, haftalik toplam zaman icinde +6 ile +8 percentage point demektir.

## 3. Metrik bazli detay

### 3.1 Prospect / account research time azalisi

**Kaynakli benchmark**

Salesforce State of Sales 2026 duyurusuna gore, fully implemented AI agents kullanildiginda seller'lar prospect research time'in 34% azalmasini bekliyor. Raporda ayrica sales reps'in haftanin neredeyse bir tam gununu prospecting'e harcadigi ve 47%'sinin cold outreach'i isin en kotu kisimlarindan biri olarak gordugu belirtiliyor.

**LeadAC mekanizmasi**

LeadAC burada genel bir AI assistant gibi degil, restaurant account context motoru gibi calisir:

- Google Places / website / reviews / menu / social / POS / booking / ordering sinyallerini tek brief'e toplar.
- "Bu restoran neden simdi calisilmaya deger?" sorusuna cevap verir.
- FineDine module angle'i onerir: QR menu, ordering, payment, website, reservations, loyalty/CRM, campaigns.
- Repe tekrar tekrar ayni arastirmayi yaptirmaz.

**Planlama araligi**

| Seviye | Beklenen research time azalisi | Ne zaman kullanilir? |
|---|---:|---|
| Conservative pilot | 15-20% | HubSpot/sender/outcome entegrasyonu zayif, LeadAC sadece brief ve signal layer veriyor. |
| Strong pilot | 20-30% | LeadAC restaurant signal brief + prioritization + opener angle veriyor. |
| Mature integrated | 30-34% | LeadAC CRM/sender/outcome loop ile calisiyor; rep research'in buyuk kismi urune tasiniyor. |

**FineDine pilot olcumu**

- Baseline: rep basina 20 restoran research suresi.
- Pilot: ayni segmentte 20 restoran LeadAC brief ile research suresi.
- Olcum: dakika/account, shortlisted account %, rep confidence score.

**Toplanti cumlesi**

> "Salesforce benchmark'i research tarafinda 34%'e kadar zaman azalisi bekliyor. Biz FineDine icin ilk pilotta bunu garanti etmeyiz; ama restaurant account research'te 15-30% arasi zaman kazanci hedeflenebilir ve bunu account basina dakika ile olcebiliriz."

### 3.2 Email / opener / follow-up drafting time azalisi

**Kaynakli benchmark**

Salesforce 2026 duyurusu, AI agents'in email drafting time'i 36% azaltmasinin beklendigini soyluyor.

**LeadAC mekanizmasi**

LeadAC'in farki generic email yazmak degil, mesajin nedenini account signal'a baglamak:

- "No direct ordering" -> direct ordering pitch.
- "Slow service complaints" -> ordering/payment speed pitch.
- "Active Instagram but weak website" -> website/menu conversion pitch.
- "High review volume but weak menu UX" -> menu analytics / AI upsell pitch.

**Planlama araligi**

| Seviye | Drafting time azalisi | Ne zaman kullanilir? |
|---|---:|---|
| Conservative | 15-20% | Rep yine metni bastan yaziyor, LeadAC sadece angle veriyor. |
| Expected | 20-30% | LeadAC opener + follow-up skeleton veriyor. |
| Mature | 30-36% | LeadAC sinyal bazli mesaj + objection + sequence variant uretiyor. |

**FineDine pilot olcumu**

- Baseline: rep'in 10 restoran icin ilk mesaj hazirlama suresi.
- Pilot: LeadAC angle/draft ile 10 restoran icin hazirlama suresi.
- Kalite kontrol: manager approve rate, edit distance, personalization correctness, hallucination rate.

**Risk**

Draft hizlanirken kalite duserse deger yok olur. Bu nedenle sadece "time saved" degil, "manager-approved usable draft %" de izlenmeli.

### 3.3 Selling / customer-facing time artis

**Kaynakli benchmark**

Salesforce State of Sales 2026, seller zamaninin 40%'inin selling, 60%'inin non-selling oldugunu gosteriyor. McKinsey sales automation arastirmasi, lead management automation'in sales reps' selling time'ini 15-20% artirabilecegini soyluyor. McKinsey ayrica high-performing reps'in lower-performing reps'e gore customer-facing time'da 20-25% daha yuksek oldugunu belirtiyor.

**Hesap**

40 saatlik hafta:

```text
Baseline selling time = 16 saat
+15% = 18.4 saat
+20% = 19.2 saat
Net kazanc = +2.4 ile +3.2 saat / rep / hafta
Toplam hafta icindeki pay = 46% ile 48%
```

**Planlama araligi**

| Seviye | Relative selling-time uplift | Absolute hafta payi | Saat/rep/hafta |
|---|---:|---:|---:|
| Conservative | +8-10% | 43-44% | +1.3 ile +1.6 saat |
| Source-backed expected | +15-20% | 46-48% | +2.4 ile +3.2 saat |
| Stretch | +20-25% | 48-50% | +3.2 ile +4.0 saat |

Stretch aralik McKinsey'in high performer customer-facing time farkiyla uyumlu, ama LeadAC icin garanti iddia edilmemeli.

**FineDine pilot olcumu**

- Rep haftalik zaman dagilimi.
- Account research, message writing, CRM logging, customer conversation, demo/call/field visit saatleri.
- LeadAC sonrasi customer-facing saat farki.

### 3.4 Sales process efficiency

**Kaynakli benchmark**

McKinsey'e gore early adopters of sales automation:

- efficiency improvements: 10-15%
- sales uplift potential: up to 10%
- customer-facing time increase

**LeadAC mekanizmasi**

LeadAC'in "efficiency" etkisi su yerlerden gelir:

- account brief hazirlama
- lead prioritization
- channel/motion onerisi
- mesaj angle'i
- outcome capture
- repeated research'in azalmasi

**Planlama araligi**

| Metrik | Min | Max | Not |
|---|---:|---:|---|
| Sales process efficiency | 10% | 15% | McKinsey source-backed; mature use cases icin. |
| Pilot operational efficiency | 5% | 10% | Daha guvenli FineDine ilk ay hedefi. |

**FineDine pilot olcumu**

- 100 account shortlist cikarma suresi.
- 100 account'tan manager-approved outreach sayisi.
- Rep basina haftalik actionable account sayisi.
- Duplicate/rejected account orani.

### 3.5 Sales uplift / pipeline productivity

**Kaynakli benchmark**

McKinsey "sales-growth outperformance" calismasinda:

- data-driven decision making sales'te 2-5% artis saglar.
- cross-functional coordination 5-10% sales increase saglar.
- behavioral science and analytics-based talent/training 10-20% productivity improvement saglar.

McKinsey sales automation arastirmasi da sales uplift potential'i up to 10% olarak verir.

**LeadAC mekanizmasi**

LeadAC'in revenue etkisi direkt "email yazdik"tan degil, su zincirden gelir:

```text
Daha iyi account prioritization
-> daha az wasted touch
-> daha yuksek relevant conversation orani
-> daha iyi demo fit
-> daha temiz closed-won / closed-lost learning
-> sonraki listede daha iyi karar
```

**Planlama araligi**

| Seviye | Pipeline / sales uplift | Guven |
|---|---:|---|
| Conservative | 2-5% | High-medium; McKinsey data-driven decision making. |
| Expected if workflow adopted | 5-10% | Medium; McKinsey automation uplift. |
| Stretch with full AI + outcome loop | 10-15% | Medium-low for FineDine until proven; McKinsey broader AI revenue uplift. |

**Toplanti cumlesi**

> "Revenue tarafinda bizim icin dogru pilot hedefi once 2-5% gibi daha muhafazakar bir pipeline productivity sinyali. 10%+ ancak outcome loop gercekten calistiginda savunulabilir."

### 3.6 Reply rate / meeting rate uplift

**Kaynakli benchmark**

Mailshake State of Cold Email 2025'e gore cogu cold email kampanyasi 5%'in altinda reply rate uretir; en yaygin aralik 1-4%'tur. Gartner 2025 B2B buyer survey ise B2B buyer'larin 73%'unun irrelevant outreach gonderen supplier'lardan aktif olarak kactigini ve 61%'inin rep-free buying experience tercih ettigini belirtir.

Bu iki kaynak su sonucu verir:

> Generic outreach'in tavani dusuk; relevance ve context olmadan reply rate uzerinden buyumek zor.

**LeadAC mekanizmasi**

LeadAC reply rate'i tek basina iyilestirmez. Reply rate ancak su kosullarda artar:

- data dogru
- deliverability saglikli
- offer/ICP net
- account signal gercek
- opener sinyalden geliyor
- rep follow-up'i zamaninda

**Planlama araligi**

Bu kisim en dikkatli yazilmali. Kaynaklar "LeadAC kullanan restaurant-tech ekipleri X% reply alir" demiyor.

| Baseline cold email reply | Conservative target | Strong target | Relative uplift |
|---:|---:|---:|---:|
| 1% | 1.25-1.5% | 2-3% | +25% ile +200% |
| 2% | 2.5-3% | 4-5% | +25% ile +150% |
| 4% | 4.5-5.5% | 6-8% | +12.5% ile +100% |

**Savunulabilir ifade**

> "Reply rate icin garanti vermeyiz. Ama mevcut kampanyalar 1-4% bandindaysa, sinyal bazli restaurant context ile ilk hedef 25-50% relative uplift; guclu segmentlerde 2x'e kadar uplift test edilebilir."

**FineDine pilot olcumu**

- Aynı segmentte A/B:
  - Control: mevcut mesaj/list.
  - Treatment: LeadAC signal + angle + recommended motion.
- Olcum:
  - total reply rate
  - positive reply rate
  - meeting booked rate
  - unsubscribe/negative reply rate
  - deliverability health

### 3.7 Sales-stage velocity

**Kaynakli benchmark**

Gartner 2026'da, AI-driven sales enablement kullanan organizasyonlarin 2029'a kadar traditional enablement'e gore 40% faster sales stage velocity elde edecegini ongoruyor.

**LeadAC mekanizmasi**

LeadAC sales velocity'yi ancak su sekilde etkiler:

- daha iyi account fit
- daha iyi first angle
- rep'e daha az hazirlik yuklenmesi
- objection pattern'lerinin yakalanmasi
- won/lost nedenlerinin sonraki aksiyona donmesi

**Planlama araligi**

| Seviye | Sales-stage velocity impact | Guven |
|---|---:|---|
| Pilot | 5-10% | Medium; ilk workflow proof. |
| Adopted workflow | 10-20% | Medium; account prioritization + enablement birlikte. |
| Mature AI-driven enablement | 20-40% | Gartner direction; 40% 2029 benchmark, bugun garanti degil. |

**Toplanti cumlesi**

> "Gartner'in uzun vadeli benchmark'i 40% daha hizli stage velocity. Biz bunu FineDine icin bugun claim etmeyiz. Ilk pilotta 5-10% stage velocity sinyali bile dogru problemi yakaladigimizi gosterir."

### 3.8 Ramp / coaching / team memory

**Kaynakli benchmark**

Salesforce 2026 raporu:

- sales reps'in 52%'si traditional enablement'in ihtiyac duyduklari skill'leri vermedigini soyluyor.
- 46%'si sales conversations konusunda nadiren feedback aldigini soyluyor.
- 40%'i manager time eksikligini enablement obstacle olarak belirtiyor.
- high performers, underperformers'a gore coaching agents kullanmaya 1.4x daha yatkin.

Bu, LeadAC'in "team memory" tezini destekler; ama dogrudan "ramp time X% azalir" demez.

**Planlama araligi**

Bu metrik icin yuzdeyi garanti iddia etmek yanlis olur. Dogru yazim:

| Metrik | Pilot hedefi | Mature hedef | Guven |
|---|---:|---:|---|
| New SDR ramp checklist completion speed | 10-20% faster | 20-30% faster | Medium-low |
| Manager feedback coverage | +10-25% daha fazla account/call review | +25-50% | Medium-low |
| Playbook reuse | +20-40% daha fazla mesaj/objection pattern reuse | +40%+ | Medium-low |

**Neden medium-low?**

Cunku kaynaklar enablement pain'i destekliyor, ama FineDine ramp baseline'i olmadan yuzde kesin degil.

**FineDine pilot olcumu**

- New rep'in ilk 50 account'u cikarma suresi.
- Manager'in geri cevirdigi mesaj/oran.
- Reused objection/pitch pattern sayisi.
- Rep confidence survey.
- 30/60/90 gun activity-to-meeting conversion.

## 4. FineDine icin metric dashboard taslagi

Pilot baslamadan once su baseline alinmali:

| Metric | Baseline nasil olculur? | LeadAC sonrasi hedef |
|---|---|---|
| Research minutes/account | 20 restoran manuel timer | -15% ile -34% |
| Drafting minutes/account | 20 opener/follow-up manuel timer | -15% ile -36% |
| Actionable accounts/rep/week | Rep'in manager-approved hesap sayisi | +10% ile +30% |
| Selling/customer-facing hours/week | Calendar + CRM activity | +2.4 ile +3.2 saat/rep/hafta |
| Reply rate | Current campaigns | +25% ile +50% relative pilot target |
| Positive reply rate | Replies classified | +10% ile +50% relative pilot target |
| Meeting booked rate | Campaign -> meeting | +10% ile +40% relative pilot target |
| Wasted touch rate | No-fit / wrong module / wrong contact | -10% ile -30% |
| Stage velocity | First touch -> demo / demo -> next step | +5% ile +10% first pilot |
| Playbook capture | Signal + pitch + outcome records | 80%+ of pilot actions logged |

## 5. Ne iddia edilir, ne edilmez?

### Guvenle iddia edilebilir

- "Salesforce benchmark'ina gore seller'lar haftanin sadece 40%'ini selling'e ayiriyor."
- "Prospecting ve manuel research sales team icin buyuk bir zaman maliyeti."
- "Salesforce, AI agents ile prospect research'te 34%, email drafting'te 36% azalma beklendigini raporluyor."
- "McKinsey, sales automation early adopters'ta 10-15% efficiency improvement ve up to 10% sales uplift potential raporluyor."
- "Gartner, AI-driven enablement icin 2029'a kadar 40% faster sales stage velocity ongoruyor."

### FineDine icin hipotez olarak soylenmeli

- "FineDine'da research time'i 15-30% azaltabiliriz."
- "FineDine'da reply rate'i 25-50% relative artirmayi test edebiliriz."
- "FineDine'da account prioritization pipeline verimliligini 2-5% iyilestirebilir."
- "Yeni SDR ramp'ini kisaltabiliriz."

### Simdilik soylenmemeli

- "LeadAC reply rate'i kesin 2x yapar."
- "LeadAC revenue'yu 15% artirir."
- "FineDine SDR'lari research'e 80% zaman harciyor."
- "LeadAC sales cycle'i 40% kisaltir."
- "LeadAC AI SDR gibi outbound'u tamamen otomatik yapar."

## 6. Final professional paragraph

> Mevcut arastirmalara gore LeadAC'in sales ekibine katacagi deger en guclu sekilde research time, message preparation, account prioritization ve outcome learning tarafinda ortaya cikiyor. Source-backed aralikla ilk pilotta prospect/account research surelerinde 15-34%, email drafting surelerinde 15-36% azalma; customer-facing selling time'da 6-8 percentage point artis; genel sales process efficiency'de 10-15% potansiyel beklenebilir. Revenue tarafinda daha dikkatli olmak gerekir: data-driven decisioning ve sales automation kaynaklari 2-10% sales/pipeline uplift araligini destekliyor, ancak FineDine icin bu ancak reply, meeting, demo, closed-won/closed-lost ve wasted-touch metrikleriyle pilotta kanitlanabilir. Bu nedenle LeadAC'in dogru vaadi "garanti daha fazla revenue" degil, "rep karar kalitesini ve tekrar eden outbound ogrenmesini olculebilir hale getirerek sales ekibinin ayni zaman icinde daha dogru account'lara, daha dogru motion ile gitmesini saglamak" olmalidir.

## 7. Sources

- Salesforce, State of Sales 2026 PDF: https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/reports/sales/salesforce-state-of-sales-report-2026.pdf
- Salesforce, State of Sales 2026 announcement: https://www.salesforce.com/news/stories/state-of-sales-report-announcement-2026/
- Gartner, AI-driven sales enablement 40% faster sales stage velocity by 2029: https://www.gartner.com/en/newsroom/press-releases/2026-04-01-gartner-predicts-ai-driven-sales-enablement-will-deliver-40-percent-faster-sales-stage-velocity-than-traditional-enablement-methods-by-20291
- Gartner, 61% B2B buyers prefer rep-free experience / 73% avoid irrelevant outreach: https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-sales-survey-finds-61-percent-of-b2b-buyers-prefer-a-rep-free-buying-experience
- McKinsey, Sales automation: the key to boosting revenue and reducing costs: https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/sales-automation-the-key-to-boosting-revenue-and-reducing-costs
- McKinsey PDF, Sales automation: https://www.mckinsey.com/~/media/McKinsey/Business%20Functions/Marketing%20and%20Sales/Our%20Insights/Sales%20automation%20The%20key%20to%20boosting%20revenue%20and%20reducing%20costs/sales-automation-the-key-to-boosting-revenue.pdf
- McKinsey, AI-powered marketing and sales reach new heights: https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/ai-powered-marketing-and-sales-reach-new-heights-with-generative-ai
- McKinsey, By the numbers: what drives sales-growth outperformance: https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/by-the-numbers-what-drives-sales-growth-outperformance
- Mailshake, State of Cold Email 2025 PDF: https://assets.mailshake.com/wp-content/uploads/2025/04/16091740/Cold-Email-Report-2025-Mailshake.pdf
- InsideSales, Response Time Matters: https://www.insidesales.com/response-time-matters/
- Chili Piper, Average B2B vendor response time: https://www.chilipiper.com/article/chili-insights-vendor-response-time
