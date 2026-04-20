/**
 * AppleShowcase — 8s hero scene shot in the Apple product-reveal language.
 *
 * Choreography (at 60fps, total 480 frames):
 *
 *   0.0–2.0s  (  0–120)  Orbit-in. Proxy phone model pinned center, camera
 *                        orbits slowly while ambient gradient pulses.
 *   2.0–4.0s (120–240)   Explode. `exploded` lerps 0 → 1 while the camera
 *                        pulls back slightly for dramatic effect.
 *   4.0–5.5s (240–330)   Re-assemble + silhouette morph. `exploded` lerps
 *                        1 → 0, and a 2D PathMorph overlay crossfades the
 *                        phone silhouette into the audit card shape.
 *   5.5–8.0s (330–480)   Score counter + "Five signals. One score." title.
 *                        Camera holds center on the now-card.
 *
 * This scene is the canonical reference for every Apple-style piece in the
 * pipeline. Keep its timings in sync with `SCENE_S.appleShowcase` in
 * theme/tokens.ts.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PinnedStage } from "../primitives/PinnedStage";
import { ThreeStage } from "../primitives/ThreeStage";
import { ProductModel } from "../primitives/ProductModel";
import { PathMorph } from "../primitives/PathMorph";
import { TitleCard } from "../primitives/TitleCard";
import { MetricCounter } from "../primitives/MetricCounter";
import { COLORS, TYPE } from "../theme/tokens";
import { EASE } from "../theme/easing";

const PHONE_SILHOUETTE_PATH =
  "M 760 200 L 1160 200 Q 1220 200 1220 260 L 1220 820 Q 1220 880 1160 880 L 760 880 Q 700 880 700 820 L 700 260 Q 700 200 760 200 Z";
const AUDIT_CARD_PATH =
  "M 460 290 L 1460 290 Q 1540 290 1540 370 L 1540 710 Q 1540 790 1460 790 L 460 790 Q 380 790 380 710 L 380 370 Q 380 290 460 290 Z";

export const AppleShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const F = (s: number) => Math.round(s * fps);

  // Exploded 0..1..0 envelope.
  const exploded = interpolate(
    frame,
    [F(2.0), F(4.0), F(5.5)],
    [0, 1, 0],
    {
      easing: EASE.appleInOut,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  // Subtle continuous product rotation across the whole scene.
  const rotationY = interpolate(frame, [0, F(8)], [-0.35, 0.25], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2D silhouette morph overlay: invisible until the re-assemble phase.
  const morphOpacity = interpolate(
    frame,
    [F(4.0), F(4.3), F(5.3), F(5.7)],
    [0, 0.95, 0.95, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // The 3D canvas softly fades out while the 2D card takes over.
  const threeOpacity = interpolate(frame, [F(4.5), F(5.5)], [1, 0.35], {
    easing: EASE.appleInOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scoreStart = F(5.8);
  const scoreDur = F(0.9);
  const titleAppear = F(5.9);
  const titleHold = F(8) - titleAppear;

  // Camera path: orbit-in, then pull back during explode, then settle.
  const cameraPath = [
    { frame: 0, position: [0.6, 0.4, 5.2] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 34 },
    { frame: F(2), position: [-0.4, 0.3, 5.0] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 33 },
    { frame: F(4), position: [0.2, 0.6, 6.0] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 36 },
    { frame: F(5.5), position: [0, 0.2, 5.2] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 33 },
    { frame: F(8), position: [0, 0.2, 5.2] as [number, number, number], lookAt: [0, 0, 0] as [number, number, number], fov: 33 },
  ];

  return (
    <PinnedStage
      background_color={COLORS.bg}
      motion={{
        dolly: { from: 1.0, to: 1.03 },
        vignette: { from: 0.15, to: 0.35 },
        ambient: { from: 0.25, to: 0.55 },
      }}
      subject={
        <AbsoluteFill style={{ opacity: threeOpacity }}>
          <ThreeStage cameraPath={cameraPath} environment="studio">
            <ProductModel exploded={exploded} rotationY={rotationY} scale={1} />
          </ThreeStage>
        </AbsoluteFill>
      }
      overlay={
        <>
          {/* Phone silhouette → audit card shape morph (faded overlay). */}
          <AbsoluteFill style={{ opacity: morphOpacity, color: "rgba(28,28,30,0.92)" }}>
            <PathMorph
              fromPath={PHONE_SILHOUETTE_PATH}
              toPath={AUDIT_CARD_PATH}
              startFrame={F(4.3)}
              durationFrames={F(1.0)}
              viewBox="0 0 1920 1080"
              fill="rgba(28,28,30,0.92)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={1}
            />
          </AbsoluteFill>

          {/* Score badge on the audit card at the end. */}
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 40,
              opacity: interpolate(frame, [F(5.6), F(5.9)], [0, 1], {
                easing: EASE.appleOut,
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <MetricCounter
                from={0}
                to={87}
                startFrame={scoreStart}
                durationFrames={scoreDur}
                size={220}
                accent={COLORS.accent}
              />
              <div
                style={{
                  fontFamily: TYPE.family,
                  fontSize: TYPE.size.eyebrow,
                  letterSpacing: TYPE.tracking.eyebrow,
                  textTransform: "uppercase",
                  color: COLORS.textMuted,
                  fontWeight: TYPE.weight.semibold,
                }}
              >
                opportunity score
              </div>
            </div>
          </AbsoluteFill>

          <TitleCard
            text="Five signals. One score."
            appearAtFrame={titleAppear}
            durationFrames={titleHold}
            position="bottom"
            size="subhead"
          />
        </>
      }
    />
  );
};
