import { createHash } from "crypto";
import {
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
  hasElevenLabs,
  isValidElevenLabsVoiceId,
  resolveElevenLabsVoiceId,
  type SessionSpeechLocale,
} from "@/lib/voice/config";

export type ElevenLabsSynthesizeParams = {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  /** Prefer streaming endpoint (default true). */
  stream?: boolean;
  stability?: number;
  similarityBoost?: number;
  style?: number;
};

export type ElevenLabsSynthesizeResult = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  voiceId: string;
  locale: SessionSpeechLocale;
  modelId: string;
  cached: boolean;
  streamed: boolean;
};

export class ElevenLabsError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: string;

  constructor(
    message: string,
    options: { code: string; status: number; detail?: string },
  ) {
    super(message);
    this.name = "ElevenLabsError";
    this.code = options.code;
    this.status = options.status;
    this.detail = options.detail;
  }
}

type CacheEntry = {
  buffer: ArrayBuffer;
  contentType: string;
  voiceId: string;
  modelId: string;
  locale: SessionSpeechLocale;
  createdAt: number;
};

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 64;

function cacheTtlMs() {
  return Number(process.env.ELEVENLABS_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS);
}

function cacheMaxEntries() {
  return Number(
    process.env.ELEVENLABS_CACHE_MAX_ENTRIES ?? DEFAULT_CACHE_MAX_ENTRIES,
  );
}

function modelId() {
  return process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
}

function apiKey() {
  return process.env.ELEVENLABS_API_KEY?.trim() || "";
}

/** In-memory LRU-ish TTS cache for repeated phrases (preview + short turns). */
const ttsCache = new Map<string, CacheEntry>();

export function resetElevenLabsCache() {
  ttsCache.clear();
}

export function elevenLabsCacheSize() {
  return ttsCache.size;
}

function cacheKey(params: {
  text: string;
  voiceId: string;
  modelId: string;
  locale: SessionSpeechLocale;
}) {
  return createHash("sha256")
    .update(params.text)
    .update("\0")
    .update(params.voiceId)
    .update("\0")
    .update(params.modelId)
    .update("\0")
    .update(params.locale)
    .digest("hex");
}

function readCache(key: string): CacheEntry | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > cacheTtlMs()) {
    ttsCache.delete(key);
    return null;
  }
  ttsCache.delete(key);
  ttsCache.set(key, entry);
  return entry;
}

function writeCache(key: string, entry: CacheEntry) {
  ttsCache.set(key, entry);
  while (ttsCache.size > cacheMaxEntries()) {
    const oldest = ttsCache.keys().next().value;
    if (oldest === undefined) break;
    ttsCache.delete(oldest);
  }
}

function arrayBufferToStream(buffer: ArrayBuffer): ReadableStream<Uint8Array> {
  const bytes = new Uint8Array(buffer);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function collectStream(
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

/**
 * Reusable ElevenLabs TTS service — streaming synthesis + repeated-request cache.
 */
export const elevenLabsService = {
  isConfigured: hasElevenLabs,

  resolveVoiceId(params: {
    locale: SessionSpeechLocale;
    voiceId?: string | null;
    voiceIdAr?: string | null;
  }) {
    return resolveElevenLabsVoiceId(params);
  },

  /**
   * Synthesize speech via ElevenLabs `/stream` when possible.
   * Identical (text, voice, model, locale) requests are served from an
   * in-memory cache. The response body is always a ReadableStream.
   */
  async synthesize(
    params: ElevenLabsSynthesizeParams,
  ): Promise<ElevenLabsSynthesizeResult> {
    if (!hasElevenLabs()) {
      throw new ElevenLabsError(
        "ElevenLabs not configured. Set ELEVENLABS_API_KEY.",
        { code: "TTS_UNAVAILABLE", status: 501 },
      );
    }

    const text = params.text.trim();
    if (!text) {
      throw new ElevenLabsError("text required", {
        code: "BAD_REQUEST",
        status: 400,
      });
    }
    if (text.length > 2500) {
      throw new ElevenLabsError("text too long (max 2500 characters)", {
        code: "BAD_REQUEST",
        status: 400,
      });
    }

    const primaryVoiceId = resolveElevenLabsVoiceId({
      locale: params.locale,
      voiceId: params.voiceId,
      voiceIdAr: params.voiceIdAr,
    });
    const fallbackVoiceId =
      params.locale === "ar"
        ? process.env.ELEVENLABS_VOICE_ID_AR || DEFAULT_ELEVENLABS_VOICE_AR
        : process.env.ELEVENLABS_VOICE_ID_EN || DEFAULT_ELEVENLABS_VOICE_EN;

    // Prefer the resolved avatar voice; on Voice Library / plan errors, retry
    // once with the account default premade voice (Rachel / Charlotte).
    const voiceCandidates = [primaryVoiceId];
    if (fallbackVoiceId && fallbackVoiceId !== primaryVoiceId) {
      voiceCandidates.push(fallbackVoiceId);
    }

    const model = modelId();
    let lastDetail = "";
    let lastVoiceId = primaryVoiceId;

    for (let i = 0; i < voiceCandidates.length; i++) {
      const voiceId = voiceCandidates[i]!;
      lastVoiceId = voiceId;

      // Defense-in-depth: never interpolate a malformed id into the upstream
      // request path (guards env/DB-derived candidates too).
      if (!isValidElevenLabsVoiceId(voiceId)) {
        lastDetail = `invalid voice id: ${voiceId}`;
        continue;
      }

      const key = cacheKey({
        text,
        voiceId,
        modelId: model,
        locale: params.locale,
      });

      const cached = readCache(key);
      if (cached) {
        return {
          body: arrayBufferToStream(cached.buffer),
          contentType: cached.contentType,
          voiceId: cached.voiceId,
          locale: cached.locale,
          modelId: cached.modelId,
          cached: true,
          streamed: false,
        };
      }

      const wantStream = params.stream !== false;
      const path = wantStream
        ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
        : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

      const res = await fetch(path, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey(),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: params.stability ?? 0.4,
            similarity_boost: params.similarityBoost ?? 0.75,
            style: params.style ?? 0,
          },
        }),
      });

      if (res.ok && res.body) {
        if (i > 0) {
          console.warn(
            `[elevenlabs] voice ${primaryVoiceId} rejected; used fallback ${voiceId}`,
          );
        }

        // Tee: stream to the client while filling the cache in the background.
        const [toClient, toCache] = res.body.tee();
        void collectStream(toCache)
          .then((buffer) => {
            writeCache(key, {
              buffer,
              contentType: "audio/mpeg",
              voiceId,
              modelId: model,
              locale: params.locale,
              createdAt: Date.now(),
            });
          })
          .catch(() => {
            /* cache fill is best-effort */
          });

        return {
          body: toClient,
          contentType: "audio/mpeg",
          voiceId,
          locale: params.locale,
          modelId: model,
          cached: false,
          streamed: wantStream,
        };
      }

      lastDetail = await res.text().catch(() => "");
      const planBlocked =
        res.status === 402 ||
        /paid_plan_required|payment_required|library voices/i.test(lastDetail);

      if (!planBlocked || i === voiceCandidates.length - 1) {
        break;
      }
      console.warn(
        `[elevenlabs] voice ${voiceId} unavailable (${res.status}); retrying default`,
      );
    }

    throw new ElevenLabsError("ElevenLabs TTS failed", {
      code: /paid_plan_required|payment_required/i.test(lastDetail)
        ? "TTS_PLAN_REQUIRED"
        : "TTS_FAILED",
      status: 502,
      detail: `${lastDetail.slice(0, 400)} [voice=${lastVoiceId}]`,
    });
  },
};
