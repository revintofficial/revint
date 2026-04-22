/**
 * P0.7 - Voice notes light: Gemini inline audio transcription.
 *
 * Gemini 2.5 Flash supports inline audio input via base64-encoded inlineData
 * blocks. We send the recorded blob directly (no Whisper API key needed,
 * GEMINI_API_KEY already configured in .env). 40+ language auto-detection.
 *
 * For very long recordings (>1 min audio), the model might truncate;
 * MediaRecorder client caps at 90 seconds anyway.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

export async function transcribeAudioWithGemini(
  audio: Buffer,
  mimeType: string,
  language?: string | null,
): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  });

  const langHint = language
    ? ` Return the transcript in ${language}.`
    : " Return the transcript in the original spoken language.";

  const prompt = `Transcribe this audio. Return only the transcript, no commentary.${langHint}
If the audio is unintelligible, output "[unintelligible]". If it is silent, output "[silent]".`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: audio.toString("base64"),
        mimeType,
      },
    },
  ]);

  return result.response.text().trim();
}
