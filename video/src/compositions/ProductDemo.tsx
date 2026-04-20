import React from "react";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { z } from "remotion/zod";
import { FPS } from "../constants";
import { Intro } from "../scenes/Intro";
import { Outro } from "../scenes/Outro";
import { DemoScene } from "../scenes/DemoScene";

const beatSchema = z.object({
  id: z.string(),
  caption: z.string(),
  subCaption: z.string().optional(),
  screenshot: z.string(),
  durationSec: z.number(),
  zoom: z
    .object({
      from: z.number().default(1),
      to: z.number().default(1.08),
      originX: z.number().default(0.5),
      originY: z.number().default(0.5),
    })
    .optional(),
  cursor: z
    .object({
      fromX: z.number(),
      fromY: z.number(),
      toX: z.number(),
      toY: z.number(),
      clickAt: z.number().optional(),
    })
    .optional(),
});

export type Beat = z.infer<typeof beatSchema>;

export const productDemoSchema = z.object({
  intro: z.object({
    title: z.string(),
    subtitle: z.string(),
    durationSec: z.number(),
  }),
  outro: z.object({
    title: z.string(),
    cta: z.string(),
    url: z.string(),
    durationSec: z.number(),
  }),
  beats: z.array(beatSchema),
});

export type ProductDemoProps = z.infer<typeof productDemoSchema>;

export const ProductDemo: React.FC<ProductDemoProps> = ({
  intro,
  outro,
  beats,
}) => {
  let cursor = 0;
  const introFrames = Math.round(intro.durationSec * FPS);
  const outroFrames = Math.round(outro.durationSec * FPS);

  const introStart = cursor;
  cursor += introFrames;

  const beatPositions = beats.map((beat) => {
    const start = cursor;
    const length = Math.round(beat.durationSec * FPS);
    cursor += length;
    return { start, length, beat };
  });

  const outroStart = cursor;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0A0A0B" }}>
      <Sequence from={introStart} durationInFrames={introFrames} name="Intro">
        <Intro title={intro.title} subtitle={intro.subtitle} />
      </Sequence>

      {beatPositions.map(({ start, length, beat }) => (
        <Sequence
          key={beat.id}
          from={start}
          durationInFrames={length}
          name={`Beat: ${beat.id}`}
        >
          <DemoScene
            screenshot={staticFile(beat.screenshot)}
            caption={beat.caption}
            subCaption={beat.subCaption}
            zoom={beat.zoom}
            cursor={beat.cursor}
            durationInFrames={length}
          />
        </Sequence>
      ))}

      <Sequence from={outroStart} durationInFrames={outroFrames} name="Outro">
        <Outro title={outro.title} cta={outro.cta} url={outro.url} />
      </Sequence>
    </AbsoluteFill>
  );
};
