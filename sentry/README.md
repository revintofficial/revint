# `sentry/`

Canonical, version-controlled inputs for Sentry alert rules. The T-H
Observability track owns this folder; it pairs with `dashboards/` to
make the Truth Layer v1 master pipeline both watchable and alarmable.

## What lives here

- `truth-layer-alerts.yaml` — alert rules for the Truth Layer v1
  master pipeline (`.cursor/plans/truth_trust_master_pipeline_dec5071b.plan.md`).
  Three rules are encoded today:

  1. **Severity normalization regression** — fires when the median
     `normalizedSeverity` drops >50% in the trailing 1h vs. the
     24h baseline. Catches a flatlined calibration table.
  2. **TruthLayerError code spike** — fires when any
     `TruthErrorCode` (matched by `truthFingerprint()` segment 1)
     appears more than 10 times in 1h.
  3. **Locale mismatch rate** — warning when
     `truth.locale.workspace_lead_mismatch` exceeds 5% of
     `truth.locale.resolved` events over 1h.

## Schema choice

Sentry's alert-rule API has shifted over multiple major versions
(Issue Alerts vs. Metric Alerts vs. Anomaly Detection), and the
Terraform provider (`sentry-terraform`) and the Python SDK (`sentry-cli
projects rules`) each accept different shapes. Rather than pin to
one, we ship a **generic, tool-agnostic YAML schema** with the fields
any sync script needs:

| field            | meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `schemaVersion`  | Integer. Bump when the shape below changes in a breaking way.           |
| `project`        | Sentry project slug.                                                    |
| `owner`          | Track owner (here: `T-H Observability`).                                |
| `environment`    | Sentry environment the rules apply to.                                  |
| `sources[]`      | Data-source declarations referenced by alerts. Each `id` is unique.     |
| `sources[].kind` | `posthog` or `sentry`. Sync script bridges these to Sentry abstractions.|
| `alerts[]`       | The actual alert rules.                                                 |
| `alerts[].id`    | Stable id, used by the sync script to deduplicate.                      |
| `alerts[].name`  | Human-readable alert title.                                             |
| `alerts[].severity` | `critical` / `high` / `warning` / `info`.                            |
| `alerts[].enabled`  | If `false` the sync script imports it disabled.                      |
| `alerts[].source`   | Id of a declared `sources[]` entry.                                  |
| `alerts[].description` | Why this alert exists.                                            |
| `alerts[].metric`   | The metric expression (`kind` plus per-kind fields below).           |
| `alerts[].window`   | Rolling window (e.g. `1h`).                                          |
| `alerts[].baselineWindow` | Optional. Trailing baseline for relative thresholds.           |
| `alerts[].condition`| `type` (`threshold` / `relative_drop` / `relative_rise`) + threshold.|
| `alerts[].notify.channels[]` | Where the alert routes.                                     |
| `alerts[].notify.runbook` | Path to a Markdown runbook (may not exist yet).                |

### Metric kinds

- `kind: count` — count of matching events.
- `kind: rate` — `numerator.event` ÷ `denominator.event`.
- `kind: median` / `mean` / `p95` — numeric math over `property` of `event`.

### Fingerprint matching for Sentry issue sources

The `metric.filter.fingerprint_prefix` and
`metric.filter.group_by` fields expect the fingerprint shape produced
by `truthFingerprint()` in `src/lib/sdr-brain/error-catalog.ts`:

```
["truth-layer", "<TruthErrorCode>", "<optional scope>"]
```

`fingerprint[0]` is always `"truth-layer"`. `fingerprint[1]` is the
typed code — group by this to get one Sentry issue per code.

## How to sync into Sentry

The Sentry side currently has no first-party YAML importer. Pick one:

1. **`sentry-terraform` provider** — write a small Terraform module
   that iterates `yamldecode("../sentry/truth-layer-alerts.yaml")`
   and creates one `sentry_metric_alert` / `sentry_issue_alert` per
   entry. Stateful (`terraform apply`), so good for production.

2. **`sentry-cli` issue-alerts JSON** — `scripts/sync-sentry-alerts.ts`
   (not yet shipped; tracking issue lives in `STATUS.md`). Reads this
   YAML, maps to Sentry's Issue Alert JSON, and `POST`s via
   `sentry-cli projects rules create`.

3. **Manual UI** — for the first roll-out, click each rule into the
   Sentry UI by hand. Future iterations switch to (1) or (2).

## Schema mismatch disclaimer

Sentry's exact alert API schema is **not** what we encode here. We
deliberately keep this file tool-agnostic so a future move to
Grafana Alerts, OpsGenie native rules, or Better Stack does not
require re-writing the source of truth. The sync script (or
Terraform module) carries the impedance mismatch.

If you're authoring a sync and find a field missing for your target
system, add it as an optional column in the table above, bump
`schemaVersion`, and update every alert that needs it. Don't add
Sentry-shaped fields without the abstraction layer.

## Adding a new alert

1. Make sure the underlying signal exists — either an event in
   `LeadDetailEventCatalog` or a `TruthErrorCode` in
   `TRUTH_ERROR_CODES`. The catalog parity test
   (`src/__tests__/lead-detail/telemetry-truth-catalog.test.ts`)
   parses this YAML and verifies referenced events exist.
2. Pick a stable `alerts[].id` (kebab-case, prefixed with `truth-`).
3. Write a runbook stub at the `notify.runbook` path. Empty is OK at
   first; alerts without a runbook stay paged on the on-call.
4. Run `npx vitest run src/__tests__/lead-detail/telemetry-truth-catalog`
   — the smoke test verifies YAML parses and required alerts exist.
