# `dashboards/`

Canonical, version-controlled inputs for our analytics dashboards. The
T-H Observability track owns this folder; tracks T-A through T-G emit
the events, and T-H is responsible for making them watchable.

## What lives here

- `truth-layer-v1.json` — the PostHog dashboard for the Truth Layer v1
  master pipeline (`.cursor/plans/truth_trust_master_pipeline_dec5071b.plan.md`).
  Every `truth.*` event in `LEAD_DETAIL_EVENT_NAMES`
  (`src/lib/lead-detail/telemetry.ts`) MUST have at least one tile here.
  The catalog parity test
  (`src/__tests__/lead-detail/telemetry-truth-catalog.test.ts`) enforces
  this — if you add an event without a tile, CI fails.

## Schema choice

PostHog's HTTP API for dashboards is opinionated and version-tied
(`/api/projects/{id}/dashboards`, `/api/projects/{id}/insights`),
and `posthog-cli` ships its own export format which has shifted across
minor versions. Rather than pin to a snapshot of one of those, we
ship a **generic, tool-agnostic schema** with the fields any sync
script needs:

| field          | meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| `schemaVersion`| Integer. Bump when the shape below changes in a breaking way.        |
| `name`         | Human-readable dashboard name.                                       |
| `slug`         | Stable id used by the sync tool to deduplicate.                      |
| `description`  | Why this dashboard exists, who owns it.                              |
| `owner`        | Track owner (here: `T-H Observability`).                             |
| `defaultTimeRange` | Default `time_range` for tiles that don't set their own.         |
| `defaultInterval`  | Default `interval` (`hour` / `day` / `week`).                    |
| `sections[]`   | Logical groupings, one per Wave 1 track.                             |
| `sections[].track` | The track id (e.g. `T-A`).                                       |
| `sections[].tiles[]` | The widgets.                                                   |
| `tiles[].id`   | Stable id, stable across syncs.                                      |
| `tiles[].display_title` | What the dashboard shows.                                   |
| `tiles[].event_name`    | Must match a key in `LeadDetailEventCatalog`.               |
| `tiles[].chart_type`    | `line` / `bar` / `number` — sync script maps to PostHog enum.|
| `tiles[].time_range`    | `1h` / `24h` / `7d` / `30d`.                                |
| `tiles[].interval`      | `hour` / `day` / `week`.                                    |
| `tiles[].breakdown`     | Property name to break down by, or `null`.                  |
| `tiles[].math`          | Optional. `total` / `dau` / `avg` / `median` / `p95`.       |
| `tiles[].math_property` | Optional. Property name for numeric math.                   |

## How to sync into PostHog

Pick one — both consume the JSON shape above:

1. **`posthog-cli` import (preferred when available)**

   ```bash
   npx posthog-cli@latest dashboards import \
     --project-id $POSTHOG_PROJECT_ID \
     --token $POSTHOG_PERSONAL_API_KEY \
     --file dashboards/truth-layer-v1.json
   ```

   If `posthog-cli` rejects the shape (it has rejected ours in the past
   for not matching its internal export schema exactly), fall through
   to (2).

2. **Manual sync via the REST API** — `scripts/sync-posthog-dashboard.ts`
   (not yet shipped; tracking issue lives in `STATUS.md`). The script
   reads this JSON, maps `chart_type` + `math` to PostHog's `insight`
   `display`/`math` fields, and `PUT`s one insight per tile.

3. **Manual UI** — for the first roll-out, sometimes the fastest path
   is to walk the JSON and re-create each tile by hand. Future syncs
   then update via (1) or (2).

## Schema mismatch disclaimer

PostHog's exact dashboard API schema is **not** what we encode here.
We deliberately keep this file tool-agnostic so a future migration
from PostHog → Mixpanel / Amplitude / OSS Plausible doesn't require
re-writing the source of truth. The sync script is responsible for
the impedance mismatch.

If you're authoring a sync script and find a missing field on a
tile, add it as an optional column in the table above, bump
`schemaVersion`, and update every tile that needs it. Don't add
PostHog-shaped fields without adding the abstraction.

## Adding a new tile

1. Make sure your event is in `LeadDetailEventCatalog` (it should already
   be — Wave 0 pre-declared every `truth.*` event).
2. Pick the right `section.track`.
3. Add a tile with a stable `id` (kebab-case, prefix with track id, e.g.
   `ta-` for T-A).
4. Run `npx vitest run src/__tests__/lead-detail/telemetry-truth-catalog`
   — the test parses this JSON and verifies tile coverage.
5. If a tile rendered tile-side data that wasn't in the event payload,
   stop and escalate. Tiles can only chart fields already on the event.
