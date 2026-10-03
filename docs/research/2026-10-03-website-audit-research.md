# Website audit: detection research (2026-10-03)

What we looked at to improve the restaurant website audit (`src/lib/extractor.ts`,
`src/lib/site-facts.ts`, `src/lib/site-signals.ts`, `src/lib/audit/booking-detection.ts`,
`src/lib/restaurant-vendors.ts`), what we adopted, and what we rejected.

Sources: Perplexity (via the Composio MCP, `PERPLEXITYAI_EXECUTE_AGENT`, pro-search
preset), vendor documentation pages it cited, and our own reading of 40 real lead
sites (rendered with Playwright, see `docs/research/2026-10-03-website-audit-accuracy.md`).
Every fingerprint we shipped was either seen on a real lead site or is the vendor's
documented embed marker; each one has a test on real or documented markup.

## 1. Open fingerprint datasets

| Dataset | License | Status | Decision |
|---|---|---|---|
| [enthec/webappanalyzer](https://github.com/enthec/webappanalyzer) | GPL-3.0 | maintained (2026 commits) | **Rejected** for copying: GPL-3.0 data cannot be vendored into a proprietary codebase. Used only as a pointer to which vendors exist. |
| [dochne/wappalyzer](https://github.com/dochne/wappalyzer) | GPL-3.0 | maintained | Rejected (license). |
| [HTTPArchive/wappalyzer](https://github.com/HTTPArchive/wappalyzer) | GPL-3.0 | maintained (HTTP Archive crawl fork) | Rejected (license). |
| [projectdiscovery/wappalyzergo](https://github.com/projectdiscovery/wappalyzergo) | MIT code, but ships the GPL data above | maintained | Rejected: Go, and the data is the GPL set. |
| [WhatWeb](https://github.com/urbanadventurer/WhatWeb) | GPL-2.0 | maintained | Rejected (license, Ruby). |

Generic tech fingerprinting is also the wrong granularity: it tells "SevenRooms
script present", not "this venue's table booking runs on SevenRooms". We kept a
small hand-written, host-based table instead (MIT-compatible, ours).

## 2. Structured data (schema.org)

Relevant properties (schema.org): `acceptsReservations` (Boolean / URL / Text) and
`hasMenu` / `menu` on `FoodEstablishment`; `potentialAction` with `ReserveAction`
/ `OrderAction`; `parentOrganization` (preferred over the superseded `branchOf`) for
chains; `containedInPlace` for a restaurant inside a hotel or mall; `LodgingBusiness`
/ `Hotel` / `Resort` types. See <https://schema.org/FoodEstablishment>,
<https://schema.org/acceptsReservations>, <https://schema.org/ReserveAction>,
<https://schema.org/parentOrganization>, <https://schema.org/containedInPlace>,
<https://schema.org/LodgingBusiness>.

Libraries considered:

| Package | License | Status | Decision |
|---|---|---|---|
| `web-auto-extractor` | MIT | last real activity 2017 | Rejected: unmaintained. |
| `htmlmetaparser` | Apache-2.0 | last release ~2023 | Rejected: a new dependency for what a 40-line cheerio walker does. |
| `microdata-node` | unclear | Microdata only | Rejected. |
| `metascraper`, `@extractus/article-extractor` | MIT | maintained | Rejected: Open Graph / article metadata, not schema.org entities. |
| `schema-dts` | Apache-2.0 | maintained | Not needed (types only). |

**Adopted:** a hand-rolled JSON-LD walker over cheerio (already a dependency) in
`site-signals.ts`: it follows `@graph`, `department`, `subOrganization`, `location`,
`hasPart`, `itemListElement`, counts distinct venue addresses (keyed by postcode so
the same venue written two ways counts once; this is what The Wolseley's two
address spellings needed) and reads `LodgingBusiness`-family types as a hotel signal.

Real-world caution: Pizza Pilgrims Soho publishes `"acceptsReservations": false`
while its page links a live SevenRooms booking. Structured data is stale often
enough that we never let it override a real booking link.

## 3. Reservation widgets

Adopted (host match on the actual link host + path where needed, or the vendor's
loader string in the rendered HTML):

| Provider | Marker | Source |
|---|---|---|
| SevenRooms | `sevenrooms.com` links; `sevenrooms.com/reservations/embed.js`, `/widget/` | lead sites (Wolseley, Flat Iron, Pizza Pilgrims, Dishoom, Mildreds, El Cenote, GALLADA, Bianco43); SevenRooms embed playbook |
| Dojo Bookings | `web.dojo.app/create_booking`, `app.walkup.co/create_booking` | lead sites (Padella, Lokanta, Bianco43, Flat Iron groups) |
| ResDiary | `resdiary.com` links, `booking.resdiary.com` widget | lead site (15grams); ResDiary widget docs (`booking.resdiary.com/widget/Standard/...`) |
| Quandoo | `quandoo.*` links, `booking-widget.quandoo.com/index.js` | lead site (Blue House); Quandoo widget docs |
| DesignMyNight / Collins | `designmynight.com/book`, `widgets.designmynight.com/bookings(-partner).min.js`, `dmn-booking-form` | Collins widget docs; event pages (`/london/whats-on/...`, seen on Pizza Pilgrims) deliberately excluded |
| Tock | `exploretock.com`, `tock.js`, `Tock_widget_container` | Tock docs |
| TableCheck | `tablecheck.com/.../shops/...` | TableCheck docs |
| Eat App | `eatapp.co/reserve` | Eat App docs |
| Formitable, Yelp Reservations | host match | vendor pages |
| OpenTable | more country hosts; `opentable.co.uk/widget` loader; the embedded form's own `/legal/` links as last resort | lead sites (Hawksmoor, Bill's, River Gardens, Ritz-Carlton Istanbul, Purezza) |

Rejected / changed:

- Substring matching on any HTML: BentoBox sites emit `<link rel="preconnect"
  href="https://widgets.resy.com">` on every venue (Mildreds read as Resy). Resource
  hints are now stripped before pattern matching.
- `squareup.com` as "Square Appointments": a Square gift-card link
  (`app.squareup.com/gift/...`, 15grams) is not a booking system. Only
  `/appointments` paths count.
- Booking.com as a table provider: it is a lodging OTA (Blue House's room booking).
  It is now a hotel signal.
- Zonal: offers an unbranded bookings widget with no stable public host
  (not established); not fingerprinted.

## 4. Digital / QR menu and ordering vendors

Adopted in `restaurant-vendors.ts`:

- Menus: FineDine (`finedinemenu.com`, seen on Blue House), **Menuzade**
  (`menuzade.com.tr`; Eva Bosphorus' `/menu` redirects there), Sunday
  (`sundayapp.io`), Mr Yum, me&u, Qlub, Yoello (`*.yoello.com`), MenuTiger, PlumQR.
- Ordering (venue-owned, not marketplace): Orderswift (Pizza Pilgrims, Zizzi),
  Storekit (`order.storekit.com`, Mildreds; documented), Vita Mojo (`vmos.io`,
  Honest Burgers), Sunday click & collect (`sun-d.io` short links 302 to
  `sundayapp.io/click-and-collect/...`, Purezza; verified with curl), Toast
  (`toasttab.com`, documented), Square Online (`square.site`), Flipdish
  (`my.flipdish.com`), Slerp (`*.slerp.com`), GloriaFood, OrderYOYO, Oddle, Mobi2Go.
- Marketplaces: Uber Eats' Singular short links `eats.sng.link` (302 to ubereats.com;
  Honest Burgers; verified with curl).

Caveat (from vendor docs): Storekit, Slerp, Flipdish and Menuzade let venues use
their own domain, so a missing vendor host does not mean "no vendor". That is why a
menu or ordering vendor is only ever asserted, never denied.

## 5. Languages

Order of evidence adopted in `detectLanguageCount`:

1. `<link rel="alternate" hreflang>` distinct languages, `x-default` excluded
   (Google Search Central, "Tell Google about localized versions").
2. Translation-plugin markup with documented markers: WPML `wpml-ls-item-{code}`,
   Polylang `lang-item-{code}`, GTranslate `window.gtranslateSettings.languages`,
   Google Website Translator `includedLanguages` (plugin docs).
3. A language switcher: same-site links labelled with a language name or code that
   point to `/xx/` paths or `xx.` subdomains (GALLADA "English / Türkçe", Deraliye "TR").
4. Otherwise `null`. A lone `<html lang>` is exposed separately as
   `declaredLanguage`, never as "1 language": Weglot / GTranslate switch client-side,
   and a multilingual QR or PDF menu is invisible on the homepage.

## 6. Deposit / card-guarantee wording

Adopted positives: "deposit" (not "no deposit", "without a deposit", "safe deposit
box", "security deposit"), "card details (are) required / taken / held", "card
details to secure", "credit card (details) are required", "pre-payment", "prepaid
booking", "kapora", "ön ödeme". A bare "cancellation fee" stays out (existing test).

Rejected sources of text: everything inside `<script>`, `<style>`, `<template>`,
`<noscript>`. Wix ships `specs.bookings.DepositeOrFullAmountUoU` and ResDiary ships
"Card details are required to secure your reservation" as JSON/i18n strings on every
venue; both produced false "takes a deposit" before.

## 7. Multi-location and hotel signals

Adopted (all in `site-signals.ts`, each with URL + quote, `null` when unseen):

- `locationCount` (only at 2+): distinct JSON-LD venue addresses; distinct child
  pages under a plural locations parent (`/locations/x`, `/pizzerias/x`,
  `/italian-restaurants/x`; singular parents need 3+ children); distinct UK
  postcodes in visible text (registered-office addresses skipped); "over 130
  restaurants" / "11 Gaucho restaurants across London" claims (years and set-menu
  "3 courses" ignored).
- `locationHints`: "Our Locations / Our Shops / Our Cafés" navigation, "Part of the
  Bull Group"-style phrases, a link to a `*group.*` / `*hospitality*` company site
  (thewolseleyhospitalitygroup.com, thebullgroup.com).
- `hotelOperator`: the site is on, or links to, a hotel-brand host (Ritz-Carlton /
  Marriott, Four Seasons, The Peninsula, Hilton, Hyatt, IHG, Accor brands, Rosewood,
  Mandarin Oriental, ...); `LodgingBusiness`-family JSON-LD; a room-booking engine
  link (istbooking, SiteMinder, Cloudbeds, SynXis, HotelRunner, Mews, Booking.com, ...)
  or "Book a room / Rooms & Suites" link.

Not adopted: counting Google Maps links (one venue often links several short URLs),
counting booking-provider venue slugs (a hotel lists all its outlets).

## 8. Playwright

Adopted: a current Chrome user agent (`CRAWLER_USER_AGENT`, Chrome 140): River
Gardens Café's WordPress host returns 403 to Chrome/120 and 200 to Chrome/140 and curl.
Subpages that redirect to another host keep `landedUrl` so the vendor host is evidence.

Considered, not adopted now (cost/benefit for the integrator to decide):

- `page.on("request")` third-party host capture: catches lazy widgets (SevenRooms /
  ResDiary scripts that load after interaction) but adds noise and a per-page
  allow-list; the host-based link table already covers the 40-site sample.
- `waitUntil: "networkidle"`: slower and flaky on sites with analytics beacons; the
  existing `load` + 2 s wait was enough on every reachable sample site.
- Akamai-protected hotel sites (fourseasons.com returns "Access Denied" to headless
  Chromium) need a headed/stealth browser or a fetch service; out of scope.
- PDF menus: we record the PDF URL (now also on CDN hosts and from the menu page);
  parsing PDF text for languages/prices was not attempted.
