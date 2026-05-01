/**
 * Design tokens — JS mirror of the CSS variables in `src/app/globals.css`.
 *
 * Why this file exists:
 *   - React Native cannot consume CSS variables. A future Expo / NativeWind /
 *     Tamagui port reads from this object, while the web stays on the CSS
 *     variables. Keep both in sync; the CSS file is the source of truth for
 *     visual values, this file is the source of truth for the *names* we agree
 *     on across web and native.
 *   - Stays JSON-serialisable so it can be passed to a worker or Storybook.
 *
 * Whenever you edit the `:root { --leadac-* }` block in globals.css or the
 * mobile UX additions below it, mirror the change here.
 */

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 40,
  8: 48,
  9: 64,
  10: 80,
  11: 96,
  12: 128,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  "2xl": 28,
  full: 9999,
} as const;

export const motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 400,
  },
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasized: "cubic-bezier(0.3, 0, 0, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export const touch = {
  min: 44,
  large: 56,
} as const;

export const chrome = {
  appBarHeight: 56,
  tabBarHeight: 64,
  fabSize: 56,
} as const;

export const sheetSnap = {
  min: "25vh",
  mid: "50vh",
  max: "92vh",
} as const;

/**
 * Mobile typography scale, semantic names. Values are CSS strings so the same
 * object can be used for inline `style={{ fontSize: text.body }}`.
 */
export const text = {
  display: "clamp(28px, 6vw, 34px)",
  title1: "clamp(22px, 5vw, 28px)",
  title2: 20,
  title3: 18,
  body: 17,
  callout: 16,
  subhead: 15,
  footnote: 13,
  caption: 12,
} as const;

export const z = {
  tabBar: 50,
  appBar: 50,
  fab: 45,
  sheet: 60,
  modal: 70,
  toast: 80,
} as const;

/**
 * Color tokens are kept as CSS-variable references on the web because the
 * `--leadac-*` system is the single re-skin knob. For native, resolve at runtime
 * using a CSS-vars→JS resolver; do NOT hardcode hex/HSL here.
 */
export const colorVar = {
  bg: "var(--leadac-bg)",
  surface: "var(--leadac-surface)",
  card: "var(--leadac-card)",
  hover: "var(--leadac-hover)",
  border: "var(--leadac-border)",
  text1: "var(--leadac-text-1)",
  text2: "var(--leadac-text-2)",
  text3: "var(--leadac-text-3)",
  muted: "var(--leadac-muted)",
  primary: "var(--leadac-500)",
  primaryHover: "var(--leadac-400)",
  success: "var(--leadac-success)",
  warning: "var(--leadac-warning)",
  error: "var(--leadac-error)",
  info: "var(--leadac-info)",
} as const;

export const breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type Breakpoint = keyof typeof breakpoints;
export type Viewport = "phone" | "tablet" | "desktop";

export const tokens = {
  space,
  radius,
  motion,
  touch,
  chrome,
  sheetSnap,
  text,
  z,
  colorVar,
  breakpoints,
} as const;

export type Tokens = typeof tokens;
