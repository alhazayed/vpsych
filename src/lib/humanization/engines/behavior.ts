/**
 * Behavior Engine (Humanization) — cooperation, defenses, speech phenotype.
 */

import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  BehaviorEngineOutput,
  EmotionEngineOutput,
  TherapistMove,
} from "@/lib/humanization/types";
import type { ClinicalCore } from "@/lib/types";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const DEFENSES = [
  "minimisation",
  "intellectualisation",
  "humour deflection",
  "topic shift",
  "somatisation",
];

export function behaviorTick(params: {
  snapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  therapistMove: TherapistMove;
  emotion: EmotionEngineOutput;
  fatigue: number;
}): BehaviorEngineOutput {
  const core =
    params.clinicalCore ?? params.snapshot?.clinical_core ?? null;
  const slug =
    params.snapshot?.primary_diagnosis?.slug ??
    (core?.disorder ? String(core.disorder) : "generic");
  const speech = speechBehaviorForDisorder(slug, null);
  const mods = params.snapshot?.difficulty_modifiers;

  let cooperation = 55;
  if (mods?.resistance === "low") cooperation = 70;
  if (mods?.resistance === "high") cooperation = 40;
  if (mods?.resistance === "very_high") cooperation = 28;
  if (mods?.alliance === "warm") cooperation += 8;
  if (mods?.alliance === "fragile" || mods?.alliance === "testing") {
    cooperation -= 8;
  }

  const directives: string[] = [];
  let resistance_mode = "cooperative";

  switch (params.therapistMove) {
    case "reflection":
    case "validation":
      cooperation += 6;
      directives.push("warm slightly when accurately reflected");
      break;
    case "invalidation":
      cooperation -= 15;
      resistance_mode = "withdrawal";
      directives.push("short answers; agreeable surface");
      break;
    case "advice":
      cooperation -= 5;
      resistance_mode = "polite_noncompliance";
      directives.push("agree verbally; do not commit to homework");
      break;
    case "rupture_repair":
      cooperation += 18;
      resistance_mode = "reopening";
      break;
    case "safety_check":
      resistance_mode = "guarded_disclosure";
      directives.push("answer risk within profile; no method detail");
      break;
    default:
      break;
  }

  cooperation = clamp(cooperation, 10, 95);

  let speech_pace = speech.pace;
  let speech_energy = speech.energy;
  if (params.fatigue > 0.6 && speech_pace !== "pressured") {
    speech_pace = "slow";
    if (speech_energy === "high") speech_energy = "moderate";
    else if (speech_energy === "moderate") speech_energy = "low";
  }
  if (params.emotion.intensity >= 8 && speech_pace === "measured") {
    speech_pace = speech.category === "anxiety" ? "fast" : "variable";
  }

  const defense_active =
    params.therapistMove === "invalidation" || cooperation < 40
      ? DEFENSES[Math.abs(Math.floor(cooperation)) % DEFENSES.length]!
      : null;

  if (defense_active) directives.push(`defense: ${defense_active}`);
  directives.push(...speech.behaviour_lines.slice(0, 2));

  return {
    cooperation,
    resistance_mode,
    speech_pace,
    speech_energy,
    defense_active,
    directives,
    category: speech.category,
  };
}
