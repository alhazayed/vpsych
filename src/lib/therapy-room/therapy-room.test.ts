import { describe, expect, it, afterEach, vi } from "vitest";
import {
  computeImmersionIndex,
  createImmersionTracker,
  derivePatientBehavior,
  deterministicJitter,
  isTherapyRoomModeEnabled,
  parseInteractionMode,
  resolveTherapyRoomTheme,
  shouldPatientInterruptTherapist,
  shouldUseTherapyRoom,
  thinkingLatencyMs,
  voiceModulationForDisorder,
} from "@/lib/therapy-room";

describe("therapy-room feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_THERAPY_ROOM_MODE", "");
    expect(isTherapyRoomModeEnabled()).toBe(false);
    expect(shouldUseTherapyRoom("therapy_room")).toBe(false);
  });

  it("requires flag and explicit therapy_room request", () => {
    vi.stubEnv("NEXT_PUBLIC_THERAPY_ROOM_MODE", "true");
    expect(isTherapyRoomModeEnabled()).toBe(true);
    expect(shouldUseTherapyRoom("classic")).toBe(false);
    expect(shouldUseTherapyRoom("therapy_room")).toBe(true);
    expect(parseInteractionMode("therapy_room")).toBe("therapy_room");
    expect(parseInteractionMode("nope")).toBe("classic");
  });
});

describe("PME bridge", () => {
  it("never uses random — same seed yields same latency", () => {
    const a = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "sess-1:3",
    });
    const b = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "sess-1:3",
    });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(1500);
  });

  it("depression thinks slower than mania", () => {
    const dep = thinkingLatencyMs({
      disorderSlug: "mdd-recurrent-moderate",
      seed: "x",
    });
    const mania = thinkingLatencyMs({
      disorderSlug: "bipolar-mania",
      seed: "x",
    });
    expect(dep).toBeGreaterThan(mania);
  });

  it("emits phase-specific cues from diagnosis", () => {
    const thinking = derivePatientBehavior({
      disorderSlug: "ptsd",
      phase: "thinking",
      seed: "s",
    });
    expect(thinking.activeCues).toContain("look_away");
    expect(thinking.animationHooks.length).toBeGreaterThan(0);
    expect(thinking.mayInterruptTherapist).toBe(true);
  });

  it("deterministic jitter is stable", () => {
    expect(deterministicJitter("abc", 100)).toBe(
      deterministicJitter("abc", 100),
    );
  });
});

describe("patient interruption", () => {
  it("blocks non-interruptive disorders", () => {
    expect(
      shouldPatientInterruptTherapist({
        disorderSlug: "mdd-recurrent-moderate",
        therapistSpeechMs: 8000,
        seed: "any",
      }),
    ).toBe(false);
  });

  it("allows mania after enough therapist speech when seed agrees", () => {
    // Scan seeds until we find one that hits and one that misses — proves gating works.
    let hit = false;
    let miss = false;
    for (let i = 0; i < 200; i++) {
      const r = shouldPatientInterruptTherapist({
        disorderSlug: "bipolar-mania",
        therapistSpeechMs: 5000,
        seed: `seed-${i}`,
      });
      if (r) hit = true;
      else miss = true;
      if (hit && miss) break;
    }
    expect(hit).toBe(true);
    expect(miss).toBe(true);
  });
});

describe("voice modulation", () => {
  it("slows depressed speech and speeds mania", () => {
    const dep = voiceModulationForDisorder("mdd-recurrent-moderate");
    const mania = voiceModulationForDisorder("bipolar-mania");
    expect(dep.rate).toBeLessThan(1);
    expect(mania.rate).toBeGreaterThan(1);
  });
});

describe("themes", () => {
  it("resolves known and unknown theme ids", () => {
    expect(resolveTherapyRoomTheme("private_practice").id).toBe(
      "private_practice",
    );
    expect(resolveTherapyRoomTheme(null).id).toBe("modern_clinic");
  });
});

describe("TRII immersion index", () => {
  it("scores hands-free continuous sessions highly", () => {
    const tracker = createImmersionTracker();
    tracker.track("session_start");
    for (let i = 0; i < 8; i++) tracker.track("hands_free_turn");
    tracker.track("session_end");
    const index = tracker.finalize();
    expect(index.handsFreeUsage).toBe(100);
    expect(index.overall).toBeGreaterThanOrEqual(70);
  });

  it("penalizes transcript and text dependency", () => {
    const low = computeImmersionIndex([
      { kind: "session_start", at: 0 },
      { kind: "text_turn", at: 1 },
      { kind: "text_turn", at: 2 },
      { kind: "transcript_opened", at: 3 },
      { kind: "transcript_opened", at: 4 },
      { kind: "pause", at: 5 },
      { kind: "settings_open", at: 6 },
      { kind: "session_end", at: 7 },
    ]);
    const high = computeImmersionIndex([
      { kind: "session_start", at: 0 },
      { kind: "hands_free_turn", at: 1 },
      { kind: "hands_free_turn", at: 2 },
      { kind: "hands_free_turn", at: 3 },
      { kind: "session_end", at: 4 },
    ]);
    expect(high.overall).toBeGreaterThan(low.overall);
  });
});
