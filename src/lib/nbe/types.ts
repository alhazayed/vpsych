/**
 * Nonverbal Behaviour Engine (NBE) — Mission 5.
 *
 * Patients communicate without speaking. Animations are emotion-driven and
 * never random; anti-repetition is enforced by the Animation Scheduler.
 */

/** Discrete animation channels required by Mission 5. */
export type NonverbalChannel =
  | "eye_contact"
  | "blink"
  | "head_movement"
  | "breathing"
  | "sighing"
  | "smiling"
  | "tearfulness"
  | "restlessness"
  | "psychomotor_slowing"
  | "hand_gesture";

/** Session presence phase — aligned with therapy-room PatientPresencePhase. */
export type NonverbalPhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "silent";

/**
 * Emotion snapshot driving nonverbal choice.
 * Compatible with a future Emotion Engine; NBE never invents emotion.
 */
export type EmotionSnapshot = {
  /** Primary affect label (e.g. depressed, anxious, tearful). */
  affect: string;
  /** Overall intensity 0–1. */
  intensity: number;
  sadness?: number;
  anxiety?: number;
  anger?: number;
  hope?: number;
  fatigue?: number;
  shame?: number;
  activation?: number;
};

/** Head / hand micro-variants — scheduled as pulse events, not loops. */
export type HeadVariant = "nod" | "tilt" | "down" | "shake" | "away";
export type HandVariant = "fidget" | "tremor" | "open" | "self_soothe" | "still";
export type SmileVariant = "soft" | "polite" | "brief" | "none";
export type EyeVariant = "hold" | "glance" | "avert" | "scan";

export type ChannelVariant =
  | HeadVariant
  | HandVariant
  | SmileVariant
  | EyeVariant
  | "inhale"
  | "exhale"
  | "deep"
  | "shallow"
  | "tear"
  | "blink"
  | "default";

/** Sustained postural / motor tone — held for the whole window. */
export type SustainedBehavior = {
  channel: Extract<
    NonverbalChannel,
    "breathing" | "psychomotor_slowing" | "restlessness" | "eye_contact"
  >;
  intensity: number;
  variant: ChannelVariant;
  cssClass: string;
  animationHook: string;
};

/** Candidate pulse intent before timeline placement. */
export type BehaviorIntent = {
  channel: NonverbalChannel;
  intensity: number;
  priority: number;
  durationMs: number;
  /** Preferred gap before another event of this channel. */
  minGapMs: number;
  variant: ChannelVariant;
  cssClass: string;
  animationHook: string;
};

export type BehaviorPlan = {
  emotion: EmotionSnapshot;
  phase: NonverbalPhase;
  disorderSlug: string;
  sustained: SustainedBehavior[];
  intents: BehaviorIntent[];
  seed: string;
};

export type TimelineEvent = {
  id: string;
  /** Offset from timeline start (ms). */
  atMs: number;
  channel: NonverbalChannel;
  intensity: number;
  durationMs: number;
  variant: ChannelVariant;
  cssClass: string;
  animationHook: string;
};

export type BehaviorTimeline = {
  durationMs: number;
  emotion: EmotionSnapshot;
  phase: NonverbalPhase;
  disorderSlug: string;
  seed: string;
  sustained: SustainedBehavior[];
  events: TimelineEvent[];
};

/** What the renderer should show at a given clock time. */
export type ActiveAnimationState = {
  atMs: number;
  /** Sustained classes always on. */
  sustainedClasses: string[];
  /** Pulse classes currently within their duration window. */
  activeClasses: string[];
  /** All CSS modifiers for PatientPresence. */
  cssClasses: string[];
  animationHooks: string[];
  activeChannels: NonverbalChannel[];
  /** Discrete cues compatible with therapy-room NonverbalCue union. */
  cueTags: string[];
};

export type SchedulerOptions = {
  /** Minimum ms between two events of the same channel (default 2400). */
  channelCooldownMs?: number;
  /** Forbid identical (channel, variant) until this many other events fire. */
  variantReuseGap?: number;
};
