/**
 * CameraBreath — subtle always-on camera motion wrapper.
 *
 * Two overlapping sinusoids (scale + x-drift) keep every frame minutely
 * different so no scene ever reads as a static photograph. The amplitudes
 * are below the threshold of conscious attention (±0.6% scale, ±4px drift)
 * which is exactly the range Apple uses for product-page hero holds.
 *
 * Wrap composition-level children so the entire film breathes uniformly
 * and scene-level animations still stack correctly on top.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export interface CameraBreathProps {
  /** Max scale deviation. Default 0.006 (±0.6%). */
  scaleAmp?: number;
  /** Max horizontal drift in px. Default 4. */
  driftAmp?: number;
  /** Scale sinusoid period in seconds. Default 8s (very slow). */
  scalePeriod?: number;
  /** Drift sinusoid period in seconds. Default 13s (even slower, asymmetric). */
  driftPeriod?: number;
  children: React.ReactNode;
}

export const CameraBreath: React.FC<CameraBreathProps> = ({
  scaleAmp = 0.006,
  driftAmp = 4,
  scalePeriod = 8,
  driftPeriod = 13,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps;
  const breath = Math.sin((t / scalePeriod) * Math.PI * 2) * scaleAmp;
  const drift = Math.sin((t / driftPeriod) * Math.PI * 2) * driftAmp;
  const driftY = Math.cos((t / (driftPeriod * 1.7)) * Math.PI * 2) * (driftAmp * 0.4);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${1 + breath}) translate(${drift}px, ${driftY}px) translateZ(0)`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
