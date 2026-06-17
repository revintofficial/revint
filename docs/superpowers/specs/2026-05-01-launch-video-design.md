# Revint — Launch Video Design Spec

**Date:** 2026-05-01  
**Product:** Revint (B2B SaaS, agency lead generation)  
**Tool:** Remotion + React + TypeScript  
**Status:** Approved — ready for implementation planning

---

## 1. Summary

A premium launch video built entirely in code using Remotion. Two outputs from one shared codebase: a 16:9 horizontal cut for web/YouTube and a 9:16 vertical cut for Instagram Reels/TikTok. Visual language is iOS 26 Liquid Glass — translucent glass cards, spring-physics entrances, amber brand glow — at Fast Hype pace (2–3s per scene, ~33s total). No app screenshots; each scene uses a hand-crafted glass mockup card representing the feature's key moment, giving full per-element animation control.

---

## 2. Decisions

| Dimension | Choice | Rationale |
|---|---|---|
| Project location | Standalone `hustle-video/` folder | Avoids Remotion/Next.js webpack conflicts; clean separation |
| UI representation | Stylized glass mockup cards | Full per-element animation; won't go stale; Apple hype reels use moments not full UIs |
| Visual style | iOS 26 Liquid Glass | Matches existing `glass-liquid` CSS; cutting-edge 2026 design language |
| Pace | Fast Hype (2–3s/scene) | Chosen by user; 30–45s reel format for social-first distribution |
| Font | Inter variable (weight 300–900) | Closest open-source SF Pro alternative; Apple-style negative tracking |
| Dual output | Two root compositions, shared scene components | Vertical/horizontal have genuinely different layouts; sharing scenes avoids duplication |

---

## 3. Brand Tokens

Sourced from `hustle/src/app/globals.css` and `hustle/src/lib/colors.ts`. Copied as constants into `hustle-video/src/tokens.ts`.

```ts
export const TOKEN = {
  // Primary — Burnt Amber (hue 38°, sat 78%)
  amber100: 'hsl(38 78% 88%)',
  amber200: 'hsl(38 78% 78%)',
  amber300: 'hsl(38 78% 68%)',
  amber400: 'hsl(38 78% 58%)',
  amber500: 'hsl(38 78% 50%)',   // primary CTA
  amber600: 'hsl(38 78% 42%)',
  amber700: 'hsl(38 78% 34%)',

  // Backgrounds
  bg:      'hsl(38 7% 5%)',      // #0d0b09 — video canvas
  surface: 'hsl(38 7% 8%)',
  card:    'hsl(38 7% 11%)',

  // Text
  text1:   'hsl(38 10% 92%)',    // primary
  text2:   'hsl(38 10% 70%)',
  text3:   'hsl(38 10% 50%)',

  // Semantic
  success: 'hsl(152 48% 50%)',
  warning: 'hsl(38 70% 52%)',
  error:   'hsl(4 62% 54%)',

  // Glass
  glassBg:     'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.12)',
} as const;
```

---

## 4. Output Specifications

| Format | Resolution | FPS | Duration | Frames | Target |
|---|---|---|---|---|---|
| Horizontal | 1920 × 1080 | 60 | ~33s | 1980 | Web hero, YouTube, LinkedIn |
| Vertical | 1080 × 1920 | 60 | ~33s | 1980 | Instagram Reels, TikTok, Stories |

Both compositions use the same scene components. Scene components read `useVideoConfig()` to adapt layout for the active aspect ratio.

---

## 5. Scene Plan

Total: 8 scenes × avg ~4s = 33s

| # | Scene | Frames (60fps) | Duration | Entry Spring |
|---|---|---|---|---|
| 1 | Logo Reveal | 0 – 180 | 0s – 3s | bouncy |
| 2 | Hero Headline | 180 – 360 | 3s – 6s | snappy |
| 3 | Lead Discovery | 360 – 540 | 6s – 9s | snappy |
| 4 | AI Workers Pipeline | 540 – 780 | 9s – 13s | snappy (staggered) |
| 5 | AI Dossier | 780 – 1020 | 13s – 17s | snappy (staggered) |
| 6 | Website Audit | 1020 – 1260 | 17s – 21s | bouncy |
| 7 | Review Intelligence | 1260 – 1500 | 21s – 25s | snappy (staggered) |
| 8 | Outro + CTA | 1500 – 1980 | 25s – 33s | smooth |

### Scene Descriptions

**S1 — Logo Reveal (0–3s)**  
Black canvas. Six amber particles drift in from off-screen converging on centre. At frame 30 the "LEADAC AI" wordmark materialises — scale 0.6→1 with `bouncy` spring, opacity 0→1, blur 12→0. Particles settle and fade. Background: tight amber radial glow.

**S2 — Hero Headline (3–6s)**  
Three words hit screen one at a time: "FIND." / "ANALYSE." / "CLOSE." Each word: Y+30→0 spring (snappy), scale 0.8→1, opacity 0→1, 20f stagger. Middle word "ANALYSE." renders in `amber400`. Scene exits with full-frame blur push (scale 1→1.06, blur 0→16px).

**S3 — Lead Discovery (6–9s)**  
Three glass lead-row cards fly in from the left (X -120→0), staggered 8 frames apart. Each row shows a score dot (green/yellow) + text placeholder lines. Background: cool-blue tinted radial glow (differentiated from amber scenes). Cards have full `glass-liquid` treatment: `backdrop-filter: blur(44px) saturate(160%)`.

**S4 — AI Workers Pipeline (9–13s)**  
Five pipeline nodes materialise left-to-right with 10f stagger: each node scale 0→1 with snappy spring. After all nodes are visible, an amber glow races along the connector lines (interpolated `opacity` and `scaleX` on each segment). Final state: first 3 nodes glowing amber, last 2 pending. This scene runs 4s (longest) — the most cinematic beat. Horizontal: nodes in a single row. Vertical: 2-row wrap.

**S5 — AI Dossier (13–17s)**  
Three citation chip cards cascade from centre (Y +20→0, staggered 8f). Each chip: glass card with amber icon square + two text placeholder lines. Background: warm amber halo, slightly brighter than S1. Chips arrive at slightly different Z-depth scales (1.0, 0.97, 0.94) to create layered depth — the iOS 26 depth-stack effect.

**S6 — Website Audit (17–21s)**  
Score ring draws clockwise: `stroke-dashoffset` interpolated from 283 (full circle) to ~66 (78% filled) over 60 frames. Score number counts up: 0→78 (interpolated integer). Three tag pills (SEO · SPEED · CTA) fly up from below with 6f stagger. Accent: success green (`hsl(152 48% 50%)`). Horizontal: ring left, tags right. Vertical: ring top, tags below.

**S7 — Review Intelligence (21–25s)**  
Three review-row cards slide in from right (X +120→0), staggered 8f. Each row: star rating (filled stars glow amber sequentially) + text line. Third row shows 2/5 stars with red accent — surfaces the pain-point signal. Cards use same glass treatment as S3.

**S8 — Outro + CTA (25–33s)**  
Logo fades back in from ambient glow (opacity 0→1, smooth spring, 40f). Tagline "Find. Analyse. Close." slides up (Y +16→0). Amber CTA pill "Start Free →" fades in at frame 1700 with a pulsing glow (`box-shadow` oscillate). Holds 3s for legibility. Fade to black over 60 frames.

---

## 6. Animation System

### Spring Presets (`src/lib/spring-presets.ts`)

```ts
import { SpringConfig } from 'remotion';

export const SPRINGS = {
  // iOS 26 "snappy" — fast, slight overshoot. Scene card entrances.
  snappy: { mass: 1, stiffness: 200, damping: 20 } satisfies SpringConfig,

  // iOS 26 "bouncy" — energetic spring. Logo, score badge, CTA pill.
  bouncy: { mass: 1, stiffness: 300, damping: 15 } satisfies SpringConfig,

  // iOS 26 "smooth" — no bounce. Background halos, outro fade.
  smooth: { mass: 1, stiffness: 100, damping: 20 } satisfies SpringConfig,
} as const;
```

### Component Entry Pattern

Every glass card uses this pattern (adapt per scene):

```tsx
const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const enter = spring({ frame, fps, config: SPRINGS.snappy, delay: staggerOffset });

const style = {
  opacity: enter,
  transform: `translateY(${interpolate(enter, [0, 1], [30, 0])}px) scale(${interpolate(enter, [0, 1], [0.88, 1])})`,
  filter: `blur(${interpolate(enter, [0, 1], [8, 0])}px)`,
};
```

### Scene Transition Pattern

Outgoing scene pushes away with scale+blur; incoming scene is simply the next component rendered at frame 0:

```tsx
const exitProgress = spring({ frame: frame - (SCENE_DURATION - 15), fps, config: SPRINGS.smooth });
const exitStyle = {
  transform: `scale(${interpolate(exitProgress, [0, 1], [1, 1.06])})`,
  filter: `blur(${interpolate(exitProgress, [0, 1], [0, 16])}px)`,
  opacity: interpolate(exitProgress, [0, 1], [1, 0]),
};
```

---

## 7. Liquid Glass Component (`src/components/GlassCard.tsx`)

Shared primitive used by all scene cards. Matches `hustle/src/app/globals.css` `.glass-liquid` exactly so the video and app feel unified:

```tsx
const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(44px) saturate(160%)',
  WebkitBackdropFilter: 'blur(44px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: [
    '4px 4px 10px rgba(0,0,0,0.22)',
    'inset 0 1px 1px rgba(255,255,255,0.12)',
    `0 20px 60px hsl(38 78% 50% / 0.15)`,
  ].join(', '),
  borderRadius: 20,
};
```

---

## 8. Project Structure

Location: `C:/Users/meert/Desktop/hustle-video/` — sibling to the main `hustle/` app. Completely standalone; no shared node_modules or workspace linking required.

```
hustle-video/
├── package.json                   # remotion, react, typescript
├── remotion.config.ts
├── tsconfig.json
└── src/
    ├── Root.tsx                   # registers HorizontalVideo + VerticalVideo
    ├── tokens.ts                  # brand colors, spacing
    ├── compositions/
    │   ├── HorizontalVideo.tsx    # 1920×1080, sequences all scenes
    │   └── VerticalVideo.tsx      # 1080×1920, sequences all scenes
    ├── scenes/
    │   ├── LogoReveal.tsx
    │   ├── HeroHeadline.tsx
    │   ├── DiscoveryScene.tsx
    │   ├── PipelineScene.tsx
    │   ├── DossierScene.tsx
    │   ├── WebsiteAuditScene.tsx
    │   └── ReviewScene.tsx
    ├── components/
    │   ├── GlassCard.tsx          # shared glass primitive
    │   ├── KineticText.tsx        # word-by-word text reveal
    │   ├── ScoreRing.tsx          # animated SVG ring
    │   ├── PipelineNode.tsx       # single node with glow state
    │   ├── CitationChip.tsx       # dossier source chip
    │   └── ReviewRow.tsx          # review card with star fill
    └── lib/
        ├── spring-presets.ts      # SPRINGS.snappy / bouncy / smooth
        └── scene-timing.ts        # SCENE_FRAMES constants
```

---

## 9. Render Commands

```bash
# Preview in Remotion Studio (hot reload)
npx remotion studio

# Render horizontal 1920×1080
npx remotion render src/Root.tsx HorizontalVideo out/leadac-horizontal.mp4

# Render vertical 1080×1920
npx remotion render src/Root.tsx VerticalVideo out/leadac-vertical.mp4
```

---

## 10. Font

**Inter** (variable, Google Fonts) for all text in the video. Loaded in Remotion via `@remotion/google-fonts` or static import.

| Role | Weight | Tracking |
|---|---|---|
| Logo / Display | 700 | -0.04em |
| Scene headline | 700 | -0.03em |
| Card title | 600 | -0.02em |
| Body / labels | 400 | -0.01em |
| ALL CAPS labels | 600 | +0.08em |

---

## 11. Out of Scope

- Audio / music track (can be added as a separate pass with `<Audio>`)
- Actual app screenshots or screen recordings
- Subtitle / caption track
- Colour-grading pass
- Any animation requiring real data from the database
