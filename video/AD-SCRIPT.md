# Leadac AI — AdCut v1 script

The 40-second paid-media master. Composition ID `AdCut` in `video/src/Root.tsx`.
Target viewer is Josh (see `BUYER-PERSONA.md` at repo root): cold-email agency
owner, 27-32, already running Apollo + Clay + a sender, tired of the saturated
list problem.

Three cuts ship from one source:

| Composition ID   | Size       | Duration | Use                         |
| ---------------- | ---------- | -------- | --------------------------- |
| `AdCut`          | 1920x1080  | ~38.8s   | X, LinkedIn, YouTube feed   |
| `AdCutVertical`  | 1080x1920  | ~38.8s   | TikTok, Reels, Shorts       |
| `AdTeaser15`     | 1920x1080  | ~14.7s   | pre-roll, retargeting       |

Each scene beat is locked to a constant in `video/src/theme/tokens.ts` under
`AD_BEATS`. If you re-score the music, move the beats there — never hardcode
frames in scene files.

---

## Beat map (AdCut)

| T (s) | Beat      | Visual                                               | Caption (kinetic, on-screen)               |
| ----- | --------- | ---------------------------------------------------- | ------------------------------------------ |
| 0.0   | pain      | Apollo-style CSV desaturates, "50,000,000" stamp     | "Same 50 million contacts. Ten thousand agencies." |
| 3.0   | promise   | Postcode input, niche picker, CTA goes live          | "Postcode. Niche. Done."                   |
| 8.5   | discovery | Leads list cascade, counter ticks to 47              | "47 audited leads. Ranked by opportunity." |
| 13.5  | audit     | Signals fill, opportunity score counts to 87         | "Five signals. One score."                 |
| 18.5  | wedge     | Website plan doc scrolls, chips + actions appear     | "And a website plan on every reply."       |
| 23.5  | opener    | Copilot drawer opens, AI response types, chips land  | "Ask. Draft. Ship."                        |
| 28.5  | proof     | Three big numbers: 47 leads · 4.2s · above baseline  | "Fresh. Ranked. Personalised."             |
| 33.5  | cta       | Logo, hero headline, URL chip, tagline stamp         | (cta carries its own copy on-screen)       |

---

## VO script (draft — record when ready)

Read with a conversational cadence. Not salesy. Not excited. Think Mark
Rober product demo, not Iman Gadzhi hook. Pauses are part of the timing;
the captions do half the work.

Total speaking time when read at normal pace: 28-30s. That leaves the
remaining 10s for music-led moments and the CTA logo hold. If the voice
actor runs long on a beat, trim the beat that follows rather than sliding
the whole track; every beat has ±0.3s of visual slack.

```
[00.2]  Every agency buys the same list.
[01.4]  Fifty million contacts. Ten thousand inboxes asking the same thing this week.
[03.2]  So we built the opposite.
[04.6]  Type a postcode. Pick a niche.
[06.8]  Four seconds later, forty-seven fresh local businesses.
[09.0]  Pulled from Google Maps. Never from the Apollo dump.
[11.2]  Every one already audited.
[13.6]  Five signals, one score.
[16.4]  Mobile, booking, page speed, HTTPS, last update.
[18.6]  And here's the part nobody else ships.
[20.4]  A website plan, grounded in their real site.
[22.4]  You attach it to the first reply.
[23.8]  Ask the copilot who in SW7 has reviews over four-point-seven and a dated site.
[26.6]  It names three and opens them in your pipeline.
[28.6]  Forty-seven leads. Four-point-two seconds. Reply rates above the three-to-four percent baseline.
[33.6]  Your first fifty leads are five minutes away.
[36.0]  Free. No card. Five website plans on the house.
[38.4]  leadac dot ai.
```

### Humanizer checklist (before recording)

- [ ] No em dashes. Commas and full stops only.
- [ ] No "unlock", "seamless", "leverage", "robust", "revolutionary", "cutting-edge", "at the intersection of", "delve", "in the realm of", "landscape", "testament to".
- [ ] No "not X, but Y" parallelism outside the one allowed at T+03.2.
- [ ] Rule-of-three used twice max (T+13.6 signals, T+28.6 numbers).
- [ ] Passive voice under 10%. Current draft: 0%.
- [ ] Numbers spoken out long form ("four-point-two seconds"), not "4.2 s".
- [ ] Sentence length distribution: ~55% under 6 words, 45% 6-12 words, 0% over 12.

---

## Audio drop-in

Remotion's `publicDir` points at `../captures`. That means audio files have
to live next to the plate captures. Drop the two files below to enable
sound on the next render; the compositions read them via `staticFile()`.

```
captures/
  audio/
    ad-bed.mp3    # 40s instrumental bed (Epidemic Sound / Artlist / Mubert)
    ad-vo.mp3     # voice-over, dry (no music baked in)
```

Then render with the props that reference them:

```bash
# From repo root
cd video
pnpm render:ad           # silent
pnpm render:ad:with-bed  # music only
pnpm render:ad:full      # music + vo
```

Or in Remotion Studio, pick `AdCut` and toggle `audioBed` / `audioVo` in
the props panel.

### Music bed brief

- 40s, 100-110 BPM.
- Two-stage build: gentle first 3s under the pain beat, lift at T+3.0
  when "postcode / niche" lands, steady rhythm 8s-28s, brief drop at
  T+28.5 for the three-number proof slab, cinematic lift at T+33.5 for
  the CTA, tail at T+38.
- Instrumentation: muted electronic pulse + melodic piano or synth.
  Avoid corporate lo-fi ukulele and avoid sports-hype EDM drops.
- Stingers hit on: 3.0, 13.5, 28.5, 33.5.

### VO recording brief

- Neutral US or RP English. Male or female, single voice.
- Close-mic, 48kHz, dry, no reverb.
- Two takes minimum per beat, pick the one where the sibilance is
  flattest.
- Deliver stems labeled `vo-beat-<NN>-<beat-name>.wav` so we can stitch
  by time code.

---

## Re-score / re-cut workflow

1. Edit `AD_BEATS` in `video/src/theme/tokens.ts` — this is the source of
   truth for every cut in the ad family.
2. Edit `AD_S` in the same file if a beat needs more or less on-screen
   time. Keep the AdCut composition under 45s; X cuts long ads off.
3. Run `pnpm dev` in `video/` and scrub through `AdCut` in Studio to
   verify the new cadence.
4. Re-export the vertical and teaser cuts via `render:ad:all`. They
   pull from the same beat table so they stay in sync automatically.
5. If the VO track moves, cut the old `ad-vo.mp3` and drop the new one;
   no code change required.
