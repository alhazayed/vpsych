/**
 * Provider-neutral in-memory TTS cache.
 *
 * Extracted from the ElevenLabs service so both providers share one bounded
 * LRU with identical TTL / max-entry semantics. Serves repeated phrases
 * (admin voice previews, short recurring patient turns).
 *
 * Isolation guarantees — two requests share a cache entry only when the
 * provider, voice, model, locale, text, AND every provider-relevant speech
 * parameter match. A Google render never satisfies an ElevenLabs request (or
 * vice versa) even for identical text and the same nominal voice.
 *
 * Not horizontally shared: each serverless instance keeps its own map, same as
 * the in-memory rate limiter.
 */

import { createHash } from "crypto";
import type { SessionSpeechLocale } from "@/lib/voice/config";
import { bufferToStream, type TtsProviderId } from "@/lib/voice/tts/types";

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 64;

export type TtsCacheEntry = {
  buffer: ArrayBuffer;
  contentType: string;
  voiceId: string;
  modelId: string;
  locale: SessionSpeechLocale;
  provider: TtsProviderId;
  createdAt: number;
};

/** `TTS_CACHE_*` wins; the ELEVENLABS_* names stay honored during migration. */
function cacheTtlMs(): number {
  const raw =
    process.env.TTS_CACHE_TTL_MS ?? process.env.ELEVENLABS_CACHE_TTL_MS;
  const n = Number(raw ?? DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CACHE_TTL_MS;
}

function cacheMaxEntries(): number {
  const raw =
    process.env.TTS_CACHE_MAX_ENTRIES ??
    process.env.ELEVENLABS_CACHE_MAX_ENTRIES;
  const n = Number(raw ?? DEFAULT_CACHE_MAX_ENTRIES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CACHE_MAX_ENTRIES;
}

const ttsCache = new Map<string, TtsCacheEntry>();

export function resetTtsCache(): void {
  ttsCache.clear();
}

export function ttsCacheSize(): number {
  return ttsCache.size;
}

/**
 * Build a cache key. `speechParams` must contain every provider-specific knob
 * that changes the rendered audio — omitting one would serve the wrong
 * delivery for a clinically different turn.
 */
export function ttsCacheKey(params: {
  provider: TtsProviderId;
  text: string;
  voiceId: string;
  modelId: string;
  locale: SessionSpeechLocale;
  speechParams: unknown;
}): string {
  return createHash("sha256")
    .update(params.provider)
    .update("\0")
    .update(params.text)
    .update("\0")
    .update(params.voiceId)
    .update("\0")
    .update(params.modelId)
    .update("\0")
    .update(params.locale)
    .update("\0")
    .update(stableStringify(params.speechParams))
    .digest("hex");
}

/** Key-order-independent serialization so equivalent params share an entry. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

export function readTtsCache(key: string): TtsCacheEntry | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > cacheTtlMs()) {
    ttsCache.delete(key);
    return null;
  }
  // Refresh recency (LRU-ish).
  ttsCache.delete(key);
  ttsCache.set(key, entry);
  return entry;
}

export function writeTtsCache(key: string, entry: TtsCacheEntry): void {
  ttsCache.set(key, entry);
  while (ttsCache.size > cacheMaxEntries()) {
    const oldest = ttsCache.keys().next().value;
    if (oldest === undefined) break;
    ttsCache.delete(oldest);
  }
}

/** Replay a cache hit as a fresh single-chunk stream body. */
export function cachedResultBody(
  entry: TtsCacheEntry,
): ReadableStream<Uint8Array> {
  return bufferToStream(entry.buffer);
}

/** Drain a stream into one buffer (used to fill the cache from a tee branch). */
export async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}
