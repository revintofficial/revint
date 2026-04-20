/**
 * MasterFilm — the canonical 60s 1920x1080 launch film at 60fps.
 *
 * Every other delivery (hero loop, vertical, square) is a re-cut/reframe of
 * this composition. Treat MasterFilm as the source of truth: changes to
 * scene durations should land here, then propagate to scripts/capture/timing.ts.
 */
import React from "react";
import { Series, AbsoluteFill } from "remotion";
import { COLORS, FPS, SCENE_S } from "../theme/tokens";
import { ColdOpen } from "../scenes/01-cold-open";
import { Promise as PromiseScene } from "../scenes/02-promise";
import { Discovery } from "../scenes/03-discovery";
import { AuditMorph } from "../scenes/04-audit-morph";
import { MockupFlip } from "../scenes/05-mockup-flip";
import { Opener } from "../scenes/06-opener";
import { Pipeline } from "../scenes/07-pipeline";
import { Cta } from "../scenes/08-cta";

const sec = (s: number) => s * FPS;

export const MasterFilm: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Series>
        <Series.Sequence durationInFrames={sec(SCENE_S.coldOpen)} name="01 Cold Open">
          <ColdOpen />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.promise)} name="02 Promise">
          <PromiseScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.discovery)} name="03 Discovery">
          <Discovery />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.auditMorph)} name="04 Audit">
          <AuditMorph />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.mockupFlip)} name="05 Mockup">
          <MockupFlip />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.opener)} name="06 Opener">
          <Opener />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.pipeline)} name="07 Pipeline">
          <Pipeline />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.cta)} name="08 CTA">
          <Cta />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
