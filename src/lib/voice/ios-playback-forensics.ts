/**
 * Phase 9.2S — temporary iOS / Safari voice playback + barge-in forensics.
 *
 * Removable diagnostic layer. Does NOT log audio bytes, transcripts, patient
 * content, cookies, or auth tokens. Safe to delete after the iPhone pass.
 *
 * Runtime dump (browser console on device):
 *   window.__VPSYCH_VOICE_FORENSICS__
 *   window.__VPSYCH_VOICE_FORENSICS__.dump()
 */

export const VOICE_FORENSICS_WINDOW_KEY = "__VPSYCH_VOICE_FORENSICS__" as const;

/** Max completed turns retained in the ring buffer. */
export const VOICE_FORENSICS_MAX_TURNS = 12;

export type ClientRuntimeProbe = {
  userAgent: string;
  platform: string;
  isIOS: boolean;
  isSafariLike: boolean;
};

export type ForensicChunkRecord = {
  chunk_index: number;
  tts_request_start: number | null;
  tts_response_status: number | null;
  tts_content_type: string | null;
  tts_byte_length: number | null;
  blob_created: boolean | null;
  blob_type: string | null;
  object_url_created: boolean | null;
  audio_created: boolean | null;
  audio_src_assigned: boolean | null;
  audio_ready_state: number | null;
  audio_network_state: number | null;
  play_called: boolean | null;
  play_resolved: boolean | null;
  play_rejected: boolean | null;
  play_rejection_name: string | null;
  play_rejection_message: string | null;
  playing_event: boolean | null;
  canplay_event: boolean | null;
  loadedmetadata_event: boolean | null;
  waiting_event: boolean | null;
  stalled_event: boolean | null;
  error_event: boolean | null;
  error_code: number | null;
  error_message: string | null;
  ended_event: boolean | null;
  pause_event: boolean | null;
  abort_signal_state: boolean | null;
  turn_fence_state: "active" | "stale" | "unknown" | null;
  timestamps: Record<string, number>;
};

export type ForensicLatencyMarks = {
  therapist_speech_end: number | null;
  STT_request_start: number | null;
  STT_complete: number | null;
  message_request_start: number | null;
  message_complete: number | null;
  patient_cognition_complete: number | null;
  first_tts_request_start: number | null;
  first_tts_response: number | null;
  first_audio_play_call: number | null;
  first_audio_play_resolved: number | null;
  first_playing_event: number | null;
  patient_audio_end: number | null;
};

export type ForensicLatencyBreakdown = {
  therapist_end_to_stt_complete_ms: number | null;
  stt_complete_to_message_start_ms: number | null;
  message_start_to_message_complete_ms: number | null;
  message_complete_to_first_tts_ready_ms: number | null;
  first_tts_ready_to_play_ms: number | null;
  play_to_playing_ms: number | null;
  therapist_end_to_patient_audio_ms: number | null;
};

export type ForensicBargeEvent = {
  at: number;
  step:
    | "vad_fired"
    | "interrupt_handler"
    | "turn_fence_invalidate"
    | "abort_signal"
    | "tts_cancel"
    | "audio_pause"
    | "queue_cancel"
    | "therapist_turn_submit"
    | "new_patient_turn";
  voice_turn_id: string | number | null;
  chunk_index: number | null;
  abort_state: boolean | null;
  speaking_state: boolean | null;
  queue_state: string | null;
  note?: string;
};

export type ForensicTurnRecord = {
  voice_turn_id: string | number;
  started_at: number;
  runtime: ClientRuntimeProbe;
  chunks: ForensicChunkRecord[];
  latency: ForensicLatencyMarks;
  latency_breakdown: ForensicLatencyBreakdown;
  barge: ForensicBargeEvent[];
  notes: string[];
};

export type VoiceForensicsDump = {
  phase: "9.2S";
  enabled: boolean;
  runtime: ClientRuntimeProbe;
  turns: ForensicTurnRecord[];
  active_turn_id: string | number | null;
};

type ForensicsStore = {
  enabled: boolean;
  turns: ForensicTurnRecord[];
  active: ForensicTurnRecord | null;
};

const emptyLatency = (): ForensicLatencyMarks => ({
  therapist_speech_end: null,
  STT_request_start: null,
  STT_complete: null,
  message_request_start: null,
  message_complete: null,
  patient_cognition_complete: null,
  first_tts_request_start: null,
  first_tts_response: null,
  first_audio_play_call: null,
  first_audio_play_resolved: null,
  first_playing_event: null,
  patient_audio_end: null,
});

const emptyChunk = (chunk_index: number): ForensicChunkRecord => ({
  chunk_index,
  tts_request_start: null,
  tts_response_status: null,
  tts_content_type: null,
  tts_byte_length: null,
  blob_created: null,
  blob_type: null,
  object_url_created: null,
  audio_created: null,
  audio_src_assigned: null,
  audio_ready_state: null,
  audio_network_state: null,
  play_called: null,
  play_resolved: null,
  play_rejected: null,
  play_rejection_name: null,
  play_rejection_message: null,
  playing_event: null,
  canplay_event: null,
  loadedmetadata_event: null,
  waiting_event: null,
  stalled_event: null,
  error_event: null,
  error_code: null,
  error_message: null,
  ended_event: null,
  pause_event: null,
  abort_signal_state: null,
  turn_fence_state: null,
  timestamps: {},
});

function nowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * Detect iOS / Safari-like clients without logging PII beyond UA/platform
 * (needed to classify the forensic dump).
 */
export function detectClientRuntime(
  nav: Pick<Navigator, "userAgent" | "platform"> | null | undefined = typeof navigator !== "undefined"
    ? navigator
    : null,
): ClientRuntimeProbe {
  const userAgent = nav?.userAgent ?? "";
  const platform = nav?.platform ?? "";
  const ua = userAgent;
  const isIOS =
    /\b(iPhone|iPad|iPod)\b/i.test(ua) ||
    (platform === "MacIntel" &&
      typeof navigator !== "undefined" &&
      typeof (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ===
        "number" &&
      ((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0) > 1);
  // Safari-like: Safari engine without Chromium/Firefox/Edg/Opera markers.
  const isSafariLike =
    /\bSafari\b/i.test(ua) &&
    !/\b(Chromium|Chrome|CriOS|Fxios|Edg|OPR|Android)\b/i.test(ua);
  return { userAgent, platform, isIOS, isSafariLike: isIOS || isSafariLike };
}

export function computeLatencyBreakdown(
  latency: ForensicLatencyMarks,
): ForensicLatencyBreakdown {
  const delta = (a: number | null, b: number | null): number | null => {
    if (a == null || b == null) return null;
    return Math.max(0, Math.round(b - a));
  };
  return {
    therapist_end_to_stt_complete_ms: delta(
      latency.therapist_speech_end,
      latency.STT_complete,
    ),
    stt_complete_to_message_start_ms: delta(
      latency.STT_complete,
      latency.message_request_start,
    ),
    message_start_to_message_complete_ms: delta(
      latency.message_request_start,
      latency.message_complete,
    ),
    message_complete_to_first_tts_ready_ms: delta(
      latency.message_complete,
      latency.first_tts_response,
    ),
    first_tts_ready_to_play_ms: delta(
      latency.first_tts_response,
      latency.first_audio_play_call,
    ),
    play_to_playing_ms: delta(
      latency.first_audio_play_call,
      latency.first_playing_event,
    ),
    therapist_end_to_patient_audio_ms: delta(
      latency.therapist_speech_end,
      latency.first_playing_event ?? latency.first_audio_play_resolved,
    ),
  };
}

/**
 * Infer the earliest failed playback step from a chunk record.
 * Returns a stable step id for the forensic report (or null if none failed).
 */
export function inferFirstFailedPlaybackStep(
  chunk: ForensicChunkRecord,
): string | null {
  if (chunk.tts_response_status != null && chunk.tts_response_status >= 400) {
    return "tts_http_status";
  }
  if (chunk.tts_byte_length === 0) return "tts_empty_bytes";
  if (chunk.blob_created === false) return "blob_created";
  if (chunk.object_url_created === false) return "object_url_created";
  if (chunk.audio_created === false) return "audio_created";
  if (chunk.audio_src_assigned === false) return "audio_src_assigned";
  if (chunk.play_called === false) return "play_called";
  if (chunk.play_rejected === true) return "play_rejected";
  if (chunk.error_event === true) return "error_event";
  if (chunk.play_resolved === true && chunk.playing_event === false) {
    return "playing_event_missing";
  }
  if (
    chunk.play_resolved === true &&
    chunk.playing_event === true &&
    chunk.ended_event === false &&
    chunk.pause_event === true
  ) {
    return "paused_before_ended";
  }
  return null;
}

const store: ForensicsStore = {
  enabled: true,
  turns: [],
  active: null,
};

function publishGlobal(): void {
  if (typeof window === "undefined") return;
  const dump = getVoiceForensicsDump();
  const api = {
    ...dump,
    dump: () => getVoiceForensicsDump(),
    clear: () => clearVoiceForensics(),
  };
  (window as unknown as Record<string, unknown>)[VOICE_FORENSICS_WINDOW_KEY] =
    api;
}

export function setVoiceForensicsEnabled(enabled: boolean): void {
  store.enabled = enabled;
  publishGlobal();
}

export function clearVoiceForensics(): void {
  store.turns = [];
  store.active = null;
  publishGlobal();
}

export function getVoiceForensicsDump(): VoiceForensicsDump {
  const turns = store.turns.map((t) => ({
    ...t,
    latency_breakdown: computeLatencyBreakdown(t.latency),
  }));
  if (store.active) {
    turns.push({
      ...store.active,
      latency_breakdown: computeLatencyBreakdown(store.active.latency),
    });
  }
  return {
    phase: "9.2S",
    enabled: store.enabled,
    runtime: detectClientRuntime(),
    turns,
    active_turn_id: store.active?.voice_turn_id ?? null,
  };
}

export function beginForensicTurn(
  voice_turn_id: string | number,
): ForensicTurnRecord | null {
  if (!store.enabled) return null;
  // Reuse the active turn when the same id continues from STT → TTS so
  // latency marks are not split across two forensic records.
  if (store.active && store.active.voice_turn_id === voice_turn_id) {
    return store.active;
  }
  if (store.active) {
    finishForensicTurn();
  }
  const turn: ForensicTurnRecord = {
    voice_turn_id,
    started_at: nowMs(),
    runtime: detectClientRuntime(),
    chunks: [],
    latency: emptyLatency(),
    latency_breakdown: computeLatencyBreakdown(emptyLatency()),
    barge: [],
    notes: [],
  };
  store.active = turn;
  publishGlobal();
  return turn;
}

export function finishForensicTurn(): ForensicTurnRecord | null {
  if (!store.active) return null;
  const done = {
    ...store.active,
    latency_breakdown: computeLatencyBreakdown(store.active.latency),
  };
  store.turns.push(done);
  while (store.turns.length > VOICE_FORENSICS_MAX_TURNS) {
    store.turns.shift();
  }
  store.active = null;
  publishGlobal();
  return done;
}

function activeTurn(): ForensicTurnRecord | null {
  return store.enabled ? store.active : null;
}

export function markForensicLatency(
  key: keyof ForensicLatencyMarks,
  at: number = nowMs(),
): void {
  const turn = activeTurn();
  if (!turn) return;
  if (turn.latency[key] == null) {
    turn.latency[key] = at;
  }
  turn.latency_breakdown = computeLatencyBreakdown(turn.latency);
  publishGlobal();
}

export function recordForensicBarge(event: Omit<ForensicBargeEvent, "at"> & { at?: number }): void {
  const turn = activeTurn();
  // Barge may fire while a prior turn is still "active" — attach there.
  const target = turn ?? store.turns[store.turns.length - 1];
  if (!target || !store.enabled) return;
  target.barge.push({
    at: event.at ?? nowMs(),
    step: event.step,
    voice_turn_id: event.voice_turn_id,
    chunk_index: event.chunk_index,
    abort_state: event.abort_state,
    speaking_state: event.speaking_state,
    queue_state: event.queue_state,
    note: event.note,
  });
  publishGlobal();
}

export function ensureForensicChunk(chunk_index: number): ForensicChunkRecord | null {
  const turn = activeTurn();
  if (!turn) return null;
  let chunk = turn.chunks.find((c) => c.chunk_index === chunk_index);
  if (!chunk) {
    chunk = emptyChunk(chunk_index);
    turn.chunks.push(chunk);
    turn.chunks.sort((a, b) => a.chunk_index - b.chunk_index);
  }
  return chunk;
}

export function patchForensicChunk(
  chunk_index: number,
  patch: Partial<ForensicChunkRecord>,
  stamp?: string,
): void {
  const chunk = ensureForensicChunk(chunk_index);
  if (!chunk) return;
  Object.assign(chunk, patch);
  if (stamp) {
    chunk.timestamps[stamp] = nowMs();
  }
  // Promote first-chunk latency marks.
  if (chunk_index === 0) {
    if (patch.tts_request_start != null) {
      markForensicLatency("first_tts_request_start", patch.tts_request_start);
    }
    if (patch.tts_response_status != null && patch.tts_response_status < 400) {
      markForensicLatency(
        "first_tts_response",
        chunk.timestamps.tts_response ?? nowMs(),
      );
    }
    if (patch.play_called) {
      markForensicLatency(
        "first_audio_play_call",
        chunk.timestamps.play_called ?? nowMs(),
      );
    }
    if (patch.play_resolved) {
      markForensicLatency(
        "first_audio_play_resolved",
        chunk.timestamps.play_resolved ?? nowMs(),
      );
    }
    if (patch.playing_event) {
      markForensicLatency(
        "first_playing_event",
        chunk.timestamps.playing ?? nowMs(),
      );
    }
    if (patch.ended_event) {
      markForensicLatency(
        "patient_audio_end",
        chunk.timestamps.ended ?? nowMs(),
      );
    }
  }
  publishGlobal();
}

export function addForensicNote(note: string): void {
  const turn = activeTurn();
  if (!turn) return;
  turn.notes.push(note);
  publishGlobal();
}

/**
 * Attach media-element forensic listeners. Returns a detach function.
 * Never throws into the playback path.
 */
export function attachAudioElementForensics(
  audio: HTMLAudioElement,
  chunk_index: number,
): () => void {
  const stamp = (name: string, patch: Partial<ForensicChunkRecord>) => {
    try {
      patchForensicChunk(
        chunk_index,
        {
          audio_ready_state: audio.readyState,
          audio_network_state: audio.networkState,
          ...patch,
        },
        name,
      );
    } catch {
      /* ignore */
    }
  };

  const onPlaying = () => stamp("playing", { playing_event: true });
  const onCanPlay = () => stamp("canplay", { canplay_event: true });
  const onLoaded = () => stamp("loadedmetadata", { loadedmetadata_event: true });
  const onWaiting = () => stamp("waiting", { waiting_event: true });
  const onStalled = () => stamp("stalled", { stalled_event: true });
  const onEnded = () => stamp("ended", { ended_event: true });
  const onPause = () => stamp("pause", { pause_event: true });
  const onError = () =>
    stamp("error", {
      error_event: true,
      error_code: audio.error?.code ?? null,
      error_message: audio.error?.message ?? null,
    });

  try {
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
  } catch {
    return () => undefined;
  }

  return () => {
    try {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    } catch {
      /* ignore */
    }
  };
}

/** Create an HTMLAudioElement instrumented for Phase 9.2S forensics. */
export function createForensicAudioElement(src: string, chunk_index: number): HTMLAudioElement {
  const audio = new Audio(src);
  patchForensicChunk(
    chunk_index,
    {
      audio_created: true,
      audio_src_assigned: Boolean(src),
      audio_ready_state: audio.readyState,
      audio_network_state: audio.networkState,
    },
    "audio_created",
  );
  attachAudioElementForensics(audio, chunk_index);
  return audio;
}

/** Wrap play() to record resolve/reject without altering control flow. */
export function playAudioWithForensics(
  audio: HTMLAudioElement,
  chunk_index: number,
  opts?: {
    abortSignal?: AbortSignal;
    turnFenceActive?: boolean | null;
  },
): Promise<void> {
  patchForensicChunk(
    chunk_index,
    {
      play_called: true,
      abort_signal_state: opts?.abortSignal?.aborted ?? null,
      turn_fence_state:
        opts?.turnFenceActive == null
          ? "unknown"
          : opts.turnFenceActive
            ? "active"
            : "stale",
      audio_ready_state: audio.readyState,
      audio_network_state: audio.networkState,
    },
    "play_called",
  );
  return audio
    .play()
    .then(() => {
      patchForensicChunk(
        chunk_index,
        {
          play_resolved: true,
          play_rejected: false,
          audio_ready_state: audio.readyState,
          audio_network_state: audio.networkState,
        },
        "play_resolved",
      );
    })
    .catch((err: unknown) => {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name?: unknown }).name ?? "")
          : "";
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message ?? "")
          : String(err ?? "");
      patchForensicChunk(
        chunk_index,
        {
          play_resolved: false,
          play_rejected: true,
          play_rejection_name: name || null,
          play_rejection_message: message.slice(0, 160) || null,
        },
        "play_rejected",
      );
      throw err;
    });
}

/** Test helper — reset module store between vitest cases. */
export function __resetVoiceForensicsForTests(): void {
  store.enabled = true;
  store.turns = [];
  store.active = null;
}
