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
  fadeOutAudio,
  sessionLocaleFrom,
  synthesizeSpeech,
  speakWithBrowser,
} from "@/lib/voice/client";
import { prepareSpeech } from "@/lib/voice/speech-text";
import { transcribeWithOpenAI } from "@/lib/voice/transcribe-client";
import type { SessionMessage, SessionSpeechLocale } from "@/lib/voice/pipeline-types";
import type { VoiceQaSink } from "@/lib/voice/qa/types";

/**
 * Monotonic clock for QA spans only. Not used for any product behaviour, so a
 * runtime without `performance` degrades to wall time rather than failing.
 */
function qaClock(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

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
  /** Stage 11 / RT-06 — therapist barge-in cut off the prior patient turn. */
  therapistInterrupted?: boolean;
  signal?: AbortSignal;
}): Promise<
  | { ok: true; data: PipelineTurnResult }
  | { ok: false; error: string; expired?: boolean; status: number }
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
      voiceHints: data.voiceHints ?? null,
      humanizationEnabled: Boolean(data.humanizationEnabled),
    },
  };
}

/** Result of speaking one patient turn. */
export type PatientSpeechMode = "elevenlabs" | "browser" | "interrupted";

/** Await `ms`, resolving false if the signal aborts first. */
function sleepAbortable(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (ms <= 0) return Promise.resolve(!signal?.aborted);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Play one synthesized clip to completion. Always revokes its object URL. */
function playClip(params: {
  objectUrl: string;
  audioRef?: { current: HTMLAudioElement | null };
  signal?: AbortSignal;
}): Promise<"played" | "failed" | "interrupted"> {
  return new Promise((resolve) => {
    const audio = new Audio(params.objectUrl);
    if (params.audioRef) params.audioRef.current = audio;

    let settled = false;
    const finish = (result: "played" | "failed" | "interrupted") => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener("abort", onAbort);
      URL.revokeObjectURL(params.objectUrl);
      if (params.audioRef && params.audioRef.current === audio) {
        params.audioRef.current = null;
      }
      resolve(result);
    };

    const onAbort = () => {
      fadeOutAudio(audio);
      window.speechSynthesis?.cancel();
      finish("interrupted");
    };

    audio.onended = () => finish("played");
    audio.onerror = () =>
      finish(params.signal?.aborted ? "interrupted" : "failed");

    params.signal?.addEventListener("abort", onAbort, { once: true });

    void audio.play().catch(() => {
      finish(params.signal?.aborted ? "interrupted" : "failed");
    });
  });
}

/** Browser SpeechSynthesis fallback for whatever is left of the turn. */
function playViaBrowser(params: {
  text: string;
  locale: SessionSpeechLocale;
  speechPace?: string | null;
  signal?: AbortSignal;
  handlers: SpeakHandlers;
}): Promise<"browser" | "interrupted"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (mode: "browser" | "interrupted") => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener("abort", onAbort);
      if (mode === "interrupted") params.handlers.onerror?.();
      else params.handlers.onend?.();
      resolve(mode);
    };
    const onAbort = () => {
      window.speechSynthesis?.cancel();
      finish("interrupted");
    };
    params.signal?.addEventListener("abort", onAbort, { once: true });

    if (params.signal?.aborted) {
      finish("interrupted");
      return;
    }

    speakWithBrowser(
      params.text,
      params.locale,
      {
        onend: () => finish("browser"),
        onerror: () => finish(params.signal?.aborted ? "interrupted" : "browser"),
      },
      params.speechPace,
    );
  });
}

/**
 * Stages 3–4 — speech-text preparation → segmented ElevenLabs synthesis →
 * sequential playback, with browser TTS fallback.
 *
 * The turn is split into conversational segments, each synthesized with the
 * neighbouring segments as `previous_text` / `next_text` so the provider keeps
 * one prosodic contour across the whole turn. Segment N+1 is requested while
 * segment N is still playing, so the inter-segment gap is the intended pause
 * budget rather than network latency.
 *
 * `params.text` is the authoritative display text and is never mutated — only a
 * derived speech representation reaches the provider.
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
  /** Scales every inter-segment pause (clinical pacing). */
  pauseScale?: number | null;
  /** Best-effort deterministic sampling; omitted by default. */
  seed?: number | null;
  audioRef?: { current: HTMLAudioElement | null };
  handlers?: SpeakHandlers;
  /** Abort cancels ElevenLabs / browser playback (barge-in / pause / end). */
  signal?: AbortSignal;
  /** Voice QA instrumentation. Absent in production — see `lib/voice/qa`. */
  qa?: VoiceQaSink;
}): Promise<PatientSpeechMode> {
  const handlers = params.handlers ?? {};
  const qa = params.qa;
  if (params.signal?.aborted) {
    handlers.onerror?.();
    qa?.finish("interrupted");
    return "interrupted";
  }

  const prepared = prepareSpeech(params.text, params.locale, {
    pauseScale: params.pauseScale ?? 1,
  });
  const segments = prepared.segments.length
    ? prepared.segments
    : [
        {
          text: prepared.speechText,
          pauseAfterMs: 0,
          boundary: "final" as const,
        },
      ];

  qa?.mark("speech_text_ready");
  qa?.setSpeech({
    displayText: params.text,
    speechText: prepared.speechText,
    changed: prepared.normalized,
    locale: params.locale,
    segments: segments.map((segment, index) => ({
      index,
      text: segment.text,
      boundary: segment.boundary,
      pauseAfterMs: segment.pauseAfterMs,
    })),
  });

  const pauseMs = Math.max(0, Math.min(6000, params.pauseBeforeMs ?? 0));
  qa?.setThinkingPauseMs(pauseMs);
  if (!(await sleepAbortable(pauseMs, params.signal))) {
    handlers.onerror?.();
    qa?.finish("interrupted");
    return "interrupted";
  }

  handlers.onstart?.();

  const synthesizeSegment = async (index: number) => {
    const startedAt = qaClock();
    qa?.mark("tts_request");
    const result = await synthesizeSpeech({
      text: segments[index]!.text,
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
      previousText: index > 0 ? segments[index - 1]!.text : null,
      nextText:
        index < segments.length - 1 ? segments[index + 1]!.text : null,
      seed: params.seed,
      captureBlob: Boolean(qa),
    });
    if (qa) {
      qa.mark("tts_first_audio");
      qa.captureSegmentAudio({
        index,
        blob: result.blob ?? null,
        headers: result.headers ?? null,
        synthesisMs: qaClock() - startedAt,
      });
    }
    return result;
  };

  type Synthesis = Awaited<ReturnType<typeof synthesizeSpeech>> | null;
  let pending: Promise<Synthesis> = synthesizeSegment(0);

  /** Drop a prefetched clip we are never going to play. */
  const discardPending = () => {
    void pending
      .then((result) => {
        if (result?.objectUrl) URL.revokeObjectURL(result.objectUrl);
      })
      .catch(() => {
        /* prefetch failures are not actionable */
      });
  };

  for (let i = 0; i < segments.length; i++) {
    const result = await pending;

    // Prefetch the next segment while this one plays.
    pending =
      i + 1 < segments.length
        ? synthesizeSegment(i + 1)
        : Promise.resolve(null);

    if (params.signal?.aborted) {
      if (result?.objectUrl) URL.revokeObjectURL(result.objectUrl);
      discardPending();
      handlers.onerror?.();
      qa?.finish("interrupted");
      return "interrupted";
    }

    const remainingText = segments
      .slice(i)
      .map((s) => s.text)
      .join(" ");

    if (result?.mode !== "elevenlabs" || !result.objectUrl) {
      discardPending();
      const mode = await playViaBrowser({
        text: remainingText,
        locale: params.locale,
        speechPace: params.speechPace,
        signal: params.signal,
        handlers,
      });
      qa?.finish(mode === "browser" ? "browser_fallback" : "interrupted");
      return mode;
    }

    qa?.mark("playback_start");
    const played = await playClip({
      objectUrl: result.objectUrl,
      audioRef: params.audioRef,
      signal: params.signal,
    });

    if (played === "interrupted") {
      discardPending();
      handlers.onerror?.();
      qa?.finish("interrupted");
      return "interrupted";
    }

    if (played === "failed") {
      discardPending();
      const mode = await playViaBrowser({
        text: remainingText,
        locale: params.locale,
        speechPace: params.speechPace,
        signal: params.signal,
        handlers,
      });
      qa?.finish(mode === "browser" ? "browser_fallback" : "interrupted");
      return mode;
    }

    const pause = segments[i]!.pauseAfterMs;
    if (pause > 0 && !(await sleepAbortable(pause, params.signal))) {
      discardPending();
      handlers.onerror?.();
      qa?.finish("interrupted");
      return "interrupted";
    }
  }

  handlers.onend?.();
  qa?.finish("spoken");
  return "elevenlabs";
}

/**
 * Full voice turn: STT → message API (GPT-5 + persistence) → optional TTS.
 * Text-only callers should use `submitConversationTurn` directly.
 *
 * `signal` abandons the WHOLE turn, not just its audio. A therapist barging in
 * mid-turn must not get the superseded transcript in the draft box, must not
 * get the superseded exchange appended to the visible transcript, and must not
 * hear the superseded reply. Each stage is re-checked after its await because
 * an abort that lands while a fetch is in flight cannot unmake the response.
 */
export async function runVoiceConversationTurn(params: {
  sessionId: string;
  audio: Blob;
  sessionLanguage?: string | null;
  locale: SessionSpeechLocale;
  voiceEnabled: boolean;
  /** Abort abandons STT, the message request, and playback. */
  signal?: AbortSignal;
  /** Voice QA instrumentation. Absent in production — see `lib/voice/qa`. */
  qa?: VoiceQaSink;
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
      stage: "stt" | "message" | "interrupted";
      error: string;
      unavailable?: boolean;
      expired?: boolean;
    }
> {
  const interrupted = {
    ok: false,
    stage: "interrupted",
    error: "Turn superseded",
  } as const;

  if (params.signal?.aborted) return interrupted;

  // T0 — the recorder has stopped, so the therapist has finished speaking.
  params.qa?.mark("speech_ended");

  const stt = await transcribeTherapistSpeech({
    audio: params.audio,
    locale: params.sessionLanguage ?? params.locale,
    signal: params.signal,
  });

  if (params.signal?.aborted) return interrupted;

  if (!stt.ok) {
    params.qa?.finish("failed");
    return {
      ok: false,
      stage: "stt",
      error: stt.error,
      unavailable: stt.unavailable,
    };
  }

  // T1 — a usable final transcript exists.
  params.qa?.mark("stt_final");

  const transcript = stt.transcript.trim();
  if (!transcript) {
    params.qa?.finish("failed");
    return {
      ok: false,
      stage: "stt",
      error: "No speech detected",
    };
  }

  params.onTranscript?.(transcript);
  params.qa?.setTherapistText(transcript);

  // An aborted fetch rejects; that is a deliberate barge-in, not a failure to
  // report, so it must not surface as a network error in the status line.
  // T2 — conversation request started.
  params.qa?.mark("llm_request");
  const turn = await submitConversationTurn({
    sessionId: params.sessionId,
    message: transcript,
    signal: params.signal,
  }).catch(() => null);
  // T3 — model response received (success or not; the wait is the same).
  params.qa?.mark("llm_response");

  // The reply is persisted server-side either way, but a superseded turn must
  // not append to the visible transcript or speak over the therapist.
  if (params.signal?.aborted) return interrupted;
  if (!turn) {
    params.qa?.finish("failed");
    return { ok: false, stage: "message", error: "Network error" };
  }

  if (!turn.ok) {
    params.qa?.finish("failed");
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
      signal: params.signal,
      qa: params.qa,
    });
  } else {
    params.qa?.finish("spoken");
  }

  return { ok: true, turn: turn.data, transcript };
}
