/**
 * HeroLoop — site-hero loop, now rebuilt on top of AppleShowcase.
 *
 * AppleShowcase is the canonical Apple-aesthetic hero reel (orbit → explode
 * → morph → score), 8s at 60fps. This composition just frames it so the
 * marketing site can drop in `public/hero-loop.mp4` and autoplay-loop.
 *
 * If you want the previous audit-morph variant as the hero, swap the
 * AppleShowcase import for AuditMorph below — everything else stays.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme/tokens";
import { AppleShowcase } from "../scenes/AppleShowcase";

export const HeroLoop: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AppleShowcase />
    </AbsoluteFill>
  );
};
