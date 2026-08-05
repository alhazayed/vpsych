/**
 * Conversation Director — builds Turn Brief from engine outputs.
 */

import { HCE_ANTI_BIAS_DIRECTIVES } from "@/lib/hce/bias";
import type {
  BehaviorEngineOutput,
  ClinicalEngineOutput,
  EmotionEngineOutput,
  EnvironmentEngineOutput,
  MemoryEngineOutput,
  ReasoningMode,
  TherapistMove,
  TurnBrief,
  VoiceEngineOutput,
} from "@/lib/hce/types";

export function buildTurnBrief(params: {
  therapistMove: TherapistMove;
  memory: MemoryEngineOutput;
  clinical: ClinicalEngineOutput;
  emotion: EmotionEngineOutput;
  environment: EnvironmentEngineOutput;
  behavior: BehaviorEngineOutput;
  voice: VoiceEngineOutput;
  sessionLanguage: string;
  locale: string;
}): TurnBrief {
  const reasoning_mode: ReasoningMode = pickReasoningMode(
    params.therapistMove,
    params.clinical,
  );

  const turn_goal = goalForMove(params.therapistMove);
  const alliance_target =
    params.behavior.cooperation >= 60
      ? "slight_warmth"
      : params.behavior.cooperation <= 35
        ? "guarded_distance"
        : "neutral_engagement";

  const clinical_directives = [
    ...params.clinical.may_disclose.map((t) => `may_disclose: ${t}`),
    ...params.clinical.must_withhold.map((t) => `withhold: ${t}`),
    `disclosure_layer: ${params.clinical.disclosure_layer}`,
    params.clinical.risk_delta,
    params.clinical.symptom_expression,
  ];

  const constraints = [
    ...HCE_ANTI_BIAS_DIRECTIVES,
    "You are the PATIENT, never the therapist or AI.",
    params.sessionLanguage === "ar"
      ? "Respond in Arabic matching session locale."
      : "Respond in English matching session locale.",
    `Locale: ${params.locale}`,
    "Do not repeat verbatim from forbidden_repetition list.",
  ];

  if (params.environment.time_pressure) {
    constraints.push("Session ending soon; slightly shorter turns OK.");
  }

  return {
    turn_goal,
    alliance_target,
    clinical_directives,
    emotion_directives: params.emotion.directives,
    behavior_directives: [
      ...params.behavior.directives,
      `resistance: ${params.behavior.resistance_mode}`,
      `target_words: ~${params.behavior.turn_length_target}`,
    ],
    voice_directives: params.voice.directives,
    constraints,
    reasoning_mode,
    therapist_move: params.therapistMove,
  };
}

function pickReasoningMode(
  move: TherapistMove,
  clinical: ClinicalEngineOutput,
): ReasoningMode {
  if (
    move === "safety_check" ||
    clinical.risk_delta.includes("elevated") ||
    clinical.disclosure_layer >= 3
  ) {
    return "deep";
  }
  return "fast";
}

function goalForMove(move: TherapistMove): string {
  switch (move) {
    case "safety_check":
      return "respond_to_safety_assessment";
    case "reflection":
      return "respond_to_empathic_reflection";
    case "validation":
      return "receive_validation";
    case "rupture_repair":
      return "repair_alliance";
    case "advice":
      return "surface_polite_compliance";
    case "invalidation":
      return "withdraw_affect";
    case "open_question":
      return "answer_openly_within_layer";
    case "closed_question":
      return "answer_factually_within_layer";
    case "rapport":
      return "establish_contact";
    default:
      return "continue_natural_dialogue";
  }
}

export function formatTurnBriefForPrompt(brief: TurnBrief, memory: MemoryEngineOutput): string {
  return [
    "TURN BRIEF (obey over general style):",
    `Goal: ${brief.turn_goal}`,
    `Alliance target: ${brief.alliance_target}`,
    `Therapist move: ${brief.therapist_move}`,
    `Clinical: ${brief.clinical_directives.join("; ")}`,
    `Emotion: ${brief.emotion_directives.join("; ")}`,
    `Behavior: ${brief.behavior_directives.join("; ")}`,
    `Voice: ${brief.voice_directives.join("; ")}`,
    `Memory summary: ${memory.relationship_summary}`,
    `Recalled: ${memory.recalled_facts.slice(-5).join("; ") || "none"}`,
    `Do not repeat: ${memory.forbidden_repetition.slice(-3).join("; ") || "none"}`,
    `Constraints: ${brief.constraints.join(" | ")}`,
  ].join("\n");
}
