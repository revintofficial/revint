# Site capture: before / after on the 40 sites (2026-10-04)

Branch `prod/i-site-yakalama`. Not pushed.

## How it was measured

- **Sample:** the same 40 restaurant / cafe sites as the previous measurement
  (`scripts/website-audit-eval/sites.json`, ground truth `truth.json`, unchanged).
- **Runs** (`run-eval.ts`, one site at a time, live, 2026-10-04):
  - *before* = shallow `crawlWebsite()` (homepage + at most one subpage per kind);
  - *after* = `crawlWebsiteDeep()` (`--deep`: homepage audit, then the site
    capture, then the facts read from the capture).
  The shallow run went first and finished before the deep run started; they did
  not overlap. The deep run took 13 min 20 s wall clock for 40 sites.
- **Machine and network:** Windows 11 laptop, Intel i7-11800H, 16 GB RAM,
  Node 22.23, Wi-Fi (link 413 Mbps) from Turkey; headless Chromium through
  Playwright; nothing else heavy running during the deep run.
- **Scoring** (`score.ts`) is the previous scheme, read through
  `buildRoomOneAudit` (what Room 1 sees), plus one column: `prepaymentAny` counts a
  deposit fact of any scope (Room 1's `prepayment` only counts a general one).
  Nothing was written to a database or Redis.

## Result

| field | before: correct / wrong / unknown (missed) | after: correct / wrong / unknown (missed) |
|---|---|---|
| reachable | 38 / 2 / 0 (0) | 40 / 0 / 0 (0) |
| bookingProvider | 27 / 0 / 4 (2) | 28 / 0 / 3 (1) |
| prepayment | 3 / 0 / 5 (2) | 3 / 0 / 5 (2) |
| prepaymentAny | 3 / 0 / 5 (2) | 5 / 0 / 3 (0) |
| qrMenuTool | 14 / 0 / 3 (0) | 16 / 0 / 1 (0) |
| pdfMenu | 7 / 0 / 11 (0) | 7 / **1** / 10 (0) |
| directOrdering | 15 / 0 / 15 (2) | 18 / 0 / 12 (2) |
| deliveryPlatforms | 8 / 0 / 27 (2) | 8 / 0 / 27 (2) |
| languageCount | 6 / 0 / 28 (0) | 6 / 0 / 28 (0) |
| tastingMenu | 0 / 0 / 33 (1) | 1 / 0 / 32 (0) |
| multiLocation | 15 / 0 / 19 (5) | 16 / 0 / 18 (4) |
| hotel | 3 / 0 / 35 (2) | 4 / 0 / 34 (1) |

```
compare: 0 regression(s), 1 new wrong answer(s), unknown cells 185 -> 173
  wolseley.pdfMenu: unknown -> wrong
time per site: median 17 s, p95 49 s (n=40)      (before, shallow: median 6 s, p95 21 s)
```

Before's two `reachable` misses were Flat Iron (`UNKNOWN` crawl error on that run)
and Avlu (Akamai 403). In the deep run both loaded, so their other cells moved
from unscored to scored; part of the "after" gain on those two sites is the
homepage loading, not the capture.

### Pass / fail against the spec

| criterion | result | verdict |
|---|---|---|
| no correct answer breaks | `0 regression(s)` | pass |
| no `null` turns wrong | `1 new wrong answer(s)` (`wolseley.pdfMenu`) | **fail** |
| total wrong ≤ 1 | 1 | pass |
| missed positives fall, none rises | unknown cells 185 -> 173; missed per field never higher (bookingProvider 2->1, prepaymentAny 2->0, tastingMenu 1->0, multiLocation 5->4, hotel 2->1, rest equal) | pass |
| time | median 17 s ≤ 60, p95 49 s ≤ 180 | pass |
| Dishoom, Lokanta deposit | `prepaymentAny` = `ok` on both, scope `group_or_event`, with evidence URL | pass |
| Zizzi, Gaucho | Gaucho named (OpenTable, with evidence); Zizzi: booking pages opened, third-party requests listed, no provider | pass (see below) |
| Avlu `capture.status = blocked` | `complete`: the site was not blocked on this run | **fail as stated** (see below) |

The slowest five deep sites: Bills 84 s (17 pages opened), Seafront 49 s (20),
Dishoom 44 s (22), Hawksmoor 43 s (26), Pizza Pilgrims 28 s (20). Capture status
over the 40: 37 `complete`, 2 `partial` (Honest, Zizzi), 1 `failed` (Caffe
Papavero, unreachable as before).

### The new wrong answer: Wolseley `pdfMenu`

The capture opened `/app/uploads/2017/10/00728_WOLSELEY_OG_Winter_2026_Wine_Menu.pdf`
(and the cocktail list PDF) as `menu` pages; `bridgeMenuPdf` returned the first
one, and Room 1 then reads `pdfMenu = true`. The truth says `false` because the
food menus are HTML pages (`/menu/breakfast/`, `/menu/lunch/`, ...).

This is not a capture fault: the shallow rule `menuPdf()` in `site-facts.ts`
accepts the same file (its `MENU_FILE` pattern matches "menu" and explicitly
"drinks"), so a drinks list as PDF counts as a menu PDF by an earlier decision.
It is a definition conflict between that rule and the truth entry. The hold-out
set shows the same pattern (Banana Tree's `202509_O2-DRINKS_BAND-A.pdf`). I did
not change `src/` or `truth.json`. What I would change, after a decision: make
`bridgeMenuPdf` (and `menuPdf`) prefer a food menu PDF and ignore drinks-only
files (wine, cocktail, drinks) when the site's food menu is an HTML page; or, if
a drinks PDF should count, change the Wolseley truth entry to `true`.

### The five known leaks

| leak | outcome | evidence (from `capture-url.ts`) |
|---|---|---|
| Dishoom deposit | **found**, scope `group_or_event` | https://www.dishoom.com/frequently-asked-questions-faq/ — "I want to cancel my large party reservation, will my deposit be refunded?" |
| Lokanta deposit | **found**, scope `group_or_event` | https://lokantagreenwich.co.uk/pages/book-your-table — "Please note that bookings above 4 people require Credit/Debit card details to secure the booking." |
| Gaucho provider | **named: OpenTable** (`source: page`) | `/reserve` lands on https://booking.gauchorestaurants.com/, whose "Powered by" link goes to `https://www.opentable.com/legal/terms-and-conditions`. Not scored (truth `null`). |
| Zizzi provider | **not named; visible in the ledger** | `opened reservation` for `/bookings`, `/bookings/group-bookings`, `/bookings/amend`, `/bookings/cancel`; the requests on those pages are analytics only (GTM, atreemo, PostHog, Facebook, Google Ads). `/bookings/bookings-policy` and three more booking pages skipped `limit_type`. Capture `partial`. The booking form loads without a third-party booking host in the page-load requests. |
| Four Seasons (Avlu) | **not blocked on this run** | Shallow run: `BOT_BLOCKED_4XX` (HTTP 403). Deep run 20 minutes later and a `capture-url.ts` check after it: homepage loaded (`reachable=true`, `capture: complete; opened 19, skipped 347, failed 2`). Akamai's decision varies between requests from the same machine, so the `blocked` path was not exercised live. |

## Other observations (not scored, worth a decision)

These facts are new in the deep run on cells the truth leaves `null`, so the
score does not see them, but Room 1 would.

- **General deposit claims from the base reading (`mergeSiteFacts`, `PREPAY`).**
  The deep run feeds the captured pages to `mergeSiteFacts`, which reads more
  text than the shallow crawler saw on the same page. Its deposit fact carries no
  scope, so Room 1 reads a general deposit:
  - 15grams: https://15grams.co.uk/15grams-book-table — "For bookings of 7+: ...
    deposit and fees will vary" (a group-only statement, no scope).
  - Avlu: the homepage — `"Credit Card Required":"Credit Card Required"`, an
    i18n string table, not venue policy.
  - Hold-out, The Peninsula Istanbul:
    https://www.peninsula.com/en/istanbul/special-offers/rooms/stay-longer —
    "Hotel may request prepayment at the time of booking" (room booking).
  The bridge's per-sentence scope rule only applies to facts it fills itself; the
  base fact wins because the bridge fills only `null`. I did not touch `PREPAY`.
- **Page-type mistake on Dishoom:** `/store/collections/books-and-music/` and two
  more `/store/` pages were opened as `reservation` ("books" read as booking;
  `store` is soft noise and only checked after the positive types).
- **Location count from tourist pages** (hold-out, Romance Istanbul Hotel):
  `locationCount 31` from `/location/` pages that are nearby attractions (Zorlu,
  Cevahir, Blue Mosque).

## What I could not verify

- Whether Zizzi's booking form talks to a third party after a click (the
  capture records page-load requests only).
- The Avlu `blocked` outcome live (see above); it is covered by unit tests only.
- The ground truth was not re-checked for this run; it is the 2026-10-03 file.
  The Wolseley `pdfMenu` entry is the only one I would question (above).

## After the fix wave

Same 40 sites, same truth file, same machine and network, code at commit
`3767ac1` (the final fix wave: hostile-site limits, honest ledger, deposit
sentence rule in the deep path, drinks-only PDFs, shop sections, venue-list
location pages). Deep run `after2`, 2026-10-04 16:14–16:28 (13 min 38 s wall
clock), nothing else heavy running. Then the 12-site hold-out run `holdout2`
(16:30–16:34), from which the test sheet was regenerated.

| field | before | first deep run | after the fix wave |
|---|---|---|---|
| reachable | 38 / 2 / 0 (0) | 40 / 0 / 0 (0) | 40 / 0 / 0 (0) |
| bookingProvider | 27 / 0 / 4 (2) | 28 / 0 / 3 (1) | 28 / 0 / 3 (1) |
| prepayment | 3 / 0 / 5 (2) | 3 / 0 / 5 (2) | **1** / 0 / 7 (4) |
| prepaymentAny | 3 / 0 / 5 (2) | 5 / 0 / 3 (0) | 5 / 0 / 3 (0) |
| qrMenuTool | 14 / 0 / 3 (0) | 16 / 0 / 1 (0) | 16 / 0 / 1 (0) |
| pdfMenu | 7 / 0 / 11 (0) | 7 / 1 / 10 (0) | 7 / **0** / 11 (0) |
| directOrdering | 15 / 0 / 15 (2) | 18 / 0 / 12 (2) | 18 / 0 / 12 (2) |
| deliveryPlatforms | 8 / 0 / 27 (2) | 8 / 0 / 27 (2) | 8 / 0 / 27 (2) |
| languageCount | 6 / 0 / 28 (0) | 6 / 0 / 28 (0) | 6 / 0 / 28 (0) |
| tastingMenu | 0 / 0 / 33 (1) | 1 / 0 / 32 (0) | 1 / 0 / 32 (0) |
| multiLocation | 15 / 0 / 19 (5) | 16 / 0 / 18 (4) | 16 / 0 / 18 (4) |
| hotel | 3 / 0 / 35 (2) | 4 / 0 / 34 (1) | 4 / 0 / 34 (1) |

(correct / wrong / unknown (missed positives))

```
against before:          compare: 40 site(s) compared
                         compare: 2 regression(s), 0 new wrong answer(s), unknown cells 185 -> 176
                           andrewedmunds.prepayment: correct -> unknown
                           wolseley.prepayment: correct -> unknown
against first deep run:  compare: 40 site(s) compared
                         compare: 2 regression(s), 0 new wrong answer(s), unknown cells 173 -> 176
                           andrewedmunds.prepayment: correct -> unknown
                           wolseley.prepayment: correct -> unknown
time per site: median 16 s, p95 84 s (n=40)
```

Capture status over the 40: 36 `complete`, 3 `partial`, 1 `failed` (Caffe
Papavero). Slowest: Seafront 102 s, Bills 84 s, Hawksmoor 46 s, Dishoom 37 s,
Pizza Pilgrims 30 s. Hold-out: 12 sites in 4 min 32 s, slowest Romance Istanbul
77 s.

### Pass / fail against the fix-wave criteria

| criterion | result | verdict |
|---|---|---|
| 0 regressions and 0 new wrong answers against `before` | 2 regressions, 0 new wrong | **fail** (both from the deposit rule, below) |
| total wrong ≤ 1 | 0 | pass |
| unknown cells lower than `before` | 185 -> 176 | pass |
| median ≤ 60 s, p95 ≤ 180 s | median 16 s, p95 84 s | pass |
| Dishoom, Lokanta `prepaymentAny` | `ok` on both | pass |
| nothing correct in the first deep run is now not correct | 2 cells (`prepayment`, below) | **fail** |

### The two regressions: the deposit sentence rule (C1)

Room 1's `prepayment` counts only a general deposit. The deep path now always
decides the deposit with the sentence rule; `mergeSiteFacts`' unscoped `PREPAY`
match no longer stands. On two sites the rule finds no general statement where
the truth says the venue takes card details for every booking. The rule was not
loosened.

- **The Wolseley**, https://www.thewolseleypiccadilly.com/reservations/:
  "Unfortunately, due to a high number customers not attending their bookings
  without notifying us, we regrettably have to ask for card details to secure the
  reservation." (386 characters, fused with the navigation text before it). The
  negation check reads "not" and "without" in the reason clause and skips the
  sentence. The fact that remains is scoped: `group_or_event` from
  `/private-dining-faqs/` ("The deposit is non-refundable if cancellation is
  within 4 weeks of your event; …"). `prepaymentAny` stays `ok`.
- **Andrew Edmunds**, https://www.andrewedmunds.com/reservations: "… we have no
  choice but to request credit card details for all reservations, however, no
  money is charged to your card at the time of booking." is skipped as negated
  ("no"); "A cancellation fee of £25.00 per person will be taken from the card
  provided at the time of the booking." is scoped because the next sentence starts
  with the heading "New Year's Eve and Valentine's Day Bookings"; that sentence
  ("… Bookings Credit card details required for all bookings.") is scoped by the
  occasion words. Result: `group_or_event`. `prepaymentAny` stays `ok`.

Bills keeps its general deposit ("Credit Card Required Your credit card details
are required to secure your booking.", `/bookatable/`).

### Previously failing or concerning cases

| case | first deep run | after the fix wave |
|---|---|---|
| Wolseley `pdfMenu` | wrong (wine-list PDF) | unknown: wine and cocktail PDFs are no longer fetched; `menuPdfUrl` null |
| 15grams deposit | general (unscoped, from `mergeSiteFacts`) | `group_or_event` ("For bookings of 7+: … deposit and fees will vary …") |
| Avlu deposit | general (i18n string table) | `null` |
| Peninsula deposit (hold-out) | general (room offer) | `null` |
| Dishoom page types | three `/store/` pages and `/store/store-faqs/` opened | one left: `/store/collections/books-and-music/` is still opened as `reservation`, because it is the pinned reservation page chosen by the shared `pickSubpages` (same as the shallow path), not by the capture's classifier |
| Romance Istanbul location count (hold-out) | 31 from `/location/` pages | `null` |
| Zizzi failures | 67 failed navigations | 17 failed (`blocked`), then the breaker stopped page opening; 172 leftovers `skipped: blocked`, 5 `limit_type`, 2 `duplicate`; status `partial` |
| Dishoom, Lokanta `prepaymentAny` | ok, ok | ok, ok (both `group_or_event`) |

Avlu loaded again (`complete`, 19 opened, 279 skipped `limit_type`, 67 addresses
over the 300-candidate cap).

### What got worse or is still open

- `prepayment` 3 -> 1 correct (above).
- p95 time 49 s -> 84 s (median 17 s -> 16 s). Seafront (102 s) and Bills (84 s)
  are the slow tail; both are within the 180 s criterion.
- Hold-out Banana Tree: `menuPdfUrl` is still
  `…/202509_O2-DRINKS_BAND-A.pdf`. It is `mergeSiteFacts`' own answer from the
  homepage (shared `menuPdf()` accepts "drinks"); the bridge keeps a non-null
  answer, so the drinks-only check never sees it. Not changed in this wave.

Re-run (outputs are not committed):
`npx tsx scripts/website-audit-eval/run-eval.ts <dir>/before`,
`npx tsx scripts/website-audit-eval/run-eval.ts <dir>/after --deep`, then
`npx tsx scripts/website-audit-eval/score.ts <dir>/after/results.json scripts/website-audit-eval/truth.json --rows --compare <dir>/before/results.json`.

## After the visible-text fix

A live audit of 15grams Coffee House stored a general deposit quoting "Card
details are required to secure your reservation.": a hidden state message of
the ResDiary widget, not the venue's policy. Since commit `65287b0` a page
opened in the browser keeps the text the browser renders (`body.innerText`,
after opening `<details>` and the `hidden` / inline `display: none` panels of
`aria-expanded="false"` controls) instead of text derived from the HTML.
Title, links, embeds and JSON-LD still come from the HTML; the HTTP fallback
and PDFs are unchanged; the shallow path makes no new browser call.

Same 40 sites, same truth file and machine. Deep run `after3`, 2026-10-04
18:07–18:21 (13 min 48 s wall clock); hold-out `holdout3` 18:21–18:25
(4 min 9 s), from which the test sheet was regenerated.

| field | before | after the fix wave | after the visible-text fix |
|---|---|---|---|
| reachable | 38 / 2 / 0 (0) | 40 / 0 / 0 (0) | 40 / 0 / 0 (0) |
| bookingProvider | 27 / 0 / 4 (2) | 28 / 0 / 3 (1) | 28 / 0 / 3 (1) |
| prepayment | 3 / 0 / 5 (2) | 1 / 0 / 7 (4) | **0** / 0 / 8 (5) |
| prepaymentAny | 3 / 0 / 5 (2) | 5 / 0 / 3 (0) | **4** / 0 / 4 (1) |
| qrMenuTool | 14 / 0 / 3 (0) | 16 / 0 / 1 (0) | 16 / 0 / 1 (0) |
| pdfMenu | 7 / 0 / 11 (0) | 7 / 0 / 11 (0) | 7 / 0 / 11 (0) |
| directOrdering | 15 / 0 / 15 (2) | 18 / 0 / 12 (2) | 18 / 0 / 12 (2) |
| deliveryPlatforms | 8 / 0 / 27 (2) | 8 / 0 / 27 (2) | 8 / 0 / 27 (2) |
| languageCount | 6 / 0 / 28 (0) | 6 / 0 / 28 (0) | 6 / 0 / 28 (0) |
| tastingMenu | 0 / 0 / 33 (1) | 1 / 0 / 32 (0) | 1 / 0 / 32 (0) |
| multiLocation | 15 / 0 / 19 (5) | 16 / 0 / 18 (4) | 16 / 0 / 18 (4) |
| hotel | 3 / 0 / 35 (2) | 4 / 0 / 34 (1) | 4 / 0 / 34 (1) |

(correct / wrong / unknown (missed positives))

```
against before:          compare: 40 site(s) compared
                         compare: 4 regression(s), 0 new wrong answer(s), unknown cells 185 -> 178
                           andrewedmunds.prepayment: correct -> unknown
                           wolseley.prepayment: correct -> unknown
                           bills.prepayment: correct -> unknown
                           bills.prepaymentAny: correct -> unknown
against the fix wave:    compare: 40 site(s) compared
                         compare: 2 regression(s), 0 new wrong answer(s), unknown cells 176 -> 178
                           bills.prepayment: correct -> unknown
                           bills.prepaymentAny: correct -> unknown
time per site: median 18 s, p95 50 s (n=40)
```

Hold-out: slowest site 39 s (Romance Istanbul; 77 s in `holdout2`). No fact
changed on the 12 hold-out sites.

### The three sites checked by hand (`capture-url.ts`)

| site | before (main's code) | after |
|---|---|---|
| 15grams | `hasPrepayment` `group_or_event`, "For bookings of 7+: we require at lest 5 days notice for cancellation, deposit and fees will vary … We are still waiting on your bank confirming your transaction." (the widget's hidden terms step; in production the same page gave the general "Card details are required …" while the widget showed its Stripe test-mode states) | `hasPrepayment` `-`; `bookingProvider` ResDiary |
| Dishoom | `group_or_event` (FAQ, large party deposit) | the same |
| Lokanta | `group_or_event` ("bookings above 4 people require Credit/Debit card details …") | the same |

### Every fact that changed against the fix wave

| site | field | fix wave → now | why |
|---|---|---|---|
| 15grams | hasPrepayment | `group_or_event` → `-` | the quoted terms sit in a step of the ResDiary widget that is not rendered; the venue's visible sentence is "For larger bookings (7+ people) and private events please get in touch". Intended. Not scored (truth n/a). |
| Ritz-Carlton roof | hasPrepayment | `group_or_event` → `-` | the events FAQ answer "Deposits are based on 30 % of the combined food and beverage minimum …" is in an accordion panel (`#accordion-body…`, controlled by a `<button aria-expanded="false">`) hidden by a CSS class, not by `hidden` or an inline `display: none`, so the expansion does not open it. Opening it would need overriding stylesheet `display: none` on `aria-controls` panels; not done. Not scored (truth n/a). |
| Bills | hasPrepayment | `general` → `-` (prepayment and prepaymentAny: correct → unknown) | "Your credit card details are required to secure your booking. No payment will be taken at this time." on `/bookatable/` sits in the booking form's details popup (`div.find_your_details_popup` inside `#errorformheader`), shown only after a slot is chosen; `innerText` does not contain it. A statement that exists only in hidden markup: an expected kind of loss, not worked around. |

No other fact changed on the 40 sites. Page counts moved a little because the
duplicate check now compares rendered text: Andrew Edmunds 0 → 5 pages skipped
as duplicates, Dishoom 2 → 0, Hawksmoor 3 → 1, Lokanta 1 → 0; Seafront went
from `partial` to `complete` (15 → 20 opened). On the hold-out, Romance
Istanbul opened 20 pages instead of 6 (44 → 1 duplicates): the duplicate key
(length and first 500 characters) matched on its HTML-derived texts, not on
its rendered texts. Seafront's change is the run, not the fix (no fact moved).

### Pass / fail

| criterion | result | verdict |
|---|---|---|
| 0 new wrong answers against `before` | 0 | pass |
| total wrong ≤ 1 | 0 | pass |
| unknown cells lower than `before` (185) | 178 | pass |
| median ≤ 60 s, p95 ≤ 180 s | median 18 s, p95 50 s | pass |
| 15grams deposit not `general`, ResDiary kept | `-`, ResDiary | pass |
| Dishoom, Lokanta deposit `group_or_event` | both kept | pass |
| cells correct in the fix wave and not now | 2 (Bills `prepayment`, `prepaymentAny`) | reported: hidden-markup statement |

### What got worse

- Bills: the only general deposit left in the 40 is lost; `prepayment` is now
  0 correct. The venue's card requirement is real but only appears in a form
  step a visitor reaches after picking a time.
- Ritz-Carlton events deposit: lost because a class-hidden accordion is not
  opened (above).
