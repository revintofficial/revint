# Lead Engine — launch film playbook

End-to-end pipeline that turns the live product into a finished launch film.

```
┌─────────────────────────────────────────────────────────────────┐
│  prisma/scripts/seed-video-demo.ts                              │
│      ↓ wipes + repopulates Mert's Workspace with the 12         │
│        deterministic leads + 3 mockup variants the film needs   │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  scripts/capture/  (Steel + Playwright)                         │
│      ↓ scripts a real Chromium through hustle-zeta.vercel.app   │
│        and dumps each scene as a numbered PNG sequence          │
│  Output: captures/<scene-id>/frame_NNNNN.png                    │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  video/  (Remotion)                                             │
│      ↓ composites the plates with cinematic camera motion,      │
│        title cards, motion overlays, and music sync             │
│  Output: video/out/master.mp4 + hero-loop.mp4 + vertical + 1:1  │
└─────────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│  ffmpeg → public/                                               │
│      ↓ encodes web-optimised H.265 + WebM, OG poster image      │
└─────────────────────────────────────────────────────────────────┘
```

## One-time setup

```bash
# 1. Required env vars (root .env)
STEEL_API_KEY=sk-steel-...                  # https://app.steel.dev
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...       # Supabase Dashboard → API
VIDEO_APP_BASE_URL=https://hustle-zeta.vercel.app

# 2. Whitelist the redirect URL in Supabase
# Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
# Add: https://hustle-zeta.vercel.app/**

# 3. Install Remotion sub-project deps (only once)
cd video
npm install
cd ..
```

## The full loop

```bash
# Reset Supabase to the deterministic video demo state
npm run video:seed

# Capture every plate from the live product
npm run video:capture

# Open Remotion Studio to scrub / iterate
npm run video:dev

# When happy — render the master + cuts
cd video
npm run render:all
npm run encode:web    # produces public/hero-loop.mp4 + .webm + og-cover.jpg
```

## Iterating on a single scene

```bash
# Re-shoot just the audit morph (fastest dev loop):
npm run video:capture:audit

# Open the Remotion scene file:
code video/src/scenes/04-audit-morph.tsx

# Live-preview at http://localhost:3000:
npm run video:dev
```

## Scene → file map

| # | Scene | Steel scenario | Remotion scene | State |
|---|---|---|---|---|
| 01 | Cold open (CSV desaturate) | — | `01-cold-open.tsx` | ★ Pure Remotion, ready |
| 02 | "Type a postcode." | — (hand-built) | `02-promise.tsx` | Stub |
| 03 | "47 fresh local leads." | `03-discovery.ts` | `03-discovery.tsx` | Stub + plate slot |
| 04 | "Five signals. One score." | `04-audit-morph.ts` ★ | `04-audit-morph.tsx` ★ | Fully wired |
| 05 | "Hand them a draft." | `05-mockup-flip.ts` | `05-mockup-flip.tsx` | Stub + plate slot |
| 06 | "The opener writes itself." | `06-opener.ts` | `06-opener.tsx` | Stub + plate slot |
| 07 | "Pipeline lives with the lead." | `07-pipeline.ts` | `07-pipeline.tsx` | Stub + plate slot |
| 08 | "Your first 50 leads…" CTA | — | `08-cta.tsx` | ★ Pure Remotion, ready |

`★` = use as the reference when wiring stubs.

## Music sync reference

The score you're producing should hit beats at these timestamps in the
60s master cut:

| Beat | Time | Notes |
|---|---|---|
| Cold open in | 0:00 | Low rumble + single piano note |
| Promise in | 0:03 | Music breath; keystroke SFX layered |
| Discovery payoff | 0:08 | First swell — pin pops on the &-beat |
| Audit reveal | 0:18 | Filter sweep into the morph |
| Score badge land | 0:24 | Confirm tone (single note, suspension resolved) |
| Mockup variants | 0:30 | Flip whoosh × 3, each on the bar |
| Opener typing | 0:42 | Key change C-min → C-maj here |
| Pipeline jump | 0:52 | 4 ticks ascending on the kanban transitions |
| CTA | 0:57 | Tail; sustain into the logo |
| End | 1:00 | Last note rings out |

If you need different cuts, change `SCENE_S` in `video/src/theme/tokens.ts`
**and** `SCENE_DURATIONS_MS` in `scripts/capture/timing.ts` together — they
must match.
