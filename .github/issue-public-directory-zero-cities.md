## Summary

`https://<site>/cities` shows **"0 cities"** and the intro copy; `/niches` is empty. URLs like `/niches/plumbers/london` return **404** even though the app route and sitemap are implemented.

**Root cause (verified on production DB, 2026-04-23):** every public-directory query in `src/lib/seo/programmatic.ts` requires `workspace.publicProfilesEnabled: true` together with `Lead.analyzeStatus = ANALYZED` and (for city/niche index) at least 3 leads per `borough` / `primaryType`.

- **`public_workspaces = 0`** / **4** — no workspace has `public_profiles_enabled = true`.
- Therefore **`public_analyzed_leads = 0`** in the public-directory sense: 63 analyzed leads exist in total, but all are in workspaces with public profiles off.

## Evidence (DB snapshot)

| Metric | Value |
|--------|------:|
| `workspaces` | 4 |
| `workspaces` with `public_profiles_enabled` | 0 |
| `leads` (all) | 451 |
| `leads` `ANALYZED` (all) | 63 |
| `leads` in public-enabled workspace + `ANALYZED` | 0 |

Largest workspace still has public profiles **disabled** while holding dozens of analyzed leads with `borough` populated.

## Follow-up (after toggling public profiles)

Even when `public_profiles_enabled` is turned on, programmatic “money” pages will stay thin until:

- **`primary_type` normalization** — many leads use a generic `service` (or sparse types like `cell_phone_store` with 1–2 leads), so `getPublicNiches` and niche×city pages may still not pass the **≥3 leads** threshold for meaningful slugs (e.g. `plumber` vs `plumbers` vs `service`).
- **City slugs** are derived from `borough` (e.g. borough names), not a single “London” umbrella — so `/cities/london` may be empty unless `borough` is exactly that string or mapping is added.

## Proposed work

1. **Product / ops:** enable `public_profiles_enabled` on at least one intended workspace (or a dedicated “public directory” workspace), and document which customer data is exposed.
2. **Engineering:** confirm `/cities`, `/niches`, `/niches/[niche]/[city]` and sitemap return non-zero when conditions are met; add monitoring or a health check in staging/prod.
3. **Optional (SEO):** normalize niche labels from `source_query` or a mapping table so `primary_type` slugs match real search terms; consider lowering or splitting thresholds for cold-start.

## Acceptance criteria

- [ ] At least one workspace has `public_profiles_enabled = true` in production, or an explicit product flag documents why the directory is off in prod.
- [ ] With that flag on and sufficient public analyzed leads, `/cities` and `/niches` list counts **> 0** when DB supports it.
- [ ] Document minimum counts (3 per `borough` / `primaryType` in groupBy) in README or `docs/`.

## Files

- `src/lib/seo/programmatic.ts` — `getPublicCities`, `getPublicNiches`, `getPublicBusinessesByNicheCity`, `passesEvidenceFloor`
- `prisma` / `workspaces.public_profiles_enabled`, `leads.borough`, `leads.primary_type`
- `src/app/sitemap.ts` — chunks depend on the same public lead set

**Labels (suggested):** `bug`, `seo`, `p1`  
**Affects:** public directory, programmatic SEO, sitemap

---

### File on GitHub (one command)

[Install GitHub CLI](https://cli.github.com), then `gh auth login`, then from the repo root:

`gh issue create -R cinargnaydin/hustle-tracker -t "Public directory: 0 cities, empty /niches, /niches/{niche}/{city} 404s" -F .github/issue-public-directory-zero-cities.md`

Or open [New issue](https://github.com/cinargnaydin/hustle-tracker/issues/new) and paste this file; use the same title as in `-t` above.
