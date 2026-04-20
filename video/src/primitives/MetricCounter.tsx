/**
 * MetricCounter — animated number that counts from `from` to `to` over `durationFrames`.
 *
 * Used for "47 leads", "5 signals scored", and the "1.8s drafted" badges.
 * Apple-out easing so the count decelerates into its final value rather
 * than slamming into it.
 */
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

export interface MetricCounterProps {
  from: number;
  to: number;
  startFrame?: number;
  durationFrames?: number;
  prefix?: string;
  suffix?: string;
  label?: string;
  size?: number;
  accent?: string;
}

export const MetricCounter: React.FC<MetricCounterProps> = ({
  from,
  to,
  startFrame = 0,
  durationFrames = 60,
  prefix = "",
  suffix = "",
  label,
  size = TYPE.size.display,
  accent = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - startFrame);

  const value = interpolate(local, [0, durationFrames], [from, to], {
    easing: EASE.appleOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const display = Number.isInteger(to)
    ? Math.round(value).toString()
    : value.toFixed(1);

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div
        style={{
          fontFamily: TYPE.family,
          fontSize: size,
          fontWeight: TYPE.weight.semibold,
          letterSpacing: TYPE.tracking.display,
          color: accent,
          lineHeight: 1,
        }}
      >
        {prefix}
        {display}
        {suffix}
      </div>
      {label && (
        <div
          style={{
            marginTop: 12,
            fontFamily: TYPE.family,
            fontSize: TYPE.size.body,
            color: COLORS.textMuted,
            letterSpacing: TYPE.tracking.body,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
