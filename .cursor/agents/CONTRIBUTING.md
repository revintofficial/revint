# Truth Layer v1 — Agent Dispatch Protocol

**Audience:** Track Owner subagents dispatched by the Master Coordinator
to execute the Truth Layer v1 master plan
(`.cursor/plans/truth_trust_master_pipeline_dec5071b.plan.md`).

This file is the contract between the parent agent (you, when reading)
and the Master Coordinator. Read it once, then start your track.

---

## 1. Your role

You are a **Track Owner** for exactly one track in the master plan
(e.g. T-A, T-B, T-D, V-K, etc.). Your mandate, files-touched envelope,
inputs (typed contracts), outputs, telemetry events, test surface, DoD,
effort, and rollback strategy are pinned in §3 of the master plan.

**You do NOT:**
- Pick a track. The Master Coordinator dispatches you with one.
- Edit any file outside your "Files-touched envelope". The §5 file-
  ownership matrix is enforced — if your track's envelope says
  `review-analyst.ts`, you do not touch `lead-intelligence-brief.ts`.
- Change a contract's shape without bumping its `__contractVersion`
  AND notifying the Contracts Steward via your PR description (see §3
  below).
- Add new BullMQ queues. Extend `agent-runs` or AI Core (per workspace
  rule `architecture.mdc`).
- Add new Gemini-calling endpoints outside `src/lib/agent-workers/` or
  `src/lib/ai-core/router.ts`.
- Touch `prisma/schema.prisma` unless your track owns a schema delta
  (Foundation owns the W0 deltas; T-C may own a W1 delta if it picks
  the relational `ReviewSwitchSignal` option — see
  `prisma/deltas/truth-layer-v1.md`).

---

## 2. Inputs you start with

When dispatched, you receive (verbatim, in your prompt):
1. **Your track id** (e.g. "T-A").
2. **The master plan section for your track** (copy-pasted §3 entry).
3. **The contracts you produce / consume** (pinned to a specific
   `__contractVersion`).
4. **A list of fixture leads relevant to your tests** (one or more of
   `tests/fixtures/leads/*.json`).
5. **The feature flag your track guards behind** (e.g.
   `TRUTH_LAYER_DECISION_GATES`).

Everything else (codebase navigation, multi-tenant rules, Prisma
client path) you read from `AGENTS.md` + the relevant `.cursor/rules/`.
**Do not re-read the entire master plan** — your context window is
limited and the per-track section has everything you need.

---

## 3. Quality gates you must pass before opening a PR

Per master plan §7 "per-PR" list:

```bash
npm run lint                            # green
npm run test src/__tests__/<your-scope> # green
npm run check:contracts                 # green
```

Plus the manual checks:
- **Multi-tenant scope**: every Prisma read/write touches `workspaceId`.
  Run the `multi-tenant-scope-audit` skill on your diff.
- **Generated Prisma client**: every Prisma type imports from
  `@/generated/prisma/client`, never `@prisma/client`.
- **Telemetry events**: every emit uses `track()` from
  `src/lib/lead-detail/telemetry.ts` AND uses an event name already in
  the typed catalog. **Wave 0 pre-declared every `truth.*` event your
  track will need** — you do not add to the catalog. If you find
  yourself wanting to add an event, escalate to the Master Coordinator.
- **Feature flag**: your changed code path is gated behind your track's
  `TRUTH_LAYER_*` flag (Foundation pre-declared all flags in
  `src/lib/feature-flags.ts`).

---

## 4. PR shape

Branch name: `truth-layer/{wave}-{track-id}-{short-slug}`
e.g. `truth-layer/w1-t-a-decision-gates`.

PR title: `[Truth Layer Wave {N}] T-{X}: {one-line summary}`

PR description MUST include:
1. **Master plan reference** — link to §3 entry.
2. **Contracts consumed** — list of `@/lib/sdr-brain/contracts` exports
   you import, each with the `__contractVersion` you pinned to.
3. **Contracts produced/changed** — if you bump a `__contractVersion`,
   call out the exact field changed and the rationale.
4. **Telemetry events emitted** — list from the master plan §3 entry.
5. **Feature flag** — name of the `TRUTH_LAYER_*` flag, default state,
   and rollout plan position (Shadow / Canary 10% / 50% / Full).
6. **Test surface coverage** — checklist from master plan §3 DoD.
7. **Rollback procedure** — copy from master plan §3 entry.

---

## 5. If you change a contract

Per master plan §1.4:
1. Bump `__contractVersion` in the contract file by exactly 1.
2. Add a row to `CHANGELOG.contracts.md` (create if missing —
   first-mover writes the file).
3. Open the PR scoped to the contract change first; let the Contracts
   Steward identify downstream consumers.
4. **Do not** edit your track's own implementation file in the same PR
   as a contract bump. Two PRs: (a) contract bump + steward review,
   (b) your track implementation against the new contract.

---

## 6. If you discover a blocker

Update `STATUS.md` in the repo root (create if missing) with:
```
T-{X} status: blocked
blocker: {one-line description}
needs: {what would unblock}
```
Then stop. The Master Coordinator polls these and re-dispatches when
the blocker clears.

**Do not** silently degrade your track to bypass the blocker. The
Truth Layer's whole point is to stop quiet quality drift.

---

## 7. When you're done

Final message back to the Master Coordinator MUST include:
- PR link (if remote) or branch name (if local).
- Files changed list.
- Test command + last-line of output proving green.
- One-paragraph summary of the implementation choices that were
  ambiguous in the plan and how you resolved them.
- Any contract bumps and their cascade impact.

The Coordinator will run the Wave-end gate (master plan §7 per-wave
list) before merging. Don't merge yourself even if you have permission.
