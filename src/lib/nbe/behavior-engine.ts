/**
 * Behavior Engine — maps emotion (+ phase / disorder) to nonverbal intents.
 *
 * Output is a plan: sustained motor tone + pulse candidates. Placement and
 * anti-repetition live in Timeline / Animation Scheduler.
 */

import { resolveEmotionInput } from "./emotion";
import { clamp01, seededPick, seededUnit } from "./seed";
import type {
  BehaviorIntent,
  BehaviorPlan,
  EmotionSnapshot,
  EyeVariant,
  HandVariant,
  HeadVariant,
  NonverbalChannel,
  NonverbalPhase,
  SmileVariant,
  SustainedBehavior,
} from "./types";

export type BehaviorEngineInput = {
  emotion?: EmotionSnapshot | null;
  affect?: string | null;
  disorderSlug?: string | null;
  phase: NonverbalPhase;
  seed: string;
  intensity?: number;
};

export function runBehaviorEngine(input: BehaviorEngineInput): BehaviorPlan {
  const emotion = resolveEmotionInput(input);
  const disorderSlug = input.disorderSlug ?? "generic";
  const phase = input.phase;
  const seed = input.seed;

  const sustained = buildSustained(emotion, phase, disorderSlug);
  const intents = buildIntents(emotion, phase, disorderSlug, seed);

  return { emotion, phase, disorderSlug, sustained, intents, seed };
}

function dim(e: EmotionSnapshot, key: keyof EmotionSnapshot): number {
  const v = e[key];
  return typeof v === "number" ? v : 0;
}

function buildSustained(
  e: EmotionSnapshot,
  phase: NonverbalPhase,
  disorderSlug: string,
): SustainedBehavior[] {
  const out: SustainedBehavior[] = [];
  const sadness = dim(e, "sadness");
  const anxiety = dim(e, "anxiety");
  const activation = dim(e, "activation");
  const fatigue = dim(e, "fatigue");

  // Breathing always present — emotion shapes depth / rate via variant.
  const breathVariant =
    anxiety >= 0.6 || activation >= 0.75
      ? "shallow"
      : sadness >= 0.65 || fatigue >= 0.65
        ? "deep"
        : "default";
  out.push({
    channel: "breathing",
    intensity: clamp01(0.35 + e.intensity * 0.4),
    variant: breathVariant,
    cssClass:
      breathVariant === "shallow"
        ? "trm-patient--breath-shallow"
        : breathVariant === "deep"
          ? "trm-patient--breath-deep"
          : "trm-patient--breath-idle",
    animationHook: `breath.${breathVariant}`,
  });

  // Psychomotor slowing — depression / fatigue / flat affect
  if (
    sadness >= 0.55 ||
    fatigue >= 0.6 ||
    e.affect === "flat" ||
    e.affect === "depressed" ||
    /mdd|depress|schizo/i.test(disorderSlug)
  ) {
    if (activation < 0.65) {
      out.push({
        channel: "psychomotor_slowing",
        intensity: clamp01(Math.max(sadness, fatigue) * 0.9),
        variant: "default",
        cssClass: "trm-patient--slow",
        animationHook: "motion.retarded",
      });
    }
  }

  // Restlessness — anxiety / mania / agitation / ADHD
  if (
    anxiety >= 0.55 ||
    activation >= 0.7 ||
    e.affect === "agitated" ||
    e.affect === "euphoric" ||
    /mania|anxiety|panic|adhd|delirium/i.test(disorderSlug)
  ) {
    if (sadness < 0.75 || activation >= 0.7) {
      out.push({
        channel: "restlessness",
        intensity: clamp01(Math.max(anxiety, activation) * 0.85),
        variant: "default",
        cssClass: "trm-patient--fidget",
        animationHook: "motion.restless",
      });
    }
  }

  // Baseline eye contact tone (sustained gaze policy)
  const eyeVariant: EyeVariant =
    e.affect === "guarded" ||
    e.affect === "flat" ||
    phase === "silent" ||
    /ptsd|trauma|schizo/i.test(disorderSlug)
      ? "avert"
      : phase === "listening" || phase === "speaking"
        ? "hold"
        : sadness >= 0.6
          ? "avert"
          : "glance";

  out.push({
    channel: "eye_contact",
    intensity:
      eyeVariant === "hold" ? clamp01(0.45 + e.intensity * 0.3) : 0.35,
    variant: eyeVariant,
    cssClass:
      eyeVariant === "avert"
        ? "trm-patient--look-away"
        : eyeVariant === "hold"
          ? "trm-patient--eye-contact"
          : "trm-patient--eye-glance",
    animationHook: `gaze.${eyeVariant}`,
  });

  return out;
}

function buildIntents(
  e: EmotionSnapshot,
  phase: NonverbalPhase,
  disorderSlug: string,
  seed: string,
): BehaviorIntent[] {
  const intents: BehaviorIntent[] = [];
  const sadness = dim(e, "sadness");
  const anxiety = dim(e, "anxiety");
  const hope = dim(e, "hope");
  const shame = dim(e, "shame");
  const activation = dim(e, "activation");
  const fatigue = dim(e, "fatigue");
  const anger = dim(e, "anger");

  // Blink rate rises with anxiety / activation; slows with depression
  const blinkWeight =
    0.35 + anxiety * 0.45 + activation * 0.2 - sadness * 0.15;
  pushMany(intents, Math.round(clamp01(blinkWeight) * 4) + 1, () =>
    intent("blink", {
      intensity: clamp01(0.4 + anxiety * 0.3),
      priority: 2,
      durationMs: 140,
      minGapMs: sadness >= 0.6 ? 4200 : anxiety >= 0.6 ? 1800 : 2800,
      variant: "blink",
      cssClass: "trm-patient--blink",
      animationHook: "eye.blink",
    }),
  );

  // Head movements — thinking / listening micro-gestures
  if (phase === "thinking" || phase === "listening" || phase === "idle") {
    const headPool: HeadVariant[] =
      sadness >= 0.55
        ? ["down", "tilt", "away"]
        : anxiety >= 0.55
          ? ["tilt", "away", "nod"]
          : anger >= 0.55
            ? ["shake", "tilt"]
            : ["nod", "tilt", "away"];
    const head = seededPick(`${seed}:head`, headPool);
    intents.push(
      intent("head_movement", {
        intensity: clamp01(0.35 + e.intensity * 0.4),
        priority: 5,
        durationMs: head === "nod" ? 600 : 900,
        minGapMs: 5000,
        variant: head,
        cssClass:
          head === "down"
            ? "trm-patient--head-down"
            : head === "away"
              ? "trm-patient--look-away"
              : head === "nod"
                ? "trm-patient--head-nod"
                : head === "shake"
                  ? "trm-patient--head-shake"
                  : "trm-patient--head-tilt",
        animationHook: `head.${head}`,
      }),
    );
  }

  // Sighing — sadness, fatigue, shame, thinking
  if (
    sadness >= 0.4 ||
    fatigue >= 0.5 ||
    shame >= 0.5 ||
    phase === "thinking" ||
    phase === "silent"
  ) {
    intents.push(
      intent("sighing", {
        intensity: clamp01(Math.max(sadness, fatigue, shame)),
        priority: 6,
        durationMs: 1200,
        minGapMs: 7000,
        variant: "exhale",
        cssClass: "trm-patient--sigh",
        animationHook: "breath.sigh",
      }),
    );
  }

  // Smiling — only when emotion supports it (never forced on depressed/flat)
  const maySmile =
    (hope >= 0.45 || e.affect === "euphoric" || e.affect === "labile") &&
    sadness < 0.7 &&
    e.affect !== "flat" &&
    e.affect !== "depressed" &&
    phase !== "silent";
  if (maySmile) {
    const smilePool: SmileVariant[] =
      e.affect === "euphoric"
        ? ["soft", "brief"]
        : hope >= 0.6
          ? ["soft", "polite"]
          : ["polite", "brief"];
    const smile = seededPick(`${seed}:smile`, smilePool);
    intents.push(
      intent("smiling", {
        intensity: clamp01(hope * 0.8 + (e.affect === "euphoric" ? 0.3 : 0)),
        priority: 4,
        durationMs: smile === "brief" ? 700 : 1600,
        minGapMs: 9000,
        variant: smile,
        cssClass: `trm-patient--smile-${smile}`,
        animationHook: `face.smile.${smile}`,
      }),
    );
  }

  // Tearfulness
  if (
    e.affect === "tearful" ||
    (sadness >= 0.7 && shame >= 0.4) ||
    (e.affect === "labile" && sadness >= 0.55)
  ) {
    intents.push(
      intent("tearfulness", {
        intensity: clamp01(sadness),
        priority: 8,
        durationMs: 3500,
        minGapMs: 12000,
        variant: "tear",
        cssClass: "trm-patient--tears",
        animationHook: "face.tears",
      }),
    );
  }

  // Hand gestures — restless / speaking / anxious
  if (
    activation >= 0.45 ||
    anxiety >= 0.45 ||
    phase === "speaking" ||
    /adhd|mania|anxiety/i.test(disorderSlug)
  ) {
    const handPool: HandVariant[] =
      anxiety >= 0.6
        ? ["fidget", "self_soothe", "tremor"]
        : activation >= 0.7
          ? ["open", "fidget"]
          : sadness >= 0.55
            ? ["still", "self_soothe"]
            : ["open", "fidget", "self_soothe"];
    const hand = seededPick(`${seed}:hand`, handPool);
    if (hand !== "still") {
      intents.push(
        intent("hand_gesture", {
          intensity: clamp01(0.4 + Math.max(anxiety, activation) * 0.4),
          priority: 5,
          durationMs: hand === "tremor" ? 2000 : 1100,
          minGapMs: 4500,
          variant: hand,
          cssClass:
            hand === "tremor"
              ? "trm-patient--hand-tremor"
              : hand === "self_soothe"
                ? "trm-patient--hand-soothe"
                : hand === "open"
                  ? "trm-patient--hand-open"
                  : "trm-patient--fidget",
          animationHook: `hand.${hand}`,
        }),
      );
    }
  }

  // Pulse eye-contact shifts when sustained is avert but alliance moment
  if (phase === "speaking" && hope >= 0.4 && seededUnit(`${seed}:glance`) > 0.35) {
    intents.push(
      intent("eye_contact", {
        intensity: 0.55,
        priority: 3,
        durationMs: 1400,
        minGapMs: 6000,
        variant: "glance",
        cssClass: "trm-patient--eye-contact",
        animationHook: "gaze.glance",
      }),
    );
  }

  // Interrupted → look away / head shift
  if (phase === "interrupted") {
    intents.push(
      intent("head_movement", {
        intensity: 0.6,
        priority: 7,
        durationMs: 800,
        minGapMs: 4000,
        variant: "away",
        cssClass: "trm-patient--look-away",
        animationHook: "head.away",
      }),
      intent("sighing", {
        intensity: 0.5,
        priority: 5,
        durationMs: 1000,
        minGapMs: 5000,
        variant: "exhale",
        cssClass: "trm-patient--sigh",
        animationHook: "breath.sigh",
      }),
    );
  }

  return intents.sort((a, b) => b.priority - a.priority);
}

function intent(
  channel: NonverbalChannel,
  partial: Omit<BehaviorIntent, "channel">,
): BehaviorIntent {
  return { channel, ...partial };
}

function pushMany(
  list: BehaviorIntent[],
  count: number,
  factory: () => BehaviorIntent,
): void {
  const n = Math.max(0, Math.min(count, 6));
  for (let i = 0; i < n; i++) list.push(factory());
}
