/**
 * ExplodedParts — stagger-animated "parts fly in / fly apart" choreography.
 *
 * Used for the Apple-style exploded product view where a device's screen,
 * camera module, chip, etc. scatter away from a center point and then
 * re-assemble (or vice versa). Runs in pure CSS 3D (perspective + translate3d
 * + rotate) so it composites with everything else in DOM-land. A future
 * Three.js variant lives in ProductModel.tsx.
 *
 * Phases:
 *   - t < explodeAt:                all parts at `restPosition`
 *   - explodeAt .. explodeAt+dur:   linear interp rest → exploded (per part,
 *                                   staggered via MOTION_S.stagger)
 *   - t >= explodeAt+dur:           all parts at `explodedPosition`
 *
 * To "assemble" (reverse — parts fly from exploded → rest), pass `reverse: true`.
 * Rotation is interpolated independently; pass in degrees.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE } from "../theme/easing";
import { MOTION_S, staggerStart } from "../theme/motion";
import { PARALLAX } from "../theme/tokens";

export interface ExplodedPartVec3 {
  x: number;
  y: number;
  z?: number;
}

export interface ExplodedPartRotation {
  x?: number;
  y?: number;
  z?: number;
}

export interface ExplodedPart {
  id: string;
  element: React.ReactNode;
  /** Position when assembled. CSS px from the stage center. */
  restPosition: ExplodedPartVec3;
  /** Position when exploded. CSS px from the stage center. */
  explodedPosition: ExplodedPartVec3;
  /** Optional rotation (deg) at rest. */
  restRotation?: ExplodedPartRotation;
  /** Optional rotation (deg) when exploded. */
  explodedRotation?: ExplodedPartRotation;
  /** Fine-grained extra delay (seconds) on top of the automatic stagger. */
  extraDelay?: number;
  /** Natural size of the part so we can CSS-translate from its own center. */
  width: number;
  height: number;
}

export interface ExplodedPartsProps {
  parts: ExplodedPart[];
  /** Composition frame at which the explode begins. */
  explodeAt: number;
  /** Override total explode duration in seconds. Defaults to MOTION_S.explode. */
  durationSeconds?: number;
  /** If true, parts fly from `explodedPosition` → `restPosition`. */
  reverse?: boolean;
  /** Stagger spread in seconds. Defaults to MOTION_S.stagger. */
  staggerSeconds?: number;
}

export const ExplodedParts: React.FC<ExplodedPartsProps> = ({
  parts,
  explodeAt,
  durationSeconds,
  reverse = false,
  staggerSeconds,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalPhase = durationSeconds ?? (reverse ? MOTION_S.assemble : MOTION_S.explode);
  const perPartDur = totalPhase * 0.75; // each part takes 75% of phase; rest is stagger

  return (
    <AbsoluteFill
      style={{
        perspective: PARALLAX.perspective,
        perspectiveOrigin: "50% 50%",
        pointerEvents: "none",
      }}
    >
      <AbsoluteFill
        style={{
          transformStyle: "preserve-3d",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {parts.map((part, i) => {
          const autoDelay =
            staggerSeconds !== undefined
              ? i * staggerSeconds
              : staggerStart(i, parts.length, totalPhase);
          const delaySec = autoDelay + (part.extraDelay ?? 0);
          const localStart = explodeAt + delaySec * fps;
          const localEnd = localStart + perPartDur * fps;

          const t = interpolate(frame, [localStart, localEnd], [0, 1], {
            easing: EASE.appleInOut,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const from = reverse ? part.explodedPosition : part.restPosition;
          const to = reverse ? part.restPosition : part.explodedPosition;
          const fromRot = reverse ? part.explodedRotation : part.restRotation;
          const toRot = reverse ? part.restRotation : part.explodedRotation;

          const x = from.x + ((to.x ?? from.x) - from.x) * t;
          const y = from.y + ((to.y ?? from.y) - from.y) * t;
          const z = (from.z ?? 0) + ((to.z ?? 0) - (from.z ?? 0)) * t;

          const rx =
            (fromRot?.x ?? 0) + ((toRot?.x ?? 0) - (fromRot?.x ?? 0)) * t;
          const ry =
            (fromRot?.y ?? 0) + ((toRot?.y ?? 0) - (fromRot?.y ?? 0)) * t;
          const rz =
            (fromRot?.z ?? 0) + ((toRot?.z ?? 0) - (fromRot?.z ?? 0)) * t;

          return (
            <div
              key={part.id}
              style={{
                position: "absolute",
                left: `calc(50% - ${part.width / 2}px)`,
                top: `calc(50% - ${part.height / 2}px)`,
                width: part.width,
                height: part.height,
                transformStyle: "preserve-3d",
                transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
                willChange: "transform",
              }}
            >
              {part.element}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
