/**
 * LaunchFilm — the feature-complete launch cut (~105s).
 *
 * Weaves the existing plate-backed narrative scenes with the eight new
 * pure-Remotion feature scenes so every product surface appears on screen
 * at least once:
 *
 *   01 Cold open  (problem)
 *   02 Promise    (discovery input)
 *   03 Discovery  (discovery output · plate)
 *   09 Dashboard  (KPIs + sparkline + NBA)
 *   04 Audit      (audit + score · plate)
 *   10 Review intel (sentiment + lead score)
 *   05 Mockup     (variant carousel · plate)
 *   11 Website plan (markdown doc)
 *   06 Opener     (plate)
 *   12 Copilot    (AI drawer)
 *   07 Pipeline   (kanban · plate)
 *   13 Campaigns  (auto-segments)
 *   14 Team todos (board)
 *   15 Settings   (offer / branding / email / billing sweep)
 *   16 Pricing    (4 tiers)
 *   08 CTA
 *
 * MasterFilm stays unchanged as the 60s short-form cut.
 */
import React from "react";
import { AbsoluteFill, Series } from "remotion";
import { COLORS, FPS, SCENE_S } from "../theme/tokens";
import { ColdOpen } from "../scenes/01-cold-open";
import { Promise as PromiseScene } from "../scenes/02-promise";
import { Discovery } from "../scenes/03-discovery";
import { Dashboard } from "../scenes/09-dashboard";
import { AuditMorph } from "../scenes/04-audit-morph";
import { ReviewIntelligence } from "../scenes/10-review-intelligence";
import { MockupFlip } from "../scenes/05-mockup-flip";
import { WebsitePlan } from "../scenes/11-website-plan";
import { Opener } from "../scenes/06-opener";
import { Copilot } from "../scenes/12-copilot";
import { Pipeline } from "../scenes/07-pipeline";
import { Campaigns } from "../scenes/13-campaigns";
import { TeamTodos } from "../scenes/14-team-todos";
import { SettingsSweep } from "../scenes/15-settings-sweep";
import { Pricing } from "../scenes/16-pricing";
import { Cta } from "../scenes/08-cta";

const sec = (s: number) => Math.round(s * FPS);

export const LaunchFilm: React.FC = () => {
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
        <Series.Sequence durationInFrames={sec(SCENE_S.dashboard)} name="09 Dashboard">
          <Dashboard />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.auditMorph)} name="04 Audit">
          <AuditMorph />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.reviewIntel)} name="10 Review Intel">
          <ReviewIntelligence />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.mockupFlip)} name="05 Mockup">
          <MockupFlip />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.websitePlan)} name="11 Website Plan">
          <WebsitePlan />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.opener)} name="06 Opener">
          <Opener />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.copilot)} name="12 Copilot">
          <Copilot />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.pipeline)} name="07 Pipeline">
          <Pipeline />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.campaigns)} name="13 Campaigns">
          <Campaigns />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.teamTodos)} name="14 Team Todos">
          <TeamTodos />
        </Series.Sequence>
        <Series.Sequence
          durationInFrames={sec(SCENE_S.settingsSweep)}
          name="15 Settings"
        >
          <SettingsSweep />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.pricing)} name="16 Pricing">
          <Pricing />
        </Series.Sequence>
        <Series.Sequence durationInFrames={sec(SCENE_S.cta)} name="08 CTA">
          <Cta />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
