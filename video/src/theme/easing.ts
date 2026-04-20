/**
 * Apple-flavoured easing curves.
 *
 * Use these everywhere instead of Remotion's defaults. Linear and bounce
 * read as "amateur"; the appleOut curve is the closest single bezier to the
 * iOS / iPadOS material motion library.
 *
 * Usage:
 *   const v = interpolate(frame, [0, 30], [0, 1], { easing: EASE.appleOut });
 */
import { Easing } from "remotion";

export const EASE = {
  // Smooth in & out, default for most UI motion.
  appleInOut: Easing.bezier(0.65, 0, 0.35, 1),
  // Decel — best for "thing arrives and settles".
  appleOut: Easing.bezier(0.22, 1, 0.36, 1),
  // Accel — best for "thing leaves the frame".
  appleIn: Easing.bezier(0.64, 0, 0.78, 0),
  // Bouncy but tasteful (no overshoot > 1.05). Use sparingly on call-to-action moments.
  appleSpring: Easing.bezier(0.34, 1.16, 0.64, 1),
} as const;
