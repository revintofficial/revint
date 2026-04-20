# Leadac AI — launch film (Remotion)

The video lives in this isolated sub-project so it has its own
node_modules, its own TypeScript config, and never collides with the
Next.js app's build pipeline.

## Quickstart

```bash
cd video
pnpm install            # or npm install — first time only
pnpm dev                # opens Remotion Studio at http://localhost:3000
```

Studio shows every composition (MasterFilm, HeroLoop, VerticalCut, SquareCut).
Pick MasterFilm to scrub the full 60s and see how the scenes string together.

## Pre-flight

Before rendering anything that uses captured plates:

1. Make sure `../captures/` exists and has been populated by Steel:
   ```bash
   cd ..
   pnpm tsx scripts/capture/run-all.ts
   ```
2. Update `PLATE_FRAMES` constants in scenes that use plates to match
   the actual file count in `../captures/<scene>/`.

## Rendering

```bash
pnpm render:master         # 60s 1920x1080 H.264 → out/master.mp4
pnpm render:launch         # ~105s feature-complete launch film → out/launch.mp4
pnpm render:launch:webm    # WebM cut of the launch film      → out/launch.webm
pnpm render:hero           # 8s muted loop     → out/hero-loop.mp4
pnpm render:showcase       # 8s Apple showcase → out/showcase.mp4
pnpm render:showcase:webm  # 8s Apple showcase → out/showcase.webm
pnpm render:vertical       # 9:16 cut          → out/vertical.mp4
pnpm render:square         # 1:1 cut           → out/square.mp4
pnpm render:all            # everything

pnpm encode:web            # H.265 + WebM dual-encode for hero + showcase
pnpm poster                # OG image still grab from the master
```

## File map

```
src/
  Root.tsx                    composition registry
  theme/
    tokens.ts                 brand colors, type, scene durations, DEPTH, PARALLAX
    easing.ts                 Apple-style bezier curves
    motion.ts                 explode / assemble / stagger / settle timings
  primitives/
    PlateCamera.tsx           PNG sequence + camera motion (zoom, blur, vignette)
    PinnedStage.tsx           Apple framing for plate-less scenes (dolly, rack focus,
                              vignette, ambient gradient, background slot)
    AppChrome.tsx             Faithful sidebar + header shell reused by pure-Remotion
                              feature scenes so they read as real app
    TitleCard.tsx             typography overlay with fade in/out
    MorphBox.tsx              Framer-style layoutId morph between two rects
    PathMorph.tsx             Flubber SVG path → path interpolation
    ExplodedParts.tsx         staggered parts fly-apart / assemble choreography
    DepthParallax.tsx         multi-z layer parallax with auto rack-focus blur
    ThreeStage.tsx            @remotion/three wrapper with camera path interp
    ProductModel.tsx          R3F proxy phone + audit-card, `exploded: 0..1`
    MetricCounter.tsx         animated number counter
  scenes/
    AppleShowcase.tsx         ★ 8s hero reel: orbit → explode → morph → score
    01-cold-open.tsx          ★ no plate; CSV desaturate
    02-promise.tsx            ★ ExplodedParts keyboard assemble
    03-discovery.tsx          ★ DepthParallax lead-pin cascade over plate
    04-audit-morph.tsx        ★ FULLY WIRED; consumes captures/04-audit-morph
    05-mockup-flip.tsx        ★ CSS 3D card carousel (indigo / emerald / warm)
    06-opener.tsx             ★ DepthParallax paper sheets + typing breath
    07-pipeline.tsx           ★ ExplodedParts kanban + MorphBox lead-card travel
    08-cta.tsx                ★ no plate; logo + CTA
    09-dashboard.tsx          ★ KPI cards + sparkline + next-best-action
    10-review-intelligence.tsx ★ weakness / strength bars + lead score
    11-website-plan.tsx       ★ scrolling markdown plan + copy/download chips
    12-copilot.tsx            ★ AI drawer typing an answer with lead refs
    13-campaigns.tsx          ★ 4 auto-segments assembling from sides
    14-team-todos.tsx         ★ 3-col todo board + card flying Doing → Done
    15-settings-sweep.tsx     ★ offer / branding / email / billing stack
    16-pricing.tsx            ★ 4 pricing tiers with Pro Solo highlight
  compositions/
    MasterFilm.tsx            60s — the canonical short cut
    LaunchFilm.tsx            ~105s — feature-complete launch film (16 scenes)
    HeroLoop.tsx              AppleShowcase wrapped as site-hero loop (8s)
    VerticalCut.tsx           STUB — 9:16 reframe
    SquareCut.tsx             STUB — 1:1 reframe

assets/
  models/                     GLB/GLTF drop zone (currently empty; ProductModel
                              ships with a proxy primitive — see assets/models/README.md)
```

## Apple-style motion primitives

The new primitives (PinnedStage, ExplodedParts, DepthParallax, PathMorph,
ThreeStage, ProductModel) implement the kinetic-product-motion language
used on apple.com product pages:

- **PinnedStage** — the center-pinned product, dolly + rack focus + vignette
- **ExplodedParts** — parts fly apart and re-assemble with staggered timing
- **DepthParallax** — multi-z-plane parallax with automatic depth-of-field
- **PathMorph** — one SVG shape morphs into another (via Flubber)
- **ThreeStage** — a Remotion-safe React Three Fiber canvas with keyframed camera
- **ProductModel** — a proxy phone + audit-card "product" with `exploded: 0..1`

All motion timings live in `theme/motion.ts` (explode 1.2s, assemble 1.0s,
settle 0.6s, stagger 0.08s) so you never hardcode frame counts in scene files.

## 3D assets (GLB models)

`ProductModel.tsx` ships with an R3F-primitive proxy so everything renders
without a GLB present. To upgrade to real models:

1. Drop `phone.glb` / `audit-card.glb` under `assets/models/` (see
   `assets/models/README.md` for expected child-mesh names and the
   publicDir caveat).
2. In `ProductModel.tsx`, swap the proxy `<RoundedBox>` / `<mesh>` elements
   for `useGLTF('/models/phone.glb')` — the `exploded: 0..1` API stays the
   same, so no scene needs to change.

## Iteration loop

1. Tweak a scene file, save.
2. Studio hot-reloads in <1s.
3. Scrub the timeline to verify motion.
4. When happy, render: `pnpm render:master`.
5. If you change camera motion, re-render. If you change the underlying
   product UI, re-capture (`scripts/capture/...`) and re-render.

## Music sync

You're producing the score yourself. The reference timing for cuts:

| Beat hit | Composition frame | Real time |
| --- | --- | --- |
| Cold open in     | 0    | 0:00.00 |
| Promise in       | 180  | 0:03.00 |
| Discovery payoff | 480  | 0:08.00 |
| Audit reveal     | 1080 | 0:18.00 |
| Score badge land | 1440 | 0:24.00 |
| Mockup variants  | 1800 | 0:30.00 |
| Opener typing    | 2520 | 0:42.00 |
| Pipeline jump    | 3120 | 0:52.00 |
| CTA              | 3420 | 0:57.00 |
| Tail             | 3600 | 1:00.00 |

If you need different beat positions, change `SCENE_S` in `theme/tokens.ts`
and the same constants in `../scripts/capture/timing.ts` so the captures
match the new lengths.
```
