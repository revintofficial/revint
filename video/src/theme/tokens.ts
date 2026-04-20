/**
 * Brand tokens, locked to the marketing site so the video reads as the
 * same product, not a separate asset.
 */

export const COLORS = {
  bg: "#0A0A0F",
  bgAlt: "#121214",
  panel: "#1C1C1E",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",
  text: "rgba(255,255,255,0.95)",
  textMuted: "rgba(255,255,255,0.55)",
  textDim: "rgba(255,255,255,0.35)",
  primary: "#5E6AD2",
  accent: "#A5B4FC",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F87171",
  primaryGradient: "linear-gradient(120deg, #FFFFFF 0%, #C7CCFF 45%, #5E6AD2 100%)",
} as const;

export const TYPE = {
  family:
    "'Inter Display', 'SF Pro Display', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  // Tracks the marketing site exactly: -0.04em on display, -0.025em on subhead.
  tracking: {
    display: "-0.04em",
    subhead: "-0.025em",
    body: "-0.01em",
    eyebrow: "0.14em",
  },
  size: {
    eyebrow: 18,
    body: 28,
    subhead: 56,
    display: 96,
    hero: 140,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const FPS = 60;

// Per-scene durations in seconds. Must mirror scripts/capture/timing.ts.
export const SCENE_S = {
  coldOpen: 3,
  promise: 5,
  discovery: 10,
  auditMorph: 12,
  mockupFlip: 12,
  opener: 10,
  pipeline: 8,
  cta: 3,
  // Standalone hero showcase composition. Not part of MasterFilm.
  appleShowcase: 8,
  // LaunchFilm-only pure-Remotion scenes that cover feature areas not
  // captured by plates. Durations tuned to keep the full cut around 105s.
  dashboard: 5,
  reviewIntel: 6,
  websitePlan: 6,
  copilot: 5,
  campaigns: 5,
  teamTodos: 4,
  settingsSweep: 5,
  pricing: 6,
} as const;

export const TOTAL_S =
  SCENE_S.coldOpen +
  SCENE_S.promise +
  SCENE_S.discovery +
  SCENE_S.auditMorph +
  SCENE_S.mockupFlip +
  SCENE_S.opener +
  SCENE_S.pipeline +
  SCENE_S.cta;

/**
 * Full launch film — the 16-scene feature-complete cut.
 *
 * Order (interleaves captured plates with pure-Remotion feature scenes):
 *
 *   01 coldOpen → 02 promise → 03 discovery → dashboard
 *     → 04 auditMorph → reviewIntel
 *     → 05 mockupFlip → websitePlan
 *     → 06 opener → copilot
 *     → 07 pipeline → campaigns → teamTodos
 *     → settingsSweep → pricing → 08 cta
 */
export const LAUNCH_TOTAL_S =
  SCENE_S.coldOpen +
  SCENE_S.promise +
  SCENE_S.discovery +
  SCENE_S.dashboard +
  SCENE_S.auditMorph +
  SCENE_S.reviewIntel +
  SCENE_S.mockupFlip +
  SCENE_S.websitePlan +
  SCENE_S.opener +
  SCENE_S.copilot +
  SCENE_S.pipeline +
  SCENE_S.campaigns +
  SCENE_S.teamTodos +
  SCENE_S.settingsSweep +
  SCENE_S.pricing +
  SCENE_S.cta;

/**
 * Virtual z-planes used by DepthParallax and ExplodedParts.
 *
 * These are in CSS pixel units for 2D depth (applied via translateZ with
 * perspective). For the Three.js side, ThreeStage maps these down by 1/40
 * to scene units so the visual scale matches.
 */
export const DEPTH = {
  fg: 0,
  near: -80,
  mid: -160,
  far: -320,
  bg: -480,
} as const;

/**
 * Parallax tuning. `PERSPECTIVE` is the CSS perspective value used by
 * DepthParallax and ExplodedParts. Lower = more exaggerated depth.
 * `travel` values are how far a layer at that depth moves over the full
 * scene (in CSS px) — foreground moves more, background less, gives the
 * classic "camera dolly" feel.
 */
export const PARALLAX = {
  perspective: 1400,
  travel: {
    fg: 140,
    near: 90,
    mid: 50,
    far: 25,
    bg: 10,
  },
  // Far layers automatically blur — creates rack-focus depth-of-field.
  blurPerDepth: 0.012, // px of blur per |z| px. |-320| → 3.84px
} as const;

/**
 * AdCut — 40-second paid-media composition. Per-beat durations in seconds.
 * Sum must equal AD_TOTAL_S. Keep in lockstep with `video/AD-SCRIPT.md`.
 *
 *   pain       0.0 - 3.0   (3.0s)  Apollo csv desaturates, "same 50M contacts"
 *   promise    3.0 - 8.5   (5.5s)  Discovery card types, 47 leads chip in
 *   discovery  8.5 - 13.5  (5.0s)  Leads list cascade, counter 0 -> 47
 *   audit     13.5 - 18.5  (5.0s)  Audit morph, score badge lands
 *   wedge     18.5 - 23.5  (5.0s)  Website plan + "we ship the pitch"
 *   opener    23.5 - 28.5  (5.0s)  Copilot drawer typing first line
 *   proof     28.5 - 33.5  (5.0s)  3 big numbers pop in
 *   cta       33.5 - 40.0  (6.5s)  "Your first 50 leads are 5 minutes away"
 */
export const AD_S = {
  pain: 3.0,
  promise: 5.5,
  discovery: 5.0,
  audit: 5.0,
  wedge: 5.0,
  opener: 5.0,
  proof: 5.0,
  cta: 6.5,
} as const;

export const AD_TOTAL_S =
  AD_S.pain +
  AD_S.promise +
  AD_S.discovery +
  AD_S.audit +
  AD_S.wedge +
  AD_S.opener +
  AD_S.proof +
  AD_S.cta;

/**
 * Beat markers in seconds from T+0. Used by KineticCaption, scene cuts,
 * and music sync. When you re-score, move the music hits here — never in
 * individual scene files.
 */
export const AD_BEATS = {
  pain: 0,
  hook: 3.0,
  promise: 3.0,
  discovery: 8.5,
  audit: 13.5,
  wedge: 18.5,
  opener: 23.5,
  proof: 28.5,
  cta: 33.5,
  endCard: 39.0,
} as const;

/**
 * Teaser (15s) cut. Keeps only the hardest-punching beats of the 40s ad.
 *
 *   pain     0.0 - 2.0  (2.0s)   cold open
 *   promise  2.0 - 5.5  (3.5s)   postcode + niche
 *   proof    5.5 - 11.0 (5.5s)   website plan + 3 numbers quick
 *   cta     11.0 - 15.0 (4.0s)
 */
export const TEASER_S = {
  pain: 2.0,
  promise: 3.5,
  proof: 5.5,
  cta: 4.0,
} as const;

export const TEASER_TOTAL_S =
  TEASER_S.pain + TEASER_S.promise + TEASER_S.proof + TEASER_S.cta;
