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
import { voiceLog } from "@/lib/voice/voice-diagnostics";

/** Why ElevenLabs audio was not returned (safe — no provider payloads). */
export type TtsFailure = {
  status: number;
  code: string;
};

/**
 * Request TTS from /api/voice/tts with graceful browser fallback.
 * Does not break text mode — callers may ignore audio entirely.
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
  /**
   * Realtime progressive chunk (one sentence of a streaming reply). Uses the
   * TTS route's per-chunk budget and length cap instead of the full-reply one.
   */
  progressive?: boolean;
  /** Abort the TTS fetch (barge-in / stale turn). */
  signal?: AbortSignal;
}): Promise<{
  mode: "elevenlabs" | "browser";
  objectUrl?: string;
  /** Set when mode is "browser" because the TTS route did not return audio. */
  failure?: TtsFailure;
}> {
  let failure: TtsFailure = { status: 0, code: "NETWORK" };
  try {
    voiceLog("TTS", "request_started", {
      chars: params.text.length,
      locale: params.locale,
      progressive: Boolean(params.progressive),
    });
    const url = params.progressive
      ? "/api/voice/tts?progressive=1"
      : "/api/voice/tts";
    const res = await fetch(url, {
      method: "POST",
      signal: params.signal,
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
    });

    const contentType = res.headers.get("Content-Type") ?? "";
    voiceLog("TTS", "response_status", {
      status: res.status,
      content_type: contentType || "(none)",
      content_length: res.headers.get("Content-Length") ?? undefined,
    });

    if (res.ok && res.body && /^audio\//i.test(contentType)) {
      // Consume the (possibly streamed) body into a playable blob.
      // MediaSource progressive playback is optional; blob keeps broad support.
      const raw = await new Response(res.body).blob();
      voiceLog("TTS", "blob_size", { blob_size: raw.size });
      if (raw.size > 0) {
        // Keep the server's audio MIME so the <audio> element decodes it.
        const blob =
          raw.type === contentType.split(";")[0]
            ? raw
            : new Blob([raw], { type: contentType.split(";")[0] });
        const objectUrl = URL.createObjectURL(blob);
        voiceLog("TTS", "object_url_created");
        return { mode: "elevenlabs", objectUrl };
      }
      failure = { status: res.status, code: "TTS_BAD_CONTENT" };
    } else if (res.ok) {
      failure = { status: res.status, code: "TTS_BAD_CONTENT" };
    } else {
      const data = (await res.json().catch(() => ({}))) as { code?: unknown };
      failure = {
        status: res.status,
        code:
          res.status === 501
            ? "TTS_UNAVAILABLE"
            : typeof data.code === "string"
              ? data.code
              : "TTS_FAILED",
      };
    }

    if (params.signal?.aborted) return { mode: "browser" };
    if (res.status !== 501) {
      console.warn("ElevenLabs TTS failed; falling back to browser.", res.status);
    }
  } catch (err) {
    if (params.signal?.aborted) return { mode: "browser" };
    console.warn("ElevenLabs TTS unavailable; falling back to browser.", err);
  }

  voiceLog("TTS", "tts_failed", { status: failure.status, code: failure.code });
  return { mode: "browser", failure };
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
  if (
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    voiceLog("TTS", "browser_speech_unsupported");
    handlers.onerror?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = browserSpeechLocale(locale);
  utter.rate = browserSpeechRateForPace(normalizeSpeechPace(speechPace));

  // Chrome can silently drop an utterance (no voice for the language, no user
  // activation, speak() right after cancel()). Without a watchdog the turn
  // would wait forever in "speaking" with nothing audible.
  let started = false;
  let settled = false;
  const startTimer = window.setTimeout(() => {
    if (started || settled) return;
    settled = true;
    voiceLog("TTS", "browser_speech_failed", { reason: "never_started" });
    window.speechSynthesis.cancel();
    handlers.onerror?.();
  }, BROWSER_SPEECH_START_TIMEOUT_MS);
  // Long utterances in Chrome can stop without firing onend.
  const endTimer = window.setTimeout(
    () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(startTimer);
      window.speechSynthesis.cancel();
      if (started) handlers.onend?.();
      else handlers.onerror?.();
    },
    BROWSER_SPEECH_START_TIMEOUT_MS + text.length * 120 + 4000,
  );

  utter.onstart = () => {
    if (settled) return;
    started = true;
    window.clearTimeout(startTimer);
    voiceLog("TTS", "browser_speech_started");
    handlers.onstart?.();
  };
  utter.onend = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(startTimer);
    window.clearTimeout(endTimer);
    voiceLog("TTS", "browser_speech_ended");
    handlers.onend?.();
  };
  utter.onerror = (event) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(startTimer);
    window.clearTimeout(endTimer);
    voiceLog("TTS", "browser_speech_failed", {
      reason: (event as SpeechSynthesisErrorEvent | undefined)?.error ?? "error",
    });
    handlers.onerror?.();
  };
  window.speechSynthesis.speak(utter);
}

/** If browser speech has not started by now, treat it as failed. */
export const BROWSER_SPEECH_START_TIMEOUT_MS = 5000;

export function sessionLocaleFrom(
  sessionLanguage?: string | null,
  avatarLanguage?: string | null,
): SessionSpeechLocale {
  return normalizeSpeechLocale(sessionLanguage ?? avatarLanguage ?? "en");
}
