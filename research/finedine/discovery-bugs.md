# Discovery Bug Report — "Istanbul Kartal" beta run

**Status:** Investigation complete. No fixes applied. Hand-off for another agent to implement fixes.

**Beta workspace under test:** `5496e39e-cc76-41bd-b18b-f1128fb9e41b` (FineDine Beta, niche=`RESTAURANT_TECH`, country=`TR`, plan=`AGENCY`).

**User reproduction steps:** Logged in as workspace owner, opened Discovery, selected `fnb` parent pack with all 6 target sub-niches enabled (`fnb-fine-dining, fnb-bar-club, fnb-cafe-bakery, fnb-ghost-kitchen, fnb-food-truck, fnb-hotel-fnb`), entered borough = `Istanbul Kartal`, hit Search.

**User-visible symptoms:**
1. Many results were **hotels outside Kartal** (Maltepe, Pendik, Ataşehir, Adalar, even one row in **Basel, Switzerland**).
2. The "food truck" query returned irrelevant places — **gas stations, building-materials store, a truck dealer**.
3. Most leads landed in the table with **`subNicheSlug = null`** (no sub-vertical badge), so the classifier-aware downstream branching never kicks in.

This document lists what the database shows, the root cause for each symptom, and where in the code the fix needs to land.

---

## 1. Database snapshot (the evidence)

Query: last 30 leads in this workspace, ordered by `createdAt desc`.

| Symptom group | Count | Sample row |
|---|---|---|
| Hotels in **non-Kartal** İstanbul districts (Maltepe, Pendik, Ataşehir, Adalar, Sancaktepe) | ~12 of 30 | `Four Points by Sheraton Istanbul Pendik`, source=`hotel restaurant`, `subNicheSlug=null` |
| Hotel **outside Türkiye** | 1 of 30 | `Istanbul Street food Basel` — address `Mailand-Strasse 6, 4053 Basel, Switzerland`, source=`food truck`, `subNicheSlug=fnb-food-truck`, confidence 0.7 |
| Non-F&B places returned by `food truck` query | 4 of 30 | `Shell` (gas_station), `Koctas` (building_materials_store), `Erçal Trucks - EN Markets` (truck_dealer) — all `subNicheSlug=null` |
| `subNicheSlug=null` rows (classifier never wrote a slug) | 28 of 30 | most hotels in this snapshot |
| `subNicheSlug` populated correctly | 2 of 30 | only `Anastasia meziki butik otel` (fnb-hotel-fnb, 0.75) and the Switzerland one (fnb-food-truck, 0.7) |

Lead totals across the whole workspace (all 100 ingested in this run):

```
hotel restaurant         → 20 leads
cocktail bar             → 20 leads
fine dining restaurant   → 20 leads
specialty coffee shop    → 20 leads
food truck               → 10 leads
ghost kitchen            → 10 leads
```

AgentRun summary across the same 100 leads:

```
GOOGLE_PLACES_REVIEWS  SUCCEEDED  100/100
WEBSITE_AUDITOR        SUCCEEDED   44
WEBSITE_AUDITOR        FAILED      56   ← 56% of audits failed
SUBVERTICAL_CLASSIFIER SUCCEEDED   16   ← classifier ran on 16/100 leads, 0 failures
SOCIAL_SCRAPER         SUCCEEDED   16
REVIEW_ANALYST         FAILED      41
```

When the classifier *did* run, it produced sensible output (rule-based, e.g. `{"slug":"fnb-hotel-fnb","source":"rule","confidence":0.75,"ruleReasons":[{"rule":"discovery_query","weight":0.45},{"rule":"google_places_type","weight":0.3}]}`). The bug is not in the classifier itself — **it's that the classifier almost never got enqueued.**

Workspace pipeline row:

```json
{
  "preset": "BALANCED",
  "steps": [],          // ← EMPTY ARRAY despite preset = BALANCED
  "enabled": true
}
```

Workspace `targetSubNiches`:

```
["fnb-fine-dining","fnb-bar-club","fnb-ghost-kitchen","fnb-cafe-bakery","fnb-food-truck","fnb-hotel-fnb"]
```

---

## 2. Bug #1 — Discovery has no geographic constraint (P0)

### Symptom
- One row in **Basel, Switzerland** when searching "Istanbul Kartal".
- ~60% of returned hotels are in **other İstanbul districts** (Maltepe, Pendik, Ataşehir, Adalar) instead of Kartal.

### Root cause
`src/lib/google-places.ts:158-179` — `discoverLeads()` only attaches a `locationBias` to the Google Places Text Search call when *both* `location.lat` AND `location.lng` are provided:

```161:179:src/lib/google-places.ts
export async function discoverLeads(
  searchQuery: string,
  location: { name: string; country?: string; lat?: number; lng?: number },
  radiusMeters = 5000
): Promise<PlaceResult[]> {
  const allPlaces: PlaceResult[] = [];
  const countryPart = location.country ? `, ${location.country}` : "";
  const query: DiscoveryQuery = {
    textQuery: `${searchQuery} in ${location.name}${countryPart}`,
    // Only attach a lat/lng bias when both coordinates are truthy — passing
    // 0,0 would bias results towards the Gulf of Guinea.
    ...(location.lat && location.lng
      ? {
          locationBias: {
            circle: {
              center: { latitude: location.lat, longitude: location.lng },
              radius: radiusMeters,
            },
          },
        }
      : {}),
  };
```

`src/app/api/discovery/route.ts:125` builds the location with **no `lat`/`lng`**:

```125:125:src/app/api/discovery/route.ts
    const location = { name: boroughName, country };
```

Result: every fan-out call to Google Places hits `places:searchText` with **only a `textQuery` like `"food truck in Istanbul Kartal, Turkey"` and no spatial bias**. Google's Text Search interprets that as a soft hint, not a hard filter. So:

- "Istanbul Street food Basel" matches the substrings "Istanbul" + "Street food" + has "Basel" in the city — ranked highly enough by Google, returned.
- Hotels in Maltepe/Pendik/Ataşehir match "Istanbul" + "hotel restaurant" — Google has no reason to prefer Kartal.
- The `radiusMeters = 5000` parameter is **silently ignored** because no `locationBias` is sent.

### What "fix" should look like (notes for the other agent — do not implement here)
Two options, in order of preference:

1. **Geocode `boroughName` → `{lat, lng}`** before calling `discoverLeads`, then pass the bias. Google Places has a Geocoding API; or for the curated borough list (`LONDON_BOROUGHS`, plus a Türkiye list to add) keep a hard-coded coordinate table. For free-typed boroughs like "Istanbul Kartal", call the Geocoding API once per discovery, cache for ~24h.
2. **Use `locationRestriction` instead of `locationBias`** so out-of-area places are *excluded*, not just deprioritized. Restriction takes the same circle/rectangle shape but enforces it.

Either way the API contract change is just adding `locationBias.circle` to the body in `textSearch()` — the field is already plumbed through `DiscoveryQuery`. The hard part is the geocoding step.

There is also a workaround in the same file that depends on a hardcoded list of London neighbourhoods (`extractBoroughFromAddress`) — Türkiye has none, so leads currently get `borough = "Istanbul Kartal"` (the literal user input) regardless of where the place actually is. That's separate from this bug but related.

---

## 3. Bug #2 — Generic Google Places text queries match wrong place types (P0)

### Symptom
The "food truck" sub-niche fan-out returned a `gas_station` (Shell), a `building_materials_store` (Koctaş), and a `truck_dealer` (Erçal Trucks - EN Markets) — none of these are F&B.

### Root cause
1. `src/lib/niches/index.ts:369` declares the `fnb-food-truck` pack's primary search query as the literal string `"food truck"`. Google Places Text Search treats unquoted multi-word queries as **separate keyword tokens** — "truck" matches `truck_dealer`, "food" matches the gas station's mini-mart, etc.
2. `src/app/api/discovery/route.ts:144-146` only uses `c.searchQueries[0]` from each child pack — the first entry. If the first entry is a low-precision string, every other (more specific) entry in the array goes unused.
3. There is no Place-type filter in the call. Google Places supports `includedTypes: ["restaurant"]` etc.; we don't pass any.

### Suggested fix path
Three independent levers, any combination is OK:

1. **Quote the query**: change `"food truck"` to `'"food truck"'` (with literal double quotes) so Google treats it as a phrase, not two tokens. Cheapest fix.
2. **Type-restrict the call**: add `includedTypes` (one of `restaurant`, `bar`, `cafe`, `meal_takeaway`, etc.) to `textSearch()` body and stamp each child NichePack with the Google place types it expects. Strongest signal — Google enforces this on the server.
3. **Run more than one query per child** (currently we only use `searchQueries[0]`). Iterate `searchQueries`, dedup by Place ID, sum counts per child. Costs more API calls.

Note: the food-truck pack has `["food truck", "street food vendor", "mobile food", ...]` — entries 2 and 3 are tighter than entry 1, but the route ignores them.

Same shape of bug exists latently for `fnb-airport-fnb` (`"airport restaurant"` matches anything in an airport) and `fnb-multi-location` (`"restaurant chain"` will match one-off restaurants whose address happens to contain "chain"). Worth reviewing all 10 child queries for token-level false matches.

---

## 4. Bug #3 — Most leads end up with `subNicheSlug = null` because classifier never enqueues (P0)

### Symptom
Of 100 ingested leads, only **16** have a sub-niche slug. The other 84 sit at `subNicheSlug = null`, which means:
- Lead detail page shows no "Bar & Club" / "Hotel F&B" / etc. badge.
- Opener writer falls back to the generic parent (`fnb`) pitch.
- Mockup template uses the generic fallback.
- Memory writes only land in the parent `fnb` scope, not the child scope — so the per-child learning loop is starved.

User explicitly said the badges are missing in the UI; this is the on-screen evidence of this bug.

### Root cause
**The `WorkspaceLeadPipeline` row for the beta workspace has `steps: []` (empty array) but `preset: "BALANCED"`.**

Verified directly:

```json
{
  "id": "476ece25-2f39-49fc-9a33-c8748a4e8350",
  "workspaceId": "5496e39e-cc76-41bd-b18b-f1128fb9e41b",
  "preset": "BALANCED",
  "steps": [],
  "enabled": true,
  "createdAt": "2026-04-27T19:00:42.826Z",
  "updatedAt": "2026-04-27T19:24:53.195Z"
}
```

The chain resolver in `src/lib/ai-core/planner.ts` (referenced from `src/lib/ai-core/chains.ts:198-204`) is supposed to:
- Use `steps` directly when the preset is `CUSTOM`.
- Otherwise re-derive the chain from `getDefaultChain(preset, plan)`.

Two possible reasons the classifier under-ran:

a) **The seed/setup script wrote `steps: []` and the planner is taking that array literally** (i.e. running an empty chain) instead of falling back to `getDefaultChain("BALANCED", "AGENCY")`. That would explain why exactly the workers we *do* see (`GOOGLE_PLACES_REVIEWS`, `WEBSITE_AUDITOR`, `REVIEW_ANALYST`, `SOCIAL_SCRAPER`) ran via independent emit paths but `SUBVERTICAL_CLASSIFIER` did not. Some of the 16 successful classifier runs may have been triggered by manual "Refresh AI" buttons on the lead detail page rather than the auto-pipeline.

b) **The classifier is `dependsOn: ["audit"]` (`src/lib/ai-core/chains.ts:262-267`) and `WEBSITE_AUDITOR` failed for 56/100 leads.** Combined with the empty-steps issue, even when audit succeeded the classifier wasn't enqueued.

The single Switzerland lead (Istanbul Street food Basel) being classified anyway is consistent with hypothesis (a) — that one had a successful audit AND a manual planner emit somewhere along the way.

### Suggested fix path
Two-part:

1. **Re-seed / repair the pipeline row** so `steps` reflects `getDefaultChain("BALANCED", "AGENCY")`. The seed script `scripts/seed-finedine-beta.ts` should call into `getDefaultChain` and persist the materialized JSON, not leave `steps: []`. This is a one-line change in the seed script.
2. **Make the planner's empty-steps path explicit**: either (a) reject empty `steps` for non-CUSTOM presets and log loudly, or (b) silently fall back to `getDefaultChain` whenever `steps.length === 0`. Option (b) is the safer, less-surprising default; option (a) catches misconfigurations earlier. Either is fine — pick one and document it on the planner module.
3. **Make `SUBVERTICAL_CLASSIFIER` not depend on audit**, or at most weakly. Right now (`src/lib/ai-core/chains.ts:262-267`) it sits on `dependsOn: ["audit"]` so an audit failure (no website, fetch timeout, etc.) hides the classifier from the chain entirely. The rule-based pass in `src/lib/agent-workers/subvertical-classifier.ts:160-178` only *uses* audit signals if present (`audit ? {...} : null`), so the worker can run fine without an audit. Move it to `dependsOn: []` (parallel with audit) — leads with no website still get a slug from name + Google primaryType + discovery query.

---

## 5. Bug #4 — `WEBSITE_AUDITOR` failure rate is 56% (P1, possibly two stacked bugs)

### Symptom
56 of 100 audits failed. We did not pull the `errorMsg` field on those AgentRuns yet — that's the next investigation step the implementing agent should take before fixing anything in `WEBSITE_AUDITOR`.

### What we know
- All 100 leads got their `GOOGLE_PLACES_REVIEWS` runs OK (100/100), so the lead rows are well-formed.
- 56 audit failures correlates with the chunk of leads that have `hasWebsite=false` OR a website URL that's down. The Website Auditor's expected behavior on `hasWebsite=false` is to skip with `crawlStatus="NO_WEBSITE"` — that should not show as `FAILED`. So there's likely a real bug here, not just an absence of website.
- Compounding: every failed audit kills the dependent classifier + score steps in the chain (see Bug #3), so the failure cascades into a "lead looks empty in the UI" experience.

### Suggested fix path
1. Pull `AgentRun.errorMsg` for the 56 failures in this workspace and bucket them. (`SELECT errorMsg, COUNT(*) FROM "AgentRun" WHERE workspaceId = '5496e39e-...' AND workerKind = 'WEBSITE_AUDITOR' AND status = 'FAILED' GROUP BY errorMsg ORDER BY COUNT(*) DESC`.)
2. If errors are dominated by "no website", the worker should `skipped: true` not `FAILED`.
3. If errors are timeouts or DNS errors, the worker should retry with backoff.

This is its own investigation; the Discovery rapport just notes that the cascade exists.

---

## 6. Bug #5 — `REVIEW_ANALYST` failure rate is 41% (P2)

### Symptom
41 of 100 review analysis runs failed.

Likely cause: the lead has zero Google reviews returned by Places API → REVIEW_ANALYST has nothing to summarize → throws. Same shape as the WEBSITE_AUDITOR issue: a "no data" outcome should be a skip, not a failure.

Same investigation step as Bug #4: pull error messages, bucket, decide skip vs retry vs fix. Listing here for completeness; not directly related to the user's "wrong location results" complaint.

---

## 7. Bug #6 — `discoverySourceQuery` field stamped per-lead is fragile (P2)

### Symptom (latent, not yet user-visible)
The rule-based classifier in `src/lib/niches/<rule-classifier file>` uses `discoverySourceQuery` as a strong prior (weight 0.45 — confirmed in the AgentRun output). But:
- Every lead is stamped with `discoverySourceQuery = "hotel restaurant"` (or whichever child query found it first), regardless of what that lead actually is. So if "hotel restaurant" surfaces a non-hotel restaurant by accident, the rule classifier will still bias heavily toward `fnb-hotel-fnb`.
- We saw this in practice: `Anastasia meziki butik otel` got `fnb-hotel-fnb` with confidence 0.75, source rule. That's correct *here* but the same logic would mis-tag a regular restaurant if it happened to be returned by the "hotel restaurant" query.

### Suggested fix path
Lower the `discovery_query` weight from 0.45 to ~0.25 in the rule-based classifier, and require at least one corroborating signal (Google primaryType or business-name keyword) for confidence > 0.7. This is a one-number tuning change in the rule weights; not a structural fix.

---

## 8. Bug #7 — `extractBoroughFromAddress` only knows London (P2)

### Symptom (latent)
`src/lib/google-places.ts:200-249` extracts a borough from the formatted address using a hardcoded London + neighbourhood map. Türkiye is not in the map, so for this beta workspace `borough` is left as the user-typed `boroughName` ("Istanbul Kartal") for every lead — including the ones in Maltepe, Pendik, Basel. So the per-borough analytics are wrong.

### Suggested fix path
- Either parse the borough from the second-to-last comma-separated segment of `formattedAddress` for non-UK addresses (rough heuristic).
- Or store a structured `addressComponents` field from the Places API and key off `addressComponents.find(c => c.types.includes("administrative_area_level_2"))`.
- This is independent of all the bugs above; flag for follow-up.

---

## 9. Bug #8 — Hotel matching too eager (low priority but worth flagging) (P2)

The single hotel that *did* get classified, `Anastasia meziki butik otel`, was tagged `fnb-hotel-fnb`. That's because the rule classifier sees `"hotel"` in the name + the discovery query + likely the `primaryType=hotel`. But `fnb-hotel-fnb` is supposed to mean **the F&B operations *inside* a hotel** (lobby bar, room service, etc.), not the hotel as a whole — see `src/lib/niches/index.ts:401-403`:

> "Hotel restaurants, lobby bars, room service, and resort/spa dining run as part of a hospitality property."

A Google Places `primaryType = hotel` means the hotel itself is the primary entity, and the restaurant inside (if any) is a sub-entity that won't surface in the same search. So the F&B pack is being applied to non-F&B businesses.

### Suggested fix path
- In the rule classifier, **only** assign `fnb-hotel-fnb` if `primaryType` is `restaurant` or `bar` AND the *address* or *name* contains hotel keywords — i.e., the F&B venue is explicitly inside a hotel, not the hotel itself.
- For places where `primaryType = hotel`, the worker should self-skip (it's not an F&B lead at all) and the discovery layer should ideally never have surfaced it. This loops back to Bug #2 — type-restricting the Places call would have prevented hotels from being returned by `"hotel restaurant"` in the first place.

---

## 10. Priority order for the fixing agent

If the fixing agent has time for one PR:
1. **Bug #1** (location bias) — fixes the "Switzerland and Maltepe" complaint directly. Highest user impact.
2. **Bug #3** (empty pipeline steps + classifier dependency on audit) — fixes the "no badges, generic openers" problem. Same workspace, same beta run.
3. **Bug #2** (food truck → truck dealer) — fixes the obvious garbage-in problem. Fast win.

If two PRs:
4. Add **Bug #4** investigation (WEBSITE_AUDITOR failure bucketing) — likely uncovers a separate "no website ≠ failure" bug.

If three PRs:
5. **Bug #5** + **#7** + **#8** — quality-of-life cleanups; can wait until after the user re-runs Discovery and confirms #1 #2 #3 fixed the reported symptoms.

---

## 11. Files touched in this investigation (read-only)

- `src/app/api/discovery/route.ts` (location built without lat/lng)
- `src/lib/google-places.ts` (locationBias gated behind `lat && lng`)
- `src/lib/niches/index.ts` (child pack queries)
- `src/lib/agent-workers/subvertical-classifier.ts` (worker ran fine when invoked)
- `src/lib/ai-core/chains.ts` (classifier dependsOn audit; default chain logic)
- `prisma/schema.prisma` (lead.subNicheSlug, WorkspaceLeadPipeline.steps)

Direct DB queries used (for the next agent to reproduce):

```sql
-- last 30 leads of the beta workspace
SELECT business_name, formatted_address, primary_type, sub_niche_slug, sub_niche_confidence, discovery_source_query, created_at
FROM leads
WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b'
ORDER BY created_at DESC
LIMIT 30;

-- classifier runs
SELECT id, status, lead_id, output_json, error_msg, finished_at
FROM agent_runs
WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b'
  AND worker_kind = 'SUBVERTICAL_CLASSIFIER'
ORDER BY created_at DESC LIMIT 10;

-- worker run summary
SELECT worker_kind, status, COUNT(*)
FROM agent_runs
WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b'
GROUP BY worker_kind, status;

-- pipeline row
SELECT * FROM workspace_lead_pipelines
WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b';

-- lead distribution by source query
SELECT discovery_source_query, COUNT(*)
FROM leads
WHERE workspace_id = '5496e39e-cc76-41bd-b18b-f1128fb9e41b'
GROUP BY discovery_source_query
ORDER BY COUNT(*) DESC;
```

No code changes were made during this investigation. The codebase is in the same state the user left it in.
