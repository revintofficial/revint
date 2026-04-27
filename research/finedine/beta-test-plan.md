# FineDine Beta Test Plan — F&B Hybrid Niche Architecture

**Owner:** PM/Engineering · **Audience:** 2 beta testers (FineDine BD)
**Scope:** Validate the parent + 10-child F&B niche architecture end-to-end before opening it to the 500-person sales team.
**Time budget:** ~2 hours per tester for the full pass; 30 min for the smoke pass.

---

## 0. Roles & accounts

| Role | Email | Plan | Seats |
|---|---|---|---|
| Owner | `owner@finedine.com` | AGENCY (100yr trial) | 5 |
| Tester 1 | `tester1@finedine.com` | MEMBER | — |
| Tester 2 | `tester2@finedine.com` | MEMBER | — |

### Provisioning

```bash
# 1. Each email signs up at /auth/signup → magic link → confirm.
#    The script below assumes auth.users rows already exist.

# 2. Seed the workspace (run from project root):
npx tsx scripts/seed-finedine-beta.ts \
  --owner owner@finedine.com \
  --tester tester1@finedine.com \
  --tester tester2@finedine.com \
  --name "FineDine Beta" \
  --slug finedine-beta \
  --country TR \
  --language tr
```

After the script runs, the readout should show:
- `plan: 'AGENCY'`
- `niche: 'RESTAURANT_TECH'`
- `target_sub_niches: []` (= all 10 children)
- `seats: 3`
- 1 OWNER + 2 MEMBER rows

---

## 1. Smoke test (30 min) — must pass before tester pass

**Goal:** confirm the workspace boots and all 13 hybrid-niche surfaces render.

| # | Action | Expected | Where to look |
|---|---|---|---|
| 1.1 | Owner signs in → `/app/dashboard` | Loads without onboarding redirect (since `onboardingCompletedAt` is set). | Browser URL stays at `/app/dashboard`. |
| 1.2 | Open Settings → My Offer | Niche dropdown shows "F&B / Hospitality (...)" selected. Below it, a 10-checkbox grid of sub-niches with labels + taglines. | `src/components/app/offer-form.tsx`. |
| 1.3 | Tick `fnb-fine-dining` + `fnb-bar-club` + `fnb-hotel-fnb`, save. | Toast "Offer context updated". DB column `workspaces.target_sub_niches = ['fnb-fine-dining','fnb-bar-club','fnb-hotel-fnb']`. | See SQL §6.1. |
| 1.4 | Open `/app/discovery`. | Two-level niche picker visible: "F&B / Hospitality" parent + sub-niche dropdown defaulting to "Auto-classify (all sub-niches)". | `src/app/app/discovery/page.tsx`. |
| 1.5 | Tester 1 signs in. | Lands in `FineDine Beta` workspace as MEMBER. | Header shows workspace name. |
| 1.6 | Tester 2 signs in (different browser / incognito). | Same workspace, MEMBER. | Header shows same workspace. |

**STOP** if any of 1.1–1.6 fail. Capture browser console + server logs and ping engineering before proceeding.

---

## 2. Discovery — fan-out vs single-child vs narrowed (20 min)

### 2.1 Parent fan-out (default)
- Settings → clear all `targetSubNiches` (uncheck every box, save).
- Discovery → niche picker = "All F&B (auto-classify)", borough = `Beşiktaş, Istanbul`, click **Search**.
- **Expect:** One spinner. After ~25–60s, `n` leads appear. Server logs should contain:
  ```
  api.discovery.fanout_start { parent: "fnb", childCount: 10, focusedTo: "all" }
  api.discovery.fanout_done { totalRaw: ~80–200, deduped: ~40–100 }
  ```
- **Inspect:** Each lead row in DB should have `discoverySourceQuery` set to the child's primary search query (not `null`). See SQL §6.2.

### 2.2 Narrowed fan-out
- Settings → tick only `fnb-fine-dining` + `fnb-bar-club`, save.
- Repeat 2.1 (same borough is fine; existing leads are skipped via place_id unique).
- **Expect:** server log `focusedTo: ["fnb-fine-dining","fnb-bar-club"]`, only 2 child queries fire. Total raw count drops to ~20–40.

### 2.3 Single-child explicit pick
- Settings → clear `targetSubNiches` again.
- Discovery → niche picker = "F&B" then sub-niche dropdown = "Cocktail Bar / Club".
- **Expect:** Single search query (not fan-out). Leads come back tagged with `nicheSlug = 'fnb'` and `subNicheSlug = 'fnb-bar-club'` immediately, **`subNicheSource = 'MANUAL'`** (because the rep explicitly chose it — classifier should self-skip; see §3.3).

### 2.4 Bug catches
- Discovery for an empty borough → friendly empty state, not 500.
- Same borough run twice → 0 new leads (dedup), not duplicates. Toast "0 new" not error.

---

## 3. Auto-classifier (rule-first → Gemini fallback) (15 min)

**Goal:** verify each lead the BALANCED pipeline tags ends up in the right child slug, with `subNicheSource = 'AUTO'` and a sensible `subNicheConfidence`.

### 3.1 Rule-based hits (high confidence ≥ 0.85)
After a fan-out discovery completes, run SQL §6.3 to list classifications. Sample expectations:
- `Hilton Istanbul` (name contains "hilton") → `fnb-hotel-fnb`, conf ≥ 0.90, source=AUTO, classifierSource=`rule`.
- `Kahve Dünyası` (Turkish for "coffee world") → `fnb-cafe-bakery`, conf ≥ 0.80.
- `Burger King` (QSR brand keyword + meal_takeaway type + low priceLevel) → `fnb-qsr`, conf ≥ 0.85.
- `Sunset Beach Club` → `fnb-bar-club`, conf ≥ 0.88.

### 3.2 Gemini fallback (mid confidence)
Look for leads whose business name doesn't trip any regex (e.g. `Mikla`, `Neolokal`). They should:
- have `subNicheSlug` set (not null)
- `subNicheConfidence` 0.55–0.85 typically
- `AgentRun.metadata.classifierSource = 'gemini'`

### 3.3 Manual lock
- Pick any AUTO-classified lead. Open its detail page.
- "Sub-niche focus" card shows the badge + dropdown.
- Change to a different sub-niche. Save.
- **Expect:**
  - Toast "Sub-niche updated".
  - DB: `subNicheSource = 'MANUAL'`, `subNicheConfidence = 1`, `subNicheVersion += 1`.
  - In server logs: a new `WEBSITE_AUDITOR` + `OPENER_WRITER` run is scheduled (see §6.4 SQL).
  - Re-trigger of the classifier worker should self-skip with `reason = 'manual-locked'`.

### 3.4 Stale-version guard
This is the hardest case to test manually but the most important. While a new run is in flight, override the sub-niche again. The first run, when it dequeues, should exit early:
- `AgentRun.status = 'SUCCEEDED'`
- `AgentRun.outputJson.stale = true` and `reason = 'subniche-version-mismatch'`
- The newer run completes normally.

If you can't reliably create the race, at minimum confirm the column shape:
- `AgentRun.inputSubNicheVersion` is **non-null** for runs enqueued after the schema change. SQL §6.5.

---

## 4. Audit / Opener / Mockup branching (30 min)

For each tester, walk through 5 leads spread across at least 5 different sub-niches. For each:

| Surface | What to verify |
|---|---|
| Website audit checklist | Sub-niche-specific checks present (e.g. fine-dining → "Sommelier / wine list page", bar → "Tab-split / age-gate", QSR → "Mobile combo upsell"). Generic web checks still there too. |
| Opener email | First sentence references **the right pain point** for the sub-niche, NOT a generic "QR menu" line for a bar/club. |
| Mockup template | Fine-dining + bar + QSR → handcrafted template (rich, vertical-specific UI). Other 7 → generic restaurant template. Opener should NOT name "Sky Bar tab-split UI" if mockup is generic. |
| Confidence gate | If `subNicheConfidence < 0.7` AND `subNicheSource = 'AUTO'`, opener should fall back to **parent F&B angle** (generic but correct), not vertical-specific. Look for a low-confidence lead and check the email body. |

**Voice/tone check:** all openers respect the workspace `tone = 'professional'` + `length = 'short'` + `language = 'tr'` you set during seed.

### 4.1 Override re-run quality
Pick a lead that the classifier got wrong (Tester 1 finds at least one). Override sub-niche → wait ~30s for re-run.
- New audit checklist matches new sub-niche.
- New opener email pivots to new pain point.
- Mockup either swaps to handcrafted (if applicable) or stays generic-but-correct.

---

## 5. Memory + cross-niche learning (10 min, day 2 onwards)

**Goal:** confirm the asymmetric write + weighted union read works.

### 5.1 Positive signals dual-write
- Mark an opener as "Sent" + later "Replied" (or via the success endpoint).
- SQL §6.6 should show **two** `SemanticMemory` rows for that opener: one with `nicheScope = 'fnb-bar-club'`, one with `nicheScope = 'fnb'`.

### 5.2 Negative signals child-only
- Mark an opener as "Failed" / "Bounced".
- SQL §6.6 should show **one** row only, scoped to the child slug. No `fnb` parent row. (Negative signals must not pollute siblings.)

### 5.3 Weighted union read
- Pick a fresh lead in a sub-niche where you've already accumulated ≥3 successes.
- Re-trigger `OPENER_WRITER` on a brand-new sub-niche lead (e.g. first ever cafe lead).
- Inspect the run's `metadata.memoryHits`: should be a mix of cafe-scope (if any) **and** parent F&B successes (weight 0.5). Logging line: `opener_writer.memory_union_count`.

---

## 6. SQL inspection helpers

Run from any Postgres client (Supabase SQL editor / psql / TablePlus). All queries assume `wsId` resolved from §0. Get it with:

```sql
select id, name, plan, niche, target_sub_niches
from workspaces
where slug = 'finedine-beta';
```

### 6.1 Verify offer + targetSubNiches saved
```sql
select offer_name, value_proposition, target_sub_niches, language, country
from workspaces where id = '<wsId>';
```

### 6.2 Discovery fan-out attribution
```sql
select sub_niche_slug, source_query, discovery_source_query, count(*)
from leads
where workspace_id = '<wsId>'
  and created_at > now() - interval '1 hour'
group by 1,2,3
order by count(*) desc;
```
Every row should have a non-null `discovery_source_query` after a fan-out run.

### 6.3 Classifier results breakdown
```sql
select
  coalesce(sub_niche_slug, '(unclassified)') as sub_niche,
  sub_niche_source,
  round(avg(sub_niche_confidence)::numeric, 2) as avg_conf,
  count(*) as leads
from leads
where workspace_id = '<wsId>'
group by 1, 2
order by leads desc;
```

### 6.4 Classifier source split (rule vs gemini)
```sql
select coalesce(metadata->>'classifierSource', 'unknown') as source, count(*)
from agent_runs
where workspace_id = '<wsId>'
  and kind = 'SUBVERTICAL_CLASSIFIER'
  and status = 'SUCCEEDED'
group by 1;
```
Healthy ratio: ~70–80% `rule`, 20–30% `gemini`. If 100% `gemini` → rules aren't matching, ping engineering.

### 6.5 Stale-version guard sanity check
```sql
select kind, status,
       output_json->>'stale' as stale,
       output_json->>'reason' as reason,
       count(*)
from agent_runs
where workspace_id = '<wsId>'
group by 1, 2, 3, 4
order by kind;
```
After at least one override, you should see at least one `SUCCEEDED` row with `stale='true'` for `WEBSITE_AUDITOR` or `OPENER_WRITER`. If overrides happen and you NEVER see this, the guard isn't being respected → bug.

### 6.6 Memory write asymmetry
```sql
select kind, niche_scope, count(*)
from semantic_memory
where workspace_id = '<wsId>'
group by 1, 2
order by 1, 2;
```
Expectations after some pipeline activity:
- `LEAD_PROFILE` rows in BOTH child slugs and `fnb`.
- `OPENER_SUCCESS` rows in BOTH.
- `OPENER_FAILURE` rows ONLY in child slugs (no `fnb` parent rows).

### 6.7 Quota burn
```sql
select plan, leads_this_cycle, ai_credits_this_cycle, cycle_reset_at
from workspaces where id = '<wsId>';
```
AGENCY plan limits live in `src/lib/plans.ts` — check we haven't tripped the cap.

---

## 7. Public-page sanity (5 min)

Pick any niche+city combo with ≥3 audited leads in the workspace. Visit:
- `/niches/<verticalSlug>` (e.g. `/niches/bar`) → page hero references the **specific sub-niche** (label + tagline from the matched NichePack), not generic "Bar".
- `/niches/<verticalSlug>/<citySlug>` (e.g. `/niches/bar/istanbul`) → same, plus city.
- View source → JSON-LD includes `BreadcrumbList`, `CollectionPage`, `ItemList`.
- Open in incognito (no auth) → still loads. Indexable (`<meta name="robots" content="index,follow">`).

For sub-niches without a matching primaryType (e.g. ghost kitchen often = `meal_delivery`), confirm the page falls back gracefully to the generic intro instead of breaking.

---

## 8. Bug-report template

When something goes wrong, capture this in your bug ticket so engineering doesn't have to ping back:

```
## What
[1-line description]

## Where
- URL:
- Workspace ID:
- Lead ID (if applicable):
- Sub-niche slug (if applicable):

## Expected vs Actual
Expected:
Actual:

## Repro
1.
2.
3.

## Evidence
- Screenshot / video:
- Console errors:
- Network tab (relevant request):
- Server logs (if visible):

## SQL state at time of bug
[paste the relevant query from §6 + its output]
```

---

## 9. Acceptance criteria (PM sign-off)

Beta passes when **all** of these are green for both testers across at least 50 unique leads:

- [ ] Fan-out discovery returns leads tagged with `discoverySourceQuery` from at least 6 of the 10 child queries.
- [ ] ≥ 70% of AUTO-classified leads have `subNicheConfidence ≥ 0.7` and the assigned slug matches a human spot-check (random sample of 20).
- [ ] Manual override invalidates downstream artifacts within 60s — the new audit + new opener reflect the new sub-niche.
- [ ] No "Sky Bar UI"-style generic-mockup-vs-specific-opener mismatch in any of the 50 leads spot-checked.
- [ ] No `agent_runs.outputJson.stale = true` rows appear without a corresponding override (i.e. no false positives killing fresh runs).
- [ ] Memory table shows asymmetric write pattern as in §6.6.
- [ ] Public niche/city pages render pack-aware copy.
- [ ] Both testers complete the full 50-lead pass in ≤ 90 minutes each (cycle-time check vs the legacy "manual tag-then-write" workflow).

When all 8 are checked → ship to the 500-person team behind the same workspace template.

---

## 10. Rollback

If a sev-1 bug is found and we need to neutralize the hybrid layer for the 500-person rollout:

```sql
-- Force every workspace back to flat-niche behaviour by clearing sub-niches.
update workspaces set target_sub_niches = '{}'::text[] where niche = 'RESTAURANT_TECH';

-- Optional: bulk-clear lead sub-niche assignments so opener falls back to
-- parent F&B angle. Confidence gate handles the rest automatically.
update leads
   set sub_niche_slug = null,
       sub_niche_source = null,
       sub_niche_confidence = null,
       sub_niche_version = sub_niche_version + 1
 where workspace_id in (select id from workspaces where niche = 'RESTAURANT_TECH');
```

The classifier worker remains harmless — it self-skips when `subNicheSource = 'MANUAL'`, and after the bulk-clear it'll re-tag leads on the next pipeline run when re-enabled.
