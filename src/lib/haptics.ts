/**
 * Lightweight haptic feedback wrapper.
 *
 * On the web we use the Vibration API (Android Chrome / Edge / Samsung
 * Internet honor it; iOS Safari ignores it but does NOT throw — so this is
 * always safe to call). On a future React Native build, swap the impl for
 * `expo-haptics` with the same signature.
 *
 * Do not call from server components — this file references `navigator`.
 */

export type HapticIntent =
  | "light" // tap acknowledgement, tab switch, toggle
  | "medium" // selection commit, swipe action commit
  | "heavy" // long-press activate
  | "success" // save success, action complete
  | "warning" // validation error, soft refusal
  | "error"; // destructive failure

const PATTERNS: Record<HapticIntent, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [10, 20, 10],
  warning: [12, 30, 12],
  error: [20, 40, 20, 40, 20],
};

let lastFiredAt = 0;
const COOLDOWN_MS = 30;

export function triggerHaptic(intent: HapticIntent = "light"): void {
  if (typeof window === "undefined") return;
  if (typeof navigator === "undefined") return;

  const now = performance.now();
  if (now - lastFiredAt < COOLDOWN_MS) return;
  lastFiredAt = now;

  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reduceMotion && intent !== "error" && intent !== "warning") return;

  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return;
  try {
    vibrate(PATTERNS[intent]);
  } catch {
    /* ignore; some embedded webviews throw */
  }
}

/**
 * React hook variant — safe to use during render to get a stable callback.
 * Equivalent to `useCallback(() => triggerHaptic(intent), [intent])` but you
 * pass the intent at call time.
 */
export function useHaptics() {
  return triggerHaptic;
}
