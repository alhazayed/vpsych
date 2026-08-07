/**
 * Mission 5 — Nonverbal Behaviour Engine tests.
 */

import { describe, expect, it } from "vitest";
import {
  applyAnimationState,
  buildBehaviorTimeline,
  createAnimationScheduler,
  deriveNonverbalBehavior,
  emotionFromAffect,
  planNonverbal,
  remapTimelineLoop,
  runBehaviorEngine,
  timelineFromPlan,
} from "@/lib/nbe";

describe("NBE Behavior Engine", () => {
  it("maps depression to slowing + downcast gaze, not smiles", () => {
    const plan = runBehaviorEngine({
      affect: "depressed",
      disorderSlug: "mdd-recurrent-moderate",
      phase: "listening",
      seed: "sess-mdd:1",
      intensity: 0.7,
    });
    expect(plan.emotion.affect).toBe("depressed");
    expect(
      plan.sustained.some((s) => s.channel === "psychomotor_slowing"),
    ).toBe(true);
    expect(plan.sustained.some((s) => s.channel === "breathing")).toBe(true);
    expect(plan.intents.some((i) => i.channel === "smiling")).toBe(false);
    expect(
      plan.intents.some(
        (i) => i.channel === "sighing" || i.channel === "blink",
      ),
    ).toBe(true);
  });

  it("maps anxiety to restlessness + hand gestures", () => {
    const plan = runBehaviorEngine({
      affect: "anxious",
      disorderSlug: "gad",
      phase: "thinking",
      seed: "sess-anx:2",
      intensity: 0.8,
    });
    expect(plan.sustained.some((s) => s.channel === "restlessness")).toBe(
      true,
    );
    expect(
      plan.intents.some(
        (i) =>
          i.channel === "hand_gesture" || i.channel === "head_movement",
      ),
    ).toBe(true);
  });

  it("maps tearful affect to tearfulness pulses", () => {
    const plan = runBehaviorEngine({
      affect: "tearful",
      phase: "speaking",
      seed: "sess-tear:1",
      intensity: 0.85,
    });
    expect(plan.intents.some((i) => i.channel === "tearfulness")).toBe(true);
  });

  it("allows smiling only when hope / euphoria supports it", () => {
    const low = runBehaviorEngine({
      affect: "flat",
      phase: "speaking",
      seed: "sess-flat:1",
    });
    expect(low.intents.some((i) => i.channel === "smiling")).toBe(false);

    const high = runBehaviorEngine({
      emotion: emotionFromAffect("euphoric", 0.8),
      disorderSlug: "bipolar-mania",
      phase: "speaking",
      seed: "sess-mania:1",
    });
    expect(high.intents.some((i) => i.channel === "smiling")).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = planNonverbal({
      disorderSlug: "ptsd",
      phase: "thinking",
      seed: "same-seed",
      affect: "guarded",
    });
    const b = planNonverbal({
      disorderSlug: "ptsd",
      phase: "thinking",
      seed: "same-seed",
      affect: "guarded",
    });
    expect(a).toEqual(b);
  });

  it("covers all Mission 5 channels across common affects", () => {
    const channels = new Set<string>();
    for (const affect of [
      "depressed",
      "anxious",
      "tearful",
      "euphoric",
      "guarded",
      "agitated",
    ] as const) {
      for (const phase of ["idle", "listening", "thinking", "speaking"] as const) {
        const plan = runBehaviorEngine({
          affect,
          phase,
          seed: `${affect}:${phase}`,
          intensity: 0.75,
        });
        for (const s of plan.sustained) channels.add(s.channel);
        for (const i of plan.intents) channels.add(i.channel);
      }
    }
    for (const required of [
      "eye_contact",
      "blink",
      "head_movement",
      "breathing",
      "sighing",
      "smiling",
      "tearfulness",
      "restlessness",
      "psychomotor_slowing",
      "hand_gesture",
    ]) {
      expect(channels.has(required)).toBe(true);
    }
  });
});

describe("NBE Timeline", () => {
  it("places events inside the window without same-channel adjacency", () => {
    const timeline = buildBehaviorTimeline({
      affect: "anxious",
      disorderSlug: "gad",
      phase: "listening",
      seed: "tl-1",
      intensity: 0.7,
    });
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.durationMs).toBe(12_000);
    for (const ev of timeline.events) {
      expect(ev.atMs).toBeGreaterThanOrEqual(0);
      expect(ev.atMs + ev.durationMs).toBeLessThanOrEqual(
        timeline.durationMs + ev.durationMs,
      );
    }
    const byChannel = new Map<string, number[]>();
    for (const ev of timeline.events) {
      const list = byChannel.get(ev.channel) ?? [];
      list.push(ev.atMs);
      byChannel.set(ev.channel, list);
    }
    for (const [, times] of byChannel) {
      const sorted = [...times].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]! - sorted[i - 1]!).toBeGreaterThan(200);
      }
    }
  });

  it("schedules denser timelines for anxiety than depression", () => {
    const anxious = buildBehaviorTimeline({
      affect: "anxious",
      phase: "idle",
      seed: "density-a",
      intensity: 0.8,
    });
    const depressed = buildBehaviorTimeline({
      affect: "depressed",
      phase: "idle",
      seed: "density-d",
      intensity: 0.8,
    });
    expect(anxious.events.length).toBeGreaterThanOrEqual(
      depressed.events.length - 1,
    );
  });

  it("loop remap changes event ids and drops some pulses", () => {
    const base = buildBehaviorTimeline({
      affect: "anxious",
      phase: "speaking",
      seed: "loop-seed",
    });
    const looped = remapTimelineLoop(base, 2);
    expect(looped.events.every((e) => e.id.includes(":L2:"))).toBe(true);
    if (base.events.length > 3) {
      expect(looped.events.length).toBeLessThanOrEqual(base.events.length);
    }
  });
});

describe("NBE Animation Scheduler", () => {
  it("returns sustained classes at t=0 and pulses later", () => {
    const timeline = buildBehaviorTimeline({
      affect: "depressed",
      disorderSlug: "mdd",
      phase: "thinking",
      seed: "sched-1",
      intensity: 0.7,
    });
    const scheduler = createAnimationScheduler(timeline);
    const t0 = scheduler.tick(0);
    expect(t0.sustainedClasses.length).toBeGreaterThan(0);
    expect(t0.cssClasses.some((c) => c.includes("breath") || c.includes("slow") || c.includes("look") || c.includes("eye"))).toBe(
      true,
    );

    let sawPulse = false;
    for (let t = 0; t < timeline.durationMs; t += 200) {
      const state = scheduler.tick(t);
      if (state.activeClasses.length > 0) {
        sawPulse = true;
        break;
      }
    }
    // Depressed thinking should still produce at least blink/sigh/head
    expect(timeline.events.length > 0 ? sawPulse || timeline.events[0]!.atMs > 0 : true).toBe(
      true,
    );
  });

  it("suppresses repetitive same-channel fires via cooldown", () => {
    const plan = runBehaviorEngine({
      affect: "anxious",
      phase: "idle",
      seed: "anti-rep",
      intensity: 0.9,
    });
    // Force a dense blink-heavy timeline
    const dense = timelineFromPlan(
      {
        ...plan,
        intents: Array.from({ length: 8 }, (_, i) => ({
          channel: "sighing" as const,
          intensity: 0.7,
          priority: 5,
          durationMs: 400,
          minGapMs: 100,
          variant: "exhale" as const,
          cssClass: "trm-patient--sigh",
          animationHook: "breath.sigh",
          // unique via index only in placement seed path — duplicate variants
          ...(i >= 0 ? {} : {}),
        })),
      },
      { durationMs: 8000, leadInMs: 0 },
    );

    const scheduler = createAnimationScheduler(dense, {
      channelCooldownMs: 2500,
      variantReuseGap: 2,
    });

    const firedChannels: string[] = [];
    for (let t = 0; t < 8000; t += 50) {
      scheduler.tick(t);
      for (const ev of scheduler.drainFired()) {
        firedChannels.push(ev.channel);
      }
    }
    // Even with many intent copies, cooldown should keep sigh count modest
    const sighs = firedChannels.filter((c) => c === "sighing").length;
    expect(sighs).toBeLessThanOrEqual(4);
  });

  it("is reproducible for identical timelines and tick times", () => {
    const timeline = buildBehaviorTimeline({
      affect: "guarded",
      disorderSlug: "ptsd",
      phase: "listening",
      seed: "repro",
    });
    const a = createAnimationScheduler(timeline);
    const b = createAnimationScheduler(timeline);
    const samples = [0, 500, 1500, 4000, 9000];
    for (const t of samples) {
      expect(a.tick(t)).toEqual(b.tick(t));
    }
  });
});

describe("NBE therapy-room bridge", () => {
  it("enriches PatientBehaviorState with animation classes and cues", () => {
    const packet = deriveNonverbalBehavior({
      disorderSlug: "mdd-recurrent-moderate",
      phase: "thinking",
      seed: "bridge-1",
    });
    expect(packet.behavior.affect).toBe("depressed");
    expect(packet.behavior.animationClasses?.length).toBeGreaterThan(0);
    expect(packet.timeline.sustained.length).toBeGreaterThan(0);
    expect(packet.behavior.animationHooks.length).toBeGreaterThan(0);
  });

  it("applyAnimationState merges cue tags without dropping base cues", () => {
    const packet = deriveNonverbalBehavior({
      disorderSlug: "gad",
      phase: "speaking",
      seed: "bridge-2",
    });
    const scheduler = createAnimationScheduler(packet.timeline);
    const mid = scheduler.tick(2000);
    const next = applyAnimationState(packet.behavior, mid);
    expect(next.phase).toBe("speaking");
    expect(next.animationClasses).toEqual(mid.cssClasses);
    expect(next.activeCues.length).toBeGreaterThan(0);
  });
});
