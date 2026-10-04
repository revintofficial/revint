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

Re-run (outputs are not committed):
`npx tsx scripts/website-audit-eval/run-eval.ts <dir>/before`,
`npx tsx scripts/website-audit-eval/run-eval.ts <dir>/after --deep`, then
`npx tsx scripts/website-audit-eval/score.ts <dir>/after/results.json scripts/website-audit-eval/truth.json --rows --compare <dir>/before/results.json`.
