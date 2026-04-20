import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "./Caption";
import { CursorOverlay } from "./CursorOverlay";

type ZoomConfig = {
  from?: number;
  to?: number;
  originX?: number;
  originY?: number;
};

type CursorConfig = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  clickAt?: number;
};

export const DemoScene: React.FC<{
  screenshot: string;
  caption: string;
  subCaption?: string;
  zoom?: ZoomConfig;
  cursor?: CursorConfig;
  durationInFrames: number;
}> = ({ screenshot, caption, subCaption, zoom, cursor }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const zFrom = zoom?.from ?? 1;
  const zTo = zoom?.to ?? 1.06;
  const originX = (zoom?.originX ?? 0.5) * 100;
  const originY = (zoom?.originY ?? 0.5) * 100;
  const scale = interpolate(frame, [0, durationInFrames], [zFrom, zTo]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0B", opacity }}>
      <AbsoluteFill
        style={{
          transformOrigin: `${originX}% ${originY}%`,
          transform: `scale(${scale})`,
        }}
      >
        <Img
          src={screenshot}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </AbsoluteFill>

      {cursor ? (
        <CursorOverlay
          fromX={cursor.fromX}
          fromY={cursor.fromY}
          toX={cursor.toX}
          toY={cursor.toY}
          clickAt={cursor.clickAt}
          width={width}
          height={height}
        />
      ) : null}

      <Caption text={caption} subText={subCaption} />
    </AbsoluteFill>
  );
};
