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
  /** Segment continuity so a multi-segment turn sounds like one utterance. */
  previousText?: string | null;
  nextText?: string | null;
  seed?: number | null;
  signal?: AbortSignal;
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
        previousText: params.previousText ?? undefined,
        nextText: params.nextText ?? undefined,
        seed: params.seed ?? undefined,
        stream: true,
      }),
      signal: params.signal,
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

/**
 * Stop patient audio with a short volume ramp instead of a hard cut.
 * Used for barge-in: an abrupt `pause()` produces an audible click, which reads
 * as a glitch rather than as the patient yielding the floor.
 */
export function fadeOutAudio(audio: HTMLAudioElement, fadeMs = 120): void {
  const steps = 6;
  const stepMs = Math.max(1, Math.round(fadeMs / steps));
  const startVolume = audio.volume;
  let step = 0;

  const hardStop = () => {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {
      /* ignore */
    }
  };

  if (fadeMs <= 0) {
    hardStop();
    return;
  }

  const timer = setInterval(() => {
    step += 1;
    const next = startVolume * (1 - step / steps);
    try {
      audio.volume = Math.max(0, next);
    } catch {
      /* ignore */
    }
    if (step >= steps) {
      clearInterval(timer);
      hardStop();
    }
  }, stepMs);
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
