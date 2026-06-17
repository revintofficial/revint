# Revint site style guide

> Single source of truth for every shipped copy block under `src/app/(site)/*`.
> Built from prelogin_site_rebuild plan §3 + brand-assets §3 + positioning §3.
>
> Three required gates before any page ships:
>
> 1. **Humanizer no-ship list** — 20 AI-tell rules below
> 2. **Copywriting page structure** — 7-section skeleton, all sections present
> 3. **Marketing-psychology** — page's primary psych model declared in
>    `src/content/site/psych-map.ts` and reflected in section props

---

## 1. Humanizer no-ship list

Every shipped page is grep-audited against this list before merge.
Hits → fix, no exceptions.

| # | Rule | Tell | Fix |
|---|---|---|---|
| H1 | Em-dash overuse — like this everywhere | More than 2 em-dashes per page | Most em-dashes become commas, periods, or parentheses. Em-dash is a special tool, not punctuation seasoning. |
| H2 | Copula avoidance | "X serves as Y", "X functions as the Y" | "X is Y". Plain and short. |
| H3 | -ing fluff | "syncing context, underscoring the importance of, leveraging the…" | Cut the cluster. Make it a new sentence. |
| H4 | AI vocab | `crucial, pivotal, key, vital, delve, leverage, foster, garner, underscore, intricate, tapestry, landscape (abstract), seamless, robust, comprehensive, navigate (abstract), realm, journey, ecosystem (overused), holistic, paradigm, synergy, empower, unlock, harness, transformative, revolutionary, cutting-edge, next-generation, best-in-class` | Search each page before merge. Most of these collapse to a verb. |
| H5 | "Despite challenges…" / formulaic closer | "Despite these complexities, the future…" | Cut. End with a sentence carrying a specific number or a specific next action. |
| H6 | Vague attribution | "Experts say", "Industry reports show", "Studies indicate" | Name the source. Add the date. Link it. (positioning §3.1 has the real list.) |
| H7 | Rule of three | "We find, enrich, and learn" everywhere | Mix in 2- and 4-element groups deliberately. The brand line is intentionally 4: "Apollo finds. Clay enriches. Gong records. Revint remembers." |
| H8 | Title case headings | "Strategic Negotiations And Global Partnerships" | Sentence case. Only brand names and the first word are capitalised. |
| H9 | Curly quotes | `"…"` `'…'` | Straight quotes `"…"` `'…'` everywhere. `font-feature-settings` in `.site-root` enforces it. |
| H10 | Generic upbeat ending | "The future looks bright for vertical SaaS…" | Page ends with a concrete next step (CTA + what the user gets). |
| H11 | "Stands as a testament to…" | Importance inflation | Cut. Replace with "X exists to do Y." |
| H12 | Mechanical bold | Three **bold** spans per paragraph | At most one bold per paragraph. Bold the one thing the reader has to remember. Often the answer is no bold at all. |
| H13 | Filler phrases | "In order to", "It is important to note that", "At this point in time", "Needless to say", "It goes without saying" | Cut. "To". Just "now". Delete the sycophantic ones. |
| H14 | Hedging stack | "could potentially possibly might affect" | "may affect" or kill the sentence. |
| H15 | Hyphenated word pairs as adjectives in body copy | `data-driven`, `cross-functional`, `real-time`, `end-to-end`, `next-generation` | Drop the hyphen unless it's a compound noun. "data driven" "cross functional" "real time". |
| H16 | Persuasive-authority openers | "The real question is…", "At its core…", "It's worth noting…" | Open with the claim. The reader doesn't need a runway. |
| H17 | Signposting | "Let's dive in.", "Here's what you need to know.", "Without further ado." | Cut. Start with the content. |
| H18 | Sycophantic | "Great question!", "Of course!", "Absolutely!" | Forbidden on shipped surfaces. Audit /legal and /changelog too. |
| H19 | Emoji decorations | `🚀 Launch:` | Forbidden. Use a Lucide icon if a visual marker is needed. |
| H20 | Knowledge-cutoff disclaimer | "As of my last update…" | Date comes from `dateModified` in the schema. The visible page never apologises for its own freshness. |

---

## 2. Copywriting page structure (cornerstone pages)

Every cornerstone page presents these sections in this order. Marketing
pages that are not cornerstones (e.g. /changelog, /legal/*) may collapse
sections 3–5 but must keep 1 and 7.

1. **Above the fold**
   - Eyebrow (optional vertical/page tag, monospace, uppercase)
   - Headline — one line, ≤ 12 words. Names the audience + the outcome.
     Passes brand-assets §3.3 12-word test.
   - Subhead — 1–2 sentences. Says one new thing that isn't restating
     the headline.
   - Primary CTA — verb + what the user gets: `Book a 20-min demo`,
     `See it on a sample account`. `Submit`, `Learn more`, `Get started` banned.
   - Secondary CTA — lower commitment: `See the comparison`, `See sample
     account brief`, `See the math`.
2. **Proof row** — 3–5 monospace data cells with named, dated numbers
   (`200 accounts in 1 hour`, `12 fields per account synced`, `<1 hour
   onboarding`). If no specific number exists, the proof row stays out.
   Generic "trusted by" stripes are forbidden.
3. **Problem section** — pain quotes from positioning §3.1 (P-001..P-014)
   with source + date + link (humanizer H6). Each pain card is one
   sentence of pain in the customer's own language + the citation.
4. **Solution section** — customer outcome, not feature. "Synced into
   HubSpot" is feature. "Your SDR sees the brief inside the HubSpot card
   before they dial" is outcome.
5. **How it works** — 3–4 steps with a goal-gradient effect. The
   reference shape is "Connect HubSpot → Define your ICP → 200 accounts
   live → 30 days of closed-loop learning".
6. **Objection handling (FAQ)** — `<FAQBlock />` rendering the
   FAQPage schema. 5–8 questions specific to this page. Pull from
   `src/content/site/faq.ts`. brand-assets §7.1 Task 3 has the canonical
   master Q&A set.
7. **Final CTA** — new sentence, not a recap. Link the asset from
   brand-assets §9.5 that matches the page intent.

---

## 3. Sentence-by-sentence editing checklist (brand-assets §3.5)

For every sentence on a shipped page, ask:

1. **Could Apollo write this tomorrow?** → drop.
2. **Does this require local-business operational signals to be true?**
   → if no, drop.
3. **Does this require closed-loop CRM outcome data to be true?**
   → if no, drop.
4. **Would a 30-something VP Sales at FineDine, Workiz, or Curve Dental
   say "yes, that's me"?** → if no, drop.

Three of four must pass before the sentence ships.

---

## 4. Customer-language sources

Every quote on a shipped page comes from one of:

- **positioning §2.3 — persona direct quotes**
  - Daniel: Salesforce State of Sales 2026 via salesmotion
  - Sarah: Lemlist CMO podcast May 2026
  - Mike: Kwanzoo benchmark synthesis (r/sales 2026)
- **positioning §3.1 — P-001..P-014 pain quotes** (Kwanzoo, Discury,
  MiniLoop AI, Salesmotion, Toast SaaStr, SalesEcho Clay Review,
  Outreach BusinessWire, MarketBetter, Gong PRNewswire, Lemlist podcast,
  ICONIQ Growth)
- **positioning §3.2 — five first-person stories** (Ahmet at FineDine,
  Mike at HVAC, Sarah at dental, Daniel at CRO, Lena at Hospitality RevOps)
- **brand-assets §2.9 — 12 short brand assets** (verbatim, no rewrite)
- **brand-assets §1.3 — the 60-second Gong-objection sentence**

If a sentence requires a quote and none of the above fits, return to
positioning docs and find one. Inventing a quote is forbidden.

---

## 5. Voice — quick reference

Pulled from brand-assets §3. The full table is there.

### Use aggressively
operational intelligence · operational memory · closed-loop · vertical-aware ·
signal library · pre-call brief · vertical SaaS GTM · local business ·
account intelligence · HubSpot-native · vertical pack · Apollo finds, Clay
enriches, Gong records, we remember · `200 accounts in 1 hour`.

### Use carefully
memory layer (always with vertical qualifier) · revenue intelligence (always
with "for local business sales") · platform (only with "layer alternative") ·
smart (only as adjective for code primitives) · scale (only with concrete
number) · AI (only as feature, never as product) · personalization (only
when contrasted with "context") · enrichment (only when contrasted with
"learning") · outbound (always with "vertical" or "local") · predictive
(only with concrete model output) · engagement (only when contrasted with
"intelligence") · memory (always paired with substrate qualifier) ·
revenue (only with concrete metric).

### Never use
AI SDR · agentic · autonomous · revolutionary · 10x · transformative ·
next-generation · best-in-class · unified end-to-end · seamless · empower ·
leverage (as verb) · synergy · cutting-edge · disruptive · paradigm · realm
· journey · ecosystem (used vaguely) · tapestry · landscape (abstract).

---

## 6. Numbers — when to use mono, when not

- Every dollar amount, percentage, count, hour, or date in body copy →
  `.site-mono` (JetBrains Mono).
- Time references in prose ("in under an hour", "30 days") stay in the
  body font — they read as language, not as data.
- Tables, comparison rows, instrument-panel data cells → always mono.
- Headlines → never mono; even when they contain a number.

---

## 7. Citations

Every page that cites a third party renders the citation inline using
`<a class="site-source">` with the source name + year visible.
Footnotes-only patterns are not used because LLMs strip them on extraction.

Format:
> `[Salesforce State of Sales 2026](https://salesmotion.io/...)`

Render hint: source name, comma, year, no parenthetical fluff.

---

## 8. The pre-merge checklist

Run before raising a PR that touches a shipped page.

- [ ] Page passes humanizer no-ship list (search each of H1–H20 manually)
- [ ] All 7 copywriting sections present, or the deliberate omissions are
      noted in the PR description
- [ ] Primary psych model declared in `psych-map.ts` and reflected in
      props passed to the matching section primitive
- [ ] Every quote sourced from §4 above
- [ ] Sentence case headings only (H8)
- [ ] Straight quotes throughout (H9)
- [ ] No emoji icons (H19)
- [ ] FAQPage schema embedded if FAQ section is present
- [ ] `buildMetadata()` called with concrete title + description
- [ ] `npm run lint` clean
