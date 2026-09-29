import {
  browserSpeechLocale,
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import {
  browserSpeechRateForPace,
  normalizeSpeechPace,
  type SpeechPace,
} from "@/lib/voice/prosody";
import { isAbortError } from "@/lib/voice/turn-fence";
import { patchForensicChunk } from "@/lib/voice/ios-playback-forensics";

export type SynthesizeSpeechResult = {
  mode: "elevenlabs" | "browser" | "interrupted";
  objectUrl?: string;
  /** Phase 9.2S — diagnostic only; never log body bytes. */
  forensic?: {
    status: number;
    contentType: string | null;
    byteLength: number;
    blobType: string;
  };
};

/**
 * Request TTS from /api/voice/tts with graceful browser fallback.
 * Does not break text mode — callers may ignore audio entirely.
 *
 * Phase 9.1 — AbortSignal cancels the browser fetch. The Next.js route may
 * still finish upstream ElevenLabs work after the client disconnects; that is
 * a documented infrastructure limit. The client must never attach/play audio
 * for an aborted or superseded turn.
 */
export async function synthesizeSpeech(params: {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  /** Mission 3 — clinical emotion live switch. */
  emotion?: string | null;
  /** Mission 10 — optional Humanization / HCE prosody overrides. */
  stability?: number | null;
  style?: number | null;
  /** Cancel in-flight TTS fetch (barge-in / turn supersede). */
  signal?: AbortSignal;
  /** Phase 9.2S — optional chunk index for forensic dump (no content logged). */
  forensicChunkIndex?: number;
}): Promise<SynthesizeSpeechResult> {
  if (params.signal?.aborted) {
    return { mode: "interrupted" };
  }

  const chunkIndex = params.forensicChunkIndex;
  if (chunkIndex != null) {
    patchForensicChunk(
      chunkIndex,
      { tts_request_start: performance.now() },
      "tts_request_start",
    );
  }

  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: params.text,
        locale: params.locale,
        voiceId: params.voiceId ?? undefined,
        voiceIdAr: params.voiceIdAr ?? undefined,
        voiceProfileId: params.voiceProfileId ?? undefined,
        avatarId: params.avatarId ?? undefined,
        speechPace: params.speechPace ?? undefined,
        speechEnergy: params.speechEnergy ?? undefined,
        disorderSlug: params.disorderSlug ?? undefined,
        emotion: params.emotion ?? undefined,
        stability: params.stability ?? undefined,
        style: params.style ?? undefined,
        stream: true,
      }),
      signal: params.signal,
    });

    if (params.signal?.aborted) {
      return { mode: "interrupted" };
    }

    const contentType = res.headers.get("content-type");

    if (res.ok && res.body) {
      // Consume the (possibly streamed) body into a playable blob.
      // MediaSource progressive playback is optional; blob keeps broad support.
      //
      // Phase 9.2S NOTE (diagnostic, not a fix): wrapping `res.body` in a new
      // `Response` without Content-Type may yield `blob.type === ""`. Chromium
      // often still decodes; iOS Safari is stricter. Forensic fields capture
      // header content-type vs blob.type for the real-device pass.
      const blob = await new Response(res.body).blob();
      if (params.signal?.aborted) {
        return { mode: "interrupted" };
      }
      const objectUrl = URL.createObjectURL(blob);
      const forensic = {
        status: res.status,
        contentType,
        byteLength: blob.size,
        blobType: blob.type,
      };
      if (chunkIndex != null) {
        patchForensicChunk(
          chunkIndex,
          {
            tts_response_status: forensic.status,
            tts_content_type: forensic.contentType,
            tts_byte_length: forensic.byteLength,
            blob_created: true,
            blob_type: forensic.blobType,
            object_url_created: Boolean(objectUrl),
          },
          "tts_response",
        );
      }
      return { mode: "elevenlabs", objectUrl, forensic };
    }

    if (chunkIndex != null) {
      patchForensicChunk(
        chunkIndex,
        {
          tts_response_status: res.status,
          tts_content_type: contentType,
          tts_byte_length: 0,
          blob_created: false,
          object_url_created: false,
        },
        "tts_response",
      );
    }

    if (res.status !== 501) {
      console.warn("ElevenLabs TTS failed; falling back to browser.", res.status);
    }
  } catch (err) {
    if (params.signal?.aborted || isAbortError(err)) {
      return { mode: "interrupted" };
    }
    console.warn("ElevenLabs TTS unavailable; falling back to browser.", err);
  }

  if (params.signal?.aborted) {
    return { mode: "interrupted" };
  }

  return { mode: "browser" };
}

export function speakWithBrowser(
  text: string,
  locale: SessionSpeechLocale,
  handlers: {
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
  },
  speechPace?: SpeechPace | string | null,
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    handlers.onerror?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = browserSpeechLocale(locale);
  utter.rate = browserSpeechRateForPace(normalizeSpeechPace(speechPace));
  utter.onstart = () => handlers.onstart?.();
  utter.onend = () => handlers.onend?.();
  utter.onerror = () => handlers.onerror?.();
  window.speechSynthesis.speak(utter);
}

export function sessionLocaleFrom(
  sessionLanguage?: string | null,
  avatarLanguage?: string | null,
): SessionSpeechLocale {
  return normalizeSpeechLocale(sessionLanguage ?? avatarLanguage ?? "en");
}
