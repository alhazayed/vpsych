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
  getHandsFreePerfBudgets,
  HANDS_FREE_PERF_BUDGETS,
} from "./conversation-telemetry";
import {
  HANDS_FREE_AUDIO_CONSTRAINTS,
  BARGE_IN_AUDIO_CONSTRAINTS,
} from "./audio-constraints";
import { evaluateVadFrame, resolveSilenceMs } from "./vad";
import {
  endpointCommitSilenceMs,
  resolveTurnTakingConfig,
  TURN_TAKING_DEFAULTS,
} from "./turn-taking-config";

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
    expect(transition("WAITING_GPT", "PLAYBACK_END").ok).toBe(false);
  });

  it("allows therapist resume (BARGE_IN) during STT/GPT to cancel pending turn", () => {
    expect(canTransition("PROCESSING_STT", "BARGE_IN")).toBe(true);
    expect(canTransition("WAITING_GPT", "BARGE_IN")).toBe(true);
    expect(nextConversationState("PROCESSING_STT", "BARGE_IN")).toBe(
      "LISTENING",
    );
    expect(nextConversationState("WAITING_GPT", "BARGE_IN")).toBe("LISTENING");
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

  it("microphone / VAD remains synchronized with FSM (listen loop gates)", () => {
    // VAD capture is only started in LISTENING; other states block the loop.
    expect(micAllowed("LISTENING")).toBe(true);
    expect(micAllowed("PROCESSING_STT")).toBe(false);
    expect(micAllowed("WAITING_GPT")).toBe(false);
    expect(micAllowed("AVATAR_SPEAKING")).toBe(false);
    // Endpoint confirm stays in LISTENING — mic/VAD stay open.
    expect(statusKeyForState("LISTENING")).toBe("listening");
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

  it("session reset invalidates previous turn generation", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    const gen = fsm.getGeneration();
    fsm.dispatch("SPEECH_END");
    fsm.reset("LISTENING");
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
    expect(
      edges.some(
        (e) =>
          e.from === "WAITING_GPT" &&
          e.event === "BARGE_IN" &&
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

describe("two-stage endpoint VAD", () => {
  const clinical = {
    speechThreshold: 0.015,
    silenceThreshold: 0.008,
    minSpeechMs: 400,
    silenceMs: 1000,
    confirmMs: 500,
    maxMs: 30000,
  };

  it("300 ms pause → no response (no candidate, no finish)", () => {
    const mid = evaluateVadFrame({
      ...clinical,
      level: 0.002,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 300,
      elapsedMs: 1500,
    });
    expect(mid.shouldFinish).toBe(false);
    expect(mid.endpointCandidate).toBe(false);
    expect(mid.nowSpeaking).toBe(true);
  });

  it("500 ms pause → no response", () => {
    const mid = evaluateVadFrame({
      ...clinical,
      level: 0.002,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 500,
      elapsedMs: 1700,
    });
    expect(mid.shouldFinish).toBe(false);
    expect(mid.endpointCandidate).toBe(false);
  });

  it("850 ms pause → no response (below Stage-1 initial 1000 ms)", () => {
    const mid = evaluateVadFrame({
      ...clinical,
      level: 0.002,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 850,
      elapsedMs: 2050,
    });
    expect(mid.shouldFinish).toBe(false);
    expect(mid.endpointCandidate).toBe(false);
  });

  it("1000 ms pause → endpoint candidate only (not committed)", () => {
    const cand = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 1000,
      elapsedMs: 2200,
    });
    expect(cand.shouldFinish).toBe(false);
    expect(cand.endpointCandidate).toBe(true);
    expect(cand.endpointConfirmed).toBe(false);
    expect(cand.speechEnded).toBe(true);
  });

  it("1200 ms quiet with confirm=500 → still candidate, not finished", () => {
    const hold = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: false,
      endpointCandidate: true,
      totalSpeechMs: 1200,
      quietForMs: 1200,
      elapsedMs: 2400,
    });
    expect(hold.shouldFinish).toBe(false);
    expect(hold.endpointCandidate).toBe(true);
  });

  it("1500 ms quiet (1000+500) → endpoint confirmed / finish", () => {
    const done = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: false,
      endpointCandidate: true,
      totalSpeechMs: 1200,
      quietForMs: 1500,
      elapsedMs: 2700,
    });
    expect(done.shouldFinish).toBe(true);
    expect(done.endpointConfirmed).toBe(true);
    expect(done.keepAudio).toBe(true);
  });

  it("therapist resumes during confirmation → cancel endpoint", () => {
    const resume = evaluateVadFrame({
      ...clinical,
      level: 0.04,
      speaking: false,
      endpointCandidate: true,
      totalSpeechMs: 1200,
      quietForMs: 1200,
      elapsedMs: 2400,
    });
    expect(resume.endpointCancelled).toBe(true);
    expect(resume.endpointCandidate).toBe(false);
    expect(resume.shouldFinish).toBe(false);
    expect(resume.nowSpeaking).toBe(true);
    expect(resume.speechStarted).toBe(true);
  });

  it("therapist continues same sentence after pause → no avatar finish", () => {
    // Mid-sentence pause then resume: never shouldFinish until new quiet commit.
    const pause = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 800,
      quietForMs: 1000,
      elapsedMs: 1800,
    });
    expect(pause.endpointCandidate).toBe(true);
    expect(pause.shouldFinish).toBe(false);

    const continueSpeech = evaluateVadFrame({
      ...clinical,
      level: 0.05,
      speaking: false,
      endpointCandidate: true,
      totalSpeechMs: 800,
      quietForMs: 1100,
      elapsedMs: 1900,
    });
    expect(continueSpeech.endpointCancelled).toBe(true);
    expect(continueSpeech.shouldFinish).toBe(false);
  });

  it("does not end on silence before minimum speech duration", () => {
    const tooShort = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 200,
      quietForMs: 1600,
      elapsedMs: 1800,
    });
    expect(tooShort.shouldFinish).toBe(false);
    expect(tooShort.endpointCandidate).toBe(false);
  });

  it("STT is post-capture: confirm window uses VAD only (no interim stream)", () => {
    // Therapy Room STT runs after endpoint commit on the captured WAV.
    // During Stage-2 the mic stays open via VAD; speech resume cancels the
    // candidate — equivalent to "interim changed → keep waiting".
    const midConfirm = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: false,
      totalSpeechMs: 1200,
      quietForMs: 1200,
      elapsedMs: 2400,
      endpointCandidate: true,
    });
    expect(midConfirm.endpointCandidate).toBe(true);
    expect(midConfirm.shouldFinish).toBe(false);

    const interimLikeResume = evaluateVadFrame({
      ...clinical,
      level: 0.05,
      speaking: false,
      totalSpeechMs: 1200,
      quietForMs: 1200,
      elapsedMs: 2400,
      endpointCandidate: true,
    });
    expect(interimLikeResume.endpointCancelled).toBe(true);
    expect(interimLikeResume.shouldFinish).toBe(false);
  });

  it("STT final path only after confirmed silence (finish gate)", () => {
    const before = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: false,
      totalSpeechMs: 1200,
      quietForMs: 1499,
      elapsedMs: 2700,
      endpointCandidate: true,
    });
    expect(before.shouldFinish).toBe(false);
    const after = evaluateVadFrame({
      ...clinical,
      level: 0.001,
      speaking: false,
      totalSpeechMs: 1200,
      quietForMs: 1500,
      elapsedMs: 2700,
      endpointCandidate: true,
    });
    expect(after.endpointConfirmed).toBe(true);
    expect(after.shouldFinish).toBe(true);
  });

  it("legacy confirmMs=0 finishes at Stage-1 (single-stage compat)", () => {
    const legacy = evaluateVadFrame({
      ...clinical,
      confirmMs: 0,
      level: 0.001,
      speaking: true,
      totalSpeechMs: 1200,
      quietForMs: 1000,
      elapsedMs: 2200,
    });
    expect(legacy.shouldFinish).toBe(true);
    expect(legacy.endpointConfirmed).toBe(true);
  });

  it("detects speech start above threshold", () => {
    const start = evaluateVadFrame({
      ...clinical,
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
      ...clinical,
      level: 0.05,
      speaking: true,
      totalSpeechMs: 28000,
      quietForMs: 0,
      elapsedMs: 30000,
    });
    expect(maxed.shouldFinish).toBe(true);
    expect(maxed.keepAudio).toBe(true);
  });

  it("clamps Stage-1 silence into clinical initial window", () => {
    expect(resolveSilenceMs(500)).toBe(700);
    expect(resolveSilenceMs(3000)).toBe(2000);
    expect(resolveSilenceMs(1000)).toBe(1000);
    expect(resolveSilenceMs(undefined)).toBe(
      resolveTurnTakingConfig().endpointInitialMs,
    );
  });

  it("enables echo cancellation, noise suppression, and AGC", () => {
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.echoCancellation).toBe(true);
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.noiseSuppression).toBe(true);
    expect(HANDS_FREE_AUDIO_CONSTRAINTS.autoGainControl).toBe(true);
    expect(BARGE_IN_AUDIO_CONSTRAINTS.autoGainControl).toBe(true);
  });
});

describe("turn-taking config", () => {
  it("defaults bias toward waiting (~1.5s commit quiet)", () => {
    const cfg = resolveTurnTakingConfig();
    expect(cfg.endpointInitialMs).toBe(1000);
    expect(cfg.endpointConfirmMs).toBe(500);
    expect(endpointCommitSilenceMs(cfg)).toBe(1500);
    expect(cfg.endpointMaxWaitMs).toBeGreaterThanOrEqual(1500);
  });

  it("documents clinical defaults constants", () => {
    expect(TURN_TAKING_DEFAULTS.endpointInitialMs).toBe(1000);
    expect(TURN_TAKING_DEFAULTS.endpointConfirmMs).toBe(500);
    expect(TURN_TAKING_DEFAULTS.endpointInitialMsMax).toBe(2000);
  });
});

describe("hands-free conversation telemetry", () => {
  it("records timings and endpoint events without PHI fields", () => {
    const tel = createConversationTelemetry();
    const t0 = tel.mark();
    tel.record("speech_duration_ms", { valueMs: 1400, turnId: 3 });
    tel.record("endpoint_candidate", {
      valueMs: 1000,
      turnId: 3,
      fsmState: "LISTENING",
    });
    tel.record("endpoint_cancelled", {
      valueMs: 1100,
      turnId: 3,
      code: "therapist_resumed",
    });
    tel.record("endpoint_confirmed", { valueMs: 1500, turnId: 4 });
    tel.record("therapist_resumed", {
      turnId: 4,
      fsmState: "WAITING_GPT",
    });
    tel.record("tts_cancelled", { code: "therapist_barge_in", turnId: 4 });
    tel.record("stale_response_blocked", {
      turnId: 2,
      code: "stale_after_gpt",
    });
    tel.record("stt_latency_ms", { valueMs: 180 });
    tel.record("gpt_latency_ms", { valueMs: 900 });
    tel.record("tts_latency_ms", { valueMs: 400 });
    tel.record("playback_duration_ms", { valueMs: 3200 });
    tel.record("mic_reopen_latency_ms", {
      valueMs: tel.elapsed(t0) < 0 ? 0 : 120,
    });
    tel.record("turn_complete", { turnId: 4 });
    tel.record("barge_in", { turnId: 4 });
    tel.record("error", { code: "stt_timeout" });
    tel.record("retry");

    const summary = tel.summarize();
    expect(summary.turns).toBe(1);
    expect(summary.bargeIns).toBe(1);
    expect(summary.errors).toBe(1);
    expect(summary.endpointCandidates).toBe(1);
    expect(summary.endpointCancelled).toBe(1);
    expect(summary.endpointConfirmed).toBe(1);
    expect(summary.therapistResumed).toBe(1);
    expect(summary.ttsCancelled).toBe(1);
    expect(summary.staleResponseBlocked).toBe(1);
    expect(summary.avgSpeechMs).toBe(1400);

    const json = JSON.stringify(tel.countersOnly());
    expect(json).not.toMatch(/transcript|audio|wav|patient said|أريد/i);
    expect(json).toContain('"endpointCancelled":1');
  });

  it("documents performance budgets from turn-taking config", () => {
    const budgets = getHandsFreePerfBudgets();
    expect(budgets.defaultSilenceMs).toBe(1000);
    expect(budgets.endpointConfirmMs).toBe(500);
    expect(budgets.endpointCommitMs).toBe(1500);
    expect(budgets.silenceDetectMsMin).toBe(700);
    expect(budgets.silenceDetectMsMax).toBe(2000);
    expect(HANDS_FREE_PERF_BUDGETS.micReopenAfterPlaybackMs).toBe(300);
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
    expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
    expect(fsm.getState()).toBe("PROCESSING_STT");
  });

  it("handles avatar barge-in then continues the loop", () => {
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

  it("cancels pending GPT when therapist resumes (rapid turns)", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    const gen10 = fsm.getGeneration();
    fsm.dispatch("SPEECH_END");
    fsm.dispatch("STT_OK");
    expect(fsm.getState()).toBe("WAITING_GPT");
    // Therapist speaks again → cancel turn #10
    expect(fsm.dispatch("BARGE_IN").ok).toBe(true);
    expect(fsm.isCurrent(gen10)).toBe(false);
    expect(fsm.getState()).toBe("LISTENING");
    // Turn #11
    expect(fsm.dispatch("SPEECH_END").ok).toBe(true);
    expect(fsm.getState()).toBe("PROCESSING_STT");
  });

  it("stale generation cannot advance to avatar speaking after barge-in", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    const gen = fsm.getGeneration();
    fsm.dispatch("SPEECH_END");
    fsm.dispatch("STT_OK");
    fsm.dispatch("BARGE_IN");
    // Late GPT_OK from aborted turn must not apply
    expect(fsm.isCurrent(gen)).toBe(false);
    expect(fsm.dispatch("GPT_OK").ok).toBe(false);
    expect(fsm.getState()).toBe("LISTENING");
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

  it("repeated rapid turns do not race via generation bumps", () => {
    const fsm = createConversationFsm();
    fsm.dispatch("START");
    const gens: number[] = [];
    for (let i = 0; i < 5; i++) {
      const g = fsm.getGeneration();
      gens.push(g);
      fsm.dispatch("SPEECH_END");
      fsm.dispatch("STT_OK");
      fsm.dispatch("GPT_OK");
      fsm.dispatch("BARGE_IN");
      expect(fsm.isCurrent(g)).toBe(false);
      expect(fsm.getState()).toBe("LISTENING");
    }
    expect(new Set(gens).size).toBe(gens.length);
  });
});
