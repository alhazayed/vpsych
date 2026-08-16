/**
 * Google Cloud Text-to-Speech provider (REST `text:synthesize`).
 *
 * Benchmark-stage scope: Chirp 3 HD, `ar-XA` Arabic, MP3 output, synchronous
 * REST only. Google's gRPC streaming surface is deliberately NOT used.
 *
 * The REST API returns `{ "audioContent": "<base64>" }` rather than an audio
 * stream, so this adapter materializes the clip and hands back a single-chunk
 * ReadableStream. That keeps the downstream contract byte-identical —
 * Response.body → Blob → object URL → HTMLAudioElement — and reports
 * `streamed: false` honestly rather than pretending the transport streamed.
 */

import {
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import {
  GOOGLE_TTS_ENDPOINT,
  GOOGLE_TTS_MAX_INPUT_BYTES,
  googleAuthHeaders,
  googleCustomPronunciationEnabled,
  googleLanguageCode,
  googleModelIdFromVoice,
  googlePauseControlEnabled,
  googleSpeakingRateEnabled,
  googleTtsTimeoutMs,
  hasGoogleTts,
  resolveGoogleVoiceName,
} from "@/lib/voice/google/config";
import { googleSupports } from "@/lib/voice/google/capabilities";
import { buildPauseMarkup } from "@/lib/voice/google/markup";
import { customPronunciationsFor } from "@/lib/voice/google/pronunciation";
import { googleProsodyFromClinicalVoice } from "@/lib/voice/google/prosody";
import {
  cachedResultBody,
  readTtsCache,
  ttsCacheKey,
  writeTtsCache,
} from "@/lib/voice/tts/cache";
import { normalizeTtsText } from "@/lib/voice/tts/normalize";
import {
  bufferToStream,
  TtsError,
  type TtsDiagnostics,
  type TtsProvider,
  type TtsSynthesizeParams,
  type TtsSynthesizeResult,
} from "@/lib/voice/tts/types";
import { isGoogleVoiceName } from "@/lib/voice/tts/voice-format";

const CONTENT_TYPE_MP3 = "audio/mpeg";

type GoogleSynthesizeResponse = {
  audioContent?: unknown;
};

/** Map a Google HTTP status onto the provider-neutral error taxonomy. */
function errorForStatus(status: number, detail: string): TtsError {
  if (status === 400) {
    return new TtsError("Text-to-speech request rejected", {
      code: "BAD_REQUEST",
      status: 400,
      detail,
    });
  }
  if (status === 401 || status === 403) {
    return new TtsError("Text-to-speech provider not authorized", {
      code: "TTS_CONFIG",
      status: 503,
      detail,
    });
  }
  if (status === 404) {
    return new TtsError("Text-to-speech voice or endpoint not found", {
      code: "TTS_VOICE_INVALID",
      status: 502,
      detail,
    });
  }
  if (status === 429) {
    return new TtsError("Text-to-speech quota exceeded", {
      code: "TTS_QUOTA",
      status: 429,
      detail,
    });
  }
  return new TtsError("Text-to-speech failed", {
    code: "TTS_FAILED",
    status: 502,
    detail,
  });
}

function decodeAudioContent(audioContent: string): ArrayBuffer {
  const buf = Buffer.from(audioContent, "base64");
  if (buf.byteLength === 0) {
    throw new TtsError("Text-to-speech returned empty audio", {
      code: "TTS_FAILED",
      status: 502,
      detail: "audioContent decoded to zero bytes",
    });
  }
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export const googleTtsService: TtsProvider = {
  id: "google",

  isConfigured: hasGoogleTts,

  resolveVoiceId(params) {
    return resolveGoogleVoiceName(params);
  },

  async synthesize(
    params: TtsSynthesizeParams,
  ): Promise<TtsSynthesizeResult> {
    if (!hasGoogleTts()) {
      throw new TtsError(
        "Google Cloud TTS not configured. Set GOOGLE_TTS_API_KEY or GOOGLE_TTS_ACCESS_TOKEN.",
        { code: "TTS_UNAVAILABLE", status: 501 },
      );
    }

    const locale: SessionSpeechLocale = normalizeSpeechLocale(params.locale);

    // Normalization only strips control/formatting characters and collapses
    // whitespace. Clinical wording — Arabic included — is never rewritten.
    const { text, bytes } = normalizeTtsText(params.text ?? "");
    if (!text) {
      throw new TtsError("text required", {
        code: "BAD_REQUEST",
        status: 400,
      });
    }
    if (bytes > GOOGLE_TTS_MAX_INPUT_BYTES) {
      // Byte-based, not character-based: Arabic is ~2 bytes/char in UTF-8.
      throw new TtsError(
        `text too long (max ${GOOGLE_TTS_MAX_INPUT_BYTES} bytes)`,
        {
          code: "BAD_REQUEST",
          status: 400,
          detail: `utf8_bytes=${bytes}`,
        },
      );
    }

    const voiceName = resolveGoogleVoiceName({
      locale,
      voiceId: params.voiceId,
      voiceIdAr: params.voiceIdAr,
    });
    // Defense in depth: never interpolate a non-Google identifier upstream.
    if (!isGoogleVoiceName(voiceName)) {
      throw new TtsError("Invalid Google voice configuration", {
        code: "TTS_CONFIG",
        status: 503,
        detail: `invalid voice name: ${voiceName}`,
      });
    }

    const languageCode = googleLanguageCode(locale);
    const modelId = googleModelIdFromVoice(voiceName);

    const clinical = params.clinicalVoice ?? null;
    const pauseEnabled =
      googlePauseControlEnabled() &&
      googleSupports("pause_control", voiceName, languageCode);

    const prosody = googleProsodyFromClinicalVoice({
      voiceName,
      languageCode,
      speechRate: clinical?.speech_rate,
      pitch: clinical?.pitch,
      pauseScale: clinical?.pause_scale,
      // Humanization overrides win over the CVP baseline, matching the
      // ElevenLabs path — both are reported unsupported for Google.
      stability: params.stability ?? clinical?.stability,
      similarityBoost: clinical?.similarity_boost,
      style: params.style ?? clinical?.style,
      enableSpeakingRate: googleSpeakingRateEnabled(),
      enablePauseControl: pauseEnabled,
    });

    const audioConfig = {
      audioEncoding: "MP3" as const,
      ...prosody.audioConfig,
    };

    // Pause markup. `buildPauseMarkup` always neutralizes brackets, so the
    // returned text is injection-safe whether or not tags were added.
    const markup = buildPauseMarkup({
      text,
      pauseScale: clinical?.pause_scale,
      enabled: pauseEnabled,
    });

    // Custom pronunciations, matched against the text actually being spoken.
    const pronunciationEnabled =
      googleCustomPronunciationEnabled() &&
      googleSupports("custom_pronunciation", voiceName, languageCode);
    const resolvedPronunciations = pronunciationEnabled
      ? customPronunciationsFor({ text: markup.text, languageCode })
      : { pronunciations: [], invalidCount: 0, truncated: false };

    // `markup` is a Chirp-3-HD-only input field; everything else uses `text`.
    const input: Record<string, unknown> = markup.applied
      ? { markup: markup.text }
      : { text: markup.text };
    if (resolvedPronunciations.pronunciations.length > 0) {
      input.customPronunciations = {
        pronunciations: resolvedPronunciations.pronunciations,
      };
    }

    const diagnostics: TtsDiagnostics = {
      speakingRateApplied: prosody.applied.includes("speech_rate"),
      ...(audioConfig.speakingRate !== undefined
        ? { speakingRate: audioConfig.speakingRate }
        : {}),
      pitchApplied: prosody.applied.includes("pitch"),
      pauseControlApplied: markup.applied,
      pauseTagCount: markup.tagCount,
      customPronunciationsApplied:
        resolvedPronunciations.pronunciations.length,
      unsupportedSignals: prosody.unsupported.map(
        (u) => `${u.signal}:${u.reason}`,
      ),
      textSanitized: markup.sanitized,
    };

    const key = ttsCacheKey({
      provider: "google",
      text: markup.text,
      voiceId: voiceName,
      modelId,
      locale,
      // Every knob that changes the rendered audio belongs in the key.
      speechParams: {
        languageCode,
        audioConfig,
        inputField: markup.applied ? "markup" : "text",
        pronunciations: resolvedPronunciations.pronunciations,
      },
    });

    const cached = readTtsCache(key);
    if (cached) {
      return {
        body: cachedResultBody(cached),
        contentType: cached.contentType,
        voiceId: cached.voiceId,
        locale: cached.locale,
        modelId: cached.modelId,
        cached: true,
        streamed: false,
        provider: "google",
        diagnostics,
      };
    }

    let res: Response;
    try {
      res = await fetch(GOOGLE_TTS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...googleAuthHeaders(),
        },
        body: JSON.stringify({
          input,
          voice: { languageCode, name: voiceName },
          audioConfig,
        }),
        // Never let a hung provider stall the session (RT-03 / RT-S11-04).
        signal: AbortSignal.timeout(googleTtsTimeoutMs()),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      if (
        name === "TimeoutError" ||
        name === "AbortError" ||
        /aborted|timeout/i.test(msg)
      ) {
        throw new TtsError("Text-to-speech timed out", {
          code: "TTS_TIMEOUT",
          status: 504,
          detail: `timeout_ms=${googleTtsTimeoutMs()} voice=${voiceName}`,
        });
      }
      throw new TtsError("Text-to-speech transport failed", {
        code: "TTS_FAILED",
        status: 502,
        detail: msg.slice(0, 200),
      });
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw errorForStatus(
        res.status,
        `${detail.slice(0, 400)} [voice=${voiceName}]`,
      );
    }

    let payload: GoogleSynthesizeResponse;
    try {
      payload = (await res.json()) as GoogleSynthesizeResponse;
    } catch {
      throw new TtsError("Text-to-speech returned a malformed response", {
        code: "TTS_FAILED",
        status: 502,
        detail: "response body was not valid JSON",
      });
    }

    if (typeof payload.audioContent !== "string" || !payload.audioContent) {
      throw new TtsError("Text-to-speech returned no audio", {
        code: "TTS_FAILED",
        status: 502,
        detail: "missing audioContent",
      });
    }

    const buffer = decodeAudioContent(payload.audioContent);

    writeTtsCache(key, {
      buffer,
      contentType: CONTENT_TYPE_MP3,
      voiceId: voiceName,
      modelId,
      locale,
      provider: "google",
      createdAt: Date.now(),
    });

    if (prosody.unsupported.length > 0) {
      // Server-side diagnostic only — records which clinical signals Google
      // could not honor so benchmarking does not mistake them for applied.
      console.info(
        "[tts:google] unsupported clinical signals:",
        prosody.unsupported.map((u) => `${u.signal}(${u.reason})`).join(","),
      );
    }

    return {
      body: bufferToStream(buffer),
      contentType: CONTENT_TYPE_MP3,
      voiceId: voiceName,
      locale,
      modelId,
      cached: false,
      // REST text:synthesize returns a complete clip, not a stream.
      streamed: false,
      provider: "google",
      diagnostics,
    };
  },
};
