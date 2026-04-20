/**
 * AdTeaser15 — 15s hard-cut teaser for pre-roll + retargeting.
 *
 * Only the hardest-punching beats of the 40s ad survive. Same primitives,
 * same voice, same audio hooks — just ruthless. Kinetic captions only on
 * the two loudest beats (pain + cta) so the visual does the rest of the
 * work.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { COLORS, FPS, TEASER_S } from "../theme/tokens";
import { CameraBreath } from "../primitives/CameraBreath";
import { KineticCaption } from "../primitives/KineticCaption";
import { Promise as PromiseScene } from "../scenes/02-promise";
import { AdPain } from "../scenes/ad-01-pain";
import { AdProof } from "../scenes/ad-03-proof";
import { AdCta } from "../scenes/ad-04-cta";

const sec = (s: number) => Math.round(s * FPS);

const TEASER_TRANSITIONS = {
  painToPromise: 10,
  promiseToProof: 0,
  proofToCta: 14,
} as const;

const sumSeq =
  sec(TEASER_S.pain) +
  sec(TEASER_S.promise) +
  sec(TEASER_S.proof) +
  sec(TEASER_S.cta);

const sumTrans =
  TEASER_TRANSITIONS.painToPromise +
  TEASER_TRANSITIONS.promiseToProof +
  TEASER_TRANSITIONS.proofToCta;

export const AD_TEASER_DURATION_FRAMES = sumSeq - sumTrans;

export interface AdTeaser15Props {
  audioBed?: boolean;
}

export const AdTeaser15: React.FC<AdTeaser15Props> = ({ audioBed = false }) => {
  const caps = {
    pain: 0,
    promise:
      sec(TEASER_S.pain) - TEASER_TRANSITIONS.painToPromise,
    cta:
      sec(TEASER_S.pain) -
      TEASER_TRANSITIONS.painToPromise +
      sec(TEASER_S.promise) -
      TEASER_TRANSITIONS.promiseToProof +
      sec(TEASER_S.proof) -
      TEASER_TRANSITIONS.proofToCta,
  };

  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <CameraBreath>
        <TransitionSeries>
          <TransitionSeries.Sequence
            durationInFrames={sec(TEASER_S.pain)}
            name="Pain"
          >
            <AdPain />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: TEASER_TRANSITIONS.painToPromise,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(TEASER_S.promise)}
            name="Promise"
          >
            <PromiseScene />
          </TransitionSeries.Sequence>

          <TransitionSeries.Sequence
            durationInFrames={sec(TEASER_S.proof)}
            name="Proof"
          >
            <AdProof />
          </TransitionSeries.Sequence>
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({
              durationInFrames: TEASER_TRANSITIONS.proofToCta,
            })}
          />

          <TransitionSeries.Sequence
            durationInFrames={sec(TEASER_S.cta)}
            name="CTA"
          >
            <AdCta />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </CameraBreath>

      <Sequence from={caps.pain} durationInFrames={sec(TEASER_S.pain)}>
        <KineticCaption
          text="Same list. Same inbox. Same week."
          appearAtFrame={Math.round(FPS * 0.1)}
          durationFrames={sec(TEASER_S.pain) - Math.round(FPS * 0.1)}
          position="bottom"
          size="subhead"
        />
      </Sequence>

      <Sequence from={caps.promise} durationInFrames={sec(TEASER_S.promise)}>
        <KineticCaption
          text="Postcode. Niche. 47 leads."
          appearAtFrame={Math.round(FPS * 0.3)}
          durationFrames={sec(TEASER_S.promise) - Math.round(FPS * 0.3)}
          position="bottom"
          size="subhead"
        />
      </Sequence>

      {audioBed && (
        <Audio src={staticFile("audio/ad-bed.mp3")} volume={0.45} />
      )}
    </AbsoluteFill>
  );
};
