/**
 * Remotion composition registry.
 *
 * Each <Composition> is a renderable target — `pnpm render:master` picks
 * MasterFilm, `pnpm render:hero` picks HeroLoop, `pnpm render:showcase`
 * picks AppleShowcase, etc.
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
    </>
  );
};

registerRoot(RemotionRoot);
