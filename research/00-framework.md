# Araştırma çerçevesi

Hazırlık: 2026-04-20. Amaç: Leadac AI için UK ve ABD pazarını analiz eden 15-30 sayfalık investor memo'sunun iskeletini kurmak. Bu dosya memo'nun kendisi değil; hangi analiz lensleriyle ne iddia ettiğimizi sayan kontrol listesi.

Neden 6 farklı framework kullanıyoruz? Tek bir çerçeve pazarın sadece bir yüzünü gösteriyor. Bessemer TAM modeli "ne kadar büyük" derken Porter rekabete bakıyor, JTBD alıcının kafasındaki işe bakıyor. Memo'nun her bölümü arkasında bir metodoloji olsun diye eşledik. Bu şekilde okuyucu "bu rakam nereden geldi?" dediğinde tek satırla cevap verebiliyoruz.

## 1. Bessemer bottoms-up TAM

Bessemer Venture Partners'ın "State of the Cloud" raporlarında ve partner blog'larında ([bvp.com/atlas](https://www.bvp.com/atlas)) standart kabul ettiği yöntem. Formül basit: nitelikli hesap sayısı × ortalama kontrat × makul penetrasyon. VC'ler "10B dolarlık pazar var" demeyi değil, "şu kadar müşteri × şu fiyat × şu yıllar" demeyi ister. Memo §3'ün (Market Size) temel hesabı burada kurulur.

Neden Bessemer? Çünkü micro-VC fonlarının çoğu Bessemer atlas'ını peer benchmark olarak kullanıyor. "Bessemer'a göre ortalama SMB SaaS ACV'si 1.200 dolar" cümlesi karşı tarafın zaten bildiği dil.

## 2. Porter's Five Forces

Harvard Business Review'un klasik modeli (Porter, 1979, güncel versiyonu 2008). Rekabet yoğunluğunu 5 eksende sayar: direkt rakipler, ikame tehdidi, yeni giriş, alıcı gücü, tedarikçi gücü. Memo §4'te (Competitive Landscape) her eksen için 0-5 arası skor ve 3 kanıt verilecek. Bunu yapmazsak "moat var" argümanı boşlukta kalıyor.

## 3. Jobs-to-be-Done

Clayton Christensen'in "Competing Against Luck" kitabındaki hikayesi ünlü: milkshake'i sabah aldığı için kahvaltı değil, uzun yol arkadaşı olarak tutuyor insan. Buyer alıcı psikolojisini feature listesinden değil, "bunu neyi halletmek için kiraladım?" sorusundan bakmak. `BUYER-PERSONA.md`'de Josh karakterine dair derin veri zaten JTBD dilinde yazılmış. Memo §5 bu veriden çıkarılacak.

Tony Ulwick'in "Outcome-Driven Innovation" eklentisi ise "arzulanan sonuçlar listesi" çıkarmamıza yardım ediyor. Örnek: Josh'un iş tanımı sadece "lead bul" değil; "haftada 5 demo bookla, rakamlar sapmasın" gibi sayısal ve duygusal bir sonuç.

## 4. April Dunford - Obviously Awesome

Positioning'in 5 bileşenini çıkarıyor Dunford: rekabetçi alternatifler, benzersiz özellikler, bunların hangi değeri ürettiği, kimler için en iyi, hangi pazar kategorisinde konumlanıyoruz. `MARKETING.md` §5'te anti-positioning zaten yazılmış ama "Leadac AI bir X'tir" cümlesi henüz muğlak. Memo §4 ve §6 bu çerçeveyle keskinleştirilecek.

Positioning yanlış kurulursa TAM hesabı da bozulur. "Biz Apollo rakibiyiz" dersek TAM 12B, "Biz local-service-tier cold outreach enablement tool'uyuz" dersek TAM 400M. İkisi de doğru olabilir ama her biri farklı defansibility hikayesine götürüyor. Memo'da hangi kapıya geçeceğimizi bu framework belirliyor.

## 5. ICONIQ ve OpenView SaaS benchmarks

ICONIQ Growth'un "Topline Growth & Efficiency" raporu ve OpenView Partners'ın "SaaS Benchmarks" raporu, VC'lerin kafasındaki default peer grup rakamları. Rule of 40, Magic Number, Net Revenue Retention, CAC payback, LTV/CAC gibi metrikleri SMB vs mid-market vs enterprise kırılımıyla veriyor. Memo §7'deki proforma bu rakamların karşısına oturtulacak.

2025 raporu (en son yayımlanan) median SMB SaaS için NRR 101-108%, CAC payback 18-24 ay, büyüme %35-50 aralığında diyor. Biz bunları hedef olarak değil, "gerçekçi tavan" olarak kullanacağız.

SaaS Capital'in "Private SaaS Survey" raporu da aynı amaçla, özellikle non-VC-backed bootstrap SaaS metrikleri için (Leadac AI'ın geldiği yer).

## 6. Gartner Hype Cycle + Moore - Crossing the Chasm

AI-SDR ve outbound automation kategorisi şu an hype cycle'ın hangi evresinde? Gartner'ın 2025 "Hype Cycle for B2B Sales" raporu bu kategoriyi "peak of inflated expectations" zirvesinde gösteriyor, "trough of disillusionment" yakında. Geoffrey Moore'un "Crossing the Chasm" modeli bize innovator'dan early majority'ye geçişin zamanlamasını söylüyor.

Timing argümanı buradan çıkıyor: hype düşerken pragmatik mainstream pazarının "data quality + deliverability + human-in-the-loop" ihtiyacı parlayacak. Leadac AI'ın "AI ranks, human ships" pozisyonu tam bu mainstream dalgaya yazılmış. Memo §8 (Timing) bu framework'e dayanıyor.

## Memo bölümleri ile framework eşleştirmesi

| Memo bölümü | Birincil framework | İkincil framework |
|---|---|---|
| §1 Executive Summary | — | Tümünün 1 sayfalık özeti |
| §2 Problem & Alternatives | JTBD Push/Pull | Dunford Alternatives |
| §3 Market Size | Bessemer Bottoms-up | Top-down (Gartner/IDC) proxy |
| §4 Competitive Landscape | Porter Five Forces | Dunford Unique Value |
| §5 Buyer Insight | JTBD Switch Interview | ODI Outcomes |
| §6 Product & Defensibility | Dunford Positioning | Porter Moat |
| §7 Unit Economics | ICONIQ / OpenView / SaaS Capital | Bessemer efficiency benchmarks |
| §8 Risk & Timing | Gartner Hype Cycle / Moore | Porter new-entrant threat |
| §9 GTM | `MARKETING.md` distilled | JTBD forces → channel fit |
| §10 Ask | Comparable exits (Pitchbook) | Bessemer valuation atlas |

## Bu memo'nun reddettiği 3 framework

Zaman kaybı olacağı için bilinçli olarak şu üç framework'e girmiyoruz:

**SWOT.** Çok üstü kapalı, her şirket için "S=kaliteli ekip, W=küçük pazarlama bütçesi" gibi tekrarlayan şeyler üretiyor. Porter + Dunford birleşimi aynı işi çok daha spesifik yapıyor.

**BCG matrisi.** Ürün portföyümüz yok, tek ürün var. Tek-ürün şirketi için star/cash-cow haritası boş çıkıyor.

**McKinsey 7S.** Organizasyonel analiz için iyi ama 3 kişilik ekip için overkill. İç yapı yerine pazar tezine odaklanıyoruz.

## Doğrulama kriteri

Bu framework seçimi memo yazımının ortasında sorgulanırsa iki testi geçmek zorunda:

1. Her framework, üzerinde 2+ sayfa yazılabilecek kadar veriye sahip mi? Eğer JTBD'de 3 quote'umuz varsa, o bölüm yazılamaz.
2. Her framework'ün çıktısı okuyucuya yeni bir şey söylüyor mu? Porter analizi "rekabet var" diyorsa atılır. "Apollo+ZoomInfo+Clay'in 4.8B ARR'si var ama toplamda ICP overlap %23" diyorsa kalır.

Bir framework üretemiyorsa silinir. Memo sürfüs değil, argüman.
