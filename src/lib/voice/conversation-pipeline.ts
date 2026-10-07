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
import {
  PLAYBACK_WATCHDOG_INTERVAL_MS,
  playbackVerdict,
} from "@/lib/voice/playback-watchdog";
import type { AudioStreamHandle } from "@/lib/voice/stream-playback";
import { transcribeWithOpenAI } from "@/lib/voice/transcribe-client";
import type { SessionMessage, SessionSpeechLocale } from "@/lib/voice/pipeline-types";

export type { SessionSpeechLocale } from "@/lib/voice/pipeline-types";
export type { SessionMessage };

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
  /** gpt | gateway | persona_fallback — a fallback is never a model reply. */
  aiSource?: string | null;
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
  | {
      ok: false;
      error: string;
      unavailable: boolean;
      code?: string;
      /** HTTP status from /api/voice/transcribe (0 = network / not sent). */
      status?: number;
    }
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
      status: result.status,
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
  /** Stage 11 / RT-06 — therapist barge-in cut off the prior patient turn. */
  therapistInterrupted?: boolean;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; data: PipelineTurnResult }
  | {
      ok: false;
      error: string;
      expired?: boolean;
      status: number;
      code?: string;
    }
> {
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
    userMessage?: SessionMessage;
    assistantMessage?: SessionMessage;
    remainingSeconds?: number;
    locale?: string;
    voiceHints?: PipelineTurnResult["voiceHints"];
    humanizationEnabled?: boolean;
    aiSource?: string;
    code?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error ?? "Failed to send message",
      expired: Boolean(data.expired),
      status: res.status,
      code: typeof data.code === "string" ? data.code : undefined,
    };
  }

  // Contract: both rows exist and the patient reply has text. A row without
  // content would render as an empty patient turn (or crash the transcript).
  if (
    !data.userMessage ||
    !data.assistantMessage ||
    typeof data.userMessage.content !== "string" ||
    typeof data.assistantMessage.content !== "string" ||
    !data.assistantMessage.content.trim()
  ) {
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
      aiSource: typeof data.aiSource === "string" ? data.aiSource : null,
    },
  };
}

/** Safe playback lifecycle events for the voice diagnostics panel. */
export type PlaybackDiagnostic =
  | { event: "tts_request_started" }
  | {
      event: "tts_response";
      ok: boolean;
      status?: number;
      code?: string;
    }
  | { event: "audio_created" }
  | { event: "audio_play_called" }
  | { event: "audio_play_resolved" }
  | { event: "audio_play_rejected"; reason: string }
  | { event: "audio_playing" }
  | { event: "audio_ended" }
  | { event: "audio_error"; reason: string }
  /** The browser paused the clip on its own; one resume is attempted. */
  | { event: "audio_paused_externally" }
  /** The clip stopped advancing or ran far past its length. */
  | { event: "audio_stalled"; reason: string }
  /** The clip plays while still downloading; its length is not final yet. */
  | { event: "audio_streaming" }
  /** Every chunk of the streamed clip has arrived; its length is final. */
  | { event: "audio_stream_complete" }
  /** Streamed playback failed before audio began; the full clip plays instead. */
  | { event: "audio_stream_fallback"; reason: string }
  | { event: "browser_fallback_started" }
  | { event: "browser_speech_started" }
  | { event: "browser_speech_failed" }
  | { event: "browser_speech_ended" };

/**
 * Outcome of one patient utterance:
 * - elevenlabs   ElevenLabs audio played to the end
 * - browser      browser SpeechSynthesis played instead
 * - interrupted  aborted (barge-in / pause / end / newer turn)
 * - unavailable  no audio could be played; `unavailableCode` says why
 */
export type PlaybackOutcome = "elevenlabs" | "browser" | "interrupted" | "unavailable";

/**
 * Stages 3–4 — ElevenLabs speech → browser audio, with browser TTS fallback.
 * No-op safe when voice is disabled by the caller. Never hangs: browser speech
 * has a start watchdog, and a failure of both paths resolves "unavailable"
 * (with `onUnavailable`) so the caller can show "Patient audio unavailable".
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
  /** Abort cancels ElevenLabs / browser playback (barge-in / pause / end). */
  signal?: AbortSignal;
  /** Playback lifecycle (no audio contents) for diagnostics. */
  onDiagnostic?: (d: PlaybackDiagnostic) => void;
  /** Called once when neither ElevenLabs nor browser speech could play. */
  onUnavailable?: (info: { code: string; status?: number }) => void;
  /** Start playback on the first audio chunk where the browser supports it. */
  streamPlayback?: boolean;
}): Promise<PlaybackOutcome> {
  const handlers = params.handlers ?? {};
  const diag = params.onDiagnostic ?? (() => undefined);
  if (params.signal?.aborted) {
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
    if (params.signal?.aborted) {
      handlers.onerror?.();
      return "interrupted";
    }
  }

  handlers.onstart?.();

  diag({ event: "tts_request_started" });
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
    streamPlayback: params.streamPlayback,
  });
  diag({
    event: "tts_response",
    ok: result.mode === "elevenlabs",
    status: result.failure?.status,
    code: result.failure?.code,
  });

  if (params.signal?.aborted) {
    if (result.mode === "elevenlabs" && result.objectUrl) {
      result.stream?.cancel();
      URL.revokeObjectURL(result.objectUrl);
    }
    handlers.onerror?.();
    return "interrupted";
  }

  /**
   * Browser SpeechSynthesis fallback. Resolves "browser" when it spoke,
   * "unavailable" when it could not, "interrupted" when aborted.
   */
  const browserFallback = (
    unavailableCode: string,
    unavailableStatus?: number,
  ): Promise<PlaybackOutcome> =>
    new Promise<PlaybackOutcome>((resolve) => {
      let settled = false;
      const finish = (mode: PlaybackOutcome) => {
        if (settled) return;
        settled = true;
        params.signal?.removeEventListener("abort", onAbort);
        if (mode === "browser") handlers.onend?.();
        else handlers.onerror?.();
        if (mode === "unavailable") {
          params.onUnavailable?.({
            code: unavailableCode,
            status: unavailableStatus,
          });
        }
        resolve(mode);
      };
      const onAbort = () => {
        window.speechSynthesis?.cancel();
        finish("interrupted");
      };
      if (params.signal?.aborted) {
        finish("interrupted");
        return;
      }
      params.signal?.addEventListener("abort", onAbort, { once: true });
      diag({ event: "browser_fallback_started" });
      let started = false;
      speakWithBrowser(
        params.text,
        params.locale,
        {
          onstart: () => {
            started = true;
            diag({ event: "browser_speech_started" });
          },
          onend: () => {
            diag({ event: "browser_speech_ended" });
            finish("browser");
          },
          onerror: () => {
            if (params.signal?.aborted) {
              finish("interrupted");
              return;
            }
            diag({ event: "browser_speech_failed" });
            // Started then cut off still counts as audible speech.
            finish(started ? "browser" : "unavailable");
          },
        },
        params.speechPace,
      );
    });

  /**
   * Play one ElevenLabs clip. `stream` is set when the clip is a MediaSource
   * still being filled: playback starts on the first chunk, and data still
   * arriving counts as progress for the stall watchdog.
   */
  const playClip = (
    objectUrl: string,
    stream?: AudioStreamHandle,
  ): Promise<PlaybackOutcome | { fallback: string; started: boolean }> => {
    const audio = new Audio(objectUrl);
    diag({ event: "audio_created" });
    if (params.audioRef) params.audioRef.current = audio;
    if (stream) {
      diag({ event: "audio_streaming" });
      void stream.fullClip.then((clip) => {
        if (clip) diag({ event: "audio_stream_complete" });
      });
    }

    return new Promise<
      PlaybackOutcome | { fallback: string; started: boolean }
    >((resolve) => {
      let settled = false;
      let watchdog: ReturnType<typeof setInterval> | null = null;
      const finish = (
        mode: PlaybackOutcome | { fallback: string; started: boolean },
      ) => {
        if (settled) return;
        settled = true;
        if (mode === "interrupted") stream?.cancel();
        if (watchdog != null) clearInterval(watchdog);
        params.signal?.removeEventListener("abort", onAbort);
        // Revoke only after playback is over — never before it starts.
        URL.revokeObjectURL(objectUrl);
        if (params.audioRef?.current === audio) params.audioRef.current = null;
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

      // Watchdog: "playing" with no "ended" must never leave the room stuck
      // on "Avatar speaking" (device switch, browser pause, frozen clock).
      let playingAt: number | null = null;
      let lastTime = 0;
      let lastProgressAt = 0;
      let resumeTried = false;
      const sample = () => {
        if (settled || playingAt == null || params.signal?.aborted) return;
        const now = performance.now();
        if (audio.ended) {
          finish("elevenlabs");
          return;
        }
        if (audio.currentTime > lastTime + 0.01) {
          lastTime = audio.currentTime;
          lastProgressAt = now;
        }
        // A streamed clip waiting for its next chunk is not stalled while
        // bytes are still arriving.
        if (stream && !stream.isComplete()) {
          lastProgressAt = Math.max(lastProgressAt, stream.lastDataAt());
        }
        if (audio.paused && !resumeTried) {
          resumeTried = true;
          diag({ event: "audio_paused_externally" });
          void audio.play().catch(() => undefined);
        }
        const verdict = playbackVerdict({
          now,
          startedAt: playingAt,
          lastProgressAt,
          duration: audio.duration,
          playbackRate: audio.playbackRate,
        });
        if (verdict === "ok") return;
        const reason = `${verdict}_at_${Math.round(audio.currentTime * 10) / 10}s`;
        diag({ event: "audio_stalled", reason });
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        // Most of the clip already played: treat it as spoken rather than
        // repeating it in the browser voice.
        const nearlyDone =
          Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          audio.currentTime / audio.duration >= 0.85;
        finish(
          nearlyDone ? "elevenlabs" : { fallback: "AUDIO_STALLED", started: true },
        );
      };

      audio.onplaying = () => {
        diag({ event: "audio_playing" });
        if (playingAt == null) {
          playingAt = performance.now();
          lastProgressAt = playingAt;
          lastTime = audio.currentTime;
          watchdog = setInterval(sample, PLAYBACK_WATCHDOG_INTERVAL_MS);
        }
      };
      audio.onended = () => {
        diag({ event: "audio_ended" });
        finish("elevenlabs");
      };
      audio.onerror = () => {
        if (params.signal?.aborted || settled) {
          finish("interrupted");
          return;
        }
        const code = audio.error?.code;
        diag({ event: "audio_error", reason: `media_error_${code ?? "unknown"}` });
        finish({ fallback: "AUDIO_DECODE", started: playingAt != null });
      };

      params.signal?.addEventListener("abort", onAbort, { once: true });

      diag({ event: "audio_play_called" });
      let playPromise: Promise<void> | undefined;
      try {
        playPromise = audio.play();
      } catch (err) {
        playPromise = Promise.reject(err);
      }
      void Promise.resolve(playPromise)
        .then(() => diag({ event: "audio_play_resolved" }))
        .catch((err: unknown) => {
          if (params.signal?.aborted || settled) {
            finish("interrupted");
            return;
          }
          const name =
            err && typeof err === "object" && "name" in err
              ? String((err as { name: unknown }).name)
              : "error";
          diag({ event: "audio_play_rejected", reason: name });
          finish({
            fallback: name === "NotAllowedError" ? "AUTOPLAY_BLOCKED" : "AUDIO_PLAY_FAILED",
            started: playingAt != null,
          });
        });
    });
  };

  if (result.mode === "elevenlabs" && result.objectUrl) {
    let outcome = await playClip(result.objectUrl, result.stream);
    // The streamed (MediaSource) path failed before any audio was heard:
    // play the complete ElevenLabs clip instead of the browser voice.
    if (
      typeof outcome !== "string" &&
      result.stream &&
      !outcome.started &&
      outcome.fallback !== "AUTOPLAY_BLOCKED" &&
      !params.signal?.aborted
    ) {
      const clip = await result.stream.fullClip;
      if (params.signal?.aborted) {
        handlers.onerror?.();
        return "interrupted";
      }
      if (clip && clip.size > 0) {
        diag({ event: "audio_stream_fallback", reason: outcome.fallback });
        outcome = await playClip(URL.createObjectURL(clip));
      }
    }
    if (typeof outcome === "string") return outcome;
    result.stream?.cancel();
    return browserFallback(outcome.fallback);
  }

  if (params.signal?.aborted) {
    handlers.onerror?.();
    return "interrupted";
  }

  return browserFallback(
    result.failure?.code ?? "TTS_FAILED",
    result.failure?.status,
  );
}

/**
 * Record how much of a patient reply was heard before the therapist barged
 * in (`/api/sessions/:id/heard`). Best effort: resolves false on any failure
 * and never throws, so an interruption is never blocked on it.
 */
export async function reportHeardPortion(params: {
  sessionId: string;
  messageId: string;
  heardChars: number;
}): Promise<boolean> {
  try {
    const res = await fetch(`/api/sessions/${params.sessionId}/heard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageId: params.messageId,
        heardChars: params.heardChars,
      }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
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
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
  emotion?: string | null;
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
    });
  }

  return { ok: true, turn: turn.data, transcript };
}
