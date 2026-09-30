# Head agent: turning it live for a workspace

This is plan Task 3 step 6. It is an environment change, not a code change.

## What the flag does

`getHeadAgentMode` (`src/lib/feature-flags.ts`) resolves per workspace, most specific first:

1. `CLAUDE_HEAD_AGENT_WORKSPACES` contains the workspace id → `live`
2. `CLAUDE_HEAD_AGENT_SHADOW_WORKSPACES` contains the workspace id → `shadow`
3. `CLAUDE_HEAD_AGENT=on` → `live` for every workspace
4. `CLAUDE_HEAD_AGENT_SHADOW=on` → `shadow` for every workspace
5. otherwise `off`

Both lists are comma separated workspace ids. Spaces are trimmed.

For a restaurant (`RESTAURANT_TECH`) workspace the brief is always the head agent:

| Mode | What the LEAD_INTELLIGENCE_BRIEF run writes |
|---|---|
| `off` | `{ "skipped": "head_agent_off" }`. No brief, no `Lead.salesConfidence` update, no `SalesOpportunity` write. The legacy Gemini brief is not used. |
| `shadow` | A head-agent brief with the Room 1 plain card (package, wedge, three evidence refs, empty talk). Claude runs; its draft is kept in `headAgent.roomTwo.draftTalkTrack` for review only. |
| `live` | A head-agent brief. Claude's talk is on the card when Room 3 QA passes; otherwise the plain card. |

`off` means restaurant leads get no brief at all. For FineDine Beta the mode must be `live` (or `shadow`).

## Turn it on

The brief runs in the BullMQ workers, not in the Next.js app. Set the variables in both places so the admin panel (eval replay) and the workers agree.

1. Find the workspace id: in the admin panel, or `select id, name from workspaces where name ilike '%finedine%';`
2. Workers host (Railway, the service that runs `npm run workers`), add:
   - `CLAUDE_HEAD_AGENT_WORKSPACES=<finedine-beta-workspace-id>` (append with a comma if the variable already has ids)
   - `ANTHROPIC_API_KEY=<key>` (without it Room 2 is skipped and every card is plain)
   - optional `ANTHROPIC_MODEL=<model id>` (defaults to the value in `src/lib/ai-core/agent/claude.ts`)
3. Vercel (Production environment), add the same `CLAUDE_HEAD_AGENT_WORKSPACES` and `ANTHROPIC_API_KEY`:
   `vercel env add CLAUDE_HEAD_AGENT_WORKSPACES production`
4. Redeploy both. Env vars are read at call time, but Railway and Vercel only pick up new values on a restart or redeploy.

## Check it with one lead

1. Add one new FineDine restaurant lead (or re-run analysis on one).
2. When the chain finishes, look at the latest `LEAD_INTELLIGENCE_BRIEF` run for that lead:

   ```sql
   select output_json->>'briefMode'                          as brief_mode,
          output_json->'headAgent'->>'recommendedPackage'    as package,
          output_json->'headAgent'->>'wedge'                 as wedge,
          output_json->'headAgent'->'roomTwo'->>'status'     as room_two,
          output_json->'missingSources'                      as missing
   from agent_runs
   where lead_id = '<lead-id>' and worker_kind = 'LEAD_INTELLIGENCE_BRIEF'
   order by finished_at desc limit 1;
   ```

   Expect `brief_mode = head-agent`, a package in `starter | growth | premium | none`, and `room_two` in `attached | qa_failed | skipped | unavailable`. `unavailable` on every lead means the Anthropic key is missing or failing.
3. Check the projection: `select best_sales_angle, opportunity_score, reason_codes from sales_opportunities where lead_id = '<lead-id>';` — `best_sales_angle` equals the wedge.
4. Worker logs: one `[head-agent-telemetry]` line with `event: head_agent.decision` and `mode: live`.
5. If the venue has a booking provider, `excludedModules` in the brief lists `reservation`.

## Roll back

- Remove the workspace id from `CLAUDE_HEAD_AGENT_WORKSPACES` on both hosts and redeploy, or move it to `CLAUDE_HEAD_AGENT_SHADOW_WORKSPACES` to keep plain cards without Claude's talk on them.
- Removing the id entirely turns the workspace `off`: new restaurant leads get `{ skipped: "head_agent_off" }` and no brief. Existing briefs and `SalesOpportunity` rows are not touched.
- A key problem only (Claude down, quota): leave the flag live. Cards degrade to the plain Room 1 card on their own; there is no Gemini fallback to turn off.
