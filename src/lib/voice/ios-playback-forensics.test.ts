import { afterEach, describe, expect, it } from "vitest";
import {
  __resetVoiceForensicsForTests,
  beginForensicTurn,
  computeLatencyBreakdown,
  detectClientRuntime,
  ensureForensicChunk,
  finishForensicTurn,
  getVoiceForensicsDump,
  inferFirstFailedPlaybackStep,
  markForensicLatency,
  patchForensicChunk,
  recordForensicBarge,
} from "@/lib/voice/ios-playback-forensics";

afterEach(() => {
  __resetVoiceForensicsForTests();
});

describe("detectClientRuntime", () => {
  it("flags iPhone Safari-like UA", () => {
    const r = detectClientRuntime({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
    });
    expect(r.isIOS).toBe(true);
    expect(r.isSafariLike).toBe(true);
  });

  it("does not flag desktop Chrome as Safari-like", () => {
    const r = detectClientRuntime({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      platform: "MacIntel",
    });
    expect(r.isIOS).toBe(false);
    expect(r.isSafariLike).toBe(false);
  });
});

describe("forensic turn lifecycle", () => {
  it("reuses the same turn id so STT latency survives into TTS", () => {
    beginForensicTurn(7);
    markForensicLatency("therapist_speech_end", 10);
    markForensicLatency("STT_complete", 40);
    beginForensicTurn(7);
    markForensicLatency("first_tts_request_start", 90);
    const dump = getVoiceForensicsDump();
    expect(dump.active_turn_id).toBe(7);
    expect(dump.turns).toHaveLength(1); // dump includes active as last entry
    const active = dump.turns[dump.turns.length - 1]!;
    expect(active.latency.therapist_speech_end).toBe(10);
    expect(active.latency.STT_complete).toBe(40);
    expect(active.latency.first_tts_request_start).toBe(90);
  });

  it("finishes into the ring buffer", () => {
    beginForensicTurn("a");
    ensureForensicChunk(0);
    patchForensicChunk(0, {
      tts_response_status: 200,
      tts_byte_length: 1200,
      blob_created: true,
      play_called: true,
      play_resolved: true,
      playing_event: true,
    });
    const done = finishForensicTurn();
    expect(done?.chunks[0]?.tts_byte_length).toBe(1200);
    expect(getVoiceForensicsDump().turns).toHaveLength(1);
    expect(getVoiceForensicsDump().active_turn_id).toBeNull();
  });

  it("records barge steps without requiring content fields", () => {
    beginForensicTurn(1);
    recordForensicBarge({
      step: "vad_fired",
      voice_turn_id: 1,
      chunk_index: 2,
      abort_state: false,
      speaking_state: true,
      queue_state: "playing",
    });
    const dump = getVoiceForensicsDump();
    const turn = dump.turns[0] ?? {
      barge: dump.active_turn_id != null ? [{ step: "vad_fired" }] : [],
    };
    // Active turn still open — barge attached there.
    expect(
      getVoiceForensicsDump().active_turn_id === 1 ||
        (turn.barge?.length ?? 0) > 0,
    ).toBe(true);
    finishForensicTurn();
    expect(getVoiceForensicsDump().turns[0]?.barge[0]?.step).toBe("vad_fired");
  });
});

describe("computeLatencyBreakdown", () => {
  it("computes dominant segments from marks", () => {
    const b = computeLatencyBreakdown({
      therapist_speech_end: 0,
      STT_request_start: 1,
      STT_complete: 800,
      message_request_start: 820,
      message_complete: 3200,
      patient_cognition_complete: 3200,
      first_tts_request_start: 3210,
      first_tts_response: 4100,
      first_audio_play_call: 4120,
      first_audio_play_resolved: 4130,
      first_playing_event: 4150,
      patient_audio_end: 9000,
    });
    expect(b.therapist_end_to_stt_complete_ms).toBe(800);
    expect(b.message_start_to_message_complete_ms).toBe(2380);
    expect(b.message_complete_to_first_tts_ready_ms).toBe(900);
    expect(b.play_to_playing_ms).toBe(30);
    expect(b.therapist_end_to_patient_audio_ms).toBe(4150);
  });
});

describe("inferFirstFailedPlaybackStep", () => {
  it("detects empty MIME-adjacent decode failure via error after play resolve", () => {
    expect(
      inferFirstFailedPlaybackStep({
        chunk_index: 0,
        tts_request_start: 1,
        tts_response_status: 200,
        tts_content_type: "audio/mpeg",
        tts_byte_length: 4000,
        blob_created: true,
        blob_type: "",
        object_url_created: true,
        audio_created: true,
        audio_src_assigned: true,
        audio_ready_state: 0,
        audio_network_state: 2,
        play_called: true,
        play_resolved: true,
        play_rejected: false,
        play_rejection_name: null,
        play_rejection_message: null,
        playing_event: false,
        canplay_event: false,
        loadedmetadata_event: false,
        waiting_event: false,
        stalled_event: false,
        error_event: true,
        error_code: 4,
        error_message: "MEDIA_ERR_SRC_NOT_SUPPORTED",
        ended_event: false,
        pause_event: false,
        abort_signal_state: false,
        turn_fence_state: "active",
        timestamps: {},
      }),
    ).toBe("error_event");
  });

  it("detects NotAllowedError as play_rejected", () => {
    expect(
      inferFirstFailedPlaybackStep({
        chunk_index: 0,
        tts_request_start: 1,
        tts_response_status: 200,
        tts_content_type: "audio/mpeg",
        tts_byte_length: 4000,
        blob_created: true,
        blob_type: "audio/mpeg",
        object_url_created: true,
        audio_created: true,
        audio_src_assigned: true,
        audio_ready_state: 1,
        audio_network_state: 1,
        play_called: true,
        play_resolved: false,
        play_rejected: true,
        play_rejection_name: "NotAllowedError",
        play_rejection_message: "The request is not allowed",
        playing_event: false,
        canplay_event: null,
        loadedmetadata_event: null,
        waiting_event: null,
        stalled_event: null,
        error_event: null,
        error_code: null,
        error_message: null,
        ended_event: null,
        pause_event: null,
        abort_signal_state: false,
        turn_fence_state: "active",
        timestamps: {},
      }),
    ).toBe("play_rejected");
  });

  it("returns null when chunk appears healthy", () => {
    expect(
      inferFirstFailedPlaybackStep({
        chunk_index: 0,
        tts_request_start: 1,
        tts_response_status: 200,
        tts_content_type: "audio/mpeg",
        tts_byte_length: 4000,
        blob_created: true,
        blob_type: "audio/mpeg",
        object_url_created: true,
        audio_created: true,
        audio_src_assigned: true,
        audio_ready_state: 4,
        audio_network_state: 1,
        play_called: true,
        play_resolved: true,
        play_rejected: false,
        play_rejection_name: null,
        play_rejection_message: null,
        playing_event: true,
        canplay_event: true,
        loadedmetadata_event: true,
        waiting_event: false,
        stalled_event: false,
        error_event: false,
        error_code: null,
        error_message: null,
        ended_event: true,
        pause_event: false,
        abort_signal_state: false,
        turn_fence_state: "active",
        timestamps: {},
      }),
    ).toBeNull();
  });
});
