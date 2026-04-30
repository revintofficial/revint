# LeadAC — Linear Backlog (Draft)

> Bu klasör Linear'a push etmeden önce gözden geçirilecek tasarım dokümanıdır.
> Onaylandıktan sonra `linear-mcp` ile workspace'e issue olarak yaratılacak.
>
> **Hazırlayan:** Cursor AI (kod tabanı + research/finedine/* + product-marketing-context.md sentezi)
> **Tarih:** 2026-04-30
> **Status:** DRAFT — kullanıcı review bekliyor

---

## 0. Linear Workspace Setup (push'tan önce)

### Team yapısı
**Tek team:** `LeadAC` — şu an 3 kişiyiz, ayrı engineering/marketing team açmaya değmez. Label'larla bölelim.

### Members
| User | Role | Linear handle (önerilen) |
|---|---|---|
| Mert | Engineering Lead | @mert |
| Çınar | Positioning / Marketing | @cinar |
| Kaan | PR-Comment / Review | @kaan |

### Labels (Linear'da yaratılacak)

**Area** (issue hangi domain'e ait):
- `area:engineering` (gri)
- `area:ai-core` (mor)
- `area:workers` (mavi)
- `area:frontend` (yeşil)
- `area:marketing` (pembe)
- `area:design` (turuncu)
- `area:billing` (sarı)
- `area:ops` (kahverengi)
- `area:test` (cyan)

**Type:**
- `type:feature` (yeşil)
- `type:bug` (kırmızı)
- `type:refactor` (mavi)
- `type:test` (cyan)
- `type:docs` (gri)
- `type:research` (pembe)

**Effort** (kabaca size):
- `effort:S` — < 1 gün
- `effort:M` — 1-3 gün
- `effort:L` — 3-7 gün
- `effort:XL` — 1+ hafta

**Priority** Linear'ın native field'ı kullanılır (Urgent / High / Medium / Low / No priority).

### Milestone → Linear Project mapping

Linear'da **Project** = Milestone. Her milestone bir Project olur:
1. `M0 — Beta Hardening` (Active)
2. `M1 — Public Launch` (Backlog → 2 hafta sonra Active)
3. `M2 — Sub-Vertical Architecture (FineDine)` (Backlog)
4. `M3 — Monetization & Growth` (Backlog)
5. `M4 — Tech Debt & Operations` (Continuous, no end date)
6. `M5 — Polish & Scale` (Future)

### Cycles
2 haftalık cycle önerilir. M0 = bu cycle. M0 + ilk M1 issue'ları sonraki cycle'a düşsün.

---

## 1. Roadmap özeti

```
[Şimdi ──────────────────────────────────────────────────────► 6 ay sonra]

M0 (2hf)    M1 (4-6hf)         M2 (4hf)              M3 (8hf)
[BETA] ───► [LAUNCH] ───────► [FINEDINE 500] ───► [MONETIZE]
                                                          │
M4 (continuous)  ────────────────────────────────────────►│
                 (tech debt / ops)                        │
M5 (post-launch) ─────────────────────────────────────────►
                 (polish / scale)
```

| Milestone | Hedef | Süre tahmini | KPI |
|---|---|---|---|
| M0 — Beta Hardening | FineDine 2-tester beta'sı stabil, untracked iş commit edilmiş, Beta tester raporlarından çıkan top-5 bug fix | 2 hafta | 50 lead pass'i 90 dk altı, ≥4/5 güven puanı |
| M1 — Public Launch | r/coldemail launch, ilk 25 paying Agency-tier customer | 4-6 hafta | 25 paying × $249 = $6k MRR |
| M2 — Sub-Vertical Architecture | FineDine 500-team prerequisite (11 niche pack + classifier + dual-write memory) | 4 hafta | Reply rate 4% → 9% |
| M3 — Monetization & Growth | Stub workers ship, native push integrations | 8 hafta | $40-55k MRR |
| M4 — Tech Debt & Operations | Coverage, hygiene, billing hardening | Continuous | %80 unit coverage AI Core |
| M5 — Polish & Scale | Performance, observability, mockup parity | Post-launch | <60s pipeline median |

---

## 2. Milestone dosyaları

| Dosya | İçerik |
|---|---|
| [`M0-beta-hardening.md`](./M0-beta-hardening.md) | Active milestone — beta stabilization |
| [`M1-public-launch.md`](./M1-public-launch.md) | r/coldemail launch sprint |
| [`M2-sub-vertical.md`](./M2-sub-vertical.md) | FineDine sub-vertical architecture |
| [`M3-monetization.md`](./M3-monetization.md) | Stub workers + integrations + agency tier |
| [`M4-tech-debt.md`](./M4-tech-debt.md) | Coverage, hygiene, hardening |
| [`M5-polish-scale.md`](./M5-polish-scale.md) | Mockup parity, perf, observability |

---

## 3. Issue formatı (her milestone dosyasında bu yapı)

```markdown
### [M0-01] Issue başlığı
**Type:** feature/bug/refactor/test
**Area:** engineering / ai-core / frontend / ...
**Priority:** Urgent / High / Medium / Low
**Effort:** S/M/L/XL
**Owner:** @mert / @cinar / @kaan
**Depends on:** [M0-X], [M1-Y] (varsa)

**Description:**
2-3 paragraflık bağlam. Neden bu issue var, hangi sorunu çözüyor.

**Acceptance Criteria:**
- [ ] Madde 1
- [ ] Madde 2
- [ ] Madde 3

**Technical Notes:**
- Dosya: `src/path/to/file.ts:LINE`
- İlgili: `<symbol>` veya `<diğer dosya>`
- Risk: ...
```

---

## 4. Linear push akışı (onaylandıktan sonra)

1. **Linear MCP setup** (Cursor `~/.cursor/mcp.json` veya workspace `.cursor/mcp.json`):
   ```json
   {
     "mcpServers": {
       "linear": {
         "url": "https://mcp.linear.app/sse"
       }
     }
   }
   ```
2. Cursor'ı restart et, OAuth ile authenticate ol (Linear hesabıyla).
3. Cursor chat'e geri dön: "Linear MCP up. Push the backlog."
4. Cursor:
   - Workspace'i listeler, hangisine push edileceğini sorar.
   - Labels'ı yaratır.
   - 6 Project'i yaratır.
   - Her milestone dosyasındaki issue'ları sırayla yaratır (parent-child link, priority, label, assignee dahil).
   - Sonunda her bir issue ID + Linear URL'sini geri verir.

### Push tehlikeleri (önce sen kontrol et)
- **Owner atamaları doğru mu?** Yanlış kişiye gidemezse `@mert` her şeyde default olur.
- **Effort tahminleri optimistik mi?** Bilerek M (medium) önerdiğim yerlere bak — gerçekçi mi?
- **M1 vs M2 sıralaması**: Sen "önce launch, sonra FineDine" dedin. Ama FineDine 500-team beta'sı paralel devam edecekse M1+M2 paralel cycle olabilir. Bunu Linear'da Cycle ataması yaparken çözeriz.

---

## 5. Sonraki adımlar (sen ne yapacaksın)

1. **Bu klasörü oku.** Sırayla README → M0 → M1 → M2 → M3 → M4 → M5.
2. **Yön düzeltmek istediğin yerleri** doğrudan dosyaya yorum bırak veya Cursor'a söyle ("M1-03'ü çıkar, M0'a şunu ekle" gibi).
3. **Linear MCP'yi kur** (yukarıdaki adım 0).
4. Cursor'a "push" de.

Sorular varsa hemen sor — issue detayını incele, eksik gördüğün her şeyi söyle.
