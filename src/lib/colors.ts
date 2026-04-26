/**
 * Leadac theme — single source of truth for JS consumers.
 *
 * The CSS layer in [src/app/globals.css](src/app/globals.css) holds the
 * canonical token scale (--leadac-100 … --leadac-900, neutrals, semantics,
 * glow). This module mirrors the same scale as JavaScript constants for
 * consumers that cannot read CSS custom properties at runtime, primarily:
 *
 *   - Recharts (Bar/Line `fill` / `stroke` props don't reliably parse var())
 *   - Inline gradient strings or canvas drawing
 *   - Funnel mono-palette generation across N steps
 *
 * To re-skin the application, change ONLY these three knobs (and keep
 * them in sync with the matching --leadac-h / --leadac-s / --leadac-ns
 * declarations in `globals.css`).
 *
 *   LEADAC_HUE         → primary hue   (0-360, default 248 = indigo)
 *   LEADAC_SATURATION  → primary sat   (0-100, default 62)
 *   LEADAC_NEUTRAL_SAT → neutral sat   (0-100, default 7 for surfaces)
 *
 * Everything else derives from those three numbers.
 */

export const LEADAC_HUE = 38;
export const LEADAC_SATURATION = 78;
export const LEADAC_NEUTRAL_SAT = 7;
export const LEADAC_TEXT_SAT = 10;

const H = LEADAC_HUE;
const S = LEADAC_SATURATION;
const NS = LEADAC_NEUTRAL_SAT;
const TS = LEADAC_TEXT_SAT;

const primary = (l: number) => `hsl(${H} ${S}% ${l}%)`;
const surface = (l: number) => `hsl(${H} ${NS}% ${l}%)`;
const text = (l: number) => `hsl(${H} ${TS}% ${l}%)`;

export const LEADAC = {
  primary100: primary(88),
  primary200: primary(78),
  primary300: primary(68),
  primary400: primary(58),
  primary500: primary(50),
  primary600: primary(42),
  primary700: primary(34),
  primary800: primary(26),
  primary900: primary(18),
  bg: surface(5),
  surface: surface(8),
  card: surface(11),
  hover: surface(14),
  border: surface(18),
  text1: text(92),
  text2: text(70),
  text3: text(50),
  muted: text(38),
  success: "hsl(152 48% 50%)",
  successSoft: "hsl(152 28% 70%)",
  warning: "hsl(38 70% 52%)",
  warningSoft: "hsl(38 50% 70%)",
  error: "hsl(4 62% 54%)",
  errorSoft: "hsl(4 42% 72%)",
} as const;

/**
 * Mono funnel palette: same hue/saturation, lightness ramps from 42% (early
 * stage) to 66% (late stage). Produces a visually-ordered scale where the
 * eye reads progress without competing colors.
 */
export function getFunnelStepColor(stepIndex: number, totalSteps: number): string {
  const safe = Math.max(totalSteps - 1, 1);
  const lightness = 42 + (stepIndex / safe) * 24;
  return `hsl(${H} ${S}% ${Math.round(lightness)}%)`;
}

/**
 * Derive a translucent indigo at a given lightness. Useful for halos,
 * focus rings, and category background tints (e.g., status badges).
 */
export function leadacAlpha(lightness: number, alpha: number): string {
  return `hsl(${H} ${S}% ${lightness}% / ${alpha})`;
}

/**
 * Derive a translucent neutral surface at a given lightness. Useful for
 * panel overlays, glass surfaces, hover states.
 */
export function leadacNeutralAlpha(lightness: number, alpha: number): string {
  return `hsl(${H} ${NS}% ${lightness}% / ${alpha})`;
}
