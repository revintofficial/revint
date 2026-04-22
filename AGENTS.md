<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:ai-core-rules -->
# AI Core - orchestration, memory, enrichment

All new AI work in this project goes through the "AI Core" stack at
[`src/lib/ai-core/`](src/lib/ai-core). Do not add new BullMQ queues,
new per-worker state columns, or new Gemini-calling endpoints without
first checking whether an existing AI Core component already solves
the need.

## The contract

Every AI worker is a module under `src/lib/agent-workers/` exporting:

- `run(ctx)` - the handler; receives hydrated lead + workspace +
  pre-fetched memory hits; returns `AgentWorkerOutput`.
- `memoryWrites(output, ctx)` - optional; returns an array of
  `MemoryWrite` rows the executor upserts + embeds after a successful
  run.

The worker is then registered in
[`src/lib/agent-workers/registry.ts`](src/lib/agent-workers/registry.ts)
with:
- Stable `kind` (enum value in `prisma/schema.prisma`).
- `group` (`intelligence` | `pitch` | `deliverable` | `ops` | `enrichment`).
- `minPlan`, `estimatedDurationMs`, `exportFormats`.
- `memoryReads` specs (which kinds to pre-fetch, scope workspace/lead).
- `implModule` lazy import pointing at the worker module.

DO NOT add new workers without:
1. Updating `AgentWorkerKind` enum in `prisma/schema.prisma`
2. Running `prisma db push` + `prisma generate`
3. Adding the limit in `src/lib/agent-workers/quota.ts`

## Chains / orchestration

Events trigger chains:
- `emit("user_one_click_pitch", { workspaceId, leadId, userId })` in
  [`src/lib/ai-core/events.ts`](src/lib/ai-core/events.ts)
- Chain definition in
  [`src/lib/ai-core/chains.ts`](src/lib/ai-core/chains.ts)
- Orchestrator walks the DAG and enqueues `ai-runs` jobs

User-initiated events fire from API routes with `emit()`; client code
POSTs to `/api/planner/start` or `/api/planner/bulk`.

## Semantic memory

Read/write SemanticMemory ONLY via
[`src/lib/ai-core/memory.ts`](src/lib/ai-core/memory.ts). Direct
`prisma.semanticMemory.*` calls are forbidden because the pgvector
column requires raw-SQL vector literals that the facade handles.

Write kinds:
- `LEAD_PROFILE` - compact lead summary; one row per lead
- `REVIEW_CHUNK` - review text / pain + strength phrases
- `VOICE_NOTE` - voice note transcripts
- `OPENER_SUCCESS` / `OPENER_FAILURE` - learning loop
- `MOCKUP_SECTION` - successful mockup sections
- `WORKSPACE_OFFER` / `WORKSPACE_PERSONA` - static workspace docs
- `PROSPECT_KB_CHUNK` - prospect site content for receptionist RAG
- `COPILOT_TURN` - past copilot exchanges
- Apify-sourced: `SOCIAL_POST`, `SERP_SNAPSHOT`, `COMPETITOR_AD`,
  `HIRING_SIGNAL`, `REDDIT_MENTION`

## Apify enrichment

Workers under `src/lib/agent-workers/apify/` use the wrapper in
[`src/lib/apify.ts`](src/lib/apify.ts). Rules:
- Check `isConfigured()` first; return `{ skipped: true }` when no
  token is set (graceful degradation for FREE tier).
- Every run writes `costUsdCents` to `AgentRun.costUsdCents`; the
  quota helper sums across all Apify kinds in the billing cycle to
  enforce `MONTHLY_APIFY_USD_CENTS` per plan.
- Long-running actors should use `runAsync()` + webhook callback to
  `/api/webhooks/apify`; short ones use `runSync()`.

## Copilot

Copilot chat goes through
[`src/lib/ai-core/router.ts`](src/lib/ai-core/router.ts) with Gemini
function-calling. The tool set is fixed (search_leads,
semantic_search_leads, start_pitch_pack, start_deep_research,
find_lookalikes); new tools require tests. Adding a destructive tool
(one that writes without the user explicitly confirming) is
forbidden without a new plan doc.
<!-- END:ai-core-rules -->
