import { describe, expect, it, beforeEach } from "vitest";
import {
  REALTIME_FORBIDDEN_WRITES,
  REALTIME_INTERACTION_LATENCY_TARGET_MS,
  REALTIME_OWNERSHIP_RULE,
  adaptQuality,
  applyRuntimeLanguageSwitch,
  buildNonverbalPresentation,
  buildReplayId,
  buildVoicePersonality,
  chunkTextForSpeech,
  clearRealtimeMetricsForTests,
  computeRms,
  connectionAfterReconnect,
  createAudioBufferManager,
  createAvatarController,
  createLatencyController,
  createMicrophonePipeline,
  createMultilingualSession,
  createReconnectController,
  createReplayGuard,
  createSecurityContext,
  createSilenceDetector,
  createSpeakerPipeline,
  createStreamingAudioManager,
  createTokenStreamController,
  createVad,
  createVoiceGateway,
  detectSpeechLocale,
  detectTurnPhase,
  emergencyTerminate,
  enterSessionFloor,
  estimateNetworkFromRtt,
  gatewayStateAfterInterrupt,
  isRtlLocale,
  isTokenExpired,
  normalizePeakScale,
  observeUtterance,
  pauseSession,
  planInterrupt,
  progressiveRevealEvents,
  progressiveTokens,
  realtimeMetrics,
  resumeSession,
  rotateStreamToken,
  runRealtimeAfterAssessment,
  runRealtimeEngine,
  shouldCommitTherapistTurn,
  speechLocaleForProviders,
  toBidirectionalLine,
  toMediaTrackConstraints,
  visemeClass,
  withStreamRetry,
  buildRealtimeVersionLock,
} from "@/lib/realtime";

describe("Stage 11 realtime ownership", () => {
  it("declares forbidden patient writes and ownership rule", () => {
    expect(REALTIME_FORBIDDEN_WRITES).toContain("clinical_snapshot");
    expect(REALTIME_FORBIDDEN_WRITES).toContain("DecisionPlan");
    expect(REALTIME_OWNERSHIP_RULE).toMatch(/Presentation layer only/i);
    expect(REALTIME_OWNERSHIP_RULE).toMatch(/Never owns Patient/i);
  });
});

describe("voice gateway + audio pipelines", () => {
  it("drives mic → vad → silence → turn phases", () => {
    const gw = createVoiceGateway();
    gw.armMic();
    gw.startListening();
    const speaking = gw.pushAudioEnergy(0.05, 50);
    expect(speaking.frame.speaking).toBe(true);
    expect(gw.state()).toBe("vad_speech");

    for (let i = 0; i < 20; i++) {
      gw.pushAudioEnergy(0.001, 50);
    }
    expect(["silence_hold", "listening", "vad_speech"]).toContain(gw.state());
  });

  it("handles barge-in interrupt and signals therapistInterrupted", () => {
    const gw = createVoiceGateway();
    gw.beginSpeaking();
    const plan = gw.interrupt("therapist_barge_in");
    expect(plan.notifyServerTherapistInterrupted).toBe(true);
    expect(plan.abortPlayback).toBe(true);
    expect(gw.state()).toBe("interrupted");
    expect(gatewayStateAfterInterrupt("network_loss")).toBe("recovering");
  });

  it("buffers audio with drop policy and backpressure", () => {
    const audio = createStreamingAudioManager({
      maxQueuedBytes: 32,
      highWaterMark: 16,
    });
    const a = audio.push(new Uint8Array(20));
    expect(a.accepted).toBe(true);
    expect(a.backpressure).toBe(true);
    const pulled = audio.pull();
    expect(pulled?.bytes.byteLength).toBe(20);
  });

  it("manages speaker queue and peak normalize", () => {
    const sp = createSpeakerPipeline({ volume: 0.8 });
    sp.enqueue({ id: "1", text: "hello" });
    expect(sp.beginPlay()?.id).toBe("1");
    sp.interrupt();
    expect(sp.state()).toBe("interrupted");
    expect(normalizePeakScale(0.45)).toBeGreaterThan(1);
  });

  it("creates mic constraints with AGC", () => {
    const c = toMediaTrackConstraints();
    expect(c.echoCancellation).toBe(true);
    expect(c.autoGainControl).toBe(true);
    const mic = createMicrophonePipeline();
    mic.beginPermissionRequest();
    mic.arm();
    expect(mic.state()).toBe("armed");
  });

  it("computes RMS and VAD frames", () => {
    expect(computeRms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
    const vad = createVad();
    expect(vad.process(0.05, 20).speaking).toBe(true);
  });

  it("detects silence commit for turns", () => {
    const det = createSilenceDetector({ silenceMs: 100, minSpeechMs: 50 });
    det.push(0.05, 60);
    const end = det.push(0.001, 120);
    expect(end.turnEnded).toBe(true);
    expect(
      shouldCommitTherapistTurn({ speechMs: 300, silenceMs: 900 }),
    ).toBe(true);
  });
});

describe("turn detection + reconnect + quality", () => {
  it("maps phases and reconnect backoff", () => {
    expect(
      detectTurnPhase({
        therapistSpeaking: false,
        silenceAfterSpeechMs: 900,
        patientStreaming: false,
        patientSpeaking: false,
        bargeIn: false,
        paused: false,
      }),
    ).toBe("patient_thinking");

    const rc = createReconnectController({
      maxAttempts: 2,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });
    const first = rc.onDisconnect();
    expect(first.shouldRetry).toBe(true);
    expect(first.nextState).toBe("reconnecting");
    rc.onDisconnect();
    expect(rc.onDisconnect().shouldRetry).toBe(false);
    expect(connectionAfterReconnect(true)).toBe("connected");
  });

  it("adapts quality from network / RTT", () => {
    expect(estimateNetworkFromRtt(40)).toBe("excellent");
    expect(adaptQuality("poor").preferLowBandwidth).toBe(true);
    expect(adaptQuality("excellent").ttsChunkChars).toBeGreaterThan(100);
  });

  it("tracks latency against interaction target", () => {
    const lc = createLatencyController();
    lc.mark("interaction", 120);
    lc.mark("e2e_turn", 4000);
    expect(lc.withinInteractionTarget()).toBe(true);
    expect(REALTIME_INTERACTION_LATENCY_TARGET_MS).toBe(250);
    expect(lc.suggestNetwork()).toBe("excellent");
  });
});

describe("LLM streaming control plane", () => {
  it("streams tokens, interrupts, resumes, completes", () => {
    const c = createTokenStreamController();
    c.pushToken("Hel");
    c.pushToken("lo");
    expect(c.text()).toBe("Hello");
    c.interrupt("barge");
    expect(c.interrupted()).toBe(true);
    c.resume();
    c.pushPartial("Hello world");
    c.complete("Hello world");
    expect(c.done()).toBe(true);
    expect(c.events().some((e) => e.type === "interrupted")).toBe(true);
  });

  it("retries with timeout recovery", async () => {
    let n = 0;
    const value = await withStreamRetry(
      async (attempt) => {
        n = attempt;
        if (attempt < 2) throw new Error("fail");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 1, timeoutMs: 1000 },
    );
    expect(value).toBe("ok");
    expect(n).toBe(2);
  });

  it("progressive tokens and reveal events", () => {
    const tokens = [...progressiveTokens("abcdef", 2)];
    expect(tokens).toEqual(["ab", "cd", "ef"]);
    const events = progressiveRevealEvents("hi");
    expect(events.at(-1)?.type).toBe("done");
  });

  it("chunks text for incremental speech", () => {
    const chunks = chunkTextForSpeech("Hello. World again today.", 10);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("avatar + nonverbal + personality", () => {
  it("animates speaking / blink / lip sync", () => {
    const avatar = createAvatarController(3);
    const pose = avatar.tick({
      speaking: true,
      streaming: false,
      thinking: false,
      interrupted: false,
      audioLevel: 0.7,
      emotionHint: "anxious",
      nonverbal: { eyeContact: 0.8, avoidance: 0.1 },
      nowMs: 10_000,
    });
    expect(pose.expression).toBe("speaking");
    expect(pose.lipSyncActive).toBe(true);
    expect(visemeClass(0.6)).toBe("viseme-open");
  });

  it("builds nonverbal presentation from voice hints", () => {
    const nv = buildNonverbalPresentation({
      voiceHints: {
        pause_before_ms: 400,
        speech_pace: "slow",
        speech_energy: "low",
      },
    });
    expect(nv.hesitationMs).toBe(400);
    expect(nv.speechRhythm).toBe("monotone");
  });

  it("builds patient-specific voice personality", () => {
    const p = buildVoicePersonality({
      locale: "ar-JO",
      age: 34,
      gender: "female",
      educationHint: "university",
      emotion: "anxious",
      speechPace: "slow",
    });
    expect(p.locale).toBe("ar");
    expect(p.genderPresentation).toBe("feminine");
    expect(p.vocabularyRegister).toBe("abstract");
    expect(p.confidence).toBeLessThan(0.5);
  });
});

describe("multilingual engine", () => {
  it("detects Arabic, English, mixed and RTL", () => {
    expect(detectSpeechLocale("Hello there")).toBe("en");
    expect(detectSpeechLocale("مرحبا")).toBe("ar");
    expect(detectSpeechLocale("Hello مرحبا")).toBe("mixed");
    expect(isRtlLocale("ar")).toBe(true);
    const state = createMultilingualSession("en");
    const switched = applyRuntimeLanguageSwitch(state, "ar");
    expect(switched.rtl).toBe(true);
    const observed = observeUtterance(switched, "ok thanks");
    expect(observed.detected).toBe("en");
    const line = toBidirectionalLine("assistant", "شكرا");
    expect(line.dir).toBe("rtl");
    expect(speechLocaleForProviders(switched)).toBe("ar");
  });
});

describe("session experience + accessibility + security", () => {
  it("waiting room → floor → pause → resume → emergency", () => {
    let s = runRealtimeEngine({
      sessionId: "s1",
      waitingRoom: true,
    }).session;
    expect(s.waitingRoom).toBe(true);
    s = enterSessionFloor(s);
    expect(s.connection).toBe("connected");
    s = pauseSession(s);
    expect(s.paused).toBe(true);
    s = resumeSession(s);
    expect(s.paused).toBe(false);
    s = emergencyTerminate(s);
    expect(s.emergencyTermination).toBe(true);
  });

  it("rotates tokens and rejects replays", () => {
    let ctx = createSecurityContext({ tokenTtlSec: 60, now: 1_000 });
    expect(isTokenExpired(ctx, 1_000)).toBe(false);
    ctx = rotateStreamToken(ctx, 1, 1_000);
    expect(ctx.nonce).toBeTruthy();
    const id = buildReplayId("sess", ctx.nonce!, 1);
    const guard = createReplayGuard(2);
    expect(guard.accept(id)).toBe(true);
    expect(guard.accept(id)).toBe(false);
  });
});

describe("observability + engine bridge", () => {
  beforeEach(() => {
    clearRealtimeMetricsForTests();
  });

  it("records metrics and runs engine bundle", () => {
    const bundle = runRealtimeEngine({
      sessionId: "sess-metrics",
      locale: "en",
      rttMs: 90,
      emotionHint: "neutral",
    });
    expect(bundle.ownership).toMatch(/Presentation/);
    expect(bundle.version.realtime_version).toBeTruthy();
    expect(buildRealtimeVersionLock().avatar_version).toBeTruthy();
    realtimeMetrics.record({
      kind: "tts_failure",
      sessionId: "sess-metrics",
      detail: "timeout",
    });
    const summary = realtimeMetrics.summary("sess-metrics");
    expect(summary.ttsFailures).toBe(1);
  });

  it("soft-fails bridge never throws", async () => {
    const result = await runRealtimeAfterAssessment(
      {} as never,
      { userId: "u1", sessionId: "s1", locale: "ar" },
    );
    expect(result.ok).toBe(true);
    expect(result.bundle?.multilingual.rtl).toBe(true);
  });

  it("audio buffer stats track underruns", () => {
    const buf = createAudioBufferManager();
    expect(buf.dequeue()).toBeNull();
    expect(buf.stats().underruns).toBe(1);
  });

  it("interrupt planner covers emergency stop", () => {
    const plan = planInterrupt("emergency_stop");
    expect(plan.abortGeneration).toBe(true);
  });
});
