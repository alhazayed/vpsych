/**
 * Animation Scheduler — plays a BehaviorTimeline without repetitive animation.
 *
 * Client or server may call `tick(elapsedMs)` to get ActiveAnimationState.
 * Cooldown + variant-reuse rules suppress loops even if the timeline is dense.
 */

import { remapTimelineLoop } from "./timeline";
import type {
  ActiveAnimationState,
  BehaviorTimeline,
  NonverbalChannel,
  SchedulerOptions,
  TimelineEvent,
} from "./types";

const DEFAULT_COOLDOWN = 2400;
const DEFAULT_VARIANT_GAP = 2;

export type AnimationScheduler = {
  readonly timeline: BehaviorTimeline;
  /** Absolute elapsed ms since start (may exceed one window; loops). */
  tick: (elapsedMs: number) => ActiveAnimationState;
  /** Events that fired since the previous tick (edge-triggered). */
  drainFired: () => TimelineEvent[];
  reset: () => void;
  /** Active CSS class list at last tick. */
  lastState: () => ActiveAnimationState | null;
};

export function createAnimationScheduler(
  timeline: BehaviorTimeline,
  options: SchedulerOptions = {},
): AnimationScheduler {
  const channelCooldownMs = options.channelCooldownMs ?? DEFAULT_COOLDOWN;
  const variantReuseGap = options.variantReuseGap ?? DEFAULT_VARIANT_GAP;

  let lastState: ActiveAnimationState | null = null;
  let lastElapsed = -1;
  let firedBuffer: TimelineEvent[] = [];
  const channelLastFire = new Map<NonverbalChannel, number>();
  const recentVariants: Array<{ channel: NonverbalChannel; variant: string }> =
    [];
  const suppressed = new Set<string>();

  function resolveWindow(elapsedMs: number): {
    localMs: number;
    events: TimelineEvent[];
    loopIndex: number;
  } {
    const dur = Math.max(1, timeline.durationMs);
    const loopIndex = Math.floor(Math.max(0, elapsedMs) / dur);
    const localMs = Math.max(0, elapsedMs) % dur;
    if (loopIndex === 0) {
      return { localMs, events: timeline.events, loopIndex };
    }
    const remapped = remapTimelineLoop(timeline, loopIndex);
    // Remapped events have absolute atMs; convert to local for this window
    const events = remapped.events.map((ev) => ({
      ...ev,
      atMs: ev.atMs - loopIndex * dur,
    }));
    return { localMs, events, loopIndex };
  }

  function allowed(ev: TimelineEvent, absoluteMs: number): boolean {
    if (suppressed.has(ev.id)) return false;

    const last = channelLastFire.get(ev.channel);
    if (last != null && absoluteMs - last < channelCooldownMs) {
      // Blink is allowed slightly more often but still jittered
      if (ev.channel !== "blink" || absoluteMs - last < channelCooldownMs * 0.55) {
        return false;
      }
    }

    const sameVariantRecent = recentVariants
      .slice(-variantReuseGap)
      .some((r) => r.channel === ev.channel && r.variant === ev.variant);
    if (sameVariantRecent && ev.channel !== "blink") return false;

    return true;
  }

  function remember(ev: TimelineEvent, absoluteMs: number): void {
    channelLastFire.set(ev.channel, absoluteMs);
    recentVariants.push({ channel: ev.channel, variant: String(ev.variant) });
    if (recentVariants.length > 12) recentVariants.shift();
  }

  function tick(elapsedMs: number): ActiveAnimationState {
    const absoluteMs = Math.max(0, elapsedMs);
    const { localMs, events } = resolveWindow(absoluteMs);

    const sustainedClasses = timeline.sustained.map((s) => s.cssClass);
    const sustainedHooks = timeline.sustained.map((s) => s.animationHook);
    const active: TimelineEvent[] = [];

    for (const ev of events) {
      const start = ev.atMs;
      const end = ev.atMs + ev.durationMs;
      const inWindow = localMs >= start && localMs < end;
      const justStarted =
        lastElapsed >= 0 &&
        lastElapsed % timeline.durationMs < start &&
        localMs >= start;

      if (inWindow || justStarted) {
        if (!allowed(ev, absoluteMs)) {
          suppressed.add(ev.id);
          continue;
        }
        if (justStarted || (lastElapsed < 0 && localMs >= start && localMs < end)) {
          if (!firedBuffer.some((f) => f.id === ev.id)) {
            firedBuffer.push(ev);
            remember(ev, absoluteMs);
          }
        } else if (inWindow) {
          // Mid-event on first tick into an ongoing pulse
          remember(ev, absoluteMs);
        }
        if (inWindow) active.push(ev);
      }
    }

    const activeClasses = unique(active.map((e) => e.cssClass));
    const pulseHooks = active.map((e) => e.animationHook);
    const activeChannels = unique(active.map((e) => e.channel));
    const cssClasses = unique([...sustainedClasses, ...activeClasses]);
    const animationHooks = unique([...sustainedHooks, ...pulseHooks]);
    const cueTags = cuesFromState(cssClasses, activeChannels, timeline);

    lastState = {
      atMs: absoluteMs,
      sustainedClasses,
      activeClasses,
      cssClasses,
      animationHooks,
      activeChannels,
      cueTags,
    };
    lastElapsed = absoluteMs;
    return lastState;
  }

  return {
    timeline,
    tick,
    drainFired: () => {
      const out = firedBuffer;
      firedBuffer = [];
      return out;
    },
    reset: () => {
      lastState = null;
      lastElapsed = -1;
      firedBuffer = [];
      channelLastFire.clear();
      recentVariants.length = 0;
      suppressed.clear();
    },
    lastState: () => lastState,
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/**
 * Map scheduler CSS / channels onto therapy-room NonverbalCue-compatible tags.
 */
function cuesFromState(
  cssClasses: string[],
  channels: NonverbalChannel[],
  timeline: BehaviorTimeline,
): string[] {
  const tags = new Set<string>();

  if (channels.includes("blink") || cssClasses.some((c) => c.includes("blink"))) {
    tags.add("blink");
  }
  if (
    channels.includes("eye_contact") ||
    cssClasses.some((c) => c.includes("eye-contact"))
  ) {
    tags.add("eye_contact");
  }
  if (cssClasses.some((c) => c.includes("look-away"))) {
    tags.add("look_away");
  }
  if (cssClasses.some((c) => c.includes("head-down"))) {
    tags.add("head_down");
  }
  if (cssClasses.some((c) => c.includes("sigh"))) {
    tags.add("sigh");
  }
  if (cssClasses.some((c) => c.includes("tears"))) {
    tags.add("tears");
  }
  if (
    channels.includes("restlessness") ||
    cssClasses.some((c) => c.includes("fidget"))
  ) {
    tags.add("fidget");
    tags.add("restlessness");
  }
  if (
    channels.includes("psychomotor_slowing") ||
    cssClasses.some((c) => c.includes("--slow"))
  ) {
    tags.add("slow_movements");
    tags.add("psychomotor_retardation");
  }
  if (cssClasses.some((c) => c.includes("hand-tremor"))) {
    tags.add("hand_tremor");
  }
  if (cssClasses.some((c) => c.includes("breath"))) {
    tags.add("idle_breathing");
  }
  if (cssClasses.some((c) => c.includes("smile"))) {
    tags.add("smile");
  }
  if (cssClasses.some((c) => c.includes("hand-"))) {
    tags.add("hand_gesture");
  }
  if (cssClasses.some((c) => c.includes("head-nod") || c.includes("head-tilt") || c.includes("head-shake"))) {
    tags.add("head_movement");
  }

  // Phase silence
  if (timeline.phase === "silent") tags.add("silence");

  return [...tags];
}
