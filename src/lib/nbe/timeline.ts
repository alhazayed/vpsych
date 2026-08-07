/**
 * Behavior Timeline — places Behavior Engine intents onto a time axis.
 *
 * Rules:
 * - Emotion-weighted spacing (anxious denser, depressed sparser)
 * - No same-channel back-to-back
 * - Respect each intent's minGapMs
 * - Sustained behaviors are not timed pulses (carried on the timeline object)
 */

import { runBehaviorEngine, type BehaviorEngineInput } from "./behavior-engine";
import { clamp, seededInt, seededUnit } from "./seed";
import type {
  BehaviorIntent,
  BehaviorPlan,
  BehaviorTimeline,
  TimelineEvent,
} from "./types";

export type TimelineOptions = {
  /** Total window to schedule into (default 12s). */
  durationMs?: number;
  /** Soft start delay so entrance isn't a cue barrage (default 400ms). */
  leadInMs?: number;
};

export function buildBehaviorTimeline(
  input: BehaviorEngineInput,
  options: TimelineOptions = {},
): BehaviorTimeline {
  const plan = runBehaviorEngine(input);
  return timelineFromPlan(plan, options);
}

export function timelineFromPlan(
  plan: BehaviorPlan,
  options: TimelineOptions = {},
): BehaviorTimeline {
  const durationMs = options.durationMs ?? 12_000;
  const leadInMs = options.leadInMs ?? 400;
  const events = placeIntents(plan.intents, plan, durationMs, leadInMs);

  return {
    durationMs,
    emotion: plan.emotion,
    phase: plan.phase,
    disorderSlug: plan.disorderSlug,
    seed: plan.seed,
    sustained: plan.sustained,
    events,
  };
}

function placeIntents(
  intents: BehaviorIntent[],
  plan: BehaviorPlan,
  durationMs: number,
  leadInMs: number,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const lastAt = new Map<string, number>();
  const density = densityFactor(plan);
  let cursor = leadInMs;
  let seq = 0;

  // Prefer higher priority first, but stagger by channel
  const ordered = [...intents].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.channel.localeCompare(b.channel);
  });

  for (let i = 0; i < ordered.length; i++) {
    const intent = ordered[i]!;
    const last = lastAt.get(intent.channel) ?? -Infinity;
    const gapFloor = Math.round(intent.minGapMs / density);
    const jitter = seededInt(`${plan.seed}:gap:${i}:${intent.channel}`, 700);
    let at = Math.max(cursor, last + gapFloor) + jitter;

    // If we would overrun, try to fit earlier in a free slot
    if (at + intent.durationMs > durationMs) {
      const early = findSlot(events, intent, leadInMs, durationMs, gapFloor);
      if (early == null) continue;
      at = early;
    }

    // Reject same-channel adjacency even after jitter
    if (at - last < gapFloor * 0.85) continue;

    // Reject identical variant too soon
    if (recentSameVariant(events, intent, at, 2)) continue;

    const id = `${intent.channel}:${seq}:${at}`;
    events.push({
      id,
      atMs: at,
      channel: intent.channel,
      intensity: intent.intensity,
      durationMs: intent.durationMs,
      variant: intent.variant,
      cssClass: intent.cssClass,
      animationHook: intent.animationHook,
    });
    lastAt.set(intent.channel, at);
    seq += 1;

    // Advance cursor with emotion-scaled step (avoid metronomic cadence)
    const stepBase = Math.round(900 / density);
    const stepJitter = seededInt(`${plan.seed}:step:${seq}`, stepBase);
    cursor = at + Math.round(intent.durationMs * 0.35) + stepJitter;
  }

  return events.sort((a, b) => a.atMs - b.atMs);
}

function densityFactor(plan: BehaviorPlan): number {
  const e = plan.emotion;
  const anxiety = typeof e.anxiety === "number" ? e.anxiety : 0;
  const activation = typeof e.activation === "number" ? e.activation : 0;
  const sadness = typeof e.sadness === "number" ? e.sadness : 0;
  const fatigue = typeof e.fatigue === "number" ? e.fatigue : 0;
  // >1 = denser schedule; <1 = sparser
  const raw = 1 + anxiety * 0.45 + activation * 0.35 - sadness * 0.35 - fatigue * 0.25;
  return clamp(raw, 0.55, 1.6);
}

function findSlot(
  existing: TimelineEvent[],
  intent: BehaviorIntent,
  leadInMs: number,
  durationMs: number,
  gapFloor: number,
): number | null {
  const candidates: number[] = [leadInMs];
  for (const ev of existing) {
    candidates.push(ev.atMs + ev.durationMs + 200);
  }
  for (const c of candidates) {
    if (c + intent.durationMs > durationMs) continue;
    const conflict = existing.some((ev) => {
      if (ev.channel !== intent.channel) return false;
      return Math.abs(ev.atMs - c) < gapFloor;
    });
    if (!conflict) return c;
  }
  return null;
}

function recentSameVariant(
  events: TimelineEvent[],
  intent: BehaviorIntent,
  atMs: number,
  gapEvents: number,
): boolean {
  const prior = events
    .filter((e) => e.atMs <= atMs)
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, gapEvents);
  return prior.some(
    (e) => e.channel === intent.channel && e.variant === intent.variant,
  );
}

/** Loop-safe: advance a looping window without repeating the same event ids. */
export function remapTimelineLoop(
  timeline: BehaviorTimeline,
  loopIndex: number,
): BehaviorTimeline {
  if (loopIndex <= 0) return timeline;
  // Shift event times into next window and lightly permute order via seed
  const shift = loopIndex * timeline.durationMs;
  const rotate = seededInt(`${timeline.seed}:loop:${loopIndex}`, Math.max(1, timeline.events.length));
  const rotated =
    timeline.events.length === 0
      ? []
      : [
          ...timeline.events.slice(rotate),
          ...timeline.events.slice(0, rotate),
        ];
  // Drop ~15% of pulses on later loops so patterns don't feel identical
  const kept = rotated.filter((_, i) => {
    const u = seededUnit(`${timeline.seed}:drop:${loopIndex}:${i}`);
    return u > 0.15;
  });
  return {
    ...timeline,
    events: kept.map((ev, i) => ({
      ...ev,
      id: `${ev.id}:L${loopIndex}:${i}`,
      atMs: (ev.atMs % timeline.durationMs) + shift,
    })),
  };
}
