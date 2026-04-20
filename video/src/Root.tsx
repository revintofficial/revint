/**
 * Remotion composition registry.
 *
 * Each <Composition> is a renderable target — `pnpm render:master` picks
 * MasterFilm, `pnpm render:hero` picks HeroLoop, `pnpm render:showcase`
 * picks AppleShowcase, `pnpm render:ad` picks AdCut, etc.
 */
import React from "react";
import { Composition, registerRoot } from "remotion";
import { FPS, TOTAL_S, LAUNCH_TOTAL_S, SCENE_S } from "./theme/tokens";
import { MasterFilm } from "./compositions/MasterFilm";
import { LaunchFilm } from "./compositions/LaunchFilm";
import { HeroLoop } from "./compositions/HeroLoop";
import { VerticalCut } from "./compositions/VerticalCut";
import { SquareCut } from "./compositions/SquareCut";
import { AppleShowcase } from "./scenes/AppleShowcase";
import { AdCut, AD_CUT_DURATION_FRAMES } from "./compositions/AdCut";
import { AdCutVertical } from "./compositions/AdCutVertical";
import { AdTeaser15, AD_TEASER_DURATION_FRAMES } from "./compositions/AdTeaser15";

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MasterFilm"
        component={MasterFilm}
        durationInFrames={Math.round(TOTAL_S * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LaunchFilm"
        component={LaunchFilm}
        durationInFrames={Math.round(LAUNCH_TOTAL_S * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="HeroLoop"
        component={HeroLoop}
        durationInFrames={Math.round(SCENE_S.appleShowcase * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="AppleShowcase"
        component={AppleShowcase}
        durationInFrames={Math.round(SCENE_S.appleShowcase * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="VerticalCut"
        component={VerticalCut}
        durationInFrames={Math.round(45 * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="SquareCut"
        component={SquareCut}
        durationInFrames={Math.round(45 * FPS)}
        fps={FPS}
        width={1080}
        height={1080}
      />

      {/*
        Ad cut family — paid-media masters.
        AdCut: 1920x1080 master (X, LinkedIn, YouTube in-stream, landing hero).
        AdCutVertical: 1080x1920 reframe (TikTok, Shorts, Reels).
        AdTeaser15: 15s hard-cut teaser (pre-roll, retargeting).

        defaultProps.audioBed/audioVo stay false until the real audio files
        land under captures/audio/. See video/AD-SCRIPT.md.
      */}
      <Composition
        id="AdCut"
        component={AdCut}
        durationInFrames={AD_CUT_DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ audioBed: false, audioVo: false, hideCaptions: false }}
      />
      <Composition
        id="AdCutVertical"
        component={AdCutVertical}
        durationInFrames={AD_CUT_DURATION_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="AdTeaser15"
        component={AdTeaser15}
        durationInFrames={AD_TEASER_DURATION_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ audioBed: false }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
