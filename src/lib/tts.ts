import "server-only";
import fs from "fs";
import path from "path";
import { STORAGE_DIR } from "./files";
import type { Locale } from "@/i18n/shared";

/**
 * Text-to-speech for the mascot. TTS_PROVIDER="openai" = any OpenAI-compatible `/audio/speech` endpoint
 * (TTS_BASE_URL, TTS_API_KEY, TTS_MODEL, TTS_VOICE_RU/TTS_VOICE_EN). Not configured → null, and every viewer's
 * browser speaks the text itself (free, but without the gas-mask radio filter).
 */
export async function synthesize(text: string, locale: Locale): Promise<{ url: string; durationMs: number | null } | null> {
  if (process.env.TTS_PROVIDER !== "openai" || !process.env.TTS_BASE_URL) return null;
  const res = await fetch(`${process.env.TTS_BASE_URL.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.TTS_API_KEY ? { Authorization: `Bearer ${process.env.TTS_API_KEY}` } : {}) },
    body: JSON.stringify({
      model: process.env.TTS_MODEL || "tts-1",
      voice: (locale === "ru" ? process.env.TTS_VOICE_RU : process.env.TTS_VOICE_EN) || "onyx",
      input: text,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = path.join(STORAGE_DIR, "tts");
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  await fs.promises.writeFile(path.join(dir, name), buf);
  return { url: `/api/mascot/tts/${name}`, durationMs: null };
}
