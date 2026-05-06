# Sprint 1 deploy runbook (Round 2 Hafta 1 Hotfix)

> **Source plan:** `research/finedine/round2-plans/00-unified-plan.md` §3.1 + Sprint 1 plan §6.
> **Status:** Code complete + 63/63 unit + 11/11 smoke-test PASS. This runbook covers the operator steps that aren't automatable from the agent (Vercel deploy, production SQL, telemetry).

---

## Pre-flight (Day 1, sabah)

```bash
# Read-only baselines — must run BEFORE any merge.
npx tsx scripts/sprint1-preflight.ts > sprint1-day1-baseline.txt

# Capture the values you'll need later for the post-deploy comparison.
grep "extractor.has_online_reservation_true" sprint1-day1-baseline.txt
# → set EXPECTED_RESERVATION_BASELINE for post-deploy

grep "qr_menu.e_menu_count" sprint1-day1-baseline.txt
# → must be ≤ 5 to merge PR-W1.B
```

If `qr_menu.e_menu_count >= 5`: stop, manually review the rows, decide whether to grandfather them or re-add `e-menu.com` as a hostname-only provider entry. The Sprint 1 plan §4.2 calls this out explicitly.

---

## Local code-level smoke (any time, before merge)

```bash
# Fast (≈10s) — exercises the §1 acceptance criteria against synthetic
# fixtures using the production code paths. No DB, no network.
npx tsx scripts/sprint1-smoke-test.ts
```

Must print `11/11 acceptance criteria satisfied.` and exit 0. This is the
floor — staging UI click-through (below) is the ceiling.

```bash
# Full unit suite (≈4s).
npx vitest run \
  src/__tests__/lib/labels-humanize.test.ts \
  src/__tests__/lib/extractor-qr-menu-and-reservation.test.ts \
  src/__tests__/review-analysis/kpi-filter.test.ts \
  src/__tests__/agent-workers/review-analyst.test.ts \
  src/__tests__/agent-workers/opener-writer-website-context.test.ts \
  src/__tests__/agent-workers/quota.test.ts \
  src/__tests__/ai-core/quota-apify.test.ts
```

Expect `63/63 passed`.

---

## Staging deploy + UI smoke (Day 2, öğle)

1. Merge PRs in this order:
   - PR-W1.A (UI display) — independent.
   - PR-W1.B (extractor + WEBSITE_EXPIRED) — must precede backfill.
   - PR-W1.C (review-analyst hard rails) — independent.
   - PR-W1.D (opener websiteContext) — independent.
   - PR-W1.E (quota disclosure) — independent.
2. Vercel staging auto-deploys.
3. Manual UI click-through on the 12 Round 2 Camden leads. Confirm:
   - **§1.1** Tier badge gone from lead detail header.
   - **§1.2** "No WhatsApp" + "no_whatsapp" never both appear.
   - **§1.3** Coffee Couch / acai-shop leads show humanized type.
   - **§1.4** Coffee Couch / YBA Brazil don't show Instagram default meta.
   - **§1.5** LUMI Camden no longer claims "Online reservation: Yes".
   - **§1.6** Glass / Camden Roastery / Black Sheep no longer say "QR menu tool: E-Menu".
   - **§1.7** Fable and Falcon shows the new "Website expired" banner (NOT "site reachable").
   - **§1.8** S.O.S small-sample lead shows empty weaknessKpis (no "Expensive 100%").
   - **§1.9** YBA / S.O.S / The Drip don't surface label-echo / fusion / 1-token KPIs.
   - **§1.10** One Shot Coffee opener says "Facebook sayfanızı" (NOT "websitenizi"); chains skip per-location pitches.
   - **§1.11** Force a quota block on a test workspace; UI shows the right copy ("daily lead cap" vs "Apify budget" vs "monthly worker limit").

If any UI step fails, file a hotfix-on-hotfix and iterate.

---

## Backfill (Day 2 PM, after PR-W1.B is in production)

```bash
# 1. Dry run — confirm the script's count matches the Day-1 SQL baseline.
npx tsx scripts/backfill-social-url-audits.ts --dry-run

# 2. Apply.
npx tsx scripts/backfill-social-url-audits.ts --apply

# 3. 24h monitoring — paste the SQL printed at the end of the apply
#    output into the Datadog SQL panel or psql.
```

Acceptance: SUCCEEDED + SUCCEEDED_NO_MEMORY ≥ 80%, FAILED rows only from the Round 1 #7 embed crash (Hafta 2 PR-W2.F kapsamı).

---

## Production deploy (Day 2 sonu)

1. Promote staging → production via Vercel (or your usual flow).
2. Run post-deploy verification:

```bash
# Pass the Day-1 baseline so the script can compute the delta.
EXPECTED_RESERVATION_BASELINE=<from Day 1 output> \
EXPECTED_BACKFILL_REMAINING_MAX=5 \
npx tsx scripts/sprint1-preflight.ts --post-deploy
```

Exit codes:
- `0` clean — Sprint 1 ✓
- `2` assertion failed — block sign-off, decide whether to roll back the offending PR or re-run the backfill.

3. Telemetry (Datadog / your APM):
   - Add panel `quota.block_reason` (counter, dimension = blockReason). New emissions land via PR-W1.E.
   - Add panel `review_analyst.dropped_for_pool_floor` (counter). Bumped by the kpi-filter on every blocked KPI.
   - Add panel `extractor.qr_menu.short_pattern_hostname_match` (counter). Distinguishes legitimate finedinemenu/menugram hits from the legacy false-positives.

---

## Definition of Done (Plan §6)

- [x] 5 PR + 1 backfill script merge'lendi (code complete).
- [x] Tüm PR'lar için Vitest yeşil (63/63 lokal).
- [x] `npm run lint` + typecheck clean.
- [ ] Staging'de 12 Round 2 lead fixture'ında manuel smoke test geçti — operator step.
- [ ] Pre-flight SQL'leri post-deploy tekrar koşturup sayılar 0'a / beklenen yöne döndü — `--post-deploy` mode.
- [ ] Backfill 24h gözlem: SUCCEEDED ≥ %80, FAILED Round 1 #7 embed crash dışında 0.
- [ ] Production deploy → telemetri ekleri canlı.

The unchecked items require live access (staging cluster, production DB, Datadog). The agent has produced every artifact needed to execute them; flip each box as the team completes the operational step.
