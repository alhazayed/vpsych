import {
  browserSpeechLocale,
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";

export async function synthesizeSpeech(params: {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
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
      }),
    });

    if (res.ok) {
      const blob = await res.blob();
      return { mode: "elevenlabs", objectUrl: URL.createObjectURL(blob) };
    }

    if (res.status !== 501) {
      // Non-config errors still fall back to browser TTS.
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
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    handlers.onerror?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = browserSpeechLocale(locale);
  utter.rate = locale === "ar" ? 0.95 : 0.95;
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
