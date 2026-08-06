import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type {
  NonverbalCue,
  PatientAffect,
  PatientBehaviorState,
  PatientPresencePhase,
  VoiceModulation,
} from "./types";

/**
 * PME bridge — Patient Mind Engine compatibility layer.
 *
 * Full PME is not yet merged; this bridge derives deterministic behavior
 * from diagnosis + speech profiles so the room never uses random cues.
 * When PME ships, swap `derivePatientBehavior` for the engine output.
 */

type DisorderBehaviorSpec = {
  affect: PatientAffect;
  thinkingBaseMs: number;
  thinkingJitterMs: number;
  mayInterruptTherapist: boolean;
  interruptProbability: number;
  idleCues: NonverbalCue[];
  thinkingCues: NonverbalCue[];
  speakingCues: NonverbalCue[];
  animationHooks: string[];
  voice: Omit<VoiceModulation, "emotion">;
};

const DEFAULT_SPEC: DisorderBehaviorSpec = {
  affect: "neutral",
  thinkingBaseMs: 900,
  thinkingJitterMs: 400,
  mayInterruptTherapist: false,
  interruptProbability: 0,
  idleCues: ["idle_breathing", "blink", "eye_contact"],
  thinkingCues: ["look_away", "sigh", "idle_breathing"],
  speakingCues: ["eye_contact", "idle_breathing"],
  animationHooks: ["breathing.idle", "gaze.soft"],
  voice: { rate: 1, volume: 1, pitch: 1, pauseScale: 1 },
};

const BY_PATTERN: Array<{ test: RegExp; spec: DisorderBehaviorSpec }> = [
  {
    test: /mdd|depress/i,
    spec: {
      affect: "depressed",
      thinkingBaseMs: 2200,
      thinkingJitterMs: 800,
      mayInterruptTherapist: false,
      interruptProbability: 0,
      idleCues: [
        "idle_breathing",
        "blink",
        "head_down",
        "slow_movements",
        "psychomotor_retardation",
      ],
      thinkingCues: ["look_away", "sigh", "head_down", "silence", "slow_movements"],
      speakingCues: ["head_down", "slow_movements", "sigh"],
      animationHooks: [
        "posture.slumped",
        "gaze.down",
        "motion.retarded",
        "breath.shallow",
      ],
      voice: { rate: 0.82, volume: 0.78, pitch: 0.92, pauseScale: 1.6 },
    },
  },
  {
    test: /mania|bipolar/i,
    spec: {
      affect: "euphoric",
      thinkingBaseMs: 250,
      thinkingJitterMs: 150,
      mayInterruptTherapist: true,
      interruptProbability: 0.55,
      idleCues: ["idle_breathing", "fidget", "restlessness", "psychomotor_agitation"],
      thinkingCues: ["fidget", "eye_contact", "laughter", "restlessness"],
      speakingCues: ["eye_contact", "fidget", "laughter", "psychomotor_agitation"],
      animationHooks: [
        "posture.forward",
        "gaze.intense",
        "motion.agitated",
        "gesture.expansive",
      ],
      voice: { rate: 1.28, volume: 1.12, pitch: 1.08, pauseScale: 0.55 },
    },
  },
  {
    test: /bpd|borderline/i,
    spec: {
      affect: "labile",
      thinkingBaseMs: 600,
      thinkingJitterMs: 500,
      mayInterruptTherapist: true,
      interruptProbability: 0.4,
      idleCues: ["idle_breathing", "blink", "fidget", "eye_contact", "look_away"],
      thinkingCues: ["look_away", "cross_arms", "sigh", "tears"],
      speakingCues: ["eye_contact", "fidget", "posture_shift"],
      animationHooks: [
        "affect.labile",
        "gaze.testing",
        "posture.shifting",
        "alliance.fragile",
      ],
      voice: { rate: 1.05, volume: 1, pitch: 1.04, pauseScale: 1.1 },
    },
  },
  {
    test: /gad|anxiety|panic/i,
    spec: {
      affect: "anxious",
      thinkingBaseMs: 700,
      thinkingJitterMs: 450,
      mayInterruptTherapist: true,
      interruptProbability: 0.28,
      idleCues: ["idle_breathing", "blink", "fidget", "hand_tremor", "restlessness"],
      thinkingCues: ["look_away", "fidget", "sigh", "hand_tremor"],
      speakingCues: ["fidget", "eye_contact", "hand_tremor"],
      animationHooks: [
        "posture.tense",
        "hands.tremor",
        "gaze.scanning",
        "breath.shallow",
      ],
      voice: { rate: 1.12, volume: 0.95, pitch: 1.06, pauseScale: 0.85 },
    },
  },
  {
    test: /ptsd|trauma/i,
    spec: {
      affect: "guarded",
      thinkingBaseMs: 1400,
      thinkingJitterMs: 700,
      mayInterruptTherapist: true,
      interruptProbability: 0.22,
      idleCues: ["idle_breathing", "blink", "look_away", "cross_arms"],
      thinkingCues: ["look_away", "cross_arms", "silence", "posture_shift"],
      speakingCues: ["look_away", "cross_arms", "eye_contact"],
      animationHooks: [
        "posture.guarded",
        "gaze.hypervigilant",
        "startle.ready",
        "avoidance.topic",
      ],
      voice: { rate: 0.95, volume: 0.88, pitch: 0.98, pauseScale: 1.35 },
    },
  },
  {
    test: /schizo|psychos/i,
    spec: {
      affect: "flat",
      thinkingBaseMs: 1800,
      thinkingJitterMs: 900,
      mayInterruptTherapist: false,
      interruptProbability: 0.05,
      idleCues: ["idle_breathing", "blink", "look_away", "slow_movements"],
      thinkingCues: ["look_away", "silence", "slow_movements"],
      speakingCues: ["look_away", "eye_contact", "slow_movements"],
      animationHooks: [
        "affect.flat",
        "gaze.odd",
        "motion.reduced",
        "thought.disorganized",
      ],
      voice: { rate: 0.9, volume: 0.85, pitch: 0.95, pauseScale: 1.5 },
    },
  },
  {
    test: /adhd|attention/i,
    spec: {
      affect: "neutral",
      thinkingBaseMs: 400,
      thinkingJitterMs: 300,
      mayInterruptTherapist: true,
      interruptProbability: 0.3,
      idleCues: ["idle_breathing", "fidget", "restlessness", "posture_shift"],
      thinkingCues: ["look_away", "fidget", "restlessness"],
      speakingCues: ["fidget", "eye_contact", "posture_shift"],
      animationHooks: [
        "motion.restless",
        "attention.drifting",
        "gesture.fragmented",
      ],
      voice: { rate: 1.15, volume: 1, pitch: 1.02, pauseScale: 0.75 },
    },
  },
  {
    test: /alcohol|substance/i,
    spec: {
      affect: "guarded",
      thinkingBaseMs: 1000,
      thinkingJitterMs: 500,
      mayInterruptTherapist: false,
      interruptProbability: 0.12,
      idleCues: ["idle_breathing", "blink", "cross_arms", "posture_shift"],
      thinkingCues: ["look_away", "cross_arms", "sigh"],
      speakingCues: ["eye_contact", "cross_arms", "posture_shift"],
      animationHooks: ["posture.defensive", "gaze.testing", "minimize.ready"],
      voice: { rate: 0.98, volume: 0.95, pitch: 1, pauseScale: 1.1 },
    },
  },
  {
    test: /delirium/i,
    spec: {
      affect: "agitated",
      thinkingBaseMs: 500,
      thinkingJitterMs: 1200,
      mayInterruptTherapist: true,
      interruptProbability: 0.35,
      idleCues: [
        "idle_breathing",
        "look_away",
        "restlessness",
        "psychomotor_agitation",
        "hand_tremor",
      ],
      thinkingCues: ["look_away", "silence", "restlessness", "fidget"],
      speakingCues: ["look_away", "restlessness", "psychomotor_agitation"],
      animationHooks: [
        "attention.fluctuating",
        "orientation.lost",
        "motion.agitated",
      ],
      voice: { rate: 1.05, volume: 0.9, pitch: 1.05, pauseScale: 1.4 },
    },
  },
];

function specForDisorder(slug?: string | null): DisorderBehaviorSpec {
  if (slug) {
    for (const entry of BY_PATTERN) {
      if (entry.test.test(slug)) return entry.spec;
    }
  }
  const speech = speechBehaviorForDisorder(slug);
  if (speech.pace === "pressured" || speech.energy === "high") {
    return {
      ...DEFAULT_SPEC,
      thinkingBaseMs: 350,
      mayInterruptTherapist: true,
      interruptProbability: 0.35,
      voice: { rate: 1.2, volume: 1.05, pitch: 1.05, pauseScale: 0.7 },
    };
  }
  if (speech.pace === "slow" || speech.energy === "low") {
    return {
      ...DEFAULT_SPEC,
      affect: "depressed",
      thinkingBaseMs: 2000,
      idleCues: ["idle_breathing", "blink", "head_down", "slow_movements"],
      voice: { rate: 0.85, volume: 0.8, pitch: 0.94, pauseScale: 1.5 },
    };
  }
  return DEFAULT_SPEC;
}

/**
 * Deterministic jitter from a seed string (session id + turn index).
 * Avoids Math.random so cues remain reproducible for a given turn.
 */
export function deterministicJitter(seed: string, maxMs: number): number {
  if (maxMs <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % (maxMs + 1);
}

export function derivePatientBehavior(params: {
  disorderSlug?: string | null;
  phase: PatientPresencePhase;
  seed: string;
}): PatientBehaviorState {
  const spec = specForDisorder(params.disorderSlug);
  const thinkingLatencyMs =
    spec.thinkingBaseMs +
    deterministicJitter(`${params.seed}:think`, spec.thinkingJitterMs);

  let activeCues: NonverbalCue[];
  switch (params.phase) {
    case "thinking":
      activeCues = spec.thinkingCues;
      break;
    case "speaking":
      activeCues = spec.speakingCues;
      break;
    case "silent":
      activeCues = ["silence", "look_away", "idle_breathing"];
      break;
    case "interrupted":
      activeCues = ["look_away", "posture_shift", "sigh"];
      break;
    case "listening":
      activeCues = ["eye_contact", "idle_breathing", "blink"];
      break;
    default:
      activeCues = spec.idleCues;
  }

  return {
    disorderSlug: params.disorderSlug ?? "generic",
    affect: spec.affect,
    phase: params.phase,
    activeCues,
    thinkingLatencyMs,
    voice: { ...spec.voice, emotion: spec.affect },
    mayInterruptTherapist: spec.mayInterruptTherapist,
    interruptProbability: spec.interruptProbability,
    animationHooks: spec.animationHooks,
  };
}

export function thinkingLatencyMs(params: {
  disorderSlug?: string | null;
  seed: string;
}): number {
  return derivePatientBehavior({
    disorderSlug: params.disorderSlug,
    phase: "thinking",
    seed: params.seed,
  }).thinkingLatencyMs;
}
