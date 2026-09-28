import { describe, expect, it, vi } from "vitest";
import {
  createVoiceTurnFence,
  isAbortError,
  isStaleVoiceResult,
} from "@/lib/voice/turn-fence";

describe("createVoiceTurnFence", () => {
  it("begins monotonic turn ids and rejects superseded turns", () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    const t2 = fence.beginTurn();
    expect(t2).toBeGreaterThan(t1);
    expect(fence.isActive(t1)).toBe(false);
    expect(fence.isActive(t2)).toBe(true);
    expect(fence.getActiveTurnId()).toBe(t2);
  });

  it("invalidate supersedes the active turn without a replacement id claim", () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    fence.invalidate();
    expect(fence.isActive(t1)).toBe(false);
    expect(fence.getActiveTurnId()).toBeGreaterThan(t1);
  });

  it("turn 0 is never active (uninitialized fence)", () => {
    const fence = createVoiceTurnFence();
    expect(fence.isActive(0)).toBe(false);
  });
});

describe("isStaleVoiceResult", () => {
  it("marks superseded turns stale even when the AbortSignal did not fire", () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    fence.beginTurn();
    const controller = new AbortController();
    expect(
      isStaleVoiceResult({
        turnId: t1,
        isActive: (id) => fence.isActive(id),
        signal: controller.signal,
      }),
    ).toBe(true);
  });

  it("marks aborted signals stale even when turn id is still current", () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    const controller = new AbortController();
    controller.abort();
    expect(
      isStaleVoiceResult({
        turnId: t1,
        isActive: (id) => fence.isActive(id),
        signal: controller.signal,
      }),
    ).toBe(true);
  });

  it("allows the active non-aborted turn", () => {
    const fence = createVoiceTurnFence();
    const t1 = fence.beginTurn();
    expect(
      isStaleVoiceResult({
        turnId: t1,
        isActive: (id) => fence.isActive(id),
      }),
    ).toBe(false);
  });
});

describe("isAbortError", () => {
  it("detects AbortError by name", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
    expect(isAbortError(new Error("network down"))).toBe(false);
  });
});

describe("stale turn lifecycle (phase 9.1 scenarios)", () => {
  it("Test 1 — old turn completes after new turn: old result ignored", () => {
    const fence = createVoiceTurnFence();
    const oldTurn = fence.beginTurn();
    const newTurn = fence.beginTurn();
    const apply = (turnId: number, label: string, sink: string[]) => {
      if (!fence.isActive(turnId)) return;
      sink.push(label);
    };
    const sink: string[] = [];
    apply(oldTurn, "old", sink);
    apply(newTurn, "new", sink);
    expect(sink).toEqual(["new"]);
  });

  it("Test 5 — two rapid turns: only newest updates active voice state", () => {
    const fence = createVoiceTurnFence();
    let speakingFor: number | null = null;
    const setSpeaking = (turnId: number) => {
      if (!fence.isActive(turnId)) return;
      speakingFor = turnId;
    };
    const t1 = fence.beginTurn();
    const t2 = fence.beginTurn();
    setSpeaking(t1);
    setSpeaking(t2);
    expect(speakingFor).toBe(t2);
  });

  it("Test 8 — interrupted server response cannot create duplicate playback", () => {
    const fence = createVoiceTurnFence();
    const play = vi.fn();
    const turn41 = fence.beginTurn();
    // Therapist interrupts → turn 42
    const turn42 = fence.beginTurn();
    // Late turn 41 TTS resolves
    if (fence.isActive(turn41)) play("turn41");
    if (fence.isActive(turn42)) play("turn42");
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("turn42");
  });
});
