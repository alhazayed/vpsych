/**
 * Hands-free turn-taking configuration — clinical bias: wait rather than interrupt.
 *
 * All timings are centralized here (env-overridable). Do not scatter magic numbers
 * in VAD / FSM / TherapyRoomSession.
 *
 * Env (optional):
 *   VOICE_TURN_ENDPOINT_INITIAL_MS  — silence before endpoint candidate
 *   VOICE_TURN_ENDPOINT_CONFIRM_MS  — additional silence to confirm end-of-turn
 *   VOICE_TURN_MAX_WAIT_MS          — absolute max quiet wait (initial+confirm clamp)
 *   VOICE_TURN_MIN_SPEECH_MS        — min speech before silence can end a turn
 *   VOICE_TURN_BARGE_IN_MIN_MS      — continuous speech to barge in on avatar TTS
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

/**
 * Clinical defaults: bias toward waiting.
 * Candidate ~1000 ms + confirm ~500 ms ≈ 1.5 s total quiet before commit.
 * Max wait allows up to ~2.2 s of sustained silence before forced commit clamp.
 */
export const TURN_TAKING_DEFAULTS = {
  /** Stage-1: silence after speech → endpoint candidate (not yet commit). */
  endpointInitialMs: 1000,
  /** Stage-2: additional silence to confirm therapist finished. */
  endpointConfirmMs: 500,
  /** Hard ceiling for initial silence (ms). */
  endpointInitialMsMin: 700,
  endpointInitialMsMax: 2000,
  /** Hard ceiling for confirm silence (ms). */
  endpointConfirmMsMin: 300,
  endpointConfirmMsMax: 1200,
  /** Absolute max quiet wait = initial + confirm (safety). */
  endpointMaxWaitMs: 2200,
  /** Minimum speech duration before silence can raise a candidate. */
  minSpeechMs: 400,
  /** Therapist barge-in while avatar speaking. */
  bargeInMinSpeechMs: 280,
  bargeInRmsThreshold: 0.02,
  /** Capture speech RMS threshold. */
  speechRmsThreshold: 0.015,
  /** Max capture length. */
  maxCaptureMs: 28000,
  /** Perf targets (telemetry / docs — not hard gates). */
  speechEndToSttStartMs: 200,
  micReopenAfterPlaybackMs: 300,
} as const;

export type TurnTakingConfig = {
  endpointInitialMs: number;
  endpointConfirmMs: number;
  endpointMaxWaitMs: number;
  minSpeechMs: number;
  bargeInMinSpeechMs: number;
  bargeInRmsThreshold: number;
  speechRmsThreshold: number;
  maxCaptureMs: number;
  speechEndToSttStartMs: number;
  micReopenAfterPlaybackMs: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Resolve runtime turn-taking config (env + clinical defaults). */
export function resolveTurnTakingConfig(
  overrides?: Partial<TurnTakingConfig>,
): TurnTakingConfig {
  const initial = clamp(
    envInt(
      "VOICE_TURN_ENDPOINT_INITIAL_MS",
      overrides?.endpointInitialMs ?? TURN_TAKING_DEFAULTS.endpointInitialMs,
    ),
    TURN_TAKING_DEFAULTS.endpointInitialMsMin,
    TURN_TAKING_DEFAULTS.endpointInitialMsMax,
  );
  const confirm = clamp(
    envInt(
      "VOICE_TURN_ENDPOINT_CONFIRM_MS",
      overrides?.endpointConfirmMs ?? TURN_TAKING_DEFAULTS.endpointConfirmMs,
    ),
    TURN_TAKING_DEFAULTS.endpointConfirmMsMin,
    TURN_TAKING_DEFAULTS.endpointConfirmMsMax,
  );
  const maxWait = Math.max(
    envInt(
      "VOICE_TURN_MAX_WAIT_MS",
      overrides?.endpointMaxWaitMs ?? TURN_TAKING_DEFAULTS.endpointMaxWaitMs,
    ),
    initial + confirm,
  );

  return {
    endpointInitialMs: initial,
    endpointConfirmMs: confirm,
    endpointMaxWaitMs: maxWait,
    minSpeechMs: envInt(
      "VOICE_TURN_MIN_SPEECH_MS",
      overrides?.minSpeechMs ?? TURN_TAKING_DEFAULTS.minSpeechMs,
    ),
    bargeInMinSpeechMs:
      overrides?.bargeInMinSpeechMs ?? TURN_TAKING_DEFAULTS.bargeInMinSpeechMs,
    bargeInRmsThreshold:
      overrides?.bargeInRmsThreshold ?? TURN_TAKING_DEFAULTS.bargeInRmsThreshold,
    speechRmsThreshold:
      overrides?.speechRmsThreshold ?? TURN_TAKING_DEFAULTS.speechRmsThreshold,
    maxCaptureMs: overrides?.maxCaptureMs ?? TURN_TAKING_DEFAULTS.maxCaptureMs,
    speechEndToSttStartMs:
      overrides?.speechEndToSttStartMs ??
      TURN_TAKING_DEFAULTS.speechEndToSttStartMs,
    micReopenAfterPlaybackMs:
      overrides?.micReopenAfterPlaybackMs ??
      TURN_TAKING_DEFAULTS.micReopenAfterPlaybackMs,
  };
}

/** Total quiet required to *commit* an endpoint (Stage-1 + Stage-2). */
export function endpointCommitSilenceMs(cfg: TurnTakingConfig): number {
  return Math.min(
    cfg.endpointMaxWaitMs,
    cfg.endpointInitialMs + cfg.endpointConfirmMs,
  );
}

/**
 * Clamp a requested Stage-1 silence into the clinical initial window.
 * Kept for callers / tests that pass a single silenceMs override.
 */
export function resolveEndpointInitialMs(requested?: number): number {
  const cfg = resolveTurnTakingConfig(
    requested != null && Number.isFinite(requested)
      ? { endpointInitialMs: requested }
      : undefined,
  );
  return cfg.endpointInitialMs;
}
