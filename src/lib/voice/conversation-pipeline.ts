/**
 * End-to-end multilingual conversation pipeline (client orchestration).
 *
 * Therapist Speech
 *   → OpenAI Speech-to-Text
 *   → GPT-5 Patient (/api/sessions/:id/message)
 *   → ElevenLabs Speech
 *   → Browser Audio
 *
 * Text-only sessions skip STT + TTS and call the same message API.
 * Voice mode is optional; transcript persistence always happens server-side.
 */

import {
  sessionLocaleFrom,
  synthesizeSpeech,
  speakWithBrowser,
} from "@/lib/voice/client";
import { transcribeWithOpenAI } from "@/lib/voice/transcribe-client";
import type { SessionMessage, SessionSpeechLocale } from "@/lib/voice/pipeline-types";

export type { SessionSpeechLocale } from "@/lib/voice/pipeline-types";
export type { SessionMessage };

export type PipelineTurnResult = {
  userMessage: SessionMessage;
  assistantMessage: SessionMessage;
  remainingSeconds?: number;
  locale: SessionSpeechLocale;
};

export type SpeakHandlers = {
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
};

/** Resolve session speech locale from session.language (en | ar). */
export function resolvePipelineLocale(
  sessionLanguage?: string | null,
  avatarLanguage?: string | null,
): SessionSpeechLocale {
  return sessionLocaleFrom(sessionLanguage, avatarLanguage);
}

/**
 * Stage 1 — Therapist speech → OpenAI STT transcript.
 * Preserves Voice Session upload contract (audio + locale).
 */
export async function transcribeTherapistSpeech(params: {
  audio: Blob;
  /** session.language */
  locale: string;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; transcript: string; provider?: string }
  | { ok: false; error: string; unavailable: boolean; code?: string }
> {
  const result = await transcribeWithOpenAI({
    audio: params.audio,
    locale: params.locale,
    signal: params.signal,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      unavailable: result.unavailable,
      code: result.code,
    };
  }
  return {
    ok: true,
    transcript: result.transcript,
    provider: result.provider,
  };
}

/**
 * Stage 2 — Persist therapist message, generate GPT-5 patient reply,
 * persist patient message (with timestamps via created_at).
 * Same API for voice and text-only turns.
 */
export async function submitConversationTurn(params: {
  sessionId: string;
  message: string;
}): Promise<
  | { ok: true; data: PipelineTurnResult }
  | { ok: false; error: string; expired?: boolean; status: number }
> {
  const res = await fetch(`/api/sessions/${params.sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: params.message }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    expired?: boolean;
    userMessage?: SessionMessage;
    assistantMessage?: SessionMessage;
    remainingSeconds?: number;
    locale?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? "Failed to send message",
      expired: Boolean(data.expired),
      status: res.status,
    };
  }

  if (!data.userMessage || !data.assistantMessage) {
    return {
      ok: false,
      error: "Incomplete message response",
      status: 502,
    };
  }

  return {
    ok: true,
    data: {
      userMessage: data.userMessage,
      assistantMessage: data.assistantMessage,
      remainingSeconds: data.remainingSeconds,
      locale: resolvePipelineLocale(data.locale),
    },
  };
}

/**
 * Stages 3–4 — ElevenLabs speech → browser audio, with browser TTS fallback.
 * No-op safe when voice is disabled by the caller.
 */
export async function playPatientSpeech(params: {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  audioRef?: { current: HTMLAudioElement | null };
  handlers?: SpeakHandlers;
}): Promise<"elevenlabs" | "browser"> {
  const handlers = params.handlers ?? {};
  handlers.onstart?.();

  const result = await synthesizeSpeech({
    text: params.text,
    locale: params.locale,
    voiceId: params.voiceId,
    voiceIdAr: params.voiceIdAr,
    voiceProfileId: params.voiceProfileId,
    avatarId: params.avatarId,
  });

  if (result.mode === "elevenlabs" && result.objectUrl) {
    const audio = new Audio(result.objectUrl);
    if (params.audioRef) params.audioRef.current = audio;

    return await new Promise<"elevenlabs" | "browser">((resolve) => {
      let settled = false;
      const finish = (mode: "elevenlabs" | "browser") => {
        if (settled) return;
        settled = true;
        URL.revokeObjectURL(result.objectUrl!);
        if (params.audioRef) params.audioRef.current = null;
        if (mode === "elevenlabs") handlers.onend?.();
        resolve(mode);
      };

      audio.onended = () => finish("elevenlabs");
      audio.onerror = () => {
        speakWithBrowser(params.text, params.locale, {
          onstart: handlers.onstart,
          onend: () => {
            handlers.onend?.();
            finish("browser");
          },
          onerror: () => {
            handlers.onerror?.();
            finish("browser");
          },
        });
      };

      void audio.play().catch(() => {
        speakWithBrowser(params.text, params.locale, {
          onstart: handlers.onstart,
          onend: () => {
            handlers.onend?.();
            finish("browser");
          },
          onerror: () => {
            handlers.onerror?.();
            finish("browser");
          },
        });
      });
    });
  }

  speakWithBrowser(params.text, params.locale, {
    onstart: handlers.onstart,
    onend: handlers.onend,
    onerror: handlers.onerror,
  });
  return "browser";
}

/**
 * Full voice turn: STT → message API (GPT-5 + persistence) → optional TTS.
 * Text-only callers should use `submitConversationTurn` directly.
 */
export async function runVoiceConversationTurn(params: {
  sessionId: string;
  audio: Blob;
  sessionLanguage?: string | null;
  locale: SessionSpeechLocale;
  voiceEnabled: boolean;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  audioRef?: { current: HTMLAudioElement | null };
  onTranscript?: (transcript: string) => void;
  onMessages?: (user: SessionMessage, assistant: SessionMessage) => void;
  speakHandlers?: SpeakHandlers;
}): Promise<
  | { ok: true; turn: PipelineTurnResult; transcript: string }
  | {
      ok: false;
      stage: "stt" | "message";
      error: string;
      unavailable?: boolean;
      expired?: boolean;
    }
> {
  const stt = await transcribeTherapistSpeech({
    audio: params.audio,
    locale: params.sessionLanguage ?? params.locale,
  });

  if (!stt.ok) {
    return {
      ok: false,
      stage: "stt",
      error: stt.error,
      unavailable: stt.unavailable,
    };
  }

  const transcript = stt.transcript.trim();
  if (!transcript) {
    return {
      ok: false,
      stage: "stt",
      error: "No speech detected",
    };
  }

  params.onTranscript?.(transcript);

  const turn = await submitConversationTurn({
    sessionId: params.sessionId,
    message: transcript,
  });

  if (!turn.ok) {
    return {
      ok: false,
      stage: "message",
      error: turn.error,
      expired: turn.expired,
    };
  }

  params.onMessages?.(turn.data.userMessage, turn.data.assistantMessage);

  if (params.voiceEnabled) {
    void playPatientSpeech({
      text: turn.data.assistantMessage.content,
      locale: params.locale,
      voiceId: params.voiceId,
      voiceIdAr: params.voiceIdAr,
      voiceProfileId: params.voiceProfileId,
      avatarId: params.avatarId,
      audioRef: params.audioRef,
      handlers: params.speakHandlers,
    });
  }

  return { ok: true, turn: turn.data, transcript };
}
