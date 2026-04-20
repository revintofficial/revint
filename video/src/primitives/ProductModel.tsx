/**
 * ProductModel — Apple-style exploded phone + audit-card 3D model.
 *
 * Default implementation is a proxy built from R3F primitives (rounded boxes,
 * cylinders, planes) so the scene works out-of-the-box with no GLB assets.
 * When real GLBs land in `video/assets/models/`, swap the <Proxy*> parts for
 * a `useGLTF('/models/phone.glb')` call — the `exploded` API stays identical.
 *
 * Must live inside <ThreeStage>. Reads `frame` from Remotion via context
 * (the parent ThreeStage's CameraRig shows the pattern), but since this
 * component is purely driven by the `exploded` prop (0..1), the parent
 * scene is responsible for computing that from `useCurrentFrame()`.
 *
 *   exploded = 0  → fully assembled, looks like a phone with an audit card
 *                   stacked on top.
 *   exploded = 1  → parts scattered along apple's canonical axes:
 *                     - screen floats forward (z+)
 *                     - camera module drifts back (z-)
 *                     - chip pops down (y-)
 *                     - audit card slides right (x+) and up (y+)
 */
import React from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

export interface ProductModelProps {
  /** 0 = assembled, 1 = fully exploded. */
  exploded: number;
  /** Optional extra rotation for the entire group (radians). */
  rotationY?: number;
  /** Shrink/grow the whole assembly uniformly. */
  scale?: number;
}

type Vec3 = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

// Rest / exploded anchors for each part, in scene units (roughly CSS px / 100).
const PHONE_BODY = { rest: [0, 0, 0] as Vec3, exploded: [0, 0, -0.4] as Vec3 };
const SCREEN = { rest: [0, 0, 0.06] as Vec3, exploded: [0, 0.05, 0.9] as Vec3 };
const CAMERA_MODULE = {
  rest: [-0.38, 0.72, -0.05] as Vec3,
  exploded: [-0.9, 1.2, -0.7] as Vec3,
};
const CHIP = { rest: [0, -0.15, -0.04] as Vec3, exploded: [0.15, -1.0, -0.3] as Vec3 };
const AUDIT_CARD = {
  rest: [0, 0, 0.12] as Vec3,
  exploded: [1.3, 0.6, 0.5] as Vec3,
};

const PART_ROTATION_REST: Vec3 = [0, 0, 0];
const AUDIT_CARD_ROT_EXPLODED: Vec3 = [0, -0.25, 0.08];
const CAMERA_MODULE_ROT_EXPLODED: Vec3 = [0.2, 0.3, 0];

export const ProductModel: React.FC<ProductModelProps> = ({
  exploded,
  rotationY = 0,
  scale = 1,
}) => {
  const t = Math.max(0, Math.min(1, exploded));

  const bodyPos = lerpVec3(PHONE_BODY.rest, PHONE_BODY.exploded, t);
  const screenPos = lerpVec3(SCREEN.rest, SCREEN.exploded, t);
  const camPos = lerpVec3(CAMERA_MODULE.rest, CAMERA_MODULE.exploded, t);
  const chipPos = lerpVec3(CHIP.rest, CHIP.exploded, t);
  const cardPos = lerpVec3(AUDIT_CARD.rest, AUDIT_CARD.exploded, t);

  const camRot = lerpVec3(PART_ROTATION_REST, CAMERA_MODULE_ROT_EXPLODED, t);
  const cardRot = lerpVec3(PART_ROTATION_REST, AUDIT_CARD_ROT_EXPLODED, t);

  return (
    <group rotation-y={rotationY} scale={scale}>
      {/* Phone body — rounded rectangular slab. */}
      <RoundedBox
        args={[1.5, 3.0, 0.2]}
        radius={0.18}
        smoothness={4}
        position={bodyPos}
      >
        <meshStandardMaterial
          color="#1C1C1E"
          metalness={0.7}
          roughness={0.25}
        />
      </RoundedBox>

      {/* Screen — slightly smaller plane on the front face. */}
      <mesh position={screenPos}>
        <planeGeometry args={[1.36, 2.86]} />
        <meshStandardMaterial
          color="#0A0A0F"
          emissive="#5E6AD2"
          emissiveIntensity={0.12}
          metalness={0.1}
          roughness={0.08}
        />
      </mesh>

      {/* Camera module — chunky rounded square on the back-top-left. */}
      <group position={camPos} rotation={new THREE.Euler(...camRot)}>
        <RoundedBox args={[0.55, 0.55, 0.12]} radius={0.1} smoothness={3}>
          <meshStandardMaterial color="#0A0A0F" metalness={0.6} roughness={0.3} />
        </RoundedBox>
        {/* Two lens rings. */}
        <mesh position={[-0.11, 0.11, 0.07]}>
          <cylinderGeometry args={[0.11, 0.11, 0.04, 24]} />
          <meshStandardMaterial color="#2a2a2e" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.11, -0.11, 0.07]}>
          <cylinderGeometry args={[0.11, 0.11, 0.04, 24]} />
          <meshStandardMaterial color="#2a2a2e" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Chip — thin square plate behind the body. */}
      <mesh position={chipPos}>
        <boxGeometry args={[0.5, 0.5, 0.04]} />
        <meshStandardMaterial
          color="#5E6AD2"
          metalness={0.4}
          roughness={0.35}
          emissive="#5E6AD2"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Audit card overlay — glassy plane with subtle border glow. */}
      <group position={cardPos} rotation={new THREE.Euler(...cardRot)}>
        <RoundedBox args={[1.3, 0.8, 0.04]} radius={0.08} smoothness={3}>
          <meshPhysicalMaterial
            color="#14141a"
            metalness={0.2}
            roughness={0.15}
            transmission={0.3}
            thickness={0.2}
            clearcoat={0.8}
            clearcoatRoughness={0.1}
          />
        </RoundedBox>
        {/* Score dot — tiny emissive sphere to suggest the "87" badge. */}
        <mesh position={[0.48, 0.22, 0.03]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color="#A5B4FC"
            emissive="#A5B4FC"
            emissiveIntensity={1.4}
          />
        </mesh>
      </group>
    </group>
  );
};
