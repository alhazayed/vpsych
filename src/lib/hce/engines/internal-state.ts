/**
 * Internal state vector (Layer 4 + 12) — hidden from therapist.
 */

import type {
  AllianceStage,
  EmotionEngineOutput,
  EnvironmentEngineOutput,
  HceInternalState,
  HceMemoryState,
  TherapistMove,
} from "@/lib/hce/types";

export function defaultInternalState(): HceInternalState {
  return {
    trust: 45,
    fear: 35,
    attachment: 40,
    suspicion: 30,
    hope: 35,
    resistance: 40,
    fatigue: 25,
    motivation: 45,
    suicidality: 15,
    insight: 50,
    alliance_stage: "contact",
  };
}

export function internalTick(state: HceMemoryState): HceInternalState {
  return { ...state.internal };
}

export function applyInternalDeltas(
  state: HceMemoryState,
  therapistMove: TherapistMove,
  emotion: EmotionEngineOutput,
  environment: EnvironmentEngineOutput,
): HceMemoryState {
  const internal = { ...state.internal };
  const deltas = moveToInternalDelta(therapistMove);

  internal.trust = clamp(internal.trust + deltas.trust, 0, 100);
  internal.fear = clamp(internal.fear + deltas.fear, 0, 100);
  internal.hope = clamp(internal.hope + deltas.hope, 0, 100);
  internal.resistance = clamp(internal.resistance + deltas.resistance, 0, 100);
  internal.fatigue = clamp(
    internal.fatigue + environment.fatigue * 20,
    0,
    100,
  );
  internal.suspicion = clamp(
    internal.suspicion + deltas.suspicion,
    0,
    100,
  );
  internal.attachment = clamp(
    internal.attachment + deltas.attachment,
    0,
    100,
  );
  internal.motivation = clamp(
    internal.motivation + deltas.motivation,
    0,
    100,
  );

  if (emotion.vector.anxiety > 70) internal.fear = clamp(internal.fear + 5, 0, 100);
  if (emotion.vector.sadness > 70) internal.motivation = clamp(internal.motivation - 5, 0, 100);

  internal.alliance_stage = deriveAllianceStage(internal, state.relationship.alliance);

  return { ...state, internal };
}

function deriveAllianceStage(
  internal: HceInternalState,
  alliance: number,
): AllianceStage {
  if (alliance < 25) return internal.resistance > 60 ? "resistance" : "contact";
  if (alliance < 45) return "contact";
  if (alliance < 60) return "disclosure";
  if (alliance < 75) return "vulnerability";
  if (internal.trust > 70 && internal.resistance < 35) return "vulnerability";
  if (internal.resistance > 55) return "repair";
  return "disclosure";
}

function moveToInternalDelta(move: TherapistMove): {
  trust: number;
  fear: number;
  hope: number;
  resistance: number;
  suspicion: number;
  attachment: number;
  motivation: number;
} {
  switch (move) {
    case "reflection":
      return { trust: 8, fear: -5, hope: 4, resistance: -6, suspicion: -3, attachment: 5, motivation: 2 };
    case "validation":
      return { trust: 6, fear: -4, hope: 5, resistance: -5, suspicion: -2, attachment: 4, motivation: 3 };
    case "rupture_repair":
      return { trust: 15, fear: -10, hope: 10, resistance: -12, suspicion: -8, attachment: 8, motivation: 6 };
    case "invalidation":
      return { trust: -12, fear: 8, hope: -6, resistance: 14, suspicion: 10, attachment: -8, motivation: -5 };
    case "advice":
      return { trust: -4, fear: 3, hope: -2, resistance: 8, suspicion: 4, attachment: -2, motivation: -3 };
    case "safety_check":
      return { trust: 2, fear: 5, hope: 0, resistance: 3, suspicion: 2, attachment: 1, motivation: 0 };
    case "open_question":
      return { trust: 1, fear: 0, hope: 1, resistance: -1, suspicion: 0, attachment: 1, motivation: 0 };
    default:
      return { trust: 0, fear: 0, hope: 0, resistance: 0, suspicion: 0, attachment: 0, motivation: 0 };
  }
}

export function trustToDisclosureClass(
  trust: number,
  mayDisclose: boolean,
): "deflect" | "partial" | "full" | "withhold" {
  if (!mayDisclose) return "withhold";
  if (trust < 30) return "deflect";
  if (trust < 65) return "partial";
  return "full";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
