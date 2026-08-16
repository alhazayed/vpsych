import {
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
  hasElevenLabs,
  resolveElevenLabsVoiceId,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import {
  resolveVoiceSettings,
  type ElevenLabsVoiceSettings,
} from "@/lib/voice/prosody";
import {
  cachedResultBody,
  collectStream,
  readTtsCache,
  ttsCacheKey,
  writeTtsCache,
} from "@/lib/voice/tts/cache";
import {
  TtsError,
  type TtsProvider,
  type TtsSynthesizeParams,
  type TtsSynthesizeResult,
} from "@/lib/voice/tts/types";
import { isElevenLabsVoiceId } from "@/lib/voice/tts/voice-format";

/**
 * @deprecated Use `TtsSynthesizeParams` / `TtsSynthesizeResult` from
 * `@/lib/voice/tts/types`. Retained so existing call sites keep compiling
 * while ElevenLabs remains the rollback provider.
 */
export type ElevenLabsSynthesizeParams = TtsSynthesizeParams;
export type ElevenLabsSynthesizeResult = TtsSynthesizeResult;

/**
 * ElevenLabs-flavoured `TtsError`. Subclassing keeps `instanceof TtsError`
 * true in the route while preserving the existing named export.
 */
export class ElevenLabsError extends TtsError {
  constructor(
    message: string,
    options: { code: string; status: number; detail?: string },
  ) {
    super(message, options);
    this.name = "ElevenLabsError";
  }
}

/** Upstream TTS hard timeout (Stage 12 / RT-03). */
const DEFAULT_TTS_TIMEOUT_MS = 30_000;

export function elevenLabsTimeoutMs(): number {
  const raw = process.env.ELEVENLABS_TIMEOUT_MS ?? process.env.TTS_TIMEOUT_MS;
  const n = Number(raw ?? DEFAULT_TTS_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTS_TIMEOUT_MS;
}

function modelId() {
  return process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
}

function apiKey() {
  // Strip accidental wrapping quotes from dashboard paste errors.
  const raw = process.env.ELEVENLABS_API_KEY?.trim() || "";
  return raw.replace(/^['"]+|['"]+$/g, "").trim();
}

/** ElevenLabs current keys are `sk_…`. Reject obvious misconfigurations early. */
export function isValidElevenLabsApiKey(key: string = apiKey()): boolean {
  return /^sk_[A-Za-z0-9]+/.test(key);
}

/**
 * @deprecated Use `resetTtsCache` / `ttsCacheSize` from
 * `@/lib/voice/tts/cache`. The cache is now shared across providers.
 */
export { resetTtsCache as resetElevenLabsCache } from "@/lib/voice/tts/cache";
export { ttsCacheSize as elevenLabsCacheSize } from "@/lib/voice/tts/cache";

/**
 * Resolve the ElevenLabs `voice_settings` payload.
 * Clinical Voice Profile settings (when the route resolved one) win over the
 * pace/energy defaults; Humanization stability/style overlay on top.
 */
function resolveElevenLabsSettings(
  params: TtsSynthesizeParams,
): ElevenLabsVoiceSettings {
  const clinical = params.clinicalVoice;
  const base: ElevenLabsVoiceSettings =
    typeof clinical?.stability === "number" &&
    typeof clinical?.similarity_boost === "number"
      ? {
          stability: clinical.stability,
          similarity_boost: clinical.similarity_boost,
          ...(typeof clinical.style === "number"
            ? { style: clinical.style }
            : {}),
        }
      : resolveVoiceSettings({
          speechPace: params.speechPace,
          speechEnergy: params.speechEnergy,
          disorderSlug: params.disorderSlug,
        });

  const settings: ElevenLabsVoiceSettings = { ...base };
  if (
    typeof params.stability === "number" &&
    Number.isFinite(params.stability)
  ) {
    settings.stability = Math.max(0, Math.min(1, params.stability));
  }
  if (typeof params.style === "number" && Number.isFinite(params.style)) {
    settings.style = Math.max(0, Math.min(1, params.style));
  }
  return settings;
}

/**
 * Reusable ElevenLabs TTS provider — streaming synthesis + repeated-request
 * cache. Retained as the rollback provider during the Google migration.
 */
export const elevenLabsService: TtsProvider = {
  id: "elevenlabs",

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
   * Identical (text, voice, model, locale, settings) requests are served from
   * the shared in-memory cache. The response body is always a ReadableStream.
   */
  async synthesize(
    params: TtsSynthesizeParams,
  ): Promise<TtsSynthesizeResult> {
    if (!hasElevenLabs()) {
      throw new ElevenLabsError(
        "ElevenLabs not configured. Set ELEVENLABS_API_KEY.",
        { code: "TTS_UNAVAILABLE", status: 501 },
      );
    }

    const key = apiKey();
    if (!isValidElevenLabsApiKey(key)) {
      console.warn(
        "[elevenlabs] ELEVENLABS_API_KEY is set but does not look like a valid sk_ key",
      );
      throw new ElevenLabsError(
        "ElevenLabs API key misconfigured (expected sk_… prefix).",
        { code: "TTS_CONFIG", status: 503 },
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
    // once with the account default premade voice.
    const voiceCandidates = [primaryVoiceId];
    if (fallbackVoiceId && fallbackVoiceId !== primaryVoiceId) {
      voiceCandidates.push(fallbackVoiceId);
    }

    const model = modelId();
    const voiceSettings = resolveElevenLabsSettings(params);

    let lastDetail = "";
    let lastVoiceId = primaryVoiceId;

    for (let i = 0; i < voiceCandidates.length; i++) {
      const voiceId = voiceCandidates[i]!;
      lastVoiceId = voiceId;

      // Defense-in-depth: never interpolate a malformed id into the upstream
      // request path, and never send a Google voice name to ElevenLabs.
      if (!isElevenLabsVoiceId(voiceId)) {
        lastDetail = `invalid voice id: ${voiceId}`;
        continue;
      }

      const cacheKey = ttsCacheKey({
        provider: "elevenlabs",
        text,
        voiceId,
        modelId: model,
        locale: params.locale,
        speechParams: voiceSettings,
      });

      const cached = readTtsCache(cacheKey);
      if (cached) {
        return {
          body: cachedResultBody(cached),
          contentType: cached.contentType,
          voiceId: cached.voiceId,
          locale: cached.locale,
          modelId: cached.modelId,
          cached: true,
          streamed: false,
          provider: "elevenlabs",
        };
      }

      const wantStream = params.stream !== false;
      const path = wantStream
        ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`
        : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

      let res: Response;
      try {
        res = await fetch(path, {
          method: "POST",
          headers: {
            "xi-api-key": apiKey(),
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: model,
            voice_settings: voiceSettings,
          }),
          // Abort hung upstream TTS (RT-03 / RT-S11-04).
          signal: AbortSignal.timeout(elevenLabsTimeoutMs()),
        });
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        const msg = err instanceof Error ? err.message : String(err);
        if (
          name === "TimeoutError" ||
          name === "AbortError" ||
          /aborted|timeout/i.test(msg)
        ) {
          throw new ElevenLabsError("ElevenLabs TTS timed out", {
            code: "TTS_TIMEOUT",
            status: 504,
            detail: `timeout_ms=${elevenLabsTimeoutMs()} voice=${voiceId}`,
          });
        }
        throw err;
      }

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
            writeTtsCache(cacheKey, {
              buffer,
              contentType: "audio/mpeg",
              voiceId,
              modelId: model,
              locale: params.locale,
              provider: "elevenlabs",
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
          provider: "elevenlabs",
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
