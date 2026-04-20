/**
 * SmoothPlate — drop-in replacement for PlateCamera that cross-blends adjacent
 * plate frames so low-cadence captures (28-90 frames over 10s) don't step at
 * 60fps.
 *
 * Given `plateFps` (or a uniform stretch when not provided) we compute a
 * fractional plate index, load frame `i0` and `i1`, and stack them with the
 * top layer's opacity = fractional remainder. The result reads as synthetic
 * 60fps without optical flow.
 *
 * All camera motion (dolly, pan, rack focus, vignette) is kept identical to
 * PlateCamera so scenes can swap this in without any other changes.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { EASE } from "../theme/easing";

interface CameraMotion {
  scale?: { from: number; to: number };
  translateX?: { from: number; to: number };
  translateY?: { from: number; to: number };
  blurPx?: { from: number; to: number };
  vignette?: { from: number; to: number };
}

export interface SmoothPlateProps {
  /** Capture directory under publicDir. e.g. "04-audit-morph" */
  dirName: string;
  /** Total frame count of this plate. Use to clamp lookup. */
  plateFrameCount: number;
  /** Frame rate the plate was captured at. Used to retime to composition fps. */
  plateFps?: number;
  /** Plate image format on disk (matches scripts/capture/recorder.ts default). */
  plateFormat?: "jpeg" | "png";
  motion?: CameraMotion;
  /** Disable inter-frame blending (for debugging step cadence). */
  disableBlend?: boolean;
}

export const SmoothPlate: React.FC<SmoothPlateProps> = ({
  dirName,
  plateFrameCount,
  plateFps,
  plateFormat = "jpeg",
  motion = {},
  disableBlend = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fracIdx = plateFps
    ? (frame / fps) * plateFps
    : (frame / durationInFrames) * plateFrameCount;

  const maxIdx = plateFrameCount - 1;
  const i0 = Math.max(0, Math.min(maxIdx, Math.floor(fracIdx)));
  const i1 = Math.max(0, Math.min(maxIdx, i0 + 1));
  const mix = disableBlend || i0 === i1 ? 0 : fracIdx - Math.floor(fracIdx);

  const fileOf = (idx: number) =>
    `${dirName}/frame_${String(idx).padStart(5, "0")}.${plateFormat}`;

  const interp = (cfg: { from: number; to: number } | undefined, fallback: number) =>
    cfg
      ? interpolate(frame, [0, durationInFrames], [cfg.from, cfg.to], {
          easing: EASE.appleOut,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : fallback;

  const scale = interp(motion.scale, 1);
  const translateX = interp(motion.translateX, 0);
  const translateY = interp(motion.translateY, 0);
  const blur = interp(motion.blurPx, 0);
  const vignetteAlpha = interp(motion.vignette, 0);

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px) translateZ(0)`,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <Img
          src={staticFile(fileOf(i0))}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
          }}
        />
        {mix > 0 && (
          <Img
            src={staticFile(fileOf(i1))}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
              opacity: mix,
            }}
          />
        )}
      </AbsoluteFill>

      {vignetteAlpha > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${vignetteAlpha}) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
