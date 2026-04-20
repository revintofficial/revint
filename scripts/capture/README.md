# Video capture pipeline

Drives a real cloud Chromium (via [Steel](https://steel.dev)) through the
production Leadac AI app and dumps each scene as a numbered PNG sequence.
Those plates feed into the Remotion project under `video/`.

## One-time setup

1. **Sign up for Steel** → https://app.steel.dev → API keys → copy.
2. **Get the Supabase service role key** → Supabase Dashboard → Project
   Settings → API → `service_role` (secret). Never commit this.
3. Add to `.env` (root of the repo):
   ```
   STEEL_API_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (the JWT, not the URL)
   VIDEO_APP_BASE_URL=https://hustle-zeta.vercel.app
   ```
4. **Whitelist redirect URLs in Supabase**:
   Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
   Add `https://hustle-zeta.vercel.app/**` (and `http://localhost:3000/**`
   if you ever shoot against local).

## Seeding the demo data

Before the first shoot — and any time the data gets stale:

```bash
pnpm tsx prisma/scripts/seed-video-demo.ts
```

This wipes Mert's Workspace and re-seeds it with the 12 deterministic
leads + audits + reviews + 3 mockup variants the scenarios target.

## Capturing

```bash
# All scenes:
pnpm tsx scripts/capture/run-all.ts

# Single scene (during iteration):
pnpm tsx scripts/capture/scenarios/04-audit-morph.ts
```

Plates land in `captures/<scene-id>/frame_NNNNN.png`.

## Tuning a scene

While iterating on a scenario, run it on its own and watch the recording
live in the Steel session viewer URL printed at the start. The viewer
shows you exactly what Playwright is doing, so you can tell whether a
selector clicked the wrong element or the page layout shifted.

If a selector breaks because the app's DOM changed:
1. Open the broken scenario file.
2. Run `pnpm tsx scripts/capture/scenarios/<file>.ts` once.
3. Watch which step fails, then update the selector — Playwright's
   `getByRole`, `getByText`, and `getByTestId` are the most stable.

## Adding a new scene

```bash
cp scripts/capture/scenarios/_template.ts scripts/capture/scenarios/09-new.ts
# Edit OUT_DIR + redirect path + scripted actions, then add to run-all.ts.
```
