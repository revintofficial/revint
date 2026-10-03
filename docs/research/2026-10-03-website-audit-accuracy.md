# Website audit accuracy: before / after (2026-10-03)

Branch `prod/h-website-audit` (from `prod/g-analiz-dogrulugu`). Not pushed.

## How it was measured

- **Sample:** 40 restaurant / cafe leads with a website, read-only from the
  production DB, every query scoped by `workspaceId`
  (`scripts/website-audit-eval/pull-leads.ts`): the 21 real websites in FineDine
  Beta (its other 4 leads are Instagram-only), plus 19 from two other workspaces
  to cover Istanbul venues, hotel restaurants and UK chains
  (`scripts/website-audit-eval/sites.json`). Nothing was written to the DB and
  no job was queued.
- **Runs:** `crawlWebsite()` called directly, one site at a time
  (`run-eval.ts`). "Before" = branch base; "after" = branch head. Both runs were
  live on 2026-10-03.
- **Ground truth** (`truth.json`, every entry with its source note): my own reading
  of the rendered pages (`deep-inspect.ts` opens up to 8 booking / menu / order /
  location / policy pages per site, records third-party hosts, outbound links and
  deposit / location wording), cross-checked per site with **Perplexity via the
  Composio MCP** (`PERPLEXITYAI_EXECUTE_AGENT`, 40 questions about reservation
  provider, deposits, delivery apps, own ordering, location count, hotel,
  languages, with cited URLs), and curl / WebFetch for a few pages. Where page and
  Perplexity disagreed, the page won (e.g. Perplexity said Padella Soho is walk-in
  only; its page links `web.dojo.app/create_booking`). Where neither settled a
  fact, it is `null` and not scored.
- **Scoring** (`score.ts`) reads the facts through `buildRoomOneAudit`, i.e. what
  Room 1 sees. *correct* = asserted and right; *wrong* = asserted and wrong
  (including a `false` where the truth is present); *unknown* = `null`;
  "missed" = unknown where the truth is positive. `multiLocation` and `hotel`
  are the new SiteFacts fields (not yet in RoomOneAudit).

## Result

| field | before: correct / wrong / unknown (missed) | after: correct / wrong / unknown (missed) |
|---|---|---|
| reachable | 38 / 2 / 0 | 39 / 1 / 0 |
| bookingProvider | 14 / **5** / 12 (10) | **28** / 0 / 3 (1) |
| prepayment | 2 / **2** / 4 (3) | 3 / 0 / 5 (2) |
| qrMenuTool | 15 / 0 / 2 (1) | 16 / 0 / 1 (0) |
| pdfMenu | 4 / 0 / 14 (3) | 7 / 0 / 11 (0) |
| directOrdering | 12 / **4** / 14 (2) | 17 / 0 / 13 (2) |
| deliveryPlatforms | 7 / 1 / 27 (2) | 8 / 0 / 27 (2) |
| languageCount | 4 / 0 / 30 (2) | 6 / 0 / 28 (0) |
| tastingMenu | 0 / 1 / 32 (1) | 0 / 0 / 33 (1) |
| multiLocation (new) | 0 / 0 / 34 (20) | 16 / 0 / 18 (4) |
| hotel (new) | 0 / 0 / 38 (5) | 3 / 0 / 35 (2) |

Wrong answers went from 15 to 1 (the remaining one is reachability of an
Akamai-protected hotel site). **No site got worse on any field** (every before
"correct" cell is still correct after).

Notes on reading the table:

- `deliveryPlatforms` "unknown" is mostly sites that truly list no marketplace:
  the fact is only ever asserted (`null` = none seen), by design.
- `languageCount` stays `null` for a single `<html lang>`: one declared language
  is not proof of a one-language menu (see "Contract decisions"). The new
  `declaredLanguage` fact carries it instead.

### What was wrong before, per site

| site | before | after |
|---|---|---|
| River Gardens Café | unreachable (403 to the Chrome/120 UA) | reachable; OpenTable from `/book-a-table` widget |
| 15grams | "Square Appointments" (gift-card link) | ResDiary (booking page widget) |
| Mildreds Camden | "Resy" (BentoBox preconnect) | SevenRooms; Storekit collection |
| Blue House Hotel | "Booking.com" (room booking), deposit = "Safe Deposit Box" | Quandoo; no deposit claim; hotel = independent hotel |
| Bianco43 | "no booking system" | Dojo / SevenRooms |
| Matiz | "no booking system" (menu lives on thehillgreenwich.com) | unknown (no false "no") |
| Andy's Taverna | deposit (Wix `DepositeOrFullAmountUoU` script flag) | no deposit claim |
| Dishoom | tasting menu (Chef's *Table*); "no own ordering" | no tasting claim; own ordering via delivery.dishoom.com |
| Pizza Pilgrims, Zizzi, Purezza | "no own ordering" | Orderswift / Sunday click & collect |
| Honest Burgers | marketplaces missing Uber Eats | Deliveroo, Just Eat, Uber Eats (`eats.sng.link`) |
| Wolseley, Flat Iron, Pizza Pilgrims, El Cenote, GALLADA, Padella | no provider (unknown) | SevenRooms / Dojo |
| Eva Bosphorus | no menu vendor | Menuzade (`/menu` redirects to menuzade.com.tr) |
| Ritz-Carlton, GALLADA, Blue House | - | hotelOperator: Ritz-Carlton (Marriott), The Peninsula, independent hotel |
| 16 chains / groups | - | locationCount or locationHints with quote |

## What changed (commits)

1. `fix(audit)`: booking-detection: SevenRooms, Dojo, ResDiary, Quandoo (+ Tock,
   TableCheck, Eat App, Formitable, Yelp); real host matching; resource hints
   ignored; Square only on `/appointments`; Booking.com dropped; evidence returned.
2. `feat`: `restaurant-vendors.ts` (menu and white-label ordering vendors),
   `eats.sng.link`, Menuzade.
3. `feat(site-facts)`: `site-signals.ts`; additive SiteFacts fields
   `locationCount`, `locationHints`, `hotelOperator` (URL + quote, `null` when
   unseen); visible-text-only deposit/tasting reads; language switcher; off-site
   subpage landing (`VisitedPage.landedUrl`); CDN/menu-page PDFs; ordering CTAs;
   offsite-menu hub keeps booking unknown; crawler UA Chrome 140.
4. `test`: 19 trimmed real-site fixtures, one test per fingerprint.
5. `feat`: documented widget loaders (Quandoo, DesignMyNight/Collins, Tock) and
   translation-plugin language lists (WPML, Polylang, GTranslate, Google).
6. `fix(site-facts)`: never claim a one-language site; `declaredLanguage` fact.
7. `chore`: eval harness + research notes.

`npx tsc --noEmit` clean; full `npx vitest run` green.

## Contract decisions

- `null` = unknown everywhere. New facts are only asserted on positive evidence:
  `locationCount` only at 2+, `hotelOperator` only on a brand/lodging/room-engine
  signal. Nothing says "single venue" or "not a hotel".
- `bookingChecked` is now also true when a provider was named, and false when the
  menu lives on another of the venue's own domains (the guest surfaces are not on
  this site).
- `languageCount` is no longer derived from a lone `<html lang>`.
- SiteFacts stays backward compatible: all new fields are optional; old rows read
  fine.

## What I could not verify

- **Composio:** connected for the second half of the session; it was down
  (ENOTFOUND) at the start, when the first page readings were done. Perplexity was
  then used for all 40 sites and for the library research. Perplexity often could
  not name a provider or deposit policy; those cells come from the page reading.
- Caffe Papavero: unreachable from every client (timeout / ECONNREFUSED); left
  unknown. naked.care and caffecremaco.com do not show the cafe (placeholder /
  iframe of a lovable.app site); left unknown.
- Four Seasons (Avlu) blocks headless Chromium (Akamai "Access Denied"); a human
  can open it. Still counted unreachable.
- Zizzi and Gaucho run their booking on their own subdomain / in-page modal; the
  underlying provider was not established.
- Eva Bosphorus: the "Chef's tasting menu" phrase sits in an SEO keyword strip;
  truth left unknown, the extractor reports it with that quote.
- Hotel status of Eva Bosphorus (Demiray Hotel, per TripAdvisor) is not stated on
  its site, so it is not detectable from the site.

## For the integrator

- **Operator mapping** (`single | small_group | chain | hotel_fnb`): read
  `siteFacts.hotelOperator` first (any value -> `hotel_fnb`), then
  `siteFacts.locationCount.value` (e.g. 2-5 small_group, 6+ chain), then
  `siteFacts.locationHints` (multi-site but count unknown, e.g. "Part of the Bull
  Group" -> small_group or ask). Absence of all three is unknown, not `single`.
  Every fact has `url` + `quote` for the evidence shelf.
- `RoomOneInput.locationCount` today comes from sibling leads in the same account;
  `siteFacts.locationCount` can fill it when the account has one lead.
- `siteFacts.declaredLanguage` can feed a softer question ("menu only in EN?")
  without setting `languageCount`.
- `room-one-audit.ts` was not changed: none of the new facts maps onto an existing
  `RoomOneAudit` field. `head-agent.ts`, `review-analysis/*`, `review-analyst.ts`
  and `lead-intelligence-brief.ts` were not touched.
- Remaining blind spots worth a follow-up: deposits stated only on group-booking /
  FAQ pages (Dishoom) or on an external booking page (Lokanta's Dojo page);
  request-level third-party capture for lazy widgets; Akamai-protected hotel sites.

Re-run: `npx tsx scripts/website-audit-eval/run-eval.ts <outDir>` then
`npx tsx scripts/website-audit-eval/score.ts <outDir>/results.json scripts/website-audit-eval/truth.json --rows`.
