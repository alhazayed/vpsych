/**
 * Behavior Engine — cooperation, defenses, speech pace from therapy profile.
 */

import type {
  CaseInstanceSnapshot,
} from "@/lib/case-engine/types";
import type {
  BehaviorEngineOutput,
  EmotionEngineOutput,
  EnvironmentEngineOutput,
  HceMemoryState,
  TherapistMove,
} from "@/lib/hce/types";

const DEFENSES = [
  "Isolation of affect",
  "Intellectualisation",
  "Humour",
  "Somatisation",
  "Altruistic deflection",
];

export function behaviorTick(
  snapshot: CaseInstanceSnapshot,
  state: HceMemoryState,
  therapistMove: TherapistMove,
  emotion: EmotionEngineOutput,
  environment: EnvironmentEngineOutput,
): BehaviorEngineOutput {
  let cooperation = state.behavior.cooperation;
  const directives: string[] = [];
  let resistance_mode = "cooperative";

  const rules = snapshot.therapy_reaction_rules as {
    engages_with?: string[];
    resists?: string[];
    alliance_cue?: string;
  };

  if (therapistMove === "advice" && rules.resists) {
    for (const r of rules.resists) {
      if (/homework|positivity|premature/i.test(r)) {
        resistance_mode = "polite_noncompliance";
        cooperation -= 8;
        directives.push(`resist: ${r}`);
      }
    }
  }

  if (therapistMove === "reflection" || therapistMove === "validation") {
    cooperation += 6;
    if (rules.alliance_cue) directives.push(rules.alliance_cue);
  }
  if (therapistMove === "invalidation") {
    cooperation -= 15;
    resistance_mode = "withdrawal";
    directives.push("short answers; agreeable surface");
  }
  if (therapistMove === "rupture_repair") {
    cooperation += 20;
  }

  cooperation = clamp(cooperation, 10, 95);

  const speech_pace = paceFromModifiers(snapshot.difficulty_modifiers, environment);
  let turn_length_target = state.behavior.turn_length_target;
  if (environment.fatigue > 0.5) turn_length_target = Math.max(15, turn_length_target - 15);
  if (emotion.intensity > 7) turn_length_target = Math.max(10, turn_length_target - 10);

  const defense_active =
    therapistMove === "invalidation" || cooperation < 40
      ? pickDefense(state.behavior.active_defense)
      : state.behavior.active_defense;

  if (defense_active) directives.push(`defense: ${defense_active}`);

  return {
    cooperation,
    resistance_mode,
    defense_active,
    speech_pace,
    turn_length_target,
    directives,
  };
}

export function applyBehavior(
  state: HceMemoryState,
  behavior: BehaviorEngineOutput,
  therapistMove: TherapistMove,
): HceMemoryState {
  const allianceDelta =
    therapistMove === "rupture_repair"
      ? 15
      : therapistMove === "invalidation"
        ? -12
        : therapistMove === "reflection"
          ? 5
          : therapistMove === "validation"
            ? 4
            : therapistMove === "advice"
              ? -3
              : 0;

  const alliance = clamp(
    state.relationship.alliance + allianceDelta,
    5,
    95,
  );
  const last_tone =
    alliance >= 65 ? "warm" : alliance <= 35 ? "strained" : "neutral";

  return {
    ...state,
    relationship: { alliance, last_tone },
    behavior: {
      cooperation: behavior.cooperation,
      active_defense: behavior.defense_active,
      speech_pace: behavior.speech_pace,
      turn_length_target: behavior.turn_length_target,
    },
  };
}

function pickDefense(current: string | null): string {
  if (current) return current;
  return DEFENSES[Math.floor(Math.random() * DEFENSES.length)]!;
}

function paceFromModifiers(
  modifiers: CaseInstanceSnapshot["difficulty_modifiers"],
  env: EnvironmentEngineOutput,
): BehaviorEngineOutput["speech_pace"] {
  if (env.fatigue > 0.6) return "slow";
  if (modifiers.resistance === "very_high") return "slow";
  if (modifiers.alliance === "warm") return "measured";
  return "measured";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
