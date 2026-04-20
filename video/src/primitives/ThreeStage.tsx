/**
 * ThreeStage — Remotion-safe React Three Fiber canvas with Apple-style
 * cinematography defaults (camera path interpolation, studio lighting,
 * neutral environment).
 *
 * IMPORTANT — frame-based vs time-based animation:
 *   Remotion renders deterministically off a frame counter. Any motion
 *   inside the ThreeStage children MUST be driven from `useCurrentFrame()`
 *   (imported from "remotion"), NOT R3F's `useFrame` / clock / delta. The
 *   `useFrameDrivenCamera` hook below and `CameraRig` component already
 *   follow this rule.
 *
 * Usage:
 *   <ThreeStage
 *     cameraPath={[
 *       { frame: 0,   position: [0, 0, 5], lookAt: [0, 0, 0] },
 *       { frame: 120, position: [2, 1, 4], lookAt: [0, 0, 0] },
 *     ]}
 *   >
 *     <ProductModel exploded={...} />
 *   </ThreeStage>
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export interface CameraKeyframe {
  frame: number;
  position: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
}

export interface ThreeStageProps {
  children?: React.ReactNode;
  cameraPath?: CameraKeyframe[];
  /** Default camera position if cameraPath is not provided. */
  initialPosition?: [number, number, number];
  initialFov?: number;
  /** Canvas dimensions. Default: composition resolution. */
  width?: number;
  height?: number;
  /** If true, adds an HDRI-ish environment for reflective materials. */
  environment?: "studio" | "city" | "warehouse" | "sunset" | "dawn" | "night" | "none";
  /** Background clear color. Default transparent so PinnedStage shines through. */
  clearColor?: string | null;
  style?: React.CSSProperties;
}

/**
 * Linear interp between camera keyframes based on composition frame.
 * Kept inline so components don't need to import it separately.
 */
function sampleCameraPath(
  path: CameraKeyframe[],
  frame: number,
): { position: THREE.Vector3; lookAt: THREE.Vector3; fov?: number } {
  if (path.length === 0) {
    return { position: new THREE.Vector3(0, 0, 5), lookAt: new THREE.Vector3(0, 0, 0) };
  }
  if (path.length === 1 || frame <= path[0].frame) {
    const k = path[0];
    return {
      position: new THREE.Vector3(...k.position),
      lookAt: new THREE.Vector3(...(k.lookAt ?? [0, 0, 0])),
      fov: k.fov,
    };
  }
  const last = path[path.length - 1];
  if (frame >= last.frame) {
    return {
      position: new THREE.Vector3(...last.position),
      lookAt: new THREE.Vector3(...(last.lookAt ?? [0, 0, 0])),
      fov: last.fov,
    };
  }
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / Math.max(1, b.frame - a.frame);
      // Smoothstep for buttery Apple-style transitions between keys.
      const s = t * t * (3 - 2 * t);
      const pos = new THREE.Vector3(...a.position).lerp(new THREE.Vector3(...b.position), s);
      const look = new THREE.Vector3(...(a.lookAt ?? [0, 0, 0])).lerp(
        new THREE.Vector3(...(b.lookAt ?? [0, 0, 0])),
        s,
      );
      const fov =
        a.fov !== undefined && b.fov !== undefined
          ? a.fov + (b.fov - a.fov) * s
          : (a.fov ?? b.fov);
      return { position: pos, lookAt: look, fov };
    }
  }
  const k = path[0];
  return {
    position: new THREE.Vector3(...k.position),
    lookAt: new THREE.Vector3(...(k.lookAt ?? [0, 0, 0])),
    fov: k.fov,
  };
}

/**
 * Rig that updates the default camera every frame. Lives INSIDE the
 * ThreeCanvas so it has access to useThree(). Reads `frame` from Remotion
 * via the parent; avoids R3F's useFrame on purpose.
 */
const CameraRig: React.FC<{ path?: CameraKeyframe[]; frame: number }> = ({ path, frame }) => {
  const { camera } = useThree();
  if (path && path.length > 0) {
    const { position, lookAt, fov } = sampleCameraPath(path, frame);
    camera.position.copy(position);
    camera.lookAt(lookAt);
    if (fov !== undefined && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspCam = camera as THREE.PerspectiveCamera;
      perspCam.fov = fov;
      perspCam.updateProjectionMatrix();
    }
  }
  return null;
};

export const ThreeStage: React.FC<ThreeStageProps> = ({
  children,
  cameraPath,
  initialPosition = [0, 0, 5],
  initialFov = 35,
  width,
  height,
  environment = "studio",
  clearColor = null,
  style,
}) => {
  const frame = useCurrentFrame();
  const { width: compWidth, height: compHeight } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width ?? compWidth}
      height={height ?? compHeight}
      style={{
        position: "absolute",
        inset: 0,
        background: "transparent",
        ...style,
      }}
      camera={{ position: initialPosition, fov: initialFov }}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        if (clearColor) {
          gl.setClearColor(new THREE.Color(clearColor), 1);
        } else {
          gl.setClearAlpha(0);
        }
      }}
    >
      <CameraRig path={cameraPath} frame={frame} />

      {/* Apple-style three-point studio lighting. */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 8, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 3, -4]} intensity={0.6} color="#a5b4fc" />
      <pointLight position={[0, -4, 4]} intensity={0.4} color="#ffffff" />

      {environment !== "none" && <Environment preset={environment} />}

      {children}
    </ThreeCanvas>
  );
};
