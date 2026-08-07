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
}): Promise<{ mode: "elevenlabs" | "browser"; objectUrl?: string }> {
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
    });

    if (res.ok && res.body) {
      // Consume the (possibly streamed) body into a playable blob.
      // MediaSource progressive playback is optional; blob keeps broad support.
      const blob = await new Response(res.body).blob();
      return { mode: "elevenlabs", objectUrl: URL.createObjectURL(blob) };
    }

    if (res.status !== 501) {
      console.warn("ElevenLabs TTS failed; falling back to browser.", res.status);
    }
  } catch (err) {
    console.warn("ElevenLabs TTS unavailable; falling back to browser.", err);
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
