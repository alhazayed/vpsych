import { describe, expect, it } from "vitest";
import {
  canGenerateTurn,
  createTurnController,
  DEFAULT_TURN_CONFIG,
  endOfTurnLatencyMs,
  micActive,
  playbackActive,
  resolveTurnConfig,
  type TurnController,
} from "@/lib/voice/turn-controller";

/** Feed frames at a fixed cadence, returning the clock position reached. */
function feed(
  controller: TurnController,
  from: number,
  toMs: number,
  speaking: boolean,
  stepMs = 50,
): number {
  let now = from;
  while (now <= toMs) {
    controller.observe({ speaking, nowMs: now });
    now += stepMs;
  }
  return now - stepMs;
}

describe("turn controller state transitions", () => {
  it("starts in LISTENING", () => {
    expect(createTurnController().getState()).toBe("LISTENING");
  });

  it("walks the full turn: LISTENING → … → SPEAKING → LISTENING", () => {
    const c = createTurnController();

    c.observe({ speaking: true, nowMs: 0 });
    expect(c.getState()).toBe("USER_SPEAKING");

    const spokeUntil = feed(c, 0, 1000, true);
    feed(c, spokeUntil + 50, spokeUntil + 600, false);
    expect(c.getState()).toBe("POSSIBLE_END");

    feed(c, spokeUntil + 650, spokeUntil + 1500, false);
    expect(c.getState()).toBe("CONFIRMED_END");

    expect(c.confirm().to).toBe("THINKING");
    expect(c.beginSpeaking().to).toBe("SPEAKING");
    expect(c.finishSpeaking().to).toBe("LISTENING");
  });

  it("enters POSSIBLE_END only after the configured silence", () => {
    const c = createTurnController({
      possibleEndSilenceMs: 500,
      confirmEndSilenceMs: 700,
    });
    feed(c, 0, 1000, true);
    // 300 ms of silence is a normal mid-sentence pause.
    feed(c, 1050, 1300, false);
    expect(c.getState()).toBe("USER_SPEAKING");
    feed(c, 1350, 1700, false);
    expect(c.getState()).toBe("POSSIBLE_END");
  });

  it("returns the floor to the therapist when speech resumes", () => {
    const c = createTurnController();
    feed(c, 0, 1000, true);
    feed(c, 1050, 1700, false);
    expect(c.getState()).toBe("POSSIBLE_END");

    const resumed = c.observe({ speaking: true, nowMs: 1750 });
    expect(resumed.to).toBe("USER_SPEAKING");
    expect(resumed.reason).toBe("speech_resumed");
    expect(c.getState()).toBe("USER_SPEAKING");
  });

  it("does not confirm a turn that resumed mid-window", () => {
    const c = createTurnController({
      possibleEndSilenceMs: 400,
      confirmEndSilenceMs: 800,
    });
    feed(c, 0, 800, true);
    feed(c, 850, 1300, false); // → POSSIBLE_END
    expect(c.getState()).toBe("POSSIBLE_END");

    c.observe({ speaking: true, nowMs: 1350 }); // therapist keeps going
    feed(c, 1400, 2200, true);
    expect(c.getState()).toBe("USER_SPEAKING");

    // Only a full, uninterrupted silence run confirms.
    feed(c, 2250, 3600, false);
    expect(c.getState()).toBe("CONFIRMED_END");
  });

  it("will not confirm below the minimum speech duration", () => {
    const c = createTurnController({ minSpeechMs: 800 });
    c.observe({ speaking: true, nowMs: 0 });
    c.observe({ speaking: true, nowMs: 100 });
    feed(c, 150, 3000, false);
    expect(c.getState()).not.toBe("CONFIRMED_END");
  });

  it("force-confirms at the max turn ceiling", () => {
    const c = createTurnController({ maxTurnMs: 5000 });
    feed(c, 0, 5200, true, 100);
    // Speaking frames never confirm directly; the next silent frame does.
    c.observe({ speaking: false, nowMs: 5300 });
    c.observe({ speaking: false, nowMs: 5400 });
    expect(["POSSIBLE_END", "CONFIRMED_END"]).toContain(c.getState());
  });
});

describe("partial STT can never generate a turn", () => {
  it("only CONFIRMED_END permits turn generation", () => {
    for (const state of [
      "LISTENING",
      "USER_SPEAKING",
      "POSSIBLE_END",
      "THINKING",
      "SPEAKING",
    ] as const) {
      expect(canGenerateTurn(state)).toBe(false);
    }
    expect(canGenerateTurn("CONFIRMED_END")).toBe(true);
  });

  it("a transcript arriving mid-speech does not advance the machine", () => {
    const c = createTurnController();
    feed(c, 0, 600, true);
    expect(c.getState()).toBe("USER_SPEAKING");
    expect(canGenerateTurn(c.getState())).toBe(false);

    // There is deliberately no API to feed a transcript: the controller has no
    // input other than VAD frames and explicit lifecycle calls. A partial STT
    // result therefore cannot reach it.
    expect(Object.keys(c)).not.toContain("onTranscript");
    expect(Object.keys(c)).not.toContain("submitPartial");
  });

  it("a pause long enough for Web Speech to emit isFinal is still not a turn", () => {
    // Web Speech commonly emits a final result after roughly 500 ms of silence.
    const c = createTurnController({
      possibleEndSilenceMs: 500,
      confirmEndSilenceMs: 700,
    });
    feed(c, 0, 1200, true);
    feed(c, 1250, 1800, false);
    expect(c.getState()).toBe("POSSIBLE_END");
    expect(canGenerateTurn(c.getState())).toBe(false);
  });

  it("confirm() is rejected from any state other than CONFIRMED_END", () => {
    const c = createTurnController();
    expect(c.confirm().changed).toBe(false);
    expect(c.getState()).toBe("LISTENING");

    feed(c, 0, 600, true);
    expect(c.confirm().changed).toBe(false);
    expect(c.getState()).toBe("USER_SPEAKING");
  });

  it("beginSpeaking() is rejected unless the turn was confirmed", () => {
    const c = createTurnController();
    expect(c.beginSpeaking().changed).toBe(false);
    expect(c.getState()).toBe("LISTENING");
  });
});

describe("barge-in and generation", () => {
  function toSpeaking(c: TurnController) {
    feed(c, 0, 1000, true);
    feed(c, 1050, 3000, false);
    c.confirm();
    c.beginSpeaking();
  }

  it("barge-in returns to LISTENING and invalidates in-flight work", () => {
    const c = createTurnController();
    toSpeaking(c);
    const generation = c.getGeneration();
    expect(c.getState()).toBe("SPEAKING");

    const result = c.bargeIn();
    expect(result.to).toBe("LISTENING");
    expect(c.isCurrent(generation)).toBe(false);
  });

  it("barge-in is only meaningful while speaking", () => {
    const c = createTurnController();
    expect(c.bargeIn().changed).toBe(false);
  });

  it("resets speech accounting so the next turn starts clean", () => {
    const c = createTurnController();
    toSpeaking(c);
    c.finishSpeaking();
    expect(c.getSpeechMs()).toBe(0);
    expect(c.getState()).toBe("LISTENING");
  });

  it("ignores VAD frames while the patient is speaking", () => {
    const c = createTurnController();
    toSpeaking(c);
    const transition = c.observe({ speaking: true, nowMs: 9999 });
    expect(transition.changed).toBe(false);
    expect(c.getState()).toBe("SPEAKING");
  });
});

describe("configuration", () => {
  it("tolerates longer pauses than the previous hard 850 ms cut", () => {
    expect(endOfTurnLatencyMs(DEFAULT_TURN_CONFIG)).toBeGreaterThan(850);
  });

  it("clamps overrides into usable bounds", () => {
    const tiny = resolveTurnConfig({
      possibleEndSilenceMs: 1,
      confirmEndSilenceMs: 1,
      maxTurnMs: 1,
    });
    expect(tiny.possibleEndSilenceMs).toBeGreaterThanOrEqual(200);
    expect(tiny.confirmEndSilenceMs).toBeGreaterThanOrEqual(200);
    expect(tiny.maxTurnMs).toBeGreaterThanOrEqual(5000);

    const huge = resolveTurnConfig({
      possibleEndSilenceMs: 999_999,
      confirmEndSilenceMs: 999_999,
    });
    expect(huge.possibleEndSilenceMs).toBeLessThanOrEqual(1500);
    expect(huge.confirmEndSilenceMs).toBeLessThanOrEqual(2500);
  });

  it("is configurable rather than a fixed window", () => {
    const slow = createTurnController({ confirmEndSilenceMs: 1500 });
    expect(slow.getConfig().confirmEndSilenceMs).toBe(1500);
  });

  it("exposes mic and playback ownership per state", () => {
    expect(micActive("LISTENING")).toBe(true);
    expect(micActive("POSSIBLE_END")).toBe(true);
    expect(micActive("SPEAKING")).toBe(false);
    expect(playbackActive("SPEAKING")).toBe(true);
    expect(playbackActive("LISTENING")).toBe(false);
  });
});
