/**
 * Nonverbal Behaviour Engine (NBE) — Mission 5.
 *
 * Behavior Engine → Timeline → Animation Scheduler.
 * Animations follow emotion; repetition is suppressed in the scheduler.
 */

export type {
  NonverbalChannel,
  NonverbalPhase,
  EmotionSnapshot,
  HeadVariant,
  HandVariant,
  SmileVariant,
  EyeVariant,
  ChannelVariant,
  SustainedBehavior,
  BehaviorIntent,
  BehaviorPlan,
  TimelineEvent,
  BehaviorTimeline,
  ActiveAnimationState,
  SchedulerOptions,
} from "./types";

export {
  hashSeed,
  seededInt,
  seededUnit,
  seededPick,
  clamp01,
  clamp,
} from "./seed";

export {
  affectFromDisorder,
  emotionFromAffect,
  resolveEmotionInput,
} from "./emotion";

export {
  runBehaviorEngine,
  type BehaviorEngineInput,
} from "./behavior-engine";

export {
  buildBehaviorTimeline,
  timelineFromPlan,
  remapTimelineLoop,
  type TimelineOptions,
} from "./timeline";

export {
  createAnimationScheduler,
  type AnimationScheduler,
} from "./animation-scheduler";

export {
  deriveNonverbalBehavior,
  applyAnimationState,
  planNonverbal,
  type NonverbalDeriveInput,
  type NonverbalPacket,
} from "./bridge";
