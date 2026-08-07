/**
 * Bridge: Nonverbal Behaviour Engine → therapy-room PatientBehaviorState.
 */

import { createAnimationScheduler } from "./animation-scheduler";
import { runBehaviorEngine } from "./behavior-engine";
import { buildBehaviorTimeline } from "./timeline";
import type {
  ActiveAnimationState,
  BehaviorTimeline,
  EmotionSnapshot,
  NonverbalPhase,
} from "./types";
import type {
  NonverbalCue,
  PatientAffect,
  PatientBehaviorState,
  PatientPresencePhase,
} from "@/lib/therapy-room/types";
import { derivePatientBehavior } from "@/lib/therapy-room/pme-bridge";

const AFFECTS: ReadonlySet<string> = new Set([
  "neutral",
  "anxious",
  "depressed",
  "irritable",
  "euphoric",
  "guarded",
  "tearful",
  "agitated",
  "flat",
  "labile",
]);

const CUES: ReadonlySet<string> = new Set([
  "idle_breathing",
  "blink",
  "look_away",
  "eye_contact",
  "fidget",
  "posture_shift",
  "sigh",
  "tears",
  "laughter",
  "silence",
  "cross_arms",
  "head_down",
  "restlessness",
  "hand_tremor",
  "slow_movements",
  "psychomotor_agitation",
  "psychomotor_retardation",
  "smile",
  "hand_gesture",
  "head_movement",
]);

export type NonverbalDeriveInput = {
  disorderSlug?: string | null;
  phase: PatientPresencePhase | NonverbalPhase;
  seed: string;
  emotion?: EmotionSnapshot | null;
  affect?: string | null;
  intensity?: number;
  /** Timeline window ms (default 12000). */
  windowMs?: number;
};

export type NonverbalPacket = {
  behavior: PatientBehaviorState;
  timeline: BehaviorTimeline;
  /** Initial tick at t=0 (sustained only / early pulses). */
  animation: ActiveAnimationState;
};

/**
 * Derive PME-compatible behavior enriched with an NBE timeline.
 * Drop-in upgrade path for `derivePatientBehavior`.
 */
export function deriveNonverbalBehavior(
  input: NonverbalDeriveInput,
): NonverbalPacket {
  const phase = input.phase as NonverbalPhase;
  const base = derivePatientBehavior({
    disorderSlug: input.disorderSlug,
    phase: input.phase as PatientPresencePhase,
    seed: input.seed,
  });

  const emotion =
    input.emotion ??
    (input.affect
      ? ({
          affect: input.affect,
          intensity: input.intensity ?? 0.55,
        } satisfies EmotionSnapshot)
      : ({
          affect: base.affect,
          intensity: input.intensity ?? 0.55,
        } satisfies EmotionSnapshot));

  const timeline = buildBehaviorTimeline(
    {
      emotion,
      disorderSlug: input.disorderSlug,
      phase,
      seed: input.seed,
      affect: input.affect ?? base.affect,
      intensity: input.intensity,
    },
    { durationMs: input.windowMs ?? 12_000 },
  );

  const scheduler = createAnimationScheduler(timeline);
  const animation = scheduler.tick(0);

  const affect = toAffect(timeline.emotion.affect, base.affect);
  const activeCues = mergeCues(base.activeCues, animation.cueTags);
  const animationHooks = unique([
    ...base.animationHooks,
    ...animation.animationHooks,
  ]);

  return {
    behavior: {
      ...base,
      affect,
      activeCues,
      animationHooks,
      animationClasses: animation.cssClasses,
    },
    timeline,
    animation,
  };
}

/** Apply scheduler state onto a PatientBehaviorState (per-frame). */
export function applyAnimationState(
  behavior: PatientBehaviorState,
  state: ActiveAnimationState,
): PatientBehaviorState {
  return {
    ...behavior,
    activeCues: mergeCues(behavior.activeCues, state.cueTags),
    animationHooks: unique([
      ...behavior.animationHooks.filter((h) => !h.startsWith("nbe.")),
      ...state.animationHooks,
    ]),
    animationClasses: state.cssClasses,
  };
}

export function planNonverbal(input: NonverbalDeriveInput) {
  return runBehaviorEngine({
    emotion: input.emotion,
    disorderSlug: input.disorderSlug,
    phase: input.phase as NonverbalPhase,
    seed: input.seed,
    affect: input.affect,
    intensity: input.intensity,
  });
}

function toAffect(label: string, fallback: PatientAffect): PatientAffect {
  const key = label.toLowerCase();
  if (AFFECTS.has(key)) return key as PatientAffect;
  return fallback;
}

function mergeCues(
  base: NonverbalCue[],
  tags: string[],
): NonverbalCue[] {
  const out = new Set<NonverbalCue>(base);
  for (const t of tags) {
    if (CUES.has(t)) out.add(t as NonverbalCue);
  }
  return [...out];
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
