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
 *
 * Phase 9.1 — turn fencing + AbortSignal:
 * Late results from superseded turns must not play audio or update active UI.
 * Clinical cognition remains owned exclusively by the message API.
 */

import {
  sessionLocaleFrom,
  synthesizeSpeech,
  speakWithBrowser,
} from "@/lib/voice/client";
import { transcribeWithOpenAI } from "@/lib/voice/transcribe-client";
import type { SessionMessage, SessionSpeechLocale } from "@/lib/voice/pipeline-types";
import {
  isStaleVoiceResult,
  type VoiceTurnId,
} from "@/lib/voice/turn-fence";

export type { SessionSpeechLocale } from "@/lib/voice/pipeline-types";
export type { SessionMessage };
export type { VoiceTurnId } from "@/lib/voice/turn-fence";
export {
  createVoiceTurnFence,
  isStaleVoiceResult,
} from "@/lib/voice/turn-fence";

export type PipelineTurnResult = {
  userMessage: SessionMessage;
  assistantMessage: SessionMessage;
  remainingSeconds?: number;
  locale: SessionSpeechLocale;
  /** Mission 10 — additive Humanization / Voice Engine hints. */
  voiceHints?: {
    pause_before_ms?: number;
    speech_rate?: number;
    stability?: number;
    style?: number;
    speech_pace?: string;
    speech_energy?: string;
  } | null;
  humanizationEnabled?: boolean;
};

export type SpeakHandlers = {
  onstart?: () => void;
  onend?: () => void;
  onerror?: () => void;
};

/** Optional turn fence attached to async voice work. */
export type VoiceTurnGuard = {
  turnId: VoiceTurnId;
  isActive: (turnId: VoiceTurnId) => boolean;
};

function isGuardStale(
  guard: VoiceTurnGuard | undefined,
  signal?: AbortSignal,
): boolean {
  if (!guard) return Boolean(signal?.aborted);
  return isStaleVoiceResult({
    turnId: guard.turnId,
    isActive: guard.isActive,
    signal,
  });
}

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
  /** Stage 11 / RT-06 / Phase 9.1 — therapist barge-in cut off the prior patient turn. */
  therapistInterrupted?: boolean;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; data: PipelineTurnResult }
  | {
      ok: false;
      error: string;
      expired?: boolean;
      status: number;
      aborted?: boolean;
      /** Phase 9.1S — server rejected stale assistant persist. */
      superseded?: boolean;
    }
> {
  try {
    const res = await fetch(`/api/sessions/${params.sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: params.message,
        ...(params.therapistInterrupted
          ? { therapistInterrupted: true }
          : {}),
      }),
      signal: params.signal,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      expired?: boolean;
      superseded?: boolean;
      aborted?: boolean;
      userMessage?: SessionMessage;
      assistantMessage?: SessionMessage;
      remainingSeconds?: number;
      locale?: string;
      voiceHints?: PipelineTurnResult["voiceHints"];
      humanizationEnabled?: boolean;
    };

    if (!res.ok) {
      const superseded =
        Boolean(data.superseded) ||
        (res.status === 409 &&
          /superseded/i.test(String(data.error ?? "")));
      return {
        ok: false,
        error: data.error ?? "Failed to send message",
        expired: Boolean(data.expired),
        status: res.status,
        superseded,
        // Treat superseded like a cancelled/stale outcome for UI fencing.
        aborted: Boolean(data.aborted) || superseded,
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
        voiceHints: data.voiceHints ?? null,
        humanizationEnabled: Boolean(data.humanizationEnabled),
      },
    };
  } catch (error) {
    if (params.signal?.aborted) {
      return {
        ok: false,
        error: "aborted",
        status: 0,
        aborted: true,
      };
    }
    throw error;
  }
}

/**
 * Stages 3–4 — ElevenLabs speech → browser audio, with browser TTS fallback.
 * No-op safe when voice is disabled by the caller.
 *
 * Phase 9.1 — passes AbortSignal into synthesizeSpeech and rejects stale turns
 * via VoiceTurnGuard before attaching/playing audio.
 */
export async function playPatientSpeech(params: {
  text: string;
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  emotion?: string | null;
  stability?: number | null;
  style?: number | null;
  /** Mission 10 — thinking pause before first audio. */
  pauseBeforeMs?: number | null;
  audioRef?: { current: HTMLAudioElement | null };
  handlers?: SpeakHandlers;
  /** Abort cancels ElevenLabs fetch + browser playback (barge-in / pause / end). */
  signal?: AbortSignal;
  /** Turn fence — late results from superseded turns never play. */
  turn?: VoiceTurnGuard;
}): Promise<"elevenlabs" | "browser" | "interrupted"> {
  const handlers = params.handlers ?? {};
  const stale = () => isGuardStale(params.turn, params.signal);

  if (stale()) {
    handlers.onerror?.();
    return "interrupted";
  }

  const pauseMs = Math.max(0, Math.min(6000, params.pauseBeforeMs ?? 0));
  if (pauseMs > 0) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pauseMs);
      params.signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    if (stale()) {
      handlers.onerror?.();
      return "interrupted";
    }
  }

  if (stale()) {
    handlers.onerror?.();
    return "interrupted";
  }

  handlers.onstart?.();

  const result = await synthesizeSpeech({
    text: params.text,
    locale: params.locale,
    voiceId: params.voiceId,
    voiceIdAr: params.voiceIdAr,
    voiceProfileId: params.voiceProfileId,
    avatarId: params.avatarId,
    speechPace: params.speechPace,
    speechEnergy: params.speechEnergy,
    disorderSlug: params.disorderSlug,
    emotion: params.emotion,
    stability: params.stability,
    style: params.style,
    signal: params.signal,
  });

  if (stale() || result.mode === "interrupted") {
    if (result.mode === "elevenlabs" && result.objectUrl) {
      URL.revokeObjectURL(result.objectUrl);
    }
    handlers.onerror?.();
    return "interrupted";
  }

  const browserFallback = (onDone: () => void) => {
    if (stale()) {
      onDone();
      return;
    }
    speakWithBrowser(
      params.text,
      params.locale,
      {
        onstart: handlers.onstart,
        onend: () => {
          handlers.onend?.();
          onDone();
        },
        onerror: () => {
          handlers.onerror?.();
          onDone();
        },
      },
      params.speechPace,
    );
  };

  if (result.mode === "elevenlabs" && result.objectUrl) {
    // Re-check after blob creation — turn may have been superseded mid-download.
    if (stale()) {
      URL.revokeObjectURL(result.objectUrl);
      handlers.onerror?.();
      return "interrupted";
    }

    const audio = new Audio(result.objectUrl);
    if (params.audioRef) params.audioRef.current = audio;

    return await new Promise<"elevenlabs" | "browser" | "interrupted">(
      (resolve) => {
        let settled = false;
        const finish = (mode: "elevenlabs" | "browser" | "interrupted") => {
          if (settled) return;
          settled = true;
          params.signal?.removeEventListener("abort", onAbort);
          URL.revokeObjectURL(result.objectUrl!);
          if (params.audioRef) params.audioRef.current = null;
          if (mode === "elevenlabs") handlers.onend?.();
          else if (mode === "interrupted") handlers.onerror?.();
          resolve(mode);
        };

        const onAbort = () => {
          try {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
          } catch {
            /* ignore */
          }
          window.speechSynthesis?.cancel();
          finish("interrupted");
        };

        audio.onended = () => {
          if (stale()) {
            finish("interrupted");
            return;
          }
          finish("elevenlabs");
        };
        audio.onerror = () => {
          if (stale()) {
            finish("interrupted");
            return;
          }
          browserFallback(() => finish("browser"));
        };

        params.signal?.addEventListener("abort", onAbort, { once: true });

        void audio.play().catch(() => {
          if (stale()) {
            finish("interrupted");
            return;
          }
          browserFallback(() => finish("browser"));
        });
      },
    );
  }

  if (stale()) {
    handlers.onerror?.();
    return "interrupted";
  }

  return await new Promise<"browser" | "interrupted">((resolve) => {
    let settled = false;
    const finish = (mode: "browser" | "interrupted") => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener("abort", onAbort);
      if (mode === "interrupted") handlers.onerror?.();
      else handlers.onend?.();
      resolve(mode);
    };
    const onAbort = () => {
      window.speechSynthesis?.cancel();
      finish("interrupted");
    };
    params.signal?.addEventListener("abort", onAbort, { once: true });
    speakWithBrowser(
      params.text,
      params.locale,
      {
        onstart: handlers.onstart,
        onend: () => {
          if (stale()) finish("interrupted");
          else finish("browser");
        },
        onerror: () => {
          if (stale()) finish("interrupted");
          else {
            handlers.onerror?.();
            finish("browser");
          }
        },
      },
      params.speechPace,
    );
  });
}

/**
 * Full voice turn: STT → message API (GPT-5 + persistence) → optional TTS.
 * Text-only callers should use `submitConversationTurn` directly.
 *
 * Phase 9.1 — supports AbortSignal, therapistInterrupted, and turn fencing.
 * Stale turns never call onMessages / playPatientSpeech.
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
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  emotion?: string | null;
  audioRef?: { current: HTMLAudioElement | null };
  onTranscript?: (transcript: string) => void;
  onMessages?: (user: SessionMessage, assistant: SessionMessage) => void;
  speakHandlers?: SpeakHandlers;
  signal?: AbortSignal;
  /** True when this therapist utterance cut off prior patient speech. */
  therapistInterrupted?: boolean;
  /**
   * Called only after a non-empty transcript is ready and immediately before
   * submitConversationTurn — use to consume the interrupt latch (Phase 9.1R).
   * Not called on empty/no-speech STT.
   */
  onValidTurnSubmit?: () => void;
  /** Active turn identity for stale-result rejection. */
  turn?: VoiceTurnGuard;
  /** AbortController used for TTS playback (separate from STT/message abort). */
  playbackSignal?: AbortSignal;
}): Promise<
  | { ok: true; turn: PipelineTurnResult; transcript: string }
  | {
      ok: false;
      stage: "stt" | "message" | "cancelled";
      error: string;
      unavailable?: boolean;
      expired?: boolean;
    }
> {
  const stale = () => isGuardStale(params.turn, params.signal);

  if (stale()) {
    return { ok: false, stage: "cancelled", error: "Turn superseded" };
  }

  const stt = await transcribeTherapistSpeech({
    audio: params.audio,
    locale: params.sessionLanguage ?? params.locale,
    signal: params.signal,
  });

  if (stale()) {
    return { ok: false, stage: "cancelled", error: "Turn superseded" };
  }

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

  if (!stale()) {
    params.onTranscript?.(transcript);
  }

  // Consume interrupt latch only for a valid replacement turn (Phase 9.1R).
  params.onValidTurnSubmit?.();

  const turn = await submitConversationTurn({
    sessionId: params.sessionId,
    message: transcript,
    therapistInterrupted: params.therapistInterrupted,
    signal: params.signal,
  });

  if (stale() || (turn.ok === false && turn.aborted)) {
    return { ok: false, stage: "cancelled", error: "Turn superseded" };
  }

  if (!turn.ok) {
    return {
      ok: false,
      stage: "message",
      error: turn.error,
      expired: turn.expired,
    };
  }

  // Server may have persisted; client must still drop superseded UI/playback.
  if (stale()) {
    return { ok: false, stage: "cancelled", error: "Turn superseded" };
  }

  params.onMessages?.(turn.data.userMessage, turn.data.assistantMessage);

  if (params.voiceEnabled) {
    if (stale()) {
      return { ok: false, stage: "cancelled", error: "Turn superseded" };
    }
    const hints = turn.data.voiceHints;
    void playPatientSpeech({
      text: turn.data.assistantMessage.content,
      locale: params.locale,
      voiceId: params.voiceId,
      voiceIdAr: params.voiceIdAr,
      voiceProfileId: params.voiceProfileId,
      avatarId: params.avatarId,
      speechPace: hints?.speech_pace ?? params.speechPace,
      speechEnergy: hints?.speech_energy ?? params.speechEnergy,
      disorderSlug: params.disorderSlug,
      emotion: params.emotion,
      stability: hints?.stability ?? null,
      style: hints?.style ?? null,
      pauseBeforeMs: hints?.pause_before_ms ?? null,
      audioRef: params.audioRef,
      handlers: params.speakHandlers,
      signal: params.playbackSignal ?? params.signal,
      turn: params.turn,
    });
  }

  return { ok: true, turn: turn.data, transcript };
}
