# Room 1 playbook research: how to pick the wedge and the plan (FineDine beta, London + Istanbul)

Date: 2026-10-03. Scope: research only, no code changes.

Inputs read:
- `src/lib/ai-core/agent/head-agent.ts`: both HEAD and the uncommitted v2 in this worktree, including `CATEGORY_WEDGE` and the `REVIEW_*` constants
- `src/lib/review-analysis/pain-phrases.ts` (the 14-category list)
- `src/lib/prompts/review-analysis-prompt.ts`
- `src/lib/site-facts.ts`
- `src/lib/agent-workers/apify/map-facts.ts`
- sections 12–13 of `revint-calisma-ozeti.md`

Method:
- Every question went through **Perplexity (sonar-pro) via Composio**. Three follow-up queries covered UK chains, Istanbul chains and hotel brand domains.
- WebSearch and WebFetch ran alongside it. WebFetch was used on the primary pages: FineDine pricing (EN and TR), the FineDine help centre, OpenTable, SevenRooms, Zonal, ResDiary, me&u, Lumina, the Turkish regulation pages, and the Hu & Liu and ASAP PDFs.
- Composio did not connect at the start of the session, so the first half of the research used WebSearch/WebFetch only. After it reconnected, Perplexity was run on all ten questions.

Labels used in this document:
- *(vendor)*: the source is a company that sells the product.
- *(heuristic)*: our own rule, with no published source behind it.

---

## Executive summary: 10 changes to the rules

1. **The plan constants are correct but incomplete.** FineDine's live pricing table matches what we have:
   - Starter: 1 language, 20 tables, 50 reservations, no prepayment.
   - Growth: multiple languages, 50 tables, 250 reservations, prepayment.
   - Premium: unlimited, plus Multi-Location Display.

   What we do not encode:
   - **Order & Pay monthly orders:** 1,000 / 1,500 / unlimited.
   - **Menu items:** 100 / unlimited / unlimited.
   - **SMS:** 0 / 250 / 500 per month.
   - **Team members:** 0 / 3 / unlimited.
   - Plans are **priced per venue**.

   Sources: https://www.finedinemenu.com/en/pricing/ , https://support.finedinemenu.com/en/articles/964581-can-a-plan-be-divided-in-multiple-venues
2. **`multi_location → Premium` is only half true.** Multi-Venue Management is in every plan. Premium adds only *Multi-Location Display* in the website builder, and every venue needs its own subscription. The card should say "Premium on the storefront; each venue still needs its own plan". Confirm this with FineDine's SDR before selling it. (Same sources as item 1.)
3. **For `bill_wait`, order volume drives the plan, not table count.** Starter's 1,000 orders/month is about 33 a day, which any full-service dinner trade exceeds.
   - Default `bill_wait` to **Growth**.
   - Allow **Premium for a single venue** when it has more than 50 tables or more than about 1,500 orders/month.
   - The ban "Tek şubeye Premium önerme" needs that exception.

   Source: the pricing page. Not yet verified: whether an "order" means one table session or one submitted order.
4. **Review strength: keep "5 and 10%", and tighten recency.** There is no universal threshold. Hu & Liu use 1% minimum support on corpora of 1,000+ sentences. For 30–200 reviews, an absolute floor of 5 plus a 10% share keeps the Wilson 95% lower bound at about 4% or higher whenever there are at most 50 complaint reviews.
   - **Strong:** at least 5 distinct reviews, at least 10% of complaint reviews, and at least 2 of them from the last 12 months.
   - **Medium:** at least 2 distinct reviews, with at least 1 from the last 24 months.

   Sources: https://www.cs.uic.edu/~liub/publications/kdd04-revSummary.pdf , https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
5. **Split `wait`, and stop treating `repeat` as a complaint.**
   - Split `wait` into `table_wait` (a queue at the door) and `kitchen_wait` (never sellable). `table_wait` is a medium reservation signal, and only for venues that are not walk-in.
   - Rename `repeat` to `regulars` and count it from positive mentions.
   - These map onto ASAP's `Service#Queue` and `Service#Timely` and onto SemEval's `SERVICE#GENERAL`.

   Sources: ASAP https://arxiv.org/abs/2103.06605 (repo, Apache-2.0: https://github.com/Meituan-Dianping/asap)
6. **Reservation is strong only when three conditions hold.** Deposits cut no-shows by about 57% *(vendor, OpenTable)*. The UK average no-show rate was about 8% in 2023 (ResDiary). But 66% of UK diners are put off by a deposit (takepayments 2025, n=1,500). So:
   - **Strong** only when (a) the provider is a **marketplace** (OpenTable, TheFork, Quandoo, DesignMyNight, Resy, Reztoran), (b) no deposit is visible, and (c) the format justifies a deposit. Format means a price level of 3 or more, a tasting menu, a groups or private-dining page, or a review about a no-show or a lost booking.
   - A **SaaS** provider (SevenRooms, ResDiary, Collins, Tablein, resOS, TableCheck, Eat App) blocks the reservation wedge.

   Sources: https://www.opentable.com/restaurant-solutions/resources/3-proven-payment-strategies-reduce-no-shows/ , https://resdiary.com/blog/no-shows-a-top-priority , https://www.takepayments.com/uk-restaurant-report-2025/
7. **Operator block: `chain` at 10+ locations or a seed-list brand, `group_hq` at 6–9, `small_group` at 2–5.**
   - Technomic counts 1–9 units as independent and 10+ as a chain. Purchasing usually centralises somewhere between 5–10 and 10–20 sites.
   - `hotel_fnb` comes from a lodging place type, a hotel brand domain, or a `/dining/` or `/restaurants-bars/` path.
   - The dataset's false targets confirm this: Gaucho has 20 UK sites, and Tuğra sits under `kempinski.com/en/ciragan-palace/restaurants-bars`.

   Sources: https://www.ifdaonline.org/wp-content/uploads/2024/05/IFDA-Quarterly-Brief-April-2024.pdf , https://www.kempinski.com/en/ciragan-palace/restaurants-bars , https://developers.google.com/maps/documentation/places/web-service/place-types
8. **Marketplace is strong only when every ordering path leads to a marketplace.**
   - UK commissions are 13–14% when the restaurant delivers and about 30% when the platform delivers (Uber Eats, Just Eat). Yemeksepeti charges 12% with the restaurant's own courier and 32% with the platform courier, plus VAT.
   - **Strong:** every order link, on the site and on the Google Business Profile, goes to a marketplace domain. Delivery appears in the Maps service options. There is no first-party checkout.
   - Ban any claim of a Deliveroo or Yemeksepeti integration: none is published.

   Sources: https://restauranthero.co.uk/guides/delivery-app-commission-fees-uk/ , https://varisdijital.com/blog/yemeksepeti-komisyon-oranlari-2026 , https://www.finedinemenu.com/en/integrations/
9. **Wedge order: strength first, then how well the rep can quantify the pain.** Keep the tiers. Gong reports 2.1x success when the rep states the reason for calling, and pitching cuts email replies by up to 57%.
   - Lead with one wedge. Keep one backup in reserve, never in the opener.
   - Within a tier, use this order: **reservation > bill_wait > marketplace > multi_location > menu_surface > guest_repeat**. This moves `menu_surface` below `multi_location`, because QR menus have the weakest revenue evidence.
   - The 80/65/50 confidence numbers are uncalibrated ranks. Re-fit them after 50 SDR outcomes, and apply the −10 penalty only for a source the chosen wedge depends on.

   Sources: https://www.gong.io/blog/cold-call-stats , https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says , https://www.katalystos.com/blog/qr-order-and-pay-at-the-table-what-changes
10. **Two Türkiye-specific triggers, both for `menu_surface`:**
    - (a) The Fiyat Etiketi Yönetmeliği amendment (RG 33044, 11.10.2025) allows QR price lists on tables. A paper copy must be given on request, and prices must be uploaded to a Ministry system.
    - (b) The Food Codex guide requires **ingredients and calories on menus**. Chains by 1.7.2026; venues with 3+ branches in one province by 31.12.2026; everyone else by 31.12.2026 for ingredients and 31.12.2027 for calories.

    Every Turkish venue with a PDF menu, or no digital menu, gets a medium `menu_surface` signal. The UK equivalent applies only to businesses with 250+ employees, so do not use it with independents.

    Sources: https://www.lexpera.com.tr/resmi-gazete/metin/fiyat-etiketi-yonetmeliginde-degisiklik-yapilmasina-dair-yonetmelik-33044/1 , https://www.turkiyetoday.com/lifestyle/calorie-counts-ingredient-lists-now-mandatory-in-restaurants-cafes-3217004 , https://www.legislation.gov.uk/ukdsi/2021/9780348223538

---

## Q1. FineDine's real plan matrix

### Findings

The live pricing page was fetched in English and Turkish on 2026-10-03:
- The UK view shows **£22 / £52 / £101 per month, billed annually (20% off)**.
- Perplexity's index of the same page shows **$29 / $69 / $135**, with a temporary 50%-off campaign at $15 / $35 / $68.

Sources: https://www.finedinemenu.com/en/pricing/ , https://www.finedinemenu.com/tr/pricing/

| Row (section on the page) | Starter | Growth | Premium |
|---|---|---|---|
| Languages & Currencies (Menu) | 1 each | Multiple | Multiple |
| Menu Items | **100** | Unlimited | Unlimited |
| Tablet Menu | 5 tablets | 5 tablets | 5 tablets |
| Menu Scheduling, In-App Promotions, Bulk Price Editor, Custom Landing Page | ✗ | ✓ | ✓ |
| Allergen & Nutrition Labels, AI Menu Builder, AI Photo, AI Translation, AR menu | ✓ | ✓ | ✓ |
| **Order & Pay: Dine-In Tables** | 20 | 50 | Unlimited |
| **Order & Pay: Monthly Orders** | **1,000** | **1,500** | Unlimited |
| POS Lite, Fast Checkout, Tip Collection, Service Requests | ✓ | ✓ | ✓ |
| SMS Order Notifications | ✗ | 250/mo | 500/mo |
| Reservations: Monthly | 50 | 250 | Unlimited |
| Online booking/cancellation, table management, durations, notes, email | ✓ | ✓ | ✓ |
| **Pre-Payment Collection** | ✗ | ✓ | ✓ |
| Reservation SMS alerts | ✗ | 250/mo | 500/mo |
| Website builder languages | 1 | Unlimited | Unlimited |
| Custom domain | ✗ | ✓ | ✓ |
| **Multi-Location Display** (website) | ✗ | ✗ | ✓ |
| Guest CRM | Last 10 | Unlimited | Unlimited |
| Promo codes, Feedback, Item ratings | ✓ | ✓ | ✓ |
| AI Smart Segmentation | ✗ | ✓ | ✓ |
| **Multi-Venue Management** (Operations) | ✓ | ✓ | ✓ |
| Advanced analytics | 7-day | 30-day | Full history |
| Team members | Not included | 3 users | Unlimited |
| Support | Email | + 24/7 chat | + Dedicated success manager |

The help centre says plans are **per venue and cannot be shared**: "Every venue in FineDine has its own signature in the system which works with individual subscriptions so the plans are not shareable between venues". Source: https://support.finedinemenu.com/en/articles/964581-can-a-plan-be-divided-in-multiple-venues

What the pricing table does not show:
- **Loyalty.** Only promo codes and feedback appear.
- **Delivery-marketplace integrations.** The integrations page names POS systems only: Micros, Epos Now, Clover, Revel, Foodics. https://www.finedinemenu.com/en/integrations/
- **Delivery and pickup ordering.** This is marketed on a separate solution page as zero-commission ordering, with no plan tier stated. https://www.finedinemenu.com/en/solutions/delivery-and-pick-up-menu/
- **Kiosk.** There is only the "Tablet menu, 5 tablets" row.

A second help article still uses the old plan names "Base / Essentials / Premium", with ordering and reservations as add-ons. It is outdated; do not quote it. https://support.finedinemenu.com/en/articles/5898218-finedine-solutions-cost-products

### Our constants against reality

| Our constant | Reality | Verdict |
|---|---|---|
| Starter: 1 language | 1 language and 1 currency | ✔ (add: 1 currency) |
| Starter: Order & Pay up to 20 tables | 20 tables **and 1,000 orders/month** | ✘ incomplete |
| Starter: 50 reservations/month, no prepayment | ✓ | ✔ |
| Growth: multi-language, 50 tables, 250 reservations, prepayment | ✓, **plus 1,500 orders/month** | ✘ incomplete |
| Premium: multi-location | Only *Multi-Location Display* (website). Multi-venue management is in all plans, and pricing is per venue | ✘ misleading |
| `guest_repeat → growth` ("Starter keeps the last 10 guests") | ✓ Guest CRM is Last 10 / Unlimited; segmentation is Growth and above | ✔ |
| `marketplace → starter` | Delivery/pickup ordering has no tier on the pricing table | ? unverified |
| `menu_surface → starter`, Growth if multilingual | ✓, but **Starter caps the menu at 100 items** | ✘ incomplete |
| Ban "Tek şubeye Premium önerme" | A single venue with more than 50 tables or more than 1,500 orders/month needs Premium | ✘ too broad |

### Rules to code

```
PLAN_LIMITS = {
  starter: { languages: 1, tables: 20, ordersPerMonth: 1000, reservationsPerMonth: 50, prepayment: false, menuItems: 100, sms: 0, teamUsers: 0, crmGuests: 10, multiLocationDisplay: false, customDomain: false },
  growth:  { languages: Infinity, tables: 50, ordersPerMonth: 1500, reservationsPerMonth: 250, prepayment: true, menuItems: Infinity, sms: 250, teamUsers: 3, crmGuests: Infinity, multiLocationDisplay: false, customDomain: true },
  premium: { languages: Infinity, tables: Infinity, ordersPerMonth: Infinity, reservationsPerMonth: Infinity, prepayment: true, menuItems: Infinity, sms: 500, teamUsers: Infinity, crmGuests: Infinity, multiLocationDisplay: true, customDomain: true },
}
PRICING_UNIT = "per_venue"
```
- `planFor` returns the smallest plan where every *feature the wedge needs* is true and every *known* quantity fits. An unknown quantity never raises the plan, except through the size proxy in Q8.
- Rewrite the ban as: "Tek şubeye Premium önerme — **unless** tableCount > 50 or estimated orders > 1,500/month (state the assumption)."
- New bans (rep guidance; each one can also be checked with a pattern):
  - Do not promise a Deliveroo, Uber Eats or Yemeksepeti integration: `/(integrat\w*|entegr\w*)[^.]{0,30}(deliveroo|uber ?eats|just ?eat|yemeksepeti|getir|trendyol)/i`
  - Do not promise a loyalty programme; say "promo codes / guest CRM" instead: `/(loyalty (program|scheme|card)|sadakat program)/i`
  - Do not say one subscription covers all branches: `/(one|single|tek) (plan|subscription|abonelik)[^.]{0,30}(all|every|tüm) (branches|locations|venues|şube)/i`

---

## Q2. Which review pains the products actually solve

### Evidence

**Tabletop ordering and payment.** There is one large independent study: Tan & Netessine, a staggered rollout across 66 restaurants and more than 2.6M checks. Results:
- meal duration **−9.74%**
- sales per minute **+10.77%**
- average check **+2.91%**
- staffing unchanged; the weakest servers gained the most

It was published in Management Science 66(10), 2020: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3037012 , https://ideas.repec.org/a/inm/ormnsc/v66y2020i10p4496-4515.html. The proven gain is faster table turns, not bigger checks: https://www.katalystos.com/blog/qr-order-and-pay-at-the-table-what-changes

**Pay at table:**
- sunday reports 6–10 minutes saved per table *(vendor)*: https://sundayapp.com/qr-code-payments-for-restaurants-real-roi/
- A UK survey (n=2,000, 2018, linked to Barclaycard) found an average wait for the bill of 9 min 57 s. 25% would consider leaving after 30 minutes, and 1 in 20 had left without paying, mostly because of the wait. https://www.foxnews.com/food-drink/1-in-20-diners-has-left-a-restaurant-without-paying-study-finds
- **Counter-evidence:** 59% of UK diners prefer to pay a member of staff at sit-down restaurants (takepayments 2025, n=1,500, Pollfish). https://www.takepayments.com/uk-restaurant-report-2025/

**Acceptance of QR ordering by format:**
- food halls 91%, competitive socialising venues 88%, large pubs and bars 83% (me&u/KAM, Oct 2023, n=250) *(vendor)*: https://www.meandu.com/blog/qr-code-order-pay-uk-guests-have-their-say
- fine-dining guests want paper menus (93% in a survey a vendor cites): https://sundayapp.com/en-gb/why-guests-prefer-ordering-via-qr-code-even-if-they-dont-admit-it/

**Deposits and card guarantees:**
- OpenTable: deposits −57% no-shows, card holds up to −16%: https://www.opentable.com/restaurant-solutions/resources/3-proven-payment-strategies-reduce-no-shows/
- a SevenRooms customer went from 15% to 1% (Farmstead) *(vendor)*: https://sevenrooms.com/blog/restaurant-reservation-deposits/

**Spend claims.** me&u claims +20–40% spend and +30% tips *(vendor; no method published)*: https://www.meandu.com/. Treat these as marketing, not evidence. The independent figure is about +3%.

**What none of these fix:** kitchen speed, taste, food safety, staff manners, decor, noise and price level. Tan & Netessine's effect comes from removing the wait for a waiter to take the order and the payment, not from faster cooking. No vendor claims otherwise. The analyst prompt already marks these as unsellable.

### Category list (closed), with sellable flag and wedge

Changes against the 14-category list in `pain-phrases.ts`:

| Category (proposed) | Change from today | Definition (one line for the prompt) | Sellable | Wedge (cap) | External anchor |
|---|---|---|---|---|---|
| `bill` | keep | waiting for or chasing the bill, card machine, splitting (the act of paying, not the amount) | ✔ | bill_wait | ASAP Service#Timely; SemEval SERVICE#GENERAL |
| `order_wait` | keep | waiting to order, no waiter's attention, had to go to the bar | ✔ | bill_wait | ASAP Service#Timely |
| `order_error` | keep | wrong or forgotten item, items billed that were never ordered | ✔ | bill_wait (**medium cap**) | — |
| `reservation` | keep | booking lost or ignored, phone not answered, cannot book online, no-show policy, deposit | ✔ | reservation | — |
| `table_wait` | **new (split from `wait`)** | queued at the door, or waited for a table, *even with a booking* | ✔ only for venues that are not walk-in | reservation (**medium cap**) | ASAP Service#Queue |
| `kitchen_wait` | **new (split from `wait`)** | food slow to arrive after ordering | ✘ | — | ASAP Service#Timely |
| `delivery` | keep | delivery or takeaway orders, delivery apps, cold or late delivery | ✔ | marketplace (**medium cap**; only if the venue delivers) | — |
| `menu` | keep | menu hard to read or out of date, prices differ, allergens missing, no translation, PDF only | ✔ | menu_surface | SemEval FOOD#STYLE_OPTIONS (partial) |
| `language` | keep, **as a plan modifier only** | language barrier; staff or menu not in the guest's language | ✔ | none (raises the plan to Growth; medium for menu_surface only when it mentions the menu) | — |
| `regulars` | **rename from `repeat`**, count positive mentions | guests say they come weekly, are regulars, or will return | n/a (not a complaint) | guest_repeat (**medium cap**) | — |
| `price` | keep | expensive, value, service charge, taxes, overcharging | ✘ | — | SemEval *#PRICES; ASAP Price#* |
| `food_quality` | keep | taste, temperature, freshness, food hygiene, illness | ✘ | — | SemEval FOOD#QUALITY; ASAP Food#Taste |
| `staff` | keep | rude or unfriendly (manners, not speed) | ✘ | — | ASAP Service#Hospitality |
| `ambiance` | keep | noise, decor, cleanliness of the room or toilets, seating | ✘ | — | SemEval AMBIENCE#GENERAL; ASAP Ambience#* |
| `other` | keep | everything else | ✘ | — | SemEval RESTAURANT#MISCELLANEOUS |

### Rules to code

- `UNSELLABLE_CATEGORIES = {kitchen_wait, price, food_quality, staff, ambiance, other}`.
- In `CATEGORY_WEDGE`:
  - add `table_wait: { wedge: "reservation", cap: "medium", requires: venueNotWalkIn }`
  - remove `repeat`
  - add `regulars: { wedge: "guest_repeat", cap: "medium" }`
- Keep the price guard from §13.4: `PRICE_WORDS` without `BILL_PROCESS` becomes `price`. It is correct, and it matches SemEval's separation of PRICES from SERVICE.
- `regulars` needs the analyst to label *positive* review fragments. Today `reviewLabels` covers complaints only, so this is a prompt change. If that costs too much, drop the category and rely on venue-type rules.

---

## Q3. Frequency thresholds

### Evidence

- Hu & Liu (KDD 2004) call a feature frequent when it appears in "more than 1% (minimum support) of the review sentences". That works on corpora of thousands of sentences. https://www.cs.uic.edu/~liub/publications/kdd04-revSummary.pdf (quote checked against the PDF text)
- Implementations on small datasets use absolute cut-offs of 2–5 mentions. Chen (2019) uses a frequency cut of 2 plus a 95% Wilson interval to down-weight rare aspects: https://rgu-repository.worktribe.com/preview/638063/CHEN%202019%20Aspect-based%20sentiment%20analysis.pdf. For ranking by the Wilson lower bound rather than the raw share: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
- Recency: BrightLocal 2025 finds consumers increasingly accept reviews from the last 6–12 months as relevant. Only 20% insist on reviews no older than two weeks. https://www.brightlocal.com/research/local-consumer-review-survey-2025/
- About 10% of guests write a review after a visit (Toast survey). So each review stands for many guests, but small counts are noisy. https://pos.toasttab.com/blog/data/restaurant-feedback-insights

### Wilson 95% lower bound for x mentions out of n complaint reviews (computed)

| n \ x | 2 | 3 | 5 | 8 | 10 | 15 |
|---|---|---|---|---|---|---|
| 20 | 2.8% | 5.2% | 11.2% | 21.9% | 29.9% | 53.1% |
| 30 | 1.8% | 3.5% | 7.3% | 14.2% | 19.2% | 33.2% |
| 50 | 1.1% | 2.1% | 4.3% | 8.3% | 11.2% | 19.1% |
| 80 | 0.7% | 1.3% | 2.7% | 5.2% | 6.9% | 11.7% |
| 120 | 0.5% | 0.9% | 1.8% | 3.4% | 4.6% | 7.7% |

Reading the table:
- With up to about 50 complaint reviews, "at least 5 and at least 10%" guarantees a lower bound of about 4% or more.
- With 80 or more, the 10% share is the binding condition (8 of 80, 12 of 120), which keeps the lower bound at about 5% or more.

### Rules to code (*heuristic, calibrated on the table above*)

```
REVIEW_CORPUS_MIN = 30           // analysed reviews; below → review signals capped at "medium", card says "n yorum okundu"
REVIEW_STRONG_MIN = 5            // distinct reviews
REVIEW_STRONG_SHARE = 0.10       // of complaintReviews (denominator = reviews with ≥1 verified complaint, any star)
REVIEW_STRONG_RECENT = 2         // of the mentions, written in the last 12 months (was ≥1)
REVIEW_MEDIUM_MIN = 2
REVIEW_MEDIUM_RECENT_MONTHS = 24 // ≥1 mention newer than this, else drop
strong ⇔ mentions ≥ max(5, ceil(0.10·complaintReviews)) ∧ recent12m ≥ 2 ∧ analysed ≥ 30
medium ⇔ mentions ≥ 2 ∧ newest mention ≤ 24 months old
```
- **Fetch the newest reviews.** Ask Apify for reviews sorted by **newest**. "Most relevant" over-samples old, long reviews and makes the recency test meaningless. Check this setting in the actor input.
- **Unknown dates cap the signal at medium.** Today the code treats unknown dates as passing (`recentOk` when `recentMentions` is missing). Change that.
- **Evidence line:** keep the §13.1 format: `yorum · hesap bekleme · 14/96 şikayetli yorum (%15) · son 12 ay: 9 · "…"`.

---

## Q4. Reservation economics and walk-in models

### Evidence

**UK no-show rate:**
- ResDiary: about 8% in 2023 (5% in 2022). 60% of venues took a deposit; 51% of those only above a party size, with the trigger averaging **9 covers**. Only 9% took a deposit on every booking. https://resdiary.com/blog/no-shows-a-top-priority
- Zonal: likelihood of a no-show fell from 11% to 6%; yearly cost fell from £17.6bn to £12.6bn. https://www.zonal.co.uk/resources/likelihood-of-no-shows-has-almost-halved-reducing-the-cost-of-no-shows-by-5bn-a-year/

**What deposits and card holds change:**
- OpenTable: deposits −57% no-shows; card holds up to −16% no-shows and −15% late cancellations *(vendor)*: https://www.opentable.com/restaurant-solutions/resources/3-proven-payment-strategies-reduce-no-shows/
- TheFork card guarantee: up to −65% (secondary source): https://restaurant.eatapp.co/blog/restaurant-no-shows
- SevenRooms global benchmark is 3.5% no-shows and 11% cancellations. It recommends deposits for groups of 6+, peak nights, prix fixe or tasting menus, and private rooms. https://sevenrooms.com/blog/restaurant-reservation-deposits/

**How UK diners react:**
- takepayments (Sept 2025, n=1,500): 66% are put off by a deposit, 44% by a request for card details. https://www.takepayments.com/uk-restaurant-report-2025/
- ResDiary 2024: 62% are willing to give card details. https://resdiary.com/blog/growing-diner-support-in-no-show-prevention

**The marketplaces already offer deposits.** OpenTable and SevenRooms both sell deposit and card-hold features (pages above). A venue on these tools without deposits has *chosen* not to use them, or has not got round to it. That makes the call a "why not?" conversation, not a missing-feature pitch.

**Walk-in by design.** Some London restaurants refuse bookings to stay casual and keep room for regulars. Dishoom keeps most tables unreserved. Barrafina Dean Street is walk-in only, while its other sites take bookings. https://www.huffingtonpost.co.uk/rory-natkiel/no-reservation-restaurants_b_2956615.html , https://www.barrafina.com/locations/dean-street/

### Rules to code

1. **Provider class.** Extend `MARKETPLACE_BOOKING` into two classes:
   - `MARKETPLACE`: thefork|lafourchette|opentable|quandoo|resy|designmynight|bookatable|tock|reztoran|rezlinka|google reserve
   - `SAAS`: sevenrooms|resdiary|collins|tablein|resos|tablecheck|eatapp|eat app|zonal|tableplus|dish\.co
   - Remove `yelp|tripadvisor|zomato` from the booking regex. They are review sites and produce false matches.
2. **Reservation strong** ⇔ all of:
   - the venue is not walk-in
   - the provider is in `MARKETPLACE`
   - `hasPrepayment !== true`
   - at least one of: price level ≥ 3; a tasting menu; a groups, private-dining or events page on the site; at least 1 `reservation` review about a no-show, a lost booking or an unanswered phone
3. **Reservation medium** ⇔ any of:
   - the provider is in `MARKETPLACE` with no deposit, but the format condition is not met
   - `hasBookingSystem === false` and Maps `acceptsReservations === true` (bookings by phone only)
   - a medium `table_wait` signal from reviews
4. **Reservation blocked** when:
   - the provider is in `SAAS`. The venue already has deposits and a CRM, so ban "rezervasyon sistemi satma" and move to the backup wedge.
   - Maps `acceptsReservations === false`
   - the site text matches `/(walk[- ]?ins? only|we (do not|don't) take (bookings|reservations)|no reservations|rezervasyon (alınmamaktadır|almıyoruz|yoktur))/i`
5. **Walk-in venue types** (from Google `primaryType`; list at https://developers.google.com/maps/documentation/places/web-service/place-types): `cafe, coffee_shop, bakery, fast_food_restaurant, food_court, ice_cream_shop, dessert_shop, sandwich_shop, juice_shop, bagel_shop, donut_shop, pub, bar`. Our own `venueType ∈ {cafe, qsr, food_hall}` also counts. Exception: a `bar` or `pub` whose site links a booking provider counts as full-service (a gastropub).
6. **Talk track.** "No deposit on OpenTable" only shows a choice the venue made, so open with a question, not a claim of loss: "OpenTable'da depozito açmamışsınız; no-show oranınız ne?"

---

## Q5. Marketplace dependence

### Evidence

**UK commissions:**
- Uber Eats: 30% when Uber delivers (33% for Uber One), 13% for self-delivery or pickup, plus a £650 activation fee.
- Just Eat: 14% for self-delivery; a delivery fee applies when Just Eat delivers.
- Deliveroo: not published; usually 25–30% for independents.

Sources: https://restauranthero.co.uk/guides/delivery-app-commission-fees-uk/ , https://www.restauranttech.co.uk/guides/how-to-get-more-online-orders-uk-2026

**UK channel mix, 2024 (share of delivery occasions):** Uber Eats 27.2%, company-owned channels 26.4%, Just Eat 25.2%, Deliveroo 16.2%. The company-owned share is dominated by Domino's, McDonald's and KFC, so independents rely on the aggregators. https://www.lumina-intelligence.com/blog/foodservice/uk-food-delivery-market-growth-share-size-statistics-2025/

**Türkiye:**
- Yemeksepeti: 12% with own courier, 32% with the platform courier, plus VAT: https://varisdijital.com/blog/yemeksepeti-komisyon-oranlari-2026
- The Competition Authority opened an investigation in March 2024, citing 32% + KDV for the mandatory courier. It imposed no penalty. https://www.bloomberght.com/rekabet-kurumu-yemek-sepeti-ne-sorusturma-acti-2349915
- Getir Yemek about 25–30%. Trendyol Go about 10% + VAT for self-delivery, 28–38% with its couriers (secondary source). https://novempos.com/blog/yemek-platformu-komisyonlari-2026/
- Uber took 85% of Trendyol Go in June 2025 and completed the Getir food acquisition on 1 July 2026, so two of the three Turkish aggregators now share one owner. https://www.tipranks.com/news/company-announcements/uber-acquires-getirs-turkiye-food-delivery-portfolio

**Google Business Profile.** "Third-party providers who state they have authorized relationships with your business are automatically listed." A marketplace link on Maps proves the venue is *on* that marketplace, not that it chose it as its main channel. https://support.google.com/business/answer/10842217?hl=en

**FineDine** sells zero-commission delivery and pickup ordering. https://www.finedinemenu.com/en/solutions/delivery-and-pick-up-menu/

### Rules to code

```
MARKETPLACE_DOMAINS = deliveroo.(co.uk|com) | ubereats.com | just-eat.co.uk | justeat | yemeksepeti.com | getir.com | trendyol.com/go | tgoyemek | foodpanda | glovo | wolt
DIRECT_ORDERING_HINTS = own-domain checkout/basket | finedine | slerp | flipdish | chownow | toasttab.com/online | square.site | deliverect direct | order.<own domain> | whatsapp order link
```
- **Strong** ⇔ all of:
  - the union of site order links and Maps `orderLinks` is not empty
  - every link host is in `MARKETPLACE_DOMAINS`
  - `directOrdering !== true`
  - Maps `serviceOptions` contains delivery or takeaway
  - the order page was actually opened (`orderPageSeen`)
- **Medium** ⇔ any marketplace link with direct ordering unknown, or a `delivery` review category (medium cap).
- **No signal** ⇔ marketplace links appear only on Maps (Google adds them automatically) and nothing on the site.
- **Bans:**
  - "Pazar yerini bırakın deme; yanına komisyonsuz kendi kanalı." Pattern: `/(leave|quit|drop|bırak\w*)[^.]{0,20}(deliveroo|uber|just eat|yemeksepeti|getir|trendyol)/i`
  - the integration ban from Q1
- **Numbers the card may show:** ranges only, each with its source: "13–30% UK commission", "Yemeksepeti 12% / 32% + KDV". Never state a specific restaurant's rate.

---

## Q6. Chain, hotel and group detection

### Evidence

**Unit thresholds:**
- Technomic convention: 1–9 units independent, 10+ chain (secondary source): https://pt.slideshare.net/slideshow/october-newcomerspresentationed/14768783
- IFDA: independents are single-unit and 2–3-unit operators: https://www.ifdaonline.org/wp-content/uploads/2024/05/IFDA-Quarterly-Brief-April-2024.pdf
- NYC defines a chain at 15+ units; US federal menu labelling at 20+: https://www.fda.gov/food/food-labeling-nutrition/menu-labeling-requirements
- UK calorie labelling applies from 250+ employees: https://www.legislation.gov.uk/ukdsi/2021/9780348223538

**Central purchasing.** No published threshold. Perplexity's synthesis puts the start at about 5–10 units, formal by 10–20 *(heuristic)*.

**Hotel F&B signals:**
- Google lodging types (`hotel, lodging, resort_hotel, inn, motel, hostel, guest_house, bed_and_breakfast, extended_stay_hotel`): https://developers.google.com/maps/documentation/places/web-service/place-types
- schema.org `Restaurant.containedInPlace → Hotel/LodgingBusiness`: https://schema.org/LodgingBusiness , https://schema.org/docs/hotels.html
- brand URL paths such as `kempinski.com/en/ciragan-palace/restaurants-bars/tugra-restaurant` (https://www.kempinski.com/en/ciragan-palace/restaurants-bars/tugra-restaurant) and `marriott.com/.../dining/` (https://www.marriott.com/en-us/hotels/lonch-london-marriott-hotel-county-hall/dining/)

**Both wrong targets in the 111-lead dataset are caught by these rules.** Gaucho has 20 UK sites (https://www.linkedin.com/posts/james-stagg-10a0527_cateys-2025-how-to-enter-activity-7288569052317315072-rcR4). Tuğra is inside the Çırağan Palace Kempinski.

**Company registers:**
- UK: the Companies House API is free. It covers officer search and persons with significant control, and SIC 56101 (licensed restaurants) / 56102 (unlicensed). https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/search-officers , https://www.siccode.co.uk/sic2007/code-56101
- Türkiye: a branch must use the head office's trade name plus "şubesi", and is announced in the Ticaret Sicili Gazetesi (MERSİS). https://www.ticaretsicil.gov.tr/view/hizlierisim/unvansorgulama.php , https://ticaret.gov.tr/ic-ticaret/ticaret-sicili/merkezi-sicil-kayit-sistemi-mersis

### Rules to code

```
operator =
  hotel_fnb   if primaryType|types ∩ LODGING_TYPES ≠ ∅
              ∨ site host ∈ HOTEL_DOMAINS
              ∨ path matches /\/(dining|restaurants?-?(and|&)?-?bars?|restaurants-bars|food-and-drink|yeme-icme)\b/i on a host that also serves /rooms|/accommodation|/odalar
              ∨ JSON-LD Restaurant.containedInPlace.@type ∈ {Hotel, LodgingBusiness, Resort}
  chain       if locationCount ≥ 10 ∨ brand ∈ CHAIN_SEED ∨ (locationCount ≥ 6 ∧ site has /franchise|/investor|/yatirimci|/careers with HQ address)
  group_hq    if 6 ≤ locationCount ≤ 9           // card opens, addressed to "operations / owner", never to a branch manager
  small_group if 2 ≤ locationCount ≤ 5           // multi_location strong
  single      otherwise
```

**`locationCount`** is the largest of:
- the number of JSON-LD `Restaurant` entries
- links under `/locations|/branches|/subeler|/şubeler|/restaurants`
- other leads on the same registrable domain (our database)
- a Places text search on the brand name within 50 km. This is paid, so run it only when one of the first three is 2 or more.

**`HOTEL_DOMAINS`** (seed list; brand domains taken from the groups' brand pages https://www.marriott.com/brands.mi , https://www.hilton.com/en/brands/ , https://www.ihg.com/content/gb/en/about/brands , https://group.accor.com/en/brands-and-experiences/our-hotel-brands): `marriott.com, ritzcarlton.com, hilton.com, ihg.com, accor.com, all.accor.com, raffles.com, swissotel.com, fairmont.com, sofitel.com, rixos.com, hyatt.com, wyndhamhotels.com, radissonhotels.com, kempinski.com, fourseasons.com, mandarinoriental.com, rosewoodhotels.com, shangri-la.com, minorhotels.com, anantara.com, peninsula.com, dedeman.com, divan.com.tr, eliteworldhotels.com.tr`.

**`CHAIN_SEED`** is a fast path. The counts are approximate, taken from Perplexity follow-ups citing operator sites and Restaurant Magazine. The ≥10 count rule stays authoritative.
- **UK:** Nando's (450+), PizzaExpress (354), Wagamama (~170), Zizzi, Prezzo (97), Côte, Franco Manca (72), ASK Italian, Honest Burgers, Rosa's Thai, Wahaca, Gaucho (20), Flat Iron, Hawksmoor, Dishoom, Bill's, Five Guys, Leon, Pret, Itsu, Wasabi, Byron, GBK, The Ivy Collection. Sources: https://www.restaurantonline.co.uk/Article/2025/02/13/what-are-the-uks-biggest-pizza-restaurant-and-pizza-delivery-brands-dominos-pizza-express-pizza-hut/ , https://www.statista.com/statistics/712128/wagamama-uk-restaurant-numbers-united-kingdom-uk/ , https://www.restaurantonline.co.uk/All-products/restaurant-report-2025/
- **Türkiye:** BigChefs (123 Turkish branches, 3/2026), Günaydın, Nusr-Et, Köfteci Yusuf, Kahve Dünyası, Simit Sarayı, HD İskender, Mado, Tavuk Dünyası, Develi, Cookshop, Happy Moon's, Midpoint, Pidem, Baydöner, Kasap Döner, Dürümle, Pasta Il Forno, Saray Muhallebicisi, Özsüt, Espressolab, Starbucks, Gloria Jean's. Sources: https://bigchefs.com.tr/yatirimci-iliskileri/ , https://www.kahvedunyasi.com/magazalar
- Develi (about 15–20 sites) and Dishoom and Hawksmoor (about 13–15 each) are on the list because they pass 10. If FineDine wants them, the call goes to head office.

**Card text:**
- `hotel_fnb`: "Otel F&B — satın alma otel yönetiminde; kart açılmaz".
- `chain`: "Zincir (N lokasyon) — genel merkez; şube kartı açılmaz".
- `group_hq`: the card opens with "muhatap: işletme sahibi / operasyon müdürü".

---

## Q7. Prioritisation, tiers and confidence

### Evidence

- Saying why you are calling gives a **2.1x** higher success rate (Gong): https://www.gong.io/blog/cold-call-stats
- Pitching cuts cold-email replies by up to **57%** (Gong Labs): https://www.gong.io/blog/does-cold-email-even-work-any-more-heres-what-the-data-says
- 87% of buyers say sales emails do not address a challenge relevant to them (Gong, 30k emails): https://www.gong.io/blog/4-data-backed-ways-to-increase-your-email-reply-rate-and-book-that-meeting
- A problem-first call structure with no pitch ("poke the bear": one question about one problem): https://joshbraun.com/poke-the-bear-cold-call-script/
- Perplexity's summary of current practice: one primary angle, one backup kept as a branch of the call, and one disqualifying question.

### Assessment of the planned tiers

**Tiers.** Adopt them as planned: A = strong + a second source, B = strong, C = two medium. Strength wins across tiers, and the priority order applies within a tier. This fits the one-problem principle, and agreement between two independent sources is the closest thing we have to a precision signal.

**Priority within a tier.** Order the wedges by how easily the rep can put a number on the pain in the call:
1. reservation (no-show % × covers, from published rates)
2. bill_wait (Tan & Netessine's −10% meal time)
3. marketplace (commission %)
4. multi_location
5. menu_surface (weakest evidence; fine-dining guests dislike QR menus)
6. guest_repeat

This moves `menu_surface` below `multi_location`, which is a change. Exception: in Türkiye, `menu_surface` with the 2026 compliance trigger keeps its current place.

**Confidence (80/65/50, −10 per missing source).** Keep it, but only as an *ordinal* display. Two refinements:
- Deduct only for sources the chosen wedge depends on: reservation and marketplace depend on the site and Maps; bill_wait depends on reviews.
- Never go below 30.

After the first 50 FineDine SDR outcomes, recalibrate: confidence = the observed share of calls where the owner confirmed the pain, per tier. No source supports 80/65/50 as probabilities.

**Backup.** Show it on the card as a branch, e.g. "Eğer rezervasyon konu değilse → hesap bekleme (14/96 yorum)". Never put it in the opener. QA already checks the opener; add the rule "opener mentions at most 1 wedge".

**Discovery card when the wedge is `none`.** Keep the fixed question list from §13.2. Pick its two questions from the unknowns that decide FineDine's plan limits: table count, monthly orders, booking channel, delivery share.

---

## Q8. Plan size without table counts

### Evidence

- **Ratings have causal evidence; review counts do not.**
  - Luca: +1 Yelp star gives +5–9% revenue for independents and no effect for chains: https://www.hbs.edu/faculty/Pages/item.aspx?num=41233
  - Anderson & Magruder: +½ star makes a restaurant sell out at peak 19 percentage points (49%) more often: https://anderson.are.berkeley.edu/pdf/Anderson%20and%20Magruder%202012.pdf
- **Review count is confounded** by age, location and tourist traffic, and only about 10% of guests write a review: https://pos.toasttab.com/blog/data/restaurant-feedback-insights
- **Popular Times** is not in the official Places API. Apify scrapers return it, but only as relative busyness, and it is missing for many places: https://apify.com/compass/crawler-google-places , https://developers.google.com/maps/documentation/places/web-service/op-overview
- **No source validates any public proxy against table count.** Reliability: low.

### Rules to code

1. **Feature gates first (reliable).** Choose Growth if any of these hold:
   - the wedge needs prepayment (reservation)
   - `languageCount > 1`, more than one `hreflang`, or more than 25% of reviews in a non-local language *(heuristic)*
   - the menu has more than 100 items (count them on the menu page when it was opened)
   - guest CRM or segmentation is the wedge
   - we are selling the FineDine storefront and it needs a custom domain
2. **Explicit capacity (reliable when found).** Parse `/(\d{2,3})\s*(covers|seats|kişilik|kapasite|masa)/i` from the site and the Maps description. Estimate tables ≈ seats / 3.5 *(heuristic)*.
   - more than 20 tables → Growth
   - more than 50 tables → Premium (the single-venue exception to the ban)
3. **Size proxy (weak; only when rules 1–2 find nothing).** `reviewCount ≥ 1000` and `priceLevel ≥ 3` → Growth for bill_wait. These are the current `LARGE_VENUE_*` constants; keep them. Never raise the plan to Premium on proxies alone.
4. **Order volume for bill_wait (new).** Starter's 1,000 orders/month is about 33 a day. Assume the venue does more than 1,000 orders/month, and choose Growth, if Popular Times shows at least 3 hours a week at ≥80% busyness, or `reviewCount ≥ 500` *(heuristic)*.
5. **Card wording (fixed template):** `Paket varsayımı: <plan>. Masa/sipariş sayısı görülmedi; <kanıt: "1.240 yorum, fiyat seviyesi 3" | "sitede 120 kişilik">. İlk soruda doğrula: "Kaç masanız var, ayda kaç sipariş?"`. When a feature gate set the plan, say so instead: `Growth: ön ödeme yalnız Growth ve üstünde`.

---

## Q9. UK (London) and Türkiye (Istanbul) specifics

| Topic | London | Istanbul |
|---|---|---|
| Reservation platforms | OpenTable, SevenRooms (~1,966 UK venues in 2024), ResDiary, DesignMyNight/Collins, TheFork, Resy. https://www.theaccessgroup.com/en-gb/hospitality/sectors/restaurants/reservations/what-is-the-best-restaurant-reservation-system-in-the-uk/ , https://restaurantbookingsystem.com/best/restaurant-booking-systems-uk/ | Reztoran (partnered with OpenTable in 2017), OpenTable listings, Rezlinka. TheFork launched in 2015 and later withdrew. Many venues take bookings by phone, WhatsApp or Instagram. https://webrazzi.com/2017/08/09/opentable-reztoran/ , https://www.uzakrota.com/tripadvisorin-restoran-rezervasyon-girisimi-the-fork-turkiyeden-cekildi/ , https://www.opentable.com/region/tr/istanbul-restaurants |
| Delivery platforms | Share of delivery occasions: Uber Eats 27.2%, Just Eat 25.2%, Deliveroo 16.2%. Deliveroo has been owned by DoorDash since October 2025. https://www.lumina-intelligence.com/blog/foodservice/uk-food-delivery-market-growth-share-size-statistics-2025/ | Yemeksepeti leads; Trendyol Go and Getir are both owned by Uber. The market was ₺270bn in 2025. https://www.legal500.com/intelligence/turkey/antitrust-competition-law/the-turkish-competition-authority-releases-a-leading-food-delivery-platform-from-most-of-its-binding-commitments-following-the-loss-of-its-dominance-but-keeps-the-narrow-price-parity-commitment-in-place-for-two-more-years |
| Deposit culture | Common for groups (trigger averages 9 covers), peak dates and tasting menus. Diners push back (66% are put off). | Prepayment is standard for New Year's Eve and special nights. No evidence of deposits on ordinary nights. https://www.tripadvisor.com/ShowTopic-g293974-i368-k14970732-New_Year_s_Eve_dinner-Istanbul.html |
| QR adoption | High in food halls and large pubs (83–91% in favour, *vendor*); low in fine dining. 59% prefer to pay staff at sit-down restaurants. | QR price lists on tables are legal (RG 33044, 11.10.2025), with paper on request and prices uploaded to the Ministry system. Ingredient and calorie disclosure phases in over 2026–27. |
| Review language mix | High tourist share in the West End and South Bank; no published figure found. | 18.97M foreign visitors in 2025, the most of any city. Main origins: Russia, Germany, Iran, the US, the UK. https://www.turkiyetoday.com/business/istanbul-leads-as-turkiye-welcomes-over-4-3m-foreign-visitors-in-early-2025-148286 , https://hispanatolia.com/en/istanbul-welcomed-more-than-18-million-tourists-in-2024/ |
| Regulation hooks | Calorie labelling applies only from 250 employees, so there is no hook for independents. | Food Codex menu disclosure (ingredients, calories) and the QR price-list rule both support `menu_surface`. |

### Rules to code

- **Country** comes from the address.
- **Türkiye menu trigger.** Add an extra **medium** `menu_surface` signal, `"2026 menü içerik/kalori bilgilendirme yükümlülüğü"`, when `pdfMenu === true` or `hasQrMenu === false`.
- **Ban (rep guidance):** "Hukuki danışmanlık verme; 'zorunlu' derken tarih ve kaynak söyle". Flag the pattern `/(ceza|fine|penalt)/i`.
- **Regex additions:** the Türkiye booking regex adds `reztoran|rezlinka`. The Türkiye delivery regex keeps `yemeksepeti|getir|trendyol|tgo`.
- **Language need:** the share of analysed reviews not in the local language (Türkiye: not Turkish; UK: not English). Above **25%**, raise the plan to Growth *(heuristic; no published threshold)*. Expect this to fire often in Istanbul's Fatih and Beyoğlu districts.

---

## Q10. Datasets and category schemes we could adopt

| Resource | Categories | Licence |
|---|---|---|
| SemEval-2014 Task 4 (restaurants) | FOOD, SERVICE, PRICE, AMBIENCE, ANECDOTES/MISCELLANEOUS | META-SHARE "MS-NC-No ReD", CC BY-NC-SA 3.0: academic, non-commercial, no redistribution. http://metashare.elda.org/repository/browse/semeval-2014-absa-restaurant-reviews-train-data/479d18c0625011e38685842b2b6a04d72cb57ba6c07743b9879d1a04e72185b8/ |
| SemEval-2015 Task 12 / 2016 Task 5 | Entity {RESTAURANT, FOOD, DRINKS, AMBIENCE, SERVICE, LOCATION} × Attribute {GENERAL, PRICES, QUALITY, STYLE_OPTIONS, MISCELLANEOUS} | No explicit licence on the task page; treat as research-only. https://alt.qcri.org/semeval2016/task5/ , https://aclanthology.org/S16-1002/ |
| ASAP (Meituan, 46,730 reviews) | 18 categories: Location#{Transportation, Downtown, Easy_to_find}; Service#{Queue, Hospitality, Parking, Timely}; Price#{Level, Cost_effective, Discount}; Ambience#{Decoration, Noise, Space, Sanitary}; Food#{Portion, Taste, Appearance, Recommend} (read from the paper's table) | Repository Apache-2.0. https://github.com/Meituan-Dianping/asap , https://arxiv.org/abs/2103.06605 |
| MAMS | food, service, staff, price, ambience, menu, place, miscellaneous | Repository Apache-2.0. https://github.com/siat-nlp/MAMS-for-ABSA |
| GERestaurant (3,078 German TripAdvisor reviews) | FOOD, SERVICE, AMBIENCE, PRICE (+ general) | The arXiv page lists CC BY 4.0, which may cover only the paper; Perplexity could not confirm a licence for the data. https://arxiv.org/abs/2408.07955 |
| Yelp Open Dataset | No ABSA labels; business attributes only (RestaurantsReservations, RestaurantsDelivery, …) | Non-commercial dataset terms. https://business.yelp.com/data/resources/open-dataset/ |

### Recommendation

- **Adopt the category design, not the data.** Our closed list (Q2) covers every SemEval entity and splits SERVICE into the operational sub-aspects ASAP already separates:
  - `Service#Queue` → `table_wait`
  - `Service#Timely` → `order_wait` / `kitchen_wait` / `bill`
  - `Service#Hospitality` → `staff`
- **Traceability:** store the anchor in a comment next to each category.
- **No training data:** do not train on, or ship, the SemEval-2014 or Yelp data in a commercial product.
- **ASAP and MAMS:** the code repositories are Apache-2.0, but nobody has checked the rights to the Meituan review texts. Use them only for offline evaluation, after a licence check.

---

## Confidence and gaps

### Checked directly on primary pages

- FineDine pricing table (EN and TR) and the per-venue help article
- OpenTable and SevenRooms deposit pages
- Zonal and ResDiary no-show figures
- the takepayments 2025 survey and the me&u UK survey
- Lumina channel shares
- the Hu & Liu 1% support quote and the 18 ASAP categories
- the Google Business Profile rule on third-party listings
- the Kempinski and Marriott hotel URL patterns
- the date of the Turkish QR price-list regulation
- the scope of UK calorie labelling

### Secondary or vendor sources (directional only)

- every spend, tip and turn-time uplift except Tan & Netessine
- TheFork's −65%
- Deliveroo and Turkish commission rates (no public rate card)
- chain site counts
- the Technomic 1–9 / 10+ convention (secondary slides)
- the central-purchasing band (Perplexity synthesis, no primary source)

### Not found or still open

1. Does "Monthly Orders" count each table session or each submitted order? This decides the bill_wait plan. **Ask FineDine.**
2. Which plan includes delivery/pickup ordering, and does it share the same order cap? **Ask FineDine.**
3. How is a 2–5 site group priced: Premium on every venue, or Premium on one venue plus Starter or Growth on the rest? Is Multi-Location Display the only multi-site benefit? **Ask FineDine.**
4. Does FineDine have any marketplace integration (Deliveroo, Yemeksepeti) or reservation-platform integration not shown on the integrations page?
5. A published threshold for "tourist share" in reviews (we use 25% as a heuristic), and any validated public proxy for table count. None found.
6. Everyday deposit (kapora) practice in Istanbul restaurants outside New Year's Eve and events. The evidence is only anecdotal.
7. The Apify review actor's sort order and date fields. The recency rule depends on both.
8. The confidence values 80/65/50. They need calibration against SDR outcomes.

### Validate with FineDine's SDR on the first 30 leads

- Does "booking on OpenTable without a deposit" open a conversation, or is it a dead end because the venue chose not to take deposits?
- Do London owners respond to the bill-wait angle, given that 59% of diners prefer to pay staff?
- Does the Turkish 2026 menu-disclosure hook work on a phone call?
- Should `group_hq` venues (6–9 sites) be called at all?
