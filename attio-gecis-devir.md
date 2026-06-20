# Notion → Attio Geçişi — Devir Dökümanı

> **Kime:** Bu işi devralan Product Manager
> **Hazırlayan:** (önceki oturum)
> **Tarih:** 2026-06-19
> **Tek cümleyle:** Ürün departmanının tüm çalışma akışını Notion'dan Attio'ya taşıyoruz. Yapı (object/kolon/ilişki) elle Attio arayüzünde kurulacak, veri taşıma kısmını AI (MCP) yapacak.

---

## 1. Bu projenin amacı (neden yapıyoruz)

Ürün departmanı (3 kişi) şu hatla çalışıyor:

```
araştır → design-partner görüşmesiyle doğrula → mimaride ilgili bölgeyi tasarla
→ feature çıkar → engineer'a devret → ship et → ölç
```

**Hedef:** Bu hattı Attio'da öyle kuralım ki **her feature geriye doğru kanıta (research + görüşme), ileriye doğru bir metriğe izlenebilir olsun.** Yani "bu özelliği neden yaptık?" sorusunun cevabı her zaman sistemde dursun.

**Neden Notion değil de Attio?**
- Notion uzun-form bilgi (doküman, araştırma) için iyi ama **akan bir pipeline** (feature'ların aşamadan aşamaya geçmesi, otomasyon, ilişkisel takip) için zayıf.
- Attio ilişkisel bir CRM veri modeli + otomasyon (workflow) sunuyor. Feature pipeline, design partner takibi ve "kanıta bağlılık" kuralları burada çok daha sağlam kurulur.

---

## 2. Şu anda Notion'da akış NASIL? (mevcut durum)

Notion'da **"Leadac Architecture Hub"** sayfası altında 3 veritabanı birbirine bağlı:

1. **Leadac Architecture Registry** — sistemin tüm bileşenleri. Bounded context'lere ayrılmış: **SI / AI / OI / CH**. Hiyerarşik (parent-child) yapıda. (~25 kayıt)
2. **Customer Meetings & Feedback** — design partner görüşmeleri; pain point, karar, action item, ürüne etkisi. (~2 kayıt: Finedine M1, M2)
3. **Research & Insights** — pazar raporları, F&B sektör araştırmaları, trendler. (~11 kayıt)

Bunlar Notion "relation"larıyla birbirine bağlı → bir bilgi grafiği oluşturuyor.

**Notion'daki eksikler (bu yüzden taşıyoruz):**
- Ayrı bir **"Features / Initiatives"** katmanı yok → çıkan özellikler düzenli takip edilmiyor.
- Engineer'a devir gayri resmi.
- North Star metrik operasyonel değil (yazılı ama takip edilmiyor).
- Merkezî bir **karar günlüğü (Decision log)** yok.
- Workflow sahipliği belirsiz.

---

## 3. Attio'da akış NASIL OLACAK? (hedef durum)

7 object'lik bir yapı:

| Object | Ne işe yarar | Kaynak (Notion) |
|---|---|---|
| **Design Partners** (standart: Companies) | Görüşülen restoran/şirketler | (yeni) |
| **Contacts** (standart: People) | Görüşülen kişiler | Meetings → Participants |
| **Meetings** (custom) | Görüşme kayıtları | Customer Meetings & Feedback |
| **Research** (custom) | Araştırmalar | Research & Insights |
| **Features** (custom) ← **OMURGA** | Çıkarılan özellikler | Meeting action item'larından türetilir |
| **Architecture** (custom) | Sistem bileşenleri (SI/AI/OI/CH) | Architecture Registry |
| **Decisions** (custom) | Karar günlüğü | (yeni) |

**Yeni akış (bir içgörünün shipped feature olmasına kadar):**

```
1. Research kaydı girilir (araştırma)
2. Meeting kaydı girilir (görüşme) → research'e bağlanır
3. Meeting'ten Feature taslağı çıkar (Status = Idea)
4. Feature, kanıta bağlanır (Research + Meeting) → Status = Validated
5. Spec yazılır → Status = Spec'd  (KURAL: kanıtsız Spec'd olamaz)
6. Engineer'a devredilir → Status = In Dev → Linear issue açılır
7. Yayınlanır → Status = Shipped
8. North Star metrik girilir → Status = Measured
```

Bu akışı **3 list/kanban** görselleştirir:
- **Feature Pipeline** (Features, Status'a göre kanban)
- **Design Partner Pipeline** (Companies: Prospect/Active/Recurring/Reference)
- **Research Queue** (Research: Intake/Synthesized/Linked)

Ve **4 workflow (otomasyon)** akışı otomatikleştirir:
1. Meeting oluşturulunca → otomatik Feature taslağı (Idea) + Slack bildirim
2. Evidence gate: Feature "Spec'd" olduğunda kanıtı yoksa → otomatik "Validated"a geri al
3. Feature "In Dev" olunca → Linear'da issue aç → URL'yi geri yaz
4. Feature "Shipped" olunca → "North Star metrik gir" hatırlatması

---

## 4. ŞU ANA KADAR NE YAPILDI ✅

- [x] Notion'daki 3 veritabanı ve içerik tamamen incelendi, eksikler çıkarıldı.
- [x] Geçiş planı + Attio kurulum rehberi hazırlandı (2 canvas dosyası — aşağıda).
- [x] Attio MCP bağlandı (AI artık Attio'ya kayıt yazabiliyor).
- [x] **FineDine** design partner'ı `Companies`'e eklendi (ilk gerçek kayıt).
- [x] (Önceki oturumda Attio'nun kendi AI'ı ile 4 workflow taslağı oluşturulmuş — UI'dan doğrulanmalı.)

**Referans dosyalar:**
- Geçiş planı canvas: `.cursor/projects/.../canvases/notion-to-attio-migration.canvas.tsx`
- Kurulum rehberi canvas: `.cursor/projects/.../canvases/attio-setup-guide.canvas.tsx`
- Bu döküman: `attio-gecis-devir.md`

---

## 5. SENİN ELLE YAPMAN GEREKENLER (Attio arayüzü) ⚠️

> Bunlar **API/MCP ile yapılamıyor**, sadece Attio UI'dan kurulur. AI'ın veri taşıyabilmesi için bunlar ÖN KOŞUL. Sırayı bozma: önce object → sonra kolon → sonra ilişki → sonra list.

**Adım 1 — 5 custom object oluştur** (Settings → Objects → New object):
`Meetings`, `Research`, `Features`, `Architecture`, `Decisions`

**Adım 2 — Her object'e kolonları (attribute) ekle:**

- **Features:** Status `status` (Idea/Validated/Spec'd/In Dev/Shipped/Measured) · Problem `text` · Hypothesis `text` · RICE `number` · North Star Metric `text` · Acceptance Criteria `text` · Priority `select` (P0/P1/P2) · Linear URL `text`
- **Meetings:** Type `select` (Discovery/Feedback/Demo) · Date `date` · Recording `text` · Pain Points `text` · Key Insights `text` · Decisions `text` · Action Items `text`
- **Research:** Type `select` · Impact `rating` · Tags `multi-select` · Source `text` · Key Findings `text` · Insights `text` · Recommendations `text`
- **Architecture:** Context `select` (SI/AI/OI/CH) · SubContext `select` · Component Type `select` (Context/Module/Agent/Worker/UI/Integration/EvidenceSystem/LearningLayer/Function) · Status `status` (Planned/Draft/In Progress/Active/Deprecated) · Version `text` · Code Path `text` · Purpose `text`
- **Decisions:** Date `date` · Decision `text` · Rationale `text` · Alternatives `text`

**Adım 3 — İlişki kolonları ekle** (tip: "Record reference", çift yönlü):
- Features ↔ Research (çoka-çok, "Evidence")
- Features ↔ Meetings (çoka-çok, "Evidence")
- Features → Architecture (çoka-bir)
- Features → Decisions (çoka-çok)
- Meetings → Companies (çoka-bir)
- Meetings ↔ People (çoka-çok)
- Research ↔ Architecture (çoka-çok)
- Architecture ↔ Architecture (Parent, self-relation)

**Adım 4 — 3 list oluştur** (kanban view ile):
- Feature Pipeline (Features, Status kanban)
- Design Partner Pipeline (Companies)
- Research Queue (Research)

**Adım 5 — 4 workflow** (Automations): Bölüm 3'teki 4 otomasyon. (MCP ile yapılamaz, UI'dan kur.)

---

## 6. SONRADAN AI (MCP) İLE YAPILACAKLAR 🤖

> Sen Adım 1-3'ü (object + kolon + ilişki) bitirince AI'a **"objeler hazır"** de. AI şu sırayla veriyi taşır:

1. **People** (görüşme katılımcıları) → standart object
2. **Research** (11 kayıt)
3. **Architecture** (25 kayıt)
4. **Architecture parent ilişkileri** (ikinci geçişte bağlanır)
5. **Meetings** (2 kayıt)
6. **Features** (meeting'lerdeki action item / "ürüne etki" maddelerinden türetilir)
7. **Tüm ilişkileri bağla** (Related Research / Last Meeting / Related Architecture)
8. **Uzun metinleri** (transcript, spec gövdeleri) ilgili kayda `note` olarak ekle

**Önemli teknik not:** Attio kolon oluştururken otomatik bir "slug" üretir; bazen beklenenden farklı olur. Bu yüzden AI taşımadan önce her object'in gerçek slug listesini çekecek, ona göre yazacak. Sen sadece "hazır" demen yeterli.

**AI'ın YAPAMADIKLARI** (tekrar): custom object/kolon/ilişki/list/workflow oluşturma. Bunlar hep UI işi.

---

## 7. "BİTTİ" tanımı (kontrol listesi)

- [ ] 7 object kurulu (2 standart + 5 custom)
- [ ] Tüm kolonlar ve ilişkiler tanımlı
- [ ] 3 list + kanban view hazır
- [ ] Notion'daki her kayıt Attio'da karşılığıyla ve ilişkileriyle mevcut
- [ ] Hiçbir Feature kanıtsız "Spec'd" değil
- [ ] 4 workflow yayında
- [ ] Özet rapor: kaç object/kolon/kayıt taşındı, hangi ilişkiler bağlandı, elle gereken kaldı mı

---

## 8. Hızlı başlangıç (devralan kişi için)

1. Bu dökümanı baştan sona oku.
2. Bölüm 5'i (Adım 1-3) Attio UI'da uygula. **Acele etme, sırayı koru.**
3. Bittiğinde AI oturumunu aç, Attio MCP'nin bağlı olduğundan emin ol, **"objeler hazır, veriyi taşı"** de.
4. AI taşırken sen paralelde Adım 4-5'i (list + workflow) kur.
5. Bölüm 7'deki kontrol listesiyle doğrula.
