<!-- BEGIN:project-overview -->
# LeadAC (`leadac-ai`) — agent quick context

B2B SaaS for agency lead generation. Stack: **Next.js 16.2.3 (App Router, Webpack), React 19, TypeScript, Prisma 6 + Postgres + pgvector, Supabase auth, BullMQ + Redis, Gemini, Stripe v22, Tailwind v4, Radix, Framer Motion, Resend, Apify, Playwright.**

The detailed rules live in `.cursor/rules/*.mdc` and load automatically when the agent edits matching files. **Read the relevant rule before writing code in that area** — don't re-discover what's already documented.

| Rule file | Auto-loads when editing | Covers |
|---|---|---|
| `architecture.mdc` (alwaysApply) | every file | folder map, hard rules, where to look first |
| `ai-core.mdc` | `src/lib/ai-core/**`, `src/lib/agent-workers/**`, planner/copilot/agent-runs API routes | orchestrator, chains, memory, worker contract, Apify, Gemini prompts |
| `prisma-db.mdc` | all `.ts/.tsx` (broad — touches every query) | multi-tenant scope, generated client path, schema flow, pgvector |
| `multi-tenant-scope.mdc` | API routes, lib, workers, app components | `requireUser()`, scope patterns, audit checklist |
| `api-routes.mdc` | `src/app/api/**` | Next.js 16 route handlers, auth wrappers, response envelope |
| `nextjs-16.mdc` | `src/app/**`, middleware, config | async params/cookies, caching defaults, config rules |
| `workers-bullmq.mdc` | `src/workers/**`, queues, idempotency, execute | BullMQ queues, retries, AI Core hand-off |
| `billing-stripe.mdc` | `src/lib/stripe.ts`, `plans.ts`, `/api/billing/**`, pricing UI | webhook signature, idempotency, plan gating |
| `ui-components.mdc` | `src/components/**`, `*.tsx`, `globals.css` | Tailwind v4, design tokens, Radix, Framer |
<!-- END:project-overview -->

<!-- BEGIN:non-negotiables -->
## Non-negotiables (every change must satisfy)

1. **Multi-tenant scope** — every Prisma query that touches workspace data MUST be scoped by `workspaceId`. Use `requireUser()` from `@/lib/auth`. See `multi-tenant-scope.mdc`.
2. **Generated Prisma client** — `import type { Lead } from "@/generated/prisma/client"`. NOT `@prisma/client`.
3. **Semantic memory** — read/write only via `src/lib/ai-core/memory.ts`. Direct `prisma.semanticMemory.*` is forbidden.
4. **No new BullMQ queue for AI work** — extend `agent-runs` (discriminated `type` field) or AI Core chains.
5. **No new Gemini-calling endpoint** — wrap the call as a worker module under `src/lib/agent-workers/`.
6. **Stripe webhook** — verify signature, dedup on `StripeEventLog`, `runtime = "nodejs"`.
7. **Next.js 16** — `params`, `cookies()`, `headers()`, `searchParams` are Promises. Always `await`. No `eslint` config key, no top-level `env` block, `serverExternalPackages` for native deps.
8. **No `apiVersion` on Stripe** — broke types in v22.
<!-- END:non-negotiables -->

<!-- BEGIN:claude-mem -->
## Cross-session memory (`claude-mem`)

This workspace uses the `claude-mem` MCP for persistent cross-session memory. Use it to avoid re-explaining and re-discovering things across sessions.

When to query memory (use the `mem-search` skill or call the MCP directly):
- "Did we already solve this?" — before re-debugging an issue.
- "How did we structure X last time?" — before re-designing a known pattern.
- "What did we decide about Y?" — before reopening a settled decision.

When to write to memory (observations, automatic via the plugin):
- After resolving a non-obvious bug — capture root cause + fix.
- After a design decision with trade-offs — capture the chosen path and why.
- After completing a multi-step refactor — capture the new shape.

Available skills (in `~/.claude/plugins/cache/thedotmack/claude-mem/`):
- `mem-search` — query past sessions
- `make-plan` + `do` — plan + execute multi-step tasks with subagent fan-out
- `pathfinder` — map duplicated concerns before a refactor
- `timeline-report` — full project history narrative

If a question feels like "we've handled this before", search memory first. If it's a new architectural decision, prefer the `make-plan` skill so the plan is captured for future agents.
<!-- END:claude-mem -->

<!-- BEGIN:commands -->
## Common commands

```bash
npm run dev                # next dev --webpack
npm run workers            # tsx src/workers/index.ts (BullMQ supervisor)
npm run db:push            # prisma db push (dev)
npm run db:generate        # prisma generate after schema edits
npm run test               # vitest run
npm run test:integration   # vitest with integration config
npm run lint               # eslint .
```
<!-- END:commands -->

<!-- BEGIN:references -->
## Pointers

- Marketing / research / ops docs: archived (moved out of workspace by user). If you need ICP, positioning, persona, launch plan, market research, or roadmap context, ask the user — these are no longer in-tree to keep agent token cost low.
- Brand assets: `public/logo.png`, `public/leadac-brand-kit.pdf`, `public/brand-kit.html`
- DB schema: `prisma/schema.prisma` (~700 lines — grep first, don't read whole)
- AI Core types: `src/lib/agent-workers/types.ts`
- Plans table: `src/lib/plans.ts`
- Auth helpers: `src/lib/auth.ts` (`requireUser`, `withAuth`, `ACTIVE_WORKSPACE_COOKIE`)
<!-- END:references -->
