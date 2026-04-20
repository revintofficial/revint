/**
 * Timing constants shared between Steel scenarios and Remotion compositions.
 *
 * Editing here will resync the whole video — but the master film duration
 * and per-scene budgets must always match what `MasterFilm.tsx` uses.
 */

export const FPS = 60 as const;

export const SCENE_DURATIONS_MS = {
  coldOpen: 3000,
  promise: 5000,
  discovery: 10000,
  auditMorph: 12000,
  mockupFlip: 12000,
  opener: 10000,
  pipeline: 8000,
  cta: 3000,
} as const;

export const TOTAL_MS =
  SCENE_DURATIONS_MS.coldOpen +
  SCENE_DURATIONS_MS.promise +
  SCENE_DURATIONS_MS.discovery +
  SCENE_DURATIONS_MS.auditMorph +
  SCENE_DURATIONS_MS.mockupFlip +
  SCENE_DURATIONS_MS.opener +
  SCENE_DURATIONS_MS.pipeline +
  SCENE_DURATIONS_MS.cta;

export const HERO_LEAD_ID = "vid_lead_01_bellavita";
export const HERO_PLACE_ID = "vid_pl_001_bellavita";
export const HERO_BUSINESS_NAME = "Bella Vita Trattoria";

export const HERO_MOCKUP_SLUGS = ["vid-bv-indigo", "vid-bv-emerald", "vid-bv-warm"] as const;

export const CAPTURE_BASE_DIR = "captures";
