import {
  browserSpeechLocale,
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";

/**
 * Consume a streamed TTS body into a playable object URL.
 * Prefer res.blob() (streams into memory once) over buffering wrappers.
 */
export async function objectUrlFromAudioResponse(
  res: Response,
): Promise<string> {
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * First speakable sentence/clause for low-latency lead-in TTS.
 * Full reply can follow as a second clip when longer than this budget.
 */
export function ttsLeadInText(text: string, maxChars = 180): {
  lead: string;
  rest: string;
} {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return { lead: trimmed, rest: "" };

  const window = trimmed.slice(0, maxChars + 1);
  const breakAt = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("。"),
    window.lastIndexOf("؟"),
    window.lastIndexOf("\n"),
  );
  if (breakAt >= 24) {
    return {
      lead: trimmed.slice(0, breakAt + 1).trim(),
      rest: trimmed.slice(breakAt + 1).trim(),
    };
  }
  const space = window.lastIndexOf(" ");
  if (space >= 24) {
    return {
      lead: trimmed.slice(0, space).trim(),
      rest: trimmed.slice(space).trim(),
    };
  }
  return { lead: trimmed.slice(0, maxChars).trim(), rest: trimmed.slice(maxChars).trim() };
}

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
        stream: true,
      }),
    });

    if (res.ok && res.body) {
      const objectUrl = await objectUrlFromAudioResponse(res);
      return { mode: "elevenlabs", objectUrl };
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
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    handlers.onerror?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = browserSpeechLocale(locale);
  utter.rate = 0.95;
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
