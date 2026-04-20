/**
 * AdCut — 40s paid-media master cut.
 *
 * Target: Josh (cold-email agency owner), X / LinkedIn / YouTube feed.
 * Structure: pain → promise → discovery → audit → wedge → opener → proof → cta.
 *
 * The scene order mirrors the buyer's decision ladder from BUYER-PERSONA.md
 * ("ekstra reply → stack entegre → trial → proof → CTA"). Each beat is
 * frame-synced to the AD_BEATS constants in `theme/tokens.ts`; kinetic
 * captions live at this composition level (not inside scenes) so music
 * re-scoring never requires per-scene edits.
 *
 * All existing product scenes (Promise, Discovery, AuditMorph, Copilot)
 * are reused via their native durations but entered mid-animation where
 * needed via `<Sequence from={-N}>` to skip pre-roll breath.
 *
 * Audio: `inputProps.audioBed` toggles the music bed (see
 * `captures/audio/README.md` for drop-in instructions).
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { COLORS, FPS, AD_S } from "../theme/tokens";
import { CameraBreath } from "../primitives/CameraBreath";
import { KineticCaption } from "../primitives/KineticCaption";

// Existing product scenes (reused without modification)
import { Promise as PromiseScene } from "../scenes/02-promise";
import { Discovery } from "../scenes/03-discovery";
import { AuditMorph } from "../scenes/04-audit-morph";
import { Copilot } from "../scenes/12-copilot";

// Ad-specific scenes
import { AdPain } from "../scenes/ad-01-pain";
import { AdWedge } from "../scenes/ad-02-wedge";
import { AdProof } from "../scenes/ad-03-proof";
import { AdCta } from "../scenes/ad-04-cta";

const sec = (s: number) => Math.round(s * FPS);

const AD_TRANSITIONS = {
  painToPromise: 14,
  promiseToDiscovery: 12,
  discoveryToAudit: 8,
  auditToWedge: 12,
  wedgeToOpener: 12,
  openerToProof: 0,
  proofToCta: 18,
} as const;

const totalTransitionFrames =
  AD_TRANSITIONS.painToPromise +
  AD_TRANSITIONS.promiseToDiscovery +
  AD_TRANSITIONS.discoveryToAudit +
  AD_TRANSITIONS.auditToWedge +
  AD_TRANSITIONS.wedgeToOpener +
  AD_TRANSITIONS.openerToProof +
  AD_TRANSITIONS.proofToCta;

const sumSeqFrames =
  sec(AD_S.pain) +
  sec(AD_S.promise) +
  sec(AD_S.discovery) +
  sec(AD_S.audit) +
  sec(AD_S.wedge) +
  sec(AD_S.opener) +
  sec(AD_S.proof) +
  sec(AD_S.cta);

/** Actual on-screen duration after transitions overlap their neighbors. */
export const AD_CUT_DURATION_FRAMES = sumSeqFrames - totalTransitionFrames;

/**
 * Absolute caption start frames, measured from composition T+0. Because
 * transitions overlap, scene N's real start is sum(prev seq) - sum(prev
 * transitions). We pre-compute this table once so caption cues stay aligned
 * even if per-scene durations move.
 */
function captionStarts() {
  let cursor = 0;
  const starts: Record<string, number> = {};
  starts.pain = cursor;
  cursor += sec(AD_S.pain) - AD_TRANSITIONS.painToPromise;
  starts.promise = cursor;
  cursor += sec(AD_S.promise) - AD_TRANSITIONS.promiseToDiscovery;
  starts.discovery = cursor;
  cursor += sec(AD_S.discovery) - AD_TRANSITIONS.discoveryToAudit;
  starts.audit = cursor;
  cursor += sec(AD_S.audit) - AD_TRANSITIONS.auditToWedge;
  starts.wedge = cursor;
  cursor += sec(AD_S.wedge) - AD_TRANSITIONS.wedgeToOpener;
  starts.opener = cursor;
  cursor += sec(AD_S.opener) - AD_TRANSITIONS.openerToProof;
  starts.proof = cursor;
  cursor += sec(AD_S.proof) - AD_TRANSITIONS.proofToCta;
  starts.cta = cursor;
  return starts;
}

export interface AdCutProps {
  /** Mount the music bed. Requires captures/audio/ad-bed.mp3 to exist. */
  audioBed?: boolean;
  /** Mount the VO track. Requires captures/audio/ad-vo.mp3 to exist. */
  audioVo?: boolean;
  /** Disable kinetic captions (for silent feed variants). */
  hideCaptions?: boolean;
}

export const AdCut: React.FC<AdCutProps> = ({
  audioBed = false,
  audioVo = false,
  hideCaptions = false,
}) => {
  const caps = captionStarts();

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <CameraBreath>
        <TransitionSeries>
          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.pain)}
            name="AD-01 Pain"
          >
            <AdPain />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.painToPromise,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.promise)}
            name="Promise"
          >
            <PromiseScene />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.promiseToDiscovery,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.discovery)}
            name="Discovery"
          >
            <Discovery />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.discoveryToAudit,
            })}
          />

          {/*
            04-audit-morph native duration is 12s. We need the best 5s of it:
            the signals cascade (1.2s) through the score badge landing (5.8s).
            Skip the first 1.0s by offsetting the inner Sequence start.
          */}
          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.audit)}
            name="Audit"
          >
            <Sequence from={-sec(1.0)} durationInFrames={sec(AD_S.audit + 1.0)}>
              <AuditMorph />
            </Sequence>
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.auditToWedge,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.wedge)}
            name="Wedge"
          >
            <AdWedge />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.wedgeToOpener,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.opener)}
            name="Opener"
          >
            <Copilot />
          </TransitionSeries.Sequence>

          {/* Hard cut to the proof slab — deliberately no transition. */}
          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.proof)}
            name="Proof"
          >
            <AdProof />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: AD_TRANSITIONS.proofToCta,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(AD_S.cta)}
            name="CTA"
          >
            <AdCta />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </CameraBreath>

      {/* Kinetic captions — composition-level so they survive scene transitions. */}
      {!hideCaptions && (
        <>
          <Sequence from={caps.pain} durationInFrames={sec(AD_S.pain)}>
            <KineticCaption
              text="Same 50 million contacts. Ten thousand agencies."
              eyebrow="The problem"
              appearAtFrame={Math.round(FPS * 0.2)}
              durationFrames={sec(AD_S.pain) - Math.round(FPS * 0.2)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.promise} durationInFrames={sec(AD_S.promise)}>
            <KineticCaption
              text="Postcode. Niche. Done."
              eyebrow="Discover"
              sub="Fresh from Google Maps · not the Apollo dump"
              appearAtFrame={Math.round(FPS * 0.3)}
              durationFrames={sec(AD_S.promise) - Math.round(FPS * 0.3)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.discovery} durationInFrames={sec(AD_S.discovery)}>
            <KineticCaption
              text="47 audited leads. Ranked by opportunity."
              eyebrow="Rank"
              appearAtFrame={Math.round(FPS * 0.4)}
              durationFrames={sec(AD_S.discovery) - Math.round(FPS * 0.4)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.audit} durationInFrames={sec(AD_S.audit)}>
            <KineticCaption
              text="Five signals. One score."
              eyebrow="Audit"
              sub="Mobile · booking · page speed · HTTPS · last update"
              appearAtFrame={Math.round(FPS * 0.4)}
              durationFrames={sec(AD_S.audit) - Math.round(FPS * 0.4)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.wedge} durationInFrames={sec(AD_S.wedge)}>
            <KineticCaption
              text="And a website plan on every reply."
              eyebrow="The wedge"
              sub="We don't sell the lead. We sell the first version of the pitch."
              appearAtFrame={Math.round(FPS * 0.3)}
              durationFrames={sec(AD_S.wedge) - Math.round(FPS * 0.3)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.opener} durationInFrames={sec(AD_S.opener)}>
            <KineticCaption
              text="Ask. Draft. Ship."
              eyebrow="Copilot"
              sub="First-draft opener grounded in their real site"
              appearAtFrame={Math.round(FPS * 0.5)}
              durationFrames={sec(AD_S.opener) - Math.round(FPS * 0.5)}
              position="bottom"
              size="subhead"
            />
          </Sequence>

          <Sequence from={caps.proof} durationInFrames={sec(AD_S.proof)}>
            <KineticCaption
              text="Fresh. Ranked. Personalised."
              eyebrow="What you get"
              appearAtFrame={Math.round(FPS * 1.8)}
              durationFrames={sec(AD_S.proof) - Math.round(FPS * 1.8)}
              position="bottom"
              size="subhead"
            />
          </Sequence>
        </>
      )}

      {audioBed && (
        <Audio src={staticFile("audio/ad-bed.mp3")} volume={0.45} />
      )}
      {audioVo && <Audio src={staticFile("audio/ad-vo.mp3")} volume={1} />}
    </AbsoluteFill>
  );
};

AdCut.displayName = "AdCut";
