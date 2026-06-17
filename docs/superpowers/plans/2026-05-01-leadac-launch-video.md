# Revint Launch Video — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 33-second cinematic product launch video in Remotion with iOS 26 Liquid Glass aesthetics, dual output (1920×1080 horizontal + 1080×1920 vertical), 8 scenes at Fast Hype pace.

**Architecture:** Standalone Remotion project at `C:/Users/meert/Desktop/hustle-video/` — sibling to the main Next.js app. Shared scene components read `useVideoConfig()` to adapt layouts for both aspect ratios. Foundation layer (tokens, springs, timing constants) is established first; shared visual primitives (GlassCard, KineticText etc.) come second; then scene files; then composition wrappers last.

**Tech Stack:** Remotion 4, React 18, TypeScript 5, `@remotion/google-fonts` (Inter), Node 20+

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Dependencies: remotion, @remotion/cli, @remotion/google-fonts, react 18, typescript |
| `remotion.config.ts` | Webpack/bundle config for Remotion |
| `tsconfig.json` | TypeScript config |
| `src/Root.tsx` | Registers `HorizontalVideo` and `VerticalVideo` compositions |
| `src/tokens.ts` | All brand colours as typed constants |
| `src/lib/spring-presets.ts` | `SPRINGS.snappy / bouncy / smooth` |
| `src/lib/scene-timing.ts` | `SCENE_FRAMES` start/end per scene + total frame count |
| `src/components/GlassCard.tsx` | Liquid-glass card primitive (backdrop-filter, border, shadow) |
| `src/components/KineticText.tsx` | Word-by-word reveal with staggered spring animation |
| `src/components/ScoreRing.tsx` | Animated SVG circle stroke-dashoffset ring |
| `src/components/PipelineNode.tsx` | Single pipeline node circle + label + glow state |
| `src/components/CitationChip.tsx` | Amber icon square + two placeholder text lines |
| `src/components/ReviewRow.tsx` | Star rating row (filled stars animate sequentially) |
| `src/scenes/LogoReveal.tsx` | S1: particles converge, wordmark spring-scales in |
| `src/scenes/HeroHeadline.tsx` | S2: FIND. ANALYSE. CLOSE. kinetic word reveal |
| `src/scenes/DiscoveryScene.tsx` | S3: three lead-row glass cards fly in from left |
| `src/scenes/PipelineScene.tsx` | S4: five nodes materialise, amber glow races along connectors |
| `src/scenes/DossierScene.tsx` | S5: three citation chips cascade at depth-stack Z-scales |
| `src/scenes/WebsiteAuditScene.tsx` | S6: score ring draws, count-up number, three tag pills |
| `src/scenes/ReviewScene.tsx` | S7: three review rows slide from right, stars fill sequentially |
| `src/scenes/OutroScene.tsx` | S8: logo returns, tagline + amber CTA pill with pulse |
| `src/compositions/HorizontalVideo.tsx` | 1920×1080 — sequences all 8 scenes in `<Series>` |
| `src/compositions/VerticalVideo.tsx` | 1080×1920 — sequences all 8 scenes in `<Series>` |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `C:/Users/meert/Desktop/hustle-video/package.json`
- Create: `C:/Users/meert/Desktop/hustle-video/remotion.config.ts`
- Create: `C:/Users/meert/Desktop/hustle-video/tsconfig.json`

- [ ] **Step 1: Create directory and package.json**

```bash
mkdir C:/Users/meert/Desktop/hustle-video
```

Create `C:/Users/meert/Desktop/hustle-video/package.json`:

```json
{
  "name": "hustle-video",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "studio": "npx remotion studio",
    "render:h": "npx remotion render src/Root.tsx HorizontalVideo out/leadac-horizontal.mp4",
    "render:v": "npx remotion render src/Root.tsx VerticalVideo out/leadac-vertical.mp4"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.291",
    "@remotion/google-fonts": "^4.0.291",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "remotion": "^4.0.291"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.5"
  },
  "remotion": {
    "entryPoint": "src/Root.tsx"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `C:/Users/meert/Desktop/hustle-video/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create remotion.config.ts**

Create `C:/Users/meert/Desktop/hustle-video/remotion.config.ts`:

```ts
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
```

- [ ] **Step 4: Install dependencies**

```bash
cd C:/Users/meert/Desktop/hustle-video
npm install
```

Expected output: `added N packages` with no errors.

- [ ] **Step 5: Create output directory**

```bash
mkdir C:/Users/meert/Desktop/hustle-video/out
```

---

## Task 2: Foundation — Tokens, Springs, Timing

**Files:**
- Create: `src/tokens.ts`
- Create: `src/lib/spring-presets.ts`
- Create: `src/lib/scene-timing.ts`

- [ ] **Step 1: Create src/tokens.ts**

```ts
export const TOKEN = {
  // Primary — Burnt Amber (hue 38°, sat 78%)
  amber100: 'hsl(38, 78%, 88%)',
  amber200: 'hsl(38, 78%, 78%)',
  amber300: 'hsl(38, 78%, 68%)',
  amber400: 'hsl(38, 78%, 58%)',
  amber500: 'hsl(38, 78%, 50%)',
  amber600: 'hsl(38, 78%, 42%)',
  amber700: 'hsl(38, 78%, 34%)',

  // Backgrounds
  bg:      'hsl(38, 7%, 5%)',
  surface: 'hsl(38, 7%, 8%)',
  card:    'hsl(38, 7%, 11%)',

  // Text
  text1: 'hsl(38, 10%, 92%)',
  text2: 'hsl(38, 10%, 70%)',
  text3: 'hsl(38, 10%, 50%)',

  // Semantic
  success: 'hsl(152, 48%, 50%)',
  warning: 'hsl(38, 70%, 52%)',
  error:   'hsl(4, 62%, 54%)',

  // Glass
  glassBg:     'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.12)',
} as const;
```

- [ ] **Step 2: Create src/lib/spring-presets.ts**

```ts
import type { SpringConfig } from 'remotion';

export const SPRINGS = {
  snappy: { mass: 1, stiffness: 200, damping: 20 } satisfies SpringConfig,
  bouncy: { mass: 1, stiffness: 300, damping: 15 } satisfies SpringConfig,
  smooth: { mass: 1, stiffness: 100, damping: 20 } satisfies SpringConfig,
} as const;
```

- [ ] **Step 3: Create src/lib/scene-timing.ts**

```ts
// All values in frames at 60fps
export const SCENE_FRAMES = {
  S1_START:  0,
  S1_END:    180,
  S2_START:  180,
  S2_END:    360,
  S3_START:  360,
  S3_END:    540,
  S4_START:  540,
  S4_END:    780,
  S5_START:  780,
  S5_END:    1020,
  S6_START:  1020,
  S6_END:    1260,
  S7_START:  1260,
  S7_END:    1500,
  S8_START:  1500,
  S8_END:    1980,
  TOTAL:     1980,
} as const;

export const S1_DUR  = SCENE_FRAMES.S1_END  - SCENE_FRAMES.S1_START;   // 180
export const S2_DUR  = SCENE_FRAMES.S2_END  - SCENE_FRAMES.S2_START;   // 180
export const S3_DUR  = SCENE_FRAMES.S3_END  - SCENE_FRAMES.S3_START;   // 180
export const S4_DUR  = SCENE_FRAMES.S4_END  - SCENE_FRAMES.S4_START;   // 240
export const S5_DUR  = SCENE_FRAMES.S5_END  - SCENE_FRAMES.S5_START;   // 240
export const S6_DUR  = SCENE_FRAMES.S6_END  - SCENE_FRAMES.S6_START;   // 240
export const S7_DUR  = SCENE_FRAMES.S7_END  - SCENE_FRAMES.S7_START;   // 240
export const S8_DUR  = SCENE_FRAMES.S8_END  - SCENE_FRAMES.S8_START;   // 480
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/meert/Desktop/hustle-video
git init
git add .
git commit -m "feat: project scaffolding + foundation tokens/springs/timing"
```

---

## Task 3: GlassCard Component

**Files:**
- Create: `src/components/GlassCard.tsx`

- [ ] **Step 1: Create GlassCard.tsx**

```tsx
import React from 'react';
import { TOKEN } from '../tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  padding?: number;
  accentGlow?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  width,
  height,
  padding = 24,
  accentGlow,
}) => {
  const glowShadow = accentGlow
    ? `0 20px 60px ${accentGlow}`
    : `0 20px 60px hsl(38, 78%, 50%, 0.15)`;

  return (
    <div
      style={{
        width,
        height,
        padding,
        background: TOKEN.glassBg,
        backdropFilter: 'blur(44px) saturate(160%)',
        WebkitBackdropFilter: 'blur(44px) saturate(160%)',
        border: `1px solid ${TOKEN.glassBorder}`,
        boxShadow: [
          '4px 4px 10px rgba(0,0,0,0.22)',
          'inset 0 1px 1px rgba(255,255,255,0.12)',
          glowShadow,
        ].join(', '),
        borderRadius: 20,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
```

- [ ] **Step 2: Verify — create a minimal Root.tsx to preview**

Create `src/Root.tsx` (temporary, will be replaced in Task 15):

```tsx
import { Composition } from 'remotion';
import { GlassCard } from './components/GlassCard';
import { TOKEN } from './tokens';

const TestComp: React.FC = () => (
  <div style={{ width: 1920, height: 1080, background: TOKEN.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <GlassCard width={400} height={200}>
      <p style={{ color: TOKEN.text1, fontFamily: 'Inter, sans-serif' }}>Glass Card Test</p>
    </GlassCard>
  </div>
);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Test" component={TestComp} durationInFrames={60} fps={60} width={1920} height={1080} />
  </>
);
```

Run `npm run studio` from `hustle-video/`. Open browser, check "Test" composition shows a glass card on dark background.

- [ ] **Step 3: Commit**

```bash
git add src/components/GlassCard.tsx src/Root.tsx
git commit -m "feat: GlassCard liquid-glass primitive"
```

---

## Task 4: KineticText Component

**Files:**
- Create: `src/components/KineticText.tsx`

- [ ] **Step 1: Create KineticText.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { SPRINGS } from '../lib/spring-presets';

interface KineticTextProps {
  words: string[];
  staggerFrames?: number;
  fontSize?: number;
  fontWeight?: number | string;
  letterSpacing?: string;
  getWordColor?: (index: number) => string;
  direction?: 'vertical' | 'horizontal';
  gap?: number;
}

export const KineticText: React.FC<KineticTextProps> = ({
  words,
  staggerFrames = 20,
  fontSize = 120,
  fontWeight = 700,
  letterSpacing = '-0.03em',
  getWordColor,
  direction = 'vertical',
  gap = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{
      display: 'flex',
      flexDirection: direction === 'vertical' ? 'column' : 'row',
      alignItems: 'center',
      gap,
    }}>
      {words.map((word, i) => {
        const delay = i * staggerFrames;
        const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
        const y = interpolate(enter, [0, 1], [30, 0]);
        const scale = interpolate(enter, [0, 1], [0.8, 1]);
        const opacity = interpolate(enter, [0, 1], [0, 1]);

        return (
          <div
            key={word + i}
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize,
              fontWeight,
              letterSpacing,
              color: getWordColor ? getWordColor(i) : '#ffffff',
              opacity,
              transform: `translateY(${y}px) scale(${scale})`,
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/KineticText.tsx
git commit -m "feat: KineticText word-by-word spring reveal component"
```

---

## Task 5: ScoreRing Component

**Files:**
- Create: `src/components/ScoreRing.tsx`

- [ ] **Step 1: Create ScoreRing.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { TOKEN } from '../tokens';
import { SPRINGS } from '../lib/spring-presets';

interface ScoreRingProps {
  score: number;        // 0–100
  size?: number;
  strokeWidth?: number;
  color?: string;
  animationDuration?: number; // frames over which stroke animates
}

export const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 200,
  strokeWidth = 12,
  color = TOKEN.success,
  animationDuration = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = spring({ frame, fps, config: SPRINGS.smooth, durationInFrames: animationDuration });
  const targetFill = score / 100;
  const fill = interpolate(progress, [0, 1], [0, targetFill]);
  const dashoffset = circumference * (1 - fill);

  const displayScore = Math.round(interpolate(Math.min(frame, animationDuration), [0, animationDuration], [0, score]));

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      {/* Score number centred */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: size * 0.28,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        color: TOKEN.text1,
      }}>
        {displayScore}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScoreRing.tsx
git commit -m "feat: ScoreRing animated SVG progress ring with count-up number"
```

---

## Task 6: PipelineNode, CitationChip, ReviewRow Components

**Files:**
- Create: `src/components/PipelineNode.tsx`
- Create: `src/components/CitationChip.tsx`
- Create: `src/components/ReviewRow.tsx`

- [ ] **Step 1: Create PipelineNode.tsx**

```tsx
import React from 'react';
import { TOKEN } from '../tokens';

interface PipelineNodeProps {
  label: string;
  size?: number;
  glowing?: boolean;
}

export const PipelineNode: React.FC<PipelineNodeProps> = ({ label, size = 80, glowing = false }) => {
  const glowColor = glowing ? TOKEN.amber500 : 'transparent';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: glowing
          ? `radial-gradient(circle, hsl(38, 78%, 50%, 0.3) 0%, hsl(38, 78%, 50%, 0.05) 70%)`
          : TOKEN.glassBg,
        border: `2px solid ${glowing ? TOKEN.amber400 : TOKEN.glassBorder}`,
        boxShadow: glowing ? `0 0 24px ${glowColor}, 0 0 48px hsl(38, 78%, 50%, 0.3)` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(20px)',
        transition: 'all 0.3s',
      }}>
        <div style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: '50%',
          background: glowing ? TOKEN.amber500 : TOKEN.text3,
        }} />
      </div>
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: glowing ? TOKEN.amber300 : TOKEN.text3,
      }}>{label}</div>
    </div>
  );
};
```

- [ ] **Step 2: Create CitationChip.tsx**

```tsx
import React from 'react';
import { TOKEN } from '../tokens';
import { GlassCard } from './GlassCard';

interface CitationChipProps {
  label: string;
  sublabel?: string;
  width?: number;
}

export const CitationChip: React.FC<CitationChipProps> = ({ label, sublabel, width = 340 }) => (
  <GlassCard width={width} padding={16} accentGlow="hsl(38, 78%, 50%, 0.18)">
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* Amber icon square */}
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${TOKEN.amber500}, ${TOKEN.amber600})`,
        boxShadow: `0 4px 12px hsl(38, 78%, 50%, 0.4)`,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 14, fontWeight: 600,
          color: TOKEN.text1,
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}>{label}</div>
        {sublabel && (
          <div style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 12, color: TOKEN.text3,
          }}>{sublabel}</div>
        )}
      </div>
    </div>
  </GlassCard>
);
```

- [ ] **Step 3: Create ReviewRow.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { GlassCard } from './GlassCard';
import { SPRINGS } from '../lib/spring-presets';

interface ReviewRowProps {
  rating: number;       // 1–5
  text: string;
  staggerOffset?: number;
  negative?: boolean;
}

export const ReviewRow: React.FC<ReviewRowProps> = ({ rating, text, staggerOffset = 0, negative = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <GlassCard width={480} padding={18}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Stars */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: 5 }, (_, i) => {
            const starDelay = staggerOffset + i * 4;
            const starIn = spring({ frame, fps, config: SPRINGS.snappy, delay: starDelay });
            const filled = i < rating;
            const starColor = filled
              ? (negative ? TOKEN.error : TOKEN.amber400)
              : TOKEN.text3;
            const glow = filled && spring({ frame, fps, config: SPRINGS.bouncy, delay: starDelay });
            return (
              <div key={i} style={{
                fontSize: 18,
                color: interpolate(glow || 0, [0, 1], [0.2, 1]) ? starColor : TOKEN.text3,
                opacity: interpolate(starIn, [0, 1], [0.2, 1]),
                filter: filled && glow ? `drop-shadow(0 0 4px ${starColor})` : 'none',
              }}>★</div>
            );
          })}
        </div>
        {/* Text line */}
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          color: TOKEN.text2,
          letterSpacing: '-0.01em',
        }}>{text}</div>
      </div>
    </GlassCard>
  );
};
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PipelineNode.tsx src/components/CitationChip.tsx src/components/ReviewRow.tsx
git commit -m "feat: PipelineNode, CitationChip, ReviewRow shared primitives"
```

---

## Task 7: S1 — LogoReveal Scene

**Files:**
- Create: `src/scenes/LogoReveal.tsx`

- [ ] **Step 1: Create LogoReveal.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { SPRINGS } from '../lib/spring-presets';

const PARTICLE_COUNT = 6;
const PARTICLE_OFFSETS: [number, number][] = [
  [-300, -200], [300, -200],
  [-400, 0],    [400, 0],
  [-300, 200],  [300, 200],
];

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const wordmarkEnter = spring({ frame, fps, config: SPRINGS.bouncy, delay: 30 });
  const wordmarkScale = interpolate(wordmarkEnter, [0, 1], [0.6, 1]);
  const wordmarkOpacity = interpolate(wordmarkEnter, [0, 1], [0, 1]);
  const wordmarkBlur = interpolate(wordmarkEnter, [0, 1], [12, 0]);

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Amber radial glow */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, hsl(38, 78%, 50%, 0.18) 0%, transparent 70%)`,
        opacity: interpolate(wordmarkEnter, [0, 1], [0, 1]),
      }} />

      {/* Particles */}
      {PARTICLE_OFFSETS.map(([ox, oy], i) => {
        const delay = i * 5;
        const p = spring({ frame, fps, config: SPRINGS.smooth, delay });
        const x = interpolate(p, [0, 1], [ox, 0]);
        const y = interpolate(p, [0, 1], [oy, 0]);
        const opacity = frame > 90
          ? interpolate(frame, [90, 150], [1, 0], { extrapolateRight: 'clamp' })
          : interpolate(p, [0, 1], [0, 0.7]);
        return (
          <div key={i} style={{
            position: 'absolute',
            width: 6, height: 6,
            borderRadius: '50%',
            background: TOKEN.amber400,
            boxShadow: `0 0 12px ${TOKEN.amber400}`,
            transform: `translate(${x}px, ${y}px)`,
            opacity,
          }} />
        );
      })}

      {/* Wordmark */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: wordmarkOpacity,
        transform: `scale(${wordmarkScale})`,
        filter: `blur(${wordmarkBlur}px)`,
      }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: width > 1000 ? 96 : 64,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: TOKEN.text1,
          lineHeight: 1,
        }}>LEADAC</div>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: width > 1000 ? 20 : 14,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: TOKEN.amber400,
        }}>AI</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update Root.tsx to preview this scene**

Replace the Test composition in `src/Root.tsx` with:

```tsx
import React from 'react';
import { Composition } from 'remotion';
import { LogoReveal } from './scenes/LogoReveal';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="S1_LogoReveal" component={LogoReveal} durationInFrames={180} fps={60} width={1920} height={1080} />
  </>
);
```

Open Remotion Studio, scrub through frames 0–180. Verify: particles converge from edges, wordmark springs in with scale+blur at frame ~30, particles fade by frame ~150.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/LogoReveal.tsx src/Root.tsx
git commit -m "feat: S1 LogoReveal — particles + wordmark spring entrance"
```

---

## Task 8: S2 — HeroHeadline Scene

**Files:**
- Create: `src/scenes/HeroHeadline.tsx`

- [ ] **Step 1: Create HeroHeadline.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { SPRINGS } from '../lib/spring-presets';

const WORDS = ['FIND.', 'ANALYSE.', 'CLOSE.'];
const STAGGER = 20;

export const HeroHeadline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Exit transition: starts at frame 165
  const exitProgress = spring({ frame: Math.max(0, frame - 165), fps, config: SPRINGS.smooth });
  const exitScale = interpolate(exitProgress, [0, 1], [1, 1.06]);
  const exitBlur = interpolate(exitProgress, [0, 1], [0, 16]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      transform: `scale(${exitScale})`,
      filter: `blur(${exitBlur}px)`,
      opacity: exitOpacity,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}>
        {WORDS.map((word, i) => {
          const delay = i * STAGGER;
          const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
          const y = interpolate(enter, [0, 1], [30, 0]);
          const scale = interpolate(enter, [0, 1], [0.8, 1]);
          const opacity = interpolate(enter, [0, 1], [0, 1]);
          const color = i === 1 ? TOKEN.amber400 : TOKEN.text1;

          return (
            <div key={word} style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: width > 1000 ? 130 : 80,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color,
              lineHeight: 1,
              textTransform: 'uppercase',
              opacity,
              transform: `translateY(${y}px) scale(${scale})`,
            }}>
              {word}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add to Root.tsx compositions list:
```tsx
<Composition id="S2_HeroHeadline" component={HeroHeadline} durationInFrames={180} fps={60} width={1920} height={1080} />
```

Preview: words appear staggered, "ANALYSE." is amber, exit blur+scale starts at frame 165.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/HeroHeadline.tsx src/Root.tsx
git commit -m "feat: S2 HeroHeadline — kinetic word reveal with exit blur push"
```

---

## Task 9: S3 — DiscoveryScene

**Files:**
- Create: `src/scenes/DiscoveryScene.tsx`

- [ ] **Step 1: Create DiscoveryScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { GlassCard } from '../components/GlassCard';
import { SPRINGS } from '../lib/spring-presets';

const LEADS = [
  { name: 'Barista Coffee Co.', score: 92, scoreColor: TOKEN.success },
  { name: 'Harbour Side Bistro', score: 74, scoreColor: TOKEN.warning },
  { name: 'Oakwood Kitchen', score: 88, scoreColor: TOKEN.success },
];

export const DiscoveryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cool-blue radial glow — differentiates from amber scenes */}
      <div style={{
        position: 'absolute',
        width: 700, height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(96,165,250,0.10) 0%, transparent 70%)',
      }} />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: width > 1000 ? 'flex-start' : 'center',
      }}>
        {/* Section label */}
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TOKEN.text3,
          marginBottom: 8,
        }}>Lead Discovery</div>

        {LEADS.map((lead, i) => {
          const delay = i * 8;
          const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
          const x = interpolate(enter, [0, 1], [-120, 0]);
          const opacity = interpolate(enter, [0, 1], [0, 1]);

          return (
            <div key={lead.name} style={{ transform: `translateX(${x}px)`, opacity }}>
              <GlassCard width={width > 1000 ? 520 : 360} padding={20} accentGlow="rgba(96,165,250,0.10)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Score dot */}
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    background: lead.scoreColor,
                    boxShadow: `0 0 8px ${lead.scoreColor}`,
                  }} />
                  {/* Name */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: 15, fontWeight: 600,
                      color: TOKEN.text1, letterSpacing: '-0.01em',
                    }}>{lead.name}</div>
                    <div style={{
                      width: '60%', height: 8, borderRadius: 4,
                      background: TOKEN.glassBorder, marginTop: 6,
                    }} />
                  </div>
                  {/* Score */}
                  <div style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 22, fontWeight: 700,
                    color: lead.scoreColor, letterSpacing: '-0.02em',
                  }}>{lead.score}</div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S3_Discovery" component={DiscoveryScene} durationInFrames={180} fps={60} width={1920} height={1080} />
```

Verify: three lead cards fly in from left with blue-tinted glow, score dots green/yellow.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/DiscoveryScene.tsx src/Root.tsx
git commit -m "feat: S3 DiscoveryScene — lead row cards fly in from left"
```

---

## Task 10: S4 — PipelineScene

**Files:**
- Create: `src/scenes/PipelineScene.tsx`

- [ ] **Step 1: Create PipelineScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { PipelineNode } from '../components/PipelineNode';
import { SPRINGS } from '../lib/spring-presets';

const NODES = [
  { label: 'Discover' },
  { label: 'Scrape' },
  { label: 'Analyse' },
  { label: 'Score' },
  { label: 'Dossier' },
];

export const PipelineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = height > width;
  const NODE_SIZE = isVertical ? 70 : 80;

  // All nodes visible by frame ~100 (10f stagger * 5 nodes + spring settle)
  // Connector glow starts at frame 110
  const connectorStart = 110;

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 48,
      overflow: 'hidden',
    }}>
      {/* Section label */}
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: TOKEN.text3,
      }}>AI Workers Pipeline</div>

      <div style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        gap: isVertical ? 24 : 0,
      }}>
        {NODES.map((node, i) => {
          const delay = i * 10;
          const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
          const scale = interpolate(enter, [0, 1], [0, 1]);
          const opacity = interpolate(enter, [0, 1], [0, 1]);
          const glowing = i < 3; // first 3 nodes glow amber in final state

          return (
            <React.Fragment key={node.label}>
              <div style={{ transform: `scale(${scale})`, opacity }}>
                <PipelineNode label={node.label} size={NODE_SIZE} glowing={glowing} />
              </div>

              {/* Connector between nodes */}
              {i < NODES.length - 1 && (
                <div style={{
                  position: 'relative',
                  ...(isVertical
                    ? { width: 2, height: 32 }
                    : { width: isVertical ? 2 : 60, height: 2 }
                  ),
                }}>
                  {/* Track */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: TOKEN.glassBorder,
                  }} />
                  {/* Glow pulse — races along connector */}
                  {(() => {
                    const connectorFrame = Math.max(0, frame - connectorStart - i * 8);
                    const glow = spring({ frame: connectorFrame, fps, config: SPRINGS.smooth });
                    const scaleVal = i < 2
                      ? interpolate(glow, [0, 1], [0, 1])
                      : 0;
                    return (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: TOKEN.amber500,
                        boxShadow: `0 0 12px ${TOKEN.amber500}`,
                        transformOrigin: 'left center',
                        transform: isVertical
                          ? `scaleY(${scaleVal})`
                          : `scaleX(${scaleVal})`,
                        opacity: scaleVal > 0 ? 1 : 0,
                      }} />
                    );
                  })()}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S4_Pipeline" component={PipelineScene} durationInFrames={240} fps={60} width={1920} height={1080} />
```

Verify: nodes pop in staggered, first 3 glow amber, connector glow travels between them after frame 110.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/PipelineScene.tsx src/Root.tsx
git commit -m "feat: S4 PipelineScene — staggered node reveal + amber connector glow"
```

---

## Task 11: S5 — DossierScene

**Files:**
- Create: `src/scenes/DossierScene.tsx`

- [ ] **Step 1: Create DossierScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { CitationChip } from '../components/CitationChip';
import { SPRINGS } from '../lib/spring-presets';

const CHIPS = [
  { label: 'Google Maps', sublabel: '4.2★ · 148 reviews' },
  { label: 'Website Audit', sublabel: 'SEO score: 78 / 100' },
  { label: 'Instagram', sublabel: '2.4k followers · last post 3d ago' },
];

const DEPTH_SCALES = [1.0, 0.97, 0.94];

export const DossierScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Warm amber halo */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsl(38, 78%, 50%, 0.22) 0%, transparent 70%)',
      }} />

      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: TOKEN.text3, marginBottom: 8,
      }}>AI Dossier</div>

      {CHIPS.map((chip, i) => {
        const delay = i * 8;
        const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
        const y = interpolate(enter, [0, 1], [20, 0]);
        const opacity = interpolate(enter, [0, 1], [0, 1]);
        const depthScale = DEPTH_SCALES[i];

        return (
          <div key={chip.label} style={{
            transform: `translateY(${y}px) scale(${depthScale})`,
            opacity,
          }}>
            <CitationChip
              label={chip.label}
              sublabel={chip.sublabel}
              width={width > 1000 ? 380 : 300}
            />
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S5_Dossier" component={DossierScene} durationInFrames={240} fps={60} width={1920} height={1080} />
```

Verify: chips cascade with depth-stack scales (1.0, 0.97, 0.94), amber halo behind them.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/DossierScene.tsx src/Root.tsx
git commit -m "feat: S5 DossierScene — citation chips cascade with depth-stack Z-scales"
```

---

## Task 12: S6 — WebsiteAuditScene

**Files:**
- Create: `src/scenes/WebsiteAuditScene.tsx`

- [ ] **Step 1: Create WebsiteAuditScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { ScoreRing } from '../components/ScoreRing';
import { GlassCard } from '../components/GlassCard';
import { SPRINGS } from '../lib/spring-presets';

const TAGS = ['SEO', 'SPEED', 'CTA'];

export const WebsiteAuditScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isVertical = height > width;
  const ringSize = isVertical ? 200 : 240;

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      flexDirection: isVertical ? 'column' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isVertical ? 40 : 80,
      overflow: 'hidden',
    }}>
      {/* Score ring */}
      <ScoreRing score={78} size={ringSize} color={TOKEN.success} animationDuration={60} />

      {/* Right side: label + tags */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 13, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: TOKEN.text3,
        }}>Website Audit</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TAGS.map((tag, i) => {
            const delay = 30 + i * 6;
            const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
            const y = interpolate(enter, [0, 1], [20, 0]);
            const opacity = interpolate(enter, [0, 1], [0, 1]);

            return (
              <div key={tag} style={{ transform: `translateY(${y}px)`, opacity }}>
                <GlassCard padding={12} accentGlow={`${TOKEN.success}33`}>
                  <div style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 14, fontWeight: 600,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: TOKEN.success,
                    paddingLeft: 8, paddingRight: 8,
                  }}>{tag}</div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S6_WebsiteAudit" component={WebsiteAuditScene} durationInFrames={240} fps={60} width={1920} height={1080} />
```

Verify: ring draws to 78%, count-up 0→78, tag pills fly up from below with green accent.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/WebsiteAuditScene.tsx src/Root.tsx
git commit -m "feat: S6 WebsiteAuditScene — score ring draw + count-up + tag pills"
```

---

## Task 13: S7 — ReviewScene

**Files:**
- Create: `src/scenes/ReviewScene.tsx`

- [ ] **Step 1: Create ReviewScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { ReviewRow } from '../components/ReviewRow';
import { SPRINGS } from '../lib/spring-presets';

const REVIEWS = [
  { rating: 5, text: 'Amazing experience, would highly recommend!', negative: false },
  { rating: 4, text: 'Great food, service was a bit slow.', negative: false },
  { rating: 2, text: 'Disappointing — cold food and long wait times.', negative: true },
];

export const ReviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13, fontWeight: 600,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        color: TOKEN.text3, marginBottom: 8,
      }}>Review Intelligence</div>

      {REVIEWS.map((review, i) => {
        const delay = i * 8;
        const enter = spring({ frame, fps, config: SPRINGS.snappy, delay });
        const x = interpolate(enter, [0, 1], [120, 0]);
        const opacity = interpolate(enter, [0, 1], [0, 1]);

        return (
          <div key={i} style={{ transform: `translateX(${x}px)`, opacity }}>
            <ReviewRow
              rating={review.rating}
              text={review.text}
              staggerOffset={delay}
              negative={review.negative}
            />
          </div>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S7_Review" component={ReviewScene} durationInFrames={240} fps={60} width={1920} height={1080} />
```

Verify: three rows slide in from right, 5-star and 4-star rows have amber stars, 2-star row shows red stars.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ReviewScene.tsx src/Root.tsx
git commit -m "feat: S7 ReviewScene — review rows slide from right, stars fill sequentially"
```

---

## Task 14: S8 — OutroScene

**Files:**
- Create: `src/scenes/OutroScene.tsx`

- [ ] **Step 1: Create OutroScene.tsx**

```tsx
import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { TOKEN } from '../tokens';
import { SPRINGS } from '../lib/spring-presets';

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Logo returns at frame 0
  const logoEnter = spring({ frame, fps, config: SPRINGS.smooth, durationInFrames: 40 });
  const logoOpacity = interpolate(logoEnter, [0, 1], [0, 1]);

  // Tagline slides up at frame 40
  const tagEnter = spring({ frame, fps, config: SPRINGS.snappy, delay: 40 });
  const tagY = interpolate(tagEnter, [0, 1], [16, 0]);
  const tagOpacity = interpolate(tagEnter, [0, 1], [0, 1]);

  // CTA pill appears at frame 200
  const ctaEnter = spring({ frame, fps, config: SPRINGS.snappy, delay: 200 });
  const ctaOpacity = interpolate(ctaEnter, [0, 1], [0, 1]);

  // CTA pulse glow oscillates after frame 250
  const pulseFrame = Math.max(0, frame - 250);
  const pulse = Math.sin((pulseFrame / fps) * Math.PI * 2) * 0.5 + 0.5;
  const glowAlpha = interpolate(ctaOpacity, [0, 1], [0, interpolate(pulse, [0, 1], [0.3, 0.7])]);

  // Fade to black: last 60 frames of 480
  const fadeStart = 420;
  const fadeOut = frame > fadeStart
    ? interpolate(frame, [fadeStart, 480], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <div style={{
      width, height,
      background: TOKEN.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Fade to black overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#000',
        opacity: fadeOut,
        pointerEvents: 'none',
      }} />

      {/* Ambient amber glow */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, hsl(38, 78%, 50%, 0.15) 0%, transparent 70%)',
        opacity: logoOpacity,
      }} />

      {/* Logo */}
      <div style={{ opacity: logoOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: width > 1000 ? 72 : 48,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: TOKEN.text1,
          lineHeight: 1,
        }}>LEADAC</div>
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: width > 1000 ? 16 : 12,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: TOKEN.amber400,
        }}>AI</div>
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: width > 1000 ? 22 : 16,
        fontWeight: 300,
        letterSpacing: '-0.01em',
        color: TOKEN.text2,
        opacity: tagOpacity,
        transform: `translateY(${tagY}px)`,
      }}>Find. Analyse. Close.</div>

      {/* CTA pill */}
      <div style={{
        marginTop: 16,
        opacity: ctaOpacity,
        background: `linear-gradient(135deg, ${TOKEN.amber500}, ${TOKEN.amber600})`,
        borderRadius: 100,
        paddingTop: 14, paddingBottom: 14,
        paddingLeft: 36, paddingRight: 36,
        boxShadow: `0 0 32px hsl(38, 78%, 50%, ${glowAlpha}), 0 0 64px hsl(38, 78%, 50%, ${glowAlpha * 0.5})`,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: width > 1000 ? 18 : 14,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: '#fff',
      }}>
        Start Free →
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add to Root.tsx and preview**

Add:
```tsx
<Composition id="S8_Outro" component={OutroScene} durationInFrames={480} fps={60} width={1920} height={1080} />
```

Verify: logo fades in, tagline slides up, CTA pill pulses amber glow, fades to black at frame 420.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/OutroScene.tsx src/Root.tsx
git commit -m "feat: S8 OutroScene — logo return, tagline, pulsing CTA, fade to black"
```

---

## Task 15: HorizontalVideo + VerticalVideo Compositions

**Files:**
- Create: `src/compositions/HorizontalVideo.tsx`
- Create: `src/compositions/VerticalVideo.tsx`

- [ ] **Step 1: Create HorizontalVideo.tsx**

```tsx
import React from 'react';
import { Series } from 'remotion';
import { LogoReveal } from '../scenes/LogoReveal';
import { HeroHeadline } from '../scenes/HeroHeadline';
import { DiscoveryScene } from '../scenes/DiscoveryScene';
import { PipelineScene } from '../scenes/PipelineScene';
import { DossierScene } from '../scenes/DossierScene';
import { WebsiteAuditScene } from '../scenes/WebsiteAuditScene';
import { ReviewScene } from '../scenes/ReviewScene';
import { OutroScene } from '../scenes/OutroScene';
import { S1_DUR, S2_DUR, S3_DUR, S4_DUR, S5_DUR, S6_DUR, S7_DUR, S8_DUR } from '../lib/scene-timing';

export const HorizontalVideo: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={S1_DUR}><LogoReveal /></Series.Sequence>
    <Series.Sequence durationInFrames={S2_DUR}><HeroHeadline /></Series.Sequence>
    <Series.Sequence durationInFrames={S3_DUR}><DiscoveryScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S4_DUR}><PipelineScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S5_DUR}><DossierScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S6_DUR}><WebsiteAuditScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S7_DUR}><ReviewScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S8_DUR}><OutroScene /></Series.Sequence>
  </Series>
);
```

- [ ] **Step 2: Create VerticalVideo.tsx**

```tsx
import React from 'react';
import { Series } from 'remotion';
import { LogoReveal } from '../scenes/LogoReveal';
import { HeroHeadline } from '../scenes/HeroHeadline';
import { DiscoveryScene } from '../scenes/DiscoveryScene';
import { PipelineScene } from '../scenes/PipelineScene';
import { DossierScene } from '../scenes/DossierScene';
import { WebsiteAuditScene } from '../scenes/WebsiteAuditScene';
import { ReviewScene } from '../scenes/ReviewScene';
import { OutroScene } from '../scenes/OutroScene';
import { S1_DUR, S2_DUR, S3_DUR, S4_DUR, S5_DUR, S6_DUR, S7_DUR, S8_DUR } from '../lib/scene-timing';

export const VerticalVideo: React.FC = () => (
  <Series>
    <Series.Sequence durationInFrames={S1_DUR}><LogoReveal /></Series.Sequence>
    <Series.Sequence durationInFrames={S2_DUR}><HeroHeadline /></Series.Sequence>
    <Series.Sequence durationInFrames={S3_DUR}><DiscoveryScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S4_DUR}><PipelineScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S5_DUR}><DossierScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S6_DUR}><WebsiteAuditScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S7_DUR}><ReviewScene /></Series.Sequence>
    <Series.Sequence durationInFrames={S8_DUR}><OutroScene /></Series.Sequence>
  </Series>
);
```

- [ ] **Step 3: Commit compositions**

```bash
git add src/compositions/
git commit -m "feat: HorizontalVideo + VerticalVideo composition wrappers"
```

---

## Task 16: Final Root.tsx + Font Loading + End-to-End Preview

**Files:**
- Modify: `src/Root.tsx`

- [ ] **Step 1: Replace Root.tsx with final version**

```tsx
import React from 'react';
import { Composition } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Inter';
import { HorizontalVideo } from './compositions/HorizontalVideo';
import { VerticalVideo } from './compositions/VerticalVideo';
import { SCENE_FRAMES } from './lib/scene-timing';

// Load Inter font for use in all scenes
loadFont('normal', { weights: ['300', '400', '600', '700'] });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="HorizontalVideo"
      component={HorizontalVideo}
      durationInFrames={SCENE_FRAMES.TOTAL}
      fps={60}
      width={1920}
      height={1080}
    />
    <Composition
      id="VerticalVideo"
      component={VerticalVideo}
      durationInFrames={SCENE_FRAMES.TOTAL}
      fps={60}
      width={1080}
      height={1920}
    />
  </>
);
```

- [ ] **Step 2: Full end-to-end preview in Remotion Studio**

```bash
cd C:/Users/meert/Desktop/hustle-video
npm run studio
```

In Remotion Studio:
1. Select `HorizontalVideo` — scrub through all 1980 frames. Check each scene transition.
2. Select `VerticalVideo` — verify layouts adapt (pipeline 2-row wrap, score ring stacks vertically).
3. Pay attention to:
   - Frame 0–180: particles + wordmark spring
   - Frame 180–360: FIND/ANALYSE/CLOSE words
   - Frame 360–540: lead cards from left
   - Frame 540–780: pipeline nodes + connector glow
   - Frame 780–1020: citation chips depth-stack
   - Frame 1020–1260: score ring draws, tags pop in
   - Frame 1260–1500: review rows from right
   - Frame 1500–1980: logo, tagline, CTA pulse, fade to black

- [ ] **Step 3: Final commit**

```bash
git add src/Root.tsx
git commit -m "feat: final Root.tsx — HorizontalVideo + VerticalVideo compositions registered, Inter font loaded"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by task |
|---|---|
| Brand tokens | Task 2 (tokens.ts) |
| Spring presets: snappy/bouncy/smooth | Task 2 (spring-presets.ts) |
| Scene timing constants | Task 2 (scene-timing.ts) |
| GlassCard liquid glass primitive | Task 3 |
| KineticText word-by-word | Task 4 |
| ScoreRing with count-up | Task 5 |
| PipelineNode, CitationChip, ReviewRow | Task 6 |
| S1 LogoReveal — particles + wordmark | Task 7 |
| S2 HeroHeadline — kinetic words | Task 8 |
| S3 DiscoveryScene — cards from left | Task 9 |
| S4 PipelineScene — nodes + glow | Task 10 |
| S5 DossierScene — depth-stack chips | Task 11 |
| S6 WebsiteAuditScene — ring + tags | Task 12 |
| S7 ReviewScene — rows from right | Task 13 |
| S8 OutroScene — logo/tagline/CTA/fade | Task 14 |
| HorizontalVideo composition (1920×1080) | Task 15 |
| VerticalVideo composition (1080×1920) | Task 15 |
| Root.tsx + font loading | Task 16 |
| `npm run studio` preview | Task 16 |

**Gaps identified and fixed:** The spec's file structure list omitted `OutroScene.tsx` for S8 — added as `src/scenes/OutroScene.tsx` in Task 14. ✓

**Placeholder scan:** No TBDs, no "similar to task N" references, no "add appropriate error handling" entries found. ✓

**Type consistency:** `SPRINGS.snappy/bouncy/smooth`, `TOKEN.*`, `S1_DUR..S8_DUR` — all defined in Task 2 and used consistently across Tasks 7–16. ✓
