/**
 * Emotion Engine (Humanization) — dynamic affect from therapist moves + case.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type {
  AffectPrimary,
  EmotionEngineOutput,
  TherapistMove,
} from "@/lib/humanization/types";
import type { ClinicalCore } from "@/lib/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function baselineAffect(
  slug: string,
  category: string,
): { primary: AffectPrimary; intensity: number } {
  const s = slug.toLowerCase();
  if (s.includes("mania") || s.includes("bipolar")) {
    return { primary: "irritable", intensity: 6 };
  }
  if (category === "mood" || s.includes("mdd") || s.includes("depress")) {
    return { primary: "sad", intensity: 5 };
  }
  if (category === "anxiety" || s.includes("gad") || s.includes("panic")) {
    return { primary: "anxious", intensity: 6 };
  }
  if (category === "trauma" || s.includes("ptsd")) {
    return { primary: "numb", intensity: 5 };
  }
  if (category === "psychosis") {
    return { primary: "numb", intensity: 4 };
  }
  if (category === "personality") {
    return { primary: "ashamed", intensity: 5 };
  }
  return { primary: "neutral", intensity: 4 };
}

const TRIGGER_KEYWORDS: Record<
  string,
  { affect: AffectPrimary; delta: number }
> = {
  suicide: { affect: "numb", delta: 2 },
  die: { affect: "sad", delta: 1 },
  dead: { affect: "sad", delta: 1 },
  shame: { affect: "ashamed", delta: 2 },
  worthless: { affect: "ashamed", delta: 2 },
  panic: { affect: "anxious", delta: 2 },
  attack: { affect: "anxious", delta: 1 },
  nightmare: { affect: "anxious", delta: 1 },
  flashback: { affect: "tearful", delta: 2 },
  mother: { affect: "sad", delta: 1 },
  father: { affect: "sad", delta: 1 },
  lonely: { affect: "sad", delta: 1 },
  hope: { affect: "hopeful", delta: 1 },
  better: { affect: "hopeful", delta: 1 },
};

function moveDelta(move: TherapistMove): {
  intensity: number;
  primary?: AffectPrimary;
  directives: string[];
} {
  switch (move) {
    case "validation":
      return {
        intensity: -1,
        directives: ["slight warmth possible; shame if tearful"],
      };
    case "reflection":
      return {
        intensity: 0,
        directives: ["allow brief authentic affect if material is near"],
      };
    case "invalidation":
      return {
        intensity: 1,
        primary: "numb",
        directives: ["withdraw affect; polite flat tone"],
      };
    case "advice":
      return {
        intensity: 0,
        directives: ["surface compliance; internal disengagement"],
      };
    case "rupture_repair":
      return {
        intensity: -2,
        primary: "relieved",
        directives: ["surprised by repair; soft reopen"],
      };
    case "safety_check":
      return {
        intensity: 0,
        directives: ["even delivery; do not escalate beyond risk profile"],
      };
    case "rapport":
      return {
        intensity: -1,
        primary: "hopeful",
        directives: ["small social warmth OK early"],
      };
    case "silence":
      return {
        intensity: 0,
        directives: ["tolerate silence; do not rush to fill"],
      };
    default:
      return { intensity: 0, directives: [] };
  }
}

export function emotionTick(params: {
  snapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  therapistMove: TherapistMove;
  userMessage: string;
  fatigue: number;
}): EmotionEngineOutput {
  const core =
    params.clinicalCore ?? params.snapshot?.clinical_core ?? null;
  const slug =
    params.snapshot?.primary_diagnosis?.slug ??
    (core?.disorder ? String(core.disorder) : "generic");
  const speech = speechBehaviorForDisorder(slug, null);
  const base = baselineAffect(slug, speech.category);

  let primary = base.primary;
  let intensity = base.intensity;
  const triggers_fired: string[] = [];
  const directives: string[] = [];

  const lower = params.userMessage.toLowerCase();
  for (const [kw, effect] of Object.entries(TRIGGER_KEYWORDS)) {
    if (lower.includes(kw)) {
      triggers_fired.push(kw);
      primary = effect.affect;
      intensity = clamp(intensity + effect.delta, 1, 10);
      directives.push(`trigger:${kw} → brief ${effect.affect}`);
    }
  }

  const md = moveDelta(params.therapistMove);
  intensity = clamp(intensity + md.intensity, 1, 10);
  if (md.primary) primary = md.primary;
  directives.push(...md.directives);

  if (params.fatigue > 0.55) {
    intensity = clamp(intensity + 1, 1, 10);
    if (primary === "neutral" || primary === "hopeful") primary = "fatigued";
    directives.push("fatigue colours affect — shorter emotional range");
  }

  const masking = params.snapshot?.difficulty_modifiers?.masking;
  let congruence: EmotionEngineOutput["congruence"] = "congruent";
  if (masking === "high" || masking === "very_high") {
    intensity = Math.min(intensity, 6);
    congruence = "guarded";
    directives.push("mask distress; flat delivery unless trigger fired");
  }

  return {
    primary,
    intensity,
    congruence,
    directives,
    triggers_fired,
  };
}
