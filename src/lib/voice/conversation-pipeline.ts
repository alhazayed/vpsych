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
import { chunkTextForSpeechPlayback } from "@/lib/voice/speech-chunker";
import {
  DEFAULT_TTS_IN_FLIGHT,
  playQueuedSpeech,
  type SpeechQueueMetrics,
  type SpeechQueuePlaybackPath,
} from "@/lib/voice/speech-queue";

export type { SessionSpeechLocale } from "@/lib/voice/pipeline-types";
export type { SessionMessage };
export type { VoiceTurnId } from "@/lib/voice/turn-fence";
export {
  createVoiceTurnFence,
  isStaleVoiceResult,
} from "@/lib/voice/turn-fence";
export { chunkTextForSpeechPlayback } from "@/lib/voice/speech-chunker";
export {
  DEFAULT_TTS_IN_FLIGHT,
  playQueuedSpeech,
} from "@/lib/voice/speech-queue";

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

export type PlayPatientSpeechResult = {
  mode: "elevenlabs" | "browser" | "interrupted";
  /** Explicit path — never claim progressive when legacy Blob was used. */
  playbackPath: SpeechQueuePlaybackPath;
  metrics: SpeechQueueMetrics & {
    /** Humanization pause applied once before first TTS (ms). */
    pauseBeforeAppliedMs: number;
  };
};

function emptyPlayResult(
  mode: PlayPatientSpeechResult["mode"],
  playbackPath: SpeechQueuePlaybackPath,
  pauseBeforeAppliedMs = 0,
): PlayPatientSpeechResult {
  return {
    mode,
    playbackPath,
    metrics: {
      ttsFirstChunkReadyMs: null,
      ttsFirstAudioPlayMs: null,
      ttsTotalGenerationMs: null,
      totalPatientAudioDurationMs: null,
      chunkCount: 0,
      chunksPlayed: 0,
      playbackPath,
      pauseBeforeAppliedMs,
    },
  };
}

/**
 * Stages 3–4 — ElevenLabs speech → browser audio, with browser TTS fallback.
 *
 * Phase 9.2 — progressive sentence/phrase queue by default:
 * chunk text → bounded concurrent TTS → play first chunk ASAP.
 * Humanization `pauseBeforeMs` applies **once** before the first chunk only.
 *
 * Phase 9.1 — AbortSignal + VoiceTurnGuard still gate playback.
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
  /**
   * Mission 10 — intentional humanization pause before **first** audio only.
   * Never applied between progressive chunks.
   */
  pauseBeforeMs?: number | null;
  audioRef?: { current: HTMLAudioElement | null };
  handlers?: SpeakHandlers;
  /** Abort cancels TTS fetches + playback (barge-in / pause / end). */
  signal?: AbortSignal;
  /** Turn fence — late results from superseded turns never play. */
  turn?: VoiceTurnGuard;
  /**
   * Force legacy whole-utterance Blob playback (A/B / fallback).
   * Default uses progressive queue when the reply chunks into ≥1 segments.
   */
  preferPlayback?: "progressive_queue" | "legacy_blob";
  /** Override TTS in-flight bound (tests). */
  maxTtsInFlight?: number;
  onQueueEvent?: Parameters<typeof playQueuedSpeech>[0]["onEvent"];
}): Promise<PlayPatientSpeechResult> {
  const handlers = params.handlers ?? {};
  const stale = () => isGuardStale(params.turn, params.signal);

  if (stale()) {
    handlers.onerror?.();
    return emptyPlayResult("interrupted", "interrupted");
  }

  // Humanization pause: once, before any TTS — not per sentence.
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
      return emptyPlayResult("interrupted", "interrupted", pauseMs);
    }
  }

  if (stale()) {
    handlers.onerror?.();
    return emptyPlayResult("interrupted", "interrupted", pauseMs);
  }

  const ttsParams = {
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
  };

  const playLegacyBlob = async (): Promise<PlayPatientSpeechResult> => {
    const t0 = performance.now();
    handlers.onstart?.();
    const result = await synthesizeSpeech({
      ...ttsParams,
      text: params.text,
      signal: params.signal,
    });

    if (stale() || result.mode === "interrupted") {
      if (result.mode === "elevenlabs" && result.objectUrl) {
        URL.revokeObjectURL(result.objectUrl);
      }
      handlers.onerror?.();
      return emptyPlayResult("interrupted", "interrupted", pauseMs);
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
      if (stale()) {
        URL.revokeObjectURL(result.objectUrl);
        handlers.onerror?.();
        return emptyPlayResult("interrupted", "interrupted", pauseMs);
      }

      const readyMs = Math.max(0, Math.round(performance.now() - t0));
      const audio = new Audio(result.objectUrl);
      if (params.audioRef) params.audioRef.current = audio;

      return await new Promise<PlayPatientSpeechResult>((resolve) => {
        let settled = false;
        const playStarted = performance.now();
        const finish = (mode: "elevenlabs" | "browser" | "interrupted") => {
          if (settled) return;
          settled = true;
          params.signal?.removeEventListener("abort", onAbort);
          URL.revokeObjectURL(result.objectUrl!);
          if (params.audioRef) params.audioRef.current = null;
          const playMs = Math.max(0, Math.round(performance.now() - playStarted));
          if (mode === "elevenlabs") handlers.onend?.();
          else if (mode === "interrupted") handlers.onerror?.();
          const path: SpeechQueuePlaybackPath =
            mode === "elevenlabs"
              ? "legacy_blob"
              : mode === "browser"
                ? "browser"
                : "interrupted";
          resolve({
            mode,
            playbackPath: path,
            metrics: {
              ttsFirstChunkReadyMs: mode === "interrupted" ? null : readyMs,
              ttsFirstAudioPlayMs: mode === "interrupted" ? null : readyMs,
              ttsTotalGenerationMs: mode === "interrupted" ? null : readyMs,
              totalPatientAudioDurationMs:
                mode === "elevenlabs" ? playMs : null,
              chunkCount: 1,
              chunksPlayed: mode === "elevenlabs" ? 1 : 0,
              playbackPath: path,
              pauseBeforeAppliedMs: pauseMs,
            },
          });
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
      });
    }

    if (stale()) {
      handlers.onerror?.();
      return emptyPlayResult("interrupted", "interrupted", pauseMs);
    }

    return await new Promise<PlayPatientSpeechResult>((resolve) => {
      let settled = false;
      const finish = (mode: "browser" | "interrupted") => {
        if (settled) return;
        settled = true;
        params.signal?.removeEventListener("abort", onAbort);
        if (mode === "interrupted") handlers.onerror?.();
        else handlers.onend?.();
        resolve(
          emptyPlayResult(
            mode,
            mode === "browser" ? "browser" : "interrupted",
            pauseMs,
          ),
        );
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
  };

  if (params.preferPlayback === "legacy_blob") {
    return playLegacyBlob();
  }

  const chunks = chunkTextForSpeechPlayback(params.text);
  if (chunks.length === 0) {
    handlers.onerror?.();
    return emptyPlayResult("interrupted", "interrupted", pauseMs);
  }

  const queued = await playQueuedSpeech({
    chunks,
    maxInFlight: params.maxTtsInFlight ?? DEFAULT_TTS_IN_FLIGHT,
    signal: params.signal,
    turn: params.turn,
    audioRef: params.audioRef,
    handlers,
    onEvent: params.onQueueEvent,
    synthesizeChunk: async (text, _index, signal) => {
      const result = await synthesizeSpeech({
        ...ttsParams,
        text,
        signal,
      });
      if (result.mode === "interrupted") {
        return { ok: false, reason: "interrupted" };
      }
      if (result.mode === "elevenlabs" && result.objectUrl) {
        return { ok: true, objectUrl: result.objectUrl };
      }
      return { ok: false, reason: "failed" };
    },
  });

  // First-chunk hard failure → explicit legacy Blob fallback (not silent).
  if (
    queued.playbackPath === "interrupted" &&
    queued.metrics.chunksPlayed === 0 &&
    !stale() &&
    !params.signal?.aborted
  ) {
    const legacy = await playLegacyBlob();
    return {
      ...legacy,
      // Keep explicit diagnostics: fallback used after progressive failure.
      playbackPath:
        legacy.playbackPath === "legacy_blob" ||
        legacy.playbackPath === "browser"
          ? legacy.playbackPath
          : legacy.playbackPath,
      metrics: {
        ...legacy.metrics,
        pauseBeforeAppliedMs: pauseMs,
      },
    };
  }

  return {
    mode: queued.mode === "elevenlabs" ? "elevenlabs" : "interrupted",
    playbackPath: queued.playbackPath,
    metrics: {
      ...queued.metrics,
      pauseBeforeAppliedMs: pauseMs,
    },
  };
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
