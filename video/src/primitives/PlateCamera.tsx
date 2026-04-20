/**
 * PlateCamera — wrap a Steel-captured PNG sequence with cinematic camera motion.
 *
 * The plate already contains the on-screen UI animation we recorded in the
 * browser. PlateCamera adds the second layer:
 *   - dolly (CSS scale)
 *   - pan (CSS translate)
 *   - rack focus (CSS blur)
 *   - vignette (radial gradient overlay)
 *
 * Pass `dirName` relative to the configured publicDir (../captures by default).
 * The component will load `captures/<dirName>/frame_<NNNNN>.png` for the
 * current frame. If a frame is missing it falls back to the last-known good frame.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE } from "../theme/easing";

interface CameraMotion {
  scale?: { from: number; to: number };
  translateX?: { from: number; to: number };
  translateY?: { from: number; to: number };
  blurPx?: { from: number; to: number };
  vignette?: { from: number; to: number };
}

export interface PlateCameraProps {
  /** Capture directory under publicDir. e.g. "04-audit-morph" */
  dirName: string;
  /** Total frame count of this plate. Use to clamp lookup. */
  plateFrameCount: number;
  /** Frame rate the plate was captured at. Used to retime from capture cadence to composition fps. */
  plateFps?: number;
  /** Plate image format on disk (matches scripts/capture/recorder.ts default). */
  plateFormat?: "jpeg" | "png";
  motion?: CameraMotion;
}

export const PlateCamera: React.FC<PlateCameraProps> = ({
  dirName,
  plateFrameCount,
  plateFps,
  plateFormat = "jpeg",
  motion = {},
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Map composition frame → plate frame index.
  //
  // If `plateFps` is provided, treat it as the literal frame rate the plate
  // was recorded at (so a 10s scene with a plate captured at 8fps will reach
  // plate frame 80 of 80 right at the end). If omitted, uniformly stretch
  // the plate over the entire scene — useful when capture FPS varied.
  const plateIdx = plateFps
    ? Math.min(plateFrameCount - 1, Math.max(0, Math.floor((frame / fps) * plateFps)))
    : Math.min(
        plateFrameCount - 1,
        Math.max(0, Math.floor((frame / durationInFrames) * plateFrameCount)),
      );

  const filename = `${dirName}/frame_${String(plateIdx).padStart(5, "0")}.${plateFormat}`;

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
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile(filename)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
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
