/**
 * Apple-style motion timings.
 *
 * Everywhere the video uses a "parts fly in", "exploded view", "things
 * settle into place" motion, it should pull timings from here — no magic
 * number frame counts inside scene files.
 *
 * All values are in seconds at composition level; multiply by FPS to get
 * frame counts. EASE curves live next to these in easing.ts.
 */

export const MOTION_S = {
  // How long a single part takes to travel from explode → rest (or vice versa).
  // Apple's Vision Pro / iPhone part-break pages sit around 1.0–1.3s per part.
  explode: 1.2,
  assemble: 1.0,

  // How long a UI element "settles" after arriving — the subtle overshoot
  // + damped return that Apple uses to signal "this is the final position".
  settle: 0.6,

  // Stagger between consecutive parts. 0.08s matches the default iOS spring
  // cascade used in Control Center and the App Library open animations.
  stagger: 0.08,

  // How long a rack-focus (background blur) transition takes.
  rackFocus: 0.8,

  // Camera moves (dolly, orbit, pan) — slower than part motion for gravitas.
  cameraMove: 2.4,

  // Crossfade between two states, e.g. before/after in a MorphBox.
  crossfade: 0.5,
} as const;

/**
 * Helper for building exploded/assemble stagger windows. Returns the local
 * time (in seconds) at which part `i` should start moving, given `count`
 * total parts and an overall phase duration. Keeps every part completing
 * before the phase ends.
 */
export function staggerStart(i: number, count: number, phase: number): number {
  if (count <= 1) return 0;
  const totalStagger = Math.min(MOTION_S.stagger * (count - 1), phase * 0.5);
  const perStep = totalStagger / (count - 1);
  return i * perStep;
}

/**
 * Convert MOTION_S values to frame counts. Pass the composition FPS.
 */
export const toFrames = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);
