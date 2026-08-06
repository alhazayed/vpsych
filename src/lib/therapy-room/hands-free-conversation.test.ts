import { describe, expect, it } from "vitest";
import {
  canTransition,
  createConversationFsm,
  listLegalTransitions,
  micAllowed,
  nextConversationState,
  playbackAllowed,
  statusKeyForState,
  transition,
  type ConversationEvent,
  type ConversationState,
} from "./conversation-fsm";
import {
  createConversationTelemetry,
  HANDS_FREE_PERF_BUDGETS,
} from "./conversation-telemetry";
import {
  HANDS_FREE_AUDIO_CONSTRAINTS,
  BARGE_IN_AUDIO_CONSTRAINTS,
} from "./audio-constraints";
import { evaluateVadFrame, resolveSilenceMs } from "./vad";

describe("hands-free conversation FSM", () => {
  it("allows only the continuous conversation loop transitions", () => {
    expect(nextConversationState("IDLE", "START")).toBe("LISTENING");
    expect(nextConversationState("LISTENING", "SPEECH_END")).toBe(
      "PROCESSING_STT",
    );
    expect(nextConversationState("PROCESSING_STT", "STT_OK")).toBe(
      "WAITING_GPT",
    );
    expect(nextConversationState("WAITING_GPT", "GPT_OK")).toBe(
      "AVATAR_SPEAKING",
    );
    expect(nextConversationState("AVATAR_SPEAKING", "PLAYBACK_END")).toBe(
      "LISTENING",
    );
  });

  it("supports barge-in from avatar speaking back to listening", () => {
    expect(transition("AVATAR_SPEAKING", "BARGE_IN")).toEqual({
      ok: true,
      from: "AVATAR_SPEAKING",
      to: "LISTENING",
      event: "BARGE_IN",
    });
  });

  it("rejects illegal transitions (no race into overlapping work)", () => {
    expect(canTransition("LISTENING", "GPT_OK")).toBe(false);
    expect(canTransition("AVATAR_SPEAKING", "SPEECH_END")).toBe(false);
    expect(canTransition("PROCESSING_STT", "BARGE_IN")).toBe(false);
    expect(transition("WAITING_GPT", "PLAYBACK_END").ok).toBe(false);
  });

  it("pause / resume preserve the automatic listening loop entry", () => {
    expect(nextConversationState("LISTENING", "PAUSE")).toBe("PAUSED");
    expect(nextConversationState("AVATAR_SPEAKING", "PAUSE")).toBe("PAUSED");
    expect(nextConversationState("PAUSED", "RESUME")).toBe("LISTENING");
  });

  it("error recovery retries into listening", () => {
    expect(nextConversationState("ERROR", "RETRY")).toBe("LISTENING");
    expect(statusKeyForState("ERROR")).toBe("error");
  });

  it("mic is only open while LISTENING; playback only while AVATAR_SPEAKING", () => {
    const states: ConversationState[] = [
      "IDLE",
      "LISTENING",
      "PROCESSING_STT",
      "WAITING_GPT",
      "AVATAR_SPEAKING",
      "PAUSED",
      "ERROR",
    ];
    for (const s of states) {
      expect(micAllowed(s)).toBe(s === "LISTENING");
      expect(playbackAllowed(s)).toBe(s === "AVATAR_SPEAKING");
    }
  });

  it("generation counter invalidates in-flight work on pause / barge-in", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    const gen = fsm.getGeneration();
    expect(fsm.isCurrent(gen)).toBe(true);
    fsm.dispatch("SPEECH_END");
    expect(fsm.isCurrent(gen)).toBe(true);
    fsm.dispatch("STT_OK");
    fsm.dispatch("GPT_OK");
    fsm.dispatch("BARGE_IN");
    expect(fsm.isCurrent(gen)).toBe(false);
    expect(fsm.getState()).toBe("LISTENING");
  });

  it("lists a closed set of legal edges for documentation", () => {
    const edges = listLegalTransitions();
    expect(edges.length).toBeGreaterThan(15);
    expect(
      edges.some(
        (e) =>
          e.from === "AVATAR_SPEAKING" &&
          e.event === "PLAYBACK_END" &&
          e.to === "LISTENING",
      ),
    ).toBe(true);
  });

  it("maps status keys for therapist feedback", () => {
    expect(statusKeyForState("LISTENING")).toBe("listening");
    expect(statusKeyForState("PROCESSING_STT")).toBe("processingStt");
    expect(statusKeyForState("WAITING_GPT")).toBe("thinking");
    expect(statusKeyForState("AVATAR_SPEAKING")).toBe("avatarSpeaking");
    expect(statusKeyForState("PAUSED")).toBe("paused");
    expect(statusKeyForState("IDLE", { ending: true })).toBe("ending");
    expect(statusKeyForState("LISTENING", { reconnecting: true })).toBe(
      "reconnecting",
    );
  });

  it("end always returns to IDLE from active states", () => {
    const events: ConversationEvent[] = ["END"];
    for (const from of [
      "LISTENING",
      "PROCESSING_STT",
      "WAITING_GPT",
      "AVATAR_SPEAKING",
      "PAUSED",
      "ERROR",
    ] as ConversationState[]) {
      expect(nextConversationState(from, events[0]!)).toBe("IDLE");
    }
  });
});

describe("hands-free VAD silence detection", () => {
  const base = {
    speechThreshold: 0.015,
    silenceThreshold: 0.008,
    minSpeechMs: 400,
    silenceMs: 850,
    maxMs: 30000,
  };

  it("clamps silence timeout into 700–1000 ms budget", () => {
    expect(resolveSilenceMs(500)).toBe(700);
    expect(resolveSilenceMs(1200)).toBe(1000);
    expect(resolveSilenceMs(850)).toBe(850);
    expect(resolveSilenceMs(undefined)).toBe(
      HANDS_FREE_PERF_BUDGETS.defaultSilenceMs,
    );
  });

  it("ignores short pauses inside a sentence", () => {
    const midPause = evaluateVadFrame({
      ...base,
      level: 0.002,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 300,
      elapsedMs: 1500,
    });
    expect(midPause.shouldFinish).toBe(false);
    expect(midPause.nowSpeaking).toBe(true);
  });

  it("ends the turn after configurable silence following speech", () => {
    const end = evaluateVadFrame({
      ...base,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 900,
      elapsedMs: 2100,
    });
    expect(end.shouldFinish).toBe(true);
    expect(end.keepAudio).toBe(true);
    expect(end.speechEnded).toBe(true);
  });

  it("does not end on silence before minimum speech duration", () => {
    const tooShort = evaluateVadFrame({
      ...base,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 200,
      quietForMs: 900,
      elapsedMs: 1100,
    });
    expect(tooShort.shouldFinish).toBe(false);
  });

  it("detects speech start above threshold", () => {
    const start = evaluateVadFrame({
      ...base,
      level: 0.04,
      speaking: false,
      totalSpeechMs: 0,
      quietForMs: 0,
      elapsedMs: 50,
    });
    expect(start.speechStarted).toBe(true);
    expect(start.nowSpeaking).toBe(true);
  });

  it("force-finishes at max duration for rapid / long speech", () => {
    const maxed = evaluateVadFrame({
      ...base,
      level: 0.05,
      speaking: true,
      totalSpeechMs: 28000,
      quietForMs: 0,
      elapsedMs: 30000,
    });
    expect(maxed.shouldFinish).toBe(true);
    expect(maxed.keepAudio).toBe(true);
  });

  it("enables echo cancellation, noise suppression, and AGC as ideal", () => {
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.echoCancellation).toEqual({
      ideal: true,
    });
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.noiseSuppression).toEqual({
      ideal: true,
    });
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.autoGainControl).toEqual({
      ideal: true,
    });
    expect(BARGE_IN_AUDIO_CONSTRAINTS.autoGainControl).toEqual({
      ideal: true,
    });
  });
});

describe("hands-free conversation telemetry", () => {
  it("records timings without PHI fields", () => {
    const tel = createConversationTelemetry();
    const t0 = tel.mark();
    tel.record("speech_duration_ms", { valueMs: 1400 });
    tel.record("stt_latency_ms", { valueMs: 180 });
    tel.record("gpt_latency_ms", { valueMs: 900 });
    tel.record("tts_latency_ms", { valueMs: 400 });
    tel.record("playback_duration_ms", { valueMs: 3200 });
    tel.record("mic_reopen_latency_ms", {
      valueMs: tel.elapsed(t0) < 0 ? 0 : 120,
    });
    tel.record("turn_complete");
    tel.record("barge_in");
    tel.record("error", { code: "stt_timeout" });
    tel.record("retry");

    const summary = tel.summarize();
    expect(summary.turns).toBe(1);
    expect(summary.bargeIns).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.retries).toBe(1);
    expect(summary.avgSpeechMs).toBe(1400);
    expect(summary.avgSttMs).toBe(180);
    expect(summary.events.some((e) => e.code === "stt_timeout")).toBe(true);

    const json = JSON.stringify(tel.countersOnly());
    expect(json).not.toMatch(/transcript|audio|wav|patient said/i);
    expect(json).toContain('"errors":1');
  });

  it("documents performance budgets", () => {
    expect(HANDS_FREE_PERF_BUDGETS.speechEndToSttStartMs).toBe(200);
    expect(HANDS_FREE_PERF_BUDGETS.micReopenAfterPlaybackMs).toBe(300);
    expect(HANDS_FREE_PERF_BUDGETS.silenceDetectMsMin).toBe(700);
    expect(HANDS_FREE_PERF_BUDGETS.silenceDetectMsMax).toBe(1000);
  });
});

describe("continuous conversation loop (FSM walk)", () => {
  it("walks a full hands-free turn then auto-reopens mic", () => {
    const fsm = createConversationFsm();
    expect(fsm.dispatch("START").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
    expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
    expect(fsm.getState()).toBe("PROCESSING_STT");
    expect(fsm.dispatch("STT_OK").ok).toBe(true);
    expect(fsm.getState()).toBe("WAITING_GPT");
    expect(fsm.dispatch("GPT_OK").ok).toBe(true);
    expect(fsm.getState()).toBe("AVATAR_SPEAKING");
    expect(fsm.dispatch("PLAYBACK_END").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
    // Second turn without microphone click
    expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
    expect(fsm.getState()).toBe("PROCESSING_STT");
  });

  it("handles interruption then continues the loop", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    fsm.dispatch("SPEECH_END");
    fsm.dispatch("STT_OK");
    fsm.dispatch("GPT_OK");
    expect(fsm.dispatch("BARGE_IN").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
    expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
    expect(fsm.getState()).toBe("PROCESSING_STT");
  });

  it("handles network failure then retry", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    fsm.dispatch("SPEECH_END");
    expect(fsm.dispatch("STT_FAIL").ok).toBe(true);
    expect(fsm.getState()).toBe("ERROR");
    expect(fsm.dispatch("RETRY").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
  });

  it("empty STT returns to listening without error", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    fsm.dispatch("SPEECH_END");
    expect(fsm.dispatch("STT_EMPTY").ok).toBe(true);
    expect(fsm.getState()).toBe("LISTENING");
  });
});
