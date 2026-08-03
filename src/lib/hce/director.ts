/**
 * Conversation Director — Turn Brief with action vocabulary (Layer 9 + 10).
 */

import { HCE_ANTI_BIAS_DIRECTIVES } from "@/lib/hce/bias";
import { deliveryDirectivesFor } from "@/lib/hce/delivery";
import { trustToDisclosureClass } from "@/lib/hce/engines/internal-state";
import type {
  BehaviorEngineOutput,
  ClinicalEngineOutput,
  DirectorAction,
  DisclosureClass,
  EmotionEngineOutput,
  EnvironmentEngineOutput,
  HceInternalState,
  MemoryEngineOutput,
  ReasoningMode,
  TherapistMove,
  TimingEngineOutput,
  TurnBrief,
  VoiceEngineOutput,
} from "@/lib/hce/types";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

export function buildTurnBrief(params: {
  snapshot: CaseInstanceSnapshot;
  therapistMove: TherapistMove;
  memory: MemoryEngineOutput;
  clinical: ClinicalEngineOutput;
  emotion: EmotionEngineOutput;
  environment: EnvironmentEngineOutput;
  behavior: BehaviorEngineOutput;
  voice: VoiceEngineOutput;
  timing: TimingEngineOutput;
  internal: HceInternalState;
  sessionLanguage: string;
  locale: string;
  therapistBargeIn?: boolean;
}): TurnBrief {
  const reasoning_mode: ReasoningMode = pickReasoningMode(
    params.therapistMove,
    params.clinical,
  );

  const mayDisclose = params.clinical.may_disclose.length > 0;
  const disclosure_class: DisclosureClass = trustToDisclosureClass(
    params.internal.trust,
    mayDisclose,
  );

  const director_action = pickDirectorAction(
    params.therapistMove,
    disclosure_class,
    params.internal,
    params.timing,
    params.therapistBargeIn,
  );

  const delivery = deliveryDirectivesFor(
    director_action,
    disclosure_class,
    params.internal,
    params.snapshot.primary_diagnosis.slug,
  );

  const turn_goal = goalForAction(director_action);
  const alliance_target =
    params.behavior.cooperation >= 60
      ? "slight_warmth"
      : params.behavior.cooperation <= 35
        ? "guarded_distance"
        : "neutral_engagement";

  const clinical_directives = [
    ...params.clinical.may_disclose.map((t) => `may_disclose: ${t}`),
    ...params.clinical.must_withhold.map((t) => `withhold: ${t}`),
    `disclosure_class: ${disclosure_class}`,
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
    `Internal trust ${params.internal.trust} — shape disclosure accordingly.`,
  ];

  if (params.environment.time_pressure) {
    constraints.push("Session ending soon; slightly shorter turns OK.");
  }

  if (params.memory.emotional_recall.length) {
    constraints.push(
      `Emotional continuity: ${params.memory.emotional_recall.slice(-2).join("; ")}`,
    );
  }

  return {
    turn_goal,
    alliance_target,
    director_action,
    disclosure_class,
    clinical_directives,
    emotion_directives: [
      ...params.emotion.directives,
      `sadness ${params.emotion.vector.sadness}% anxiety ${params.emotion.vector.anxiety}%`,
    ],
    behavior_directives: [
      ...params.behavior.directives,
      `resistance: ${params.behavior.resistance_mode}`,
      `target_words: ~${params.behavior.turn_length_target}`,
    ],
    voice_directives: params.voice.directives,
    delivery_directives: [
      ...delivery.directives,
      `tags: ${delivery.suggested_tags.join(", ")}`,
    ],
    constraints,
    reasoning_mode,
    therapist_move: params.therapistMove,
    patient_should_interrupt:
      params.timing.should_interrupt ||
      director_action === "interrupt_therapist",
  };
}

function pickDirectorAction(
  move: TherapistMove,
  disclosureClass: DisclosureClass,
  internal: HceInternalState,
  timing: TimingEngineOutput,
  bargeIn?: boolean,
): DirectorAction {
  if (bargeIn && timing.should_interrupt) return "interrupt_therapist";
  if (timing.should_interrupt) return "interrupt_therapist";
  if (move === "invalidation") return "deflect";
  if (disclosureClass === "deflect") return "deflect";
  if (disclosureClass === "withhold") return "avoid_topic";
  if (disclosureClass === "partial") return "partial_disclosure";
  if (move === "rupture_repair") return "de_escalate";
  if (move === "safety_check" && internal.fear > 50) return "de_escalate";
  if (internal.alliance_stage === "resistance") return "deflect";
  if (internal.trust > 75 && disclosureClass === "full") return "full_disclosure";
  if (move === "silence") return "stay_silent_brief";
  return "answer";
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

function goalForAction(action: DirectorAction): string {
  const map: Record<DirectorAction, string> = {
    answer: "continue_natural_dialogue",
    deflect: "deflect_without_hostility",
    partial_disclosure: "share_partial_truth",
    full_disclosure: "share_vulnerable_truth",
    avoid_topic: "avoid_topic_politely",
    ask_question: "ask_clarifying_question",
    change_subject: "shift_topic",
    become_emotional: "show_brief_authentic_affect",
    stay_silent_brief: "minimal_response_after_pause",
    interrupt_therapist: "interrupt_mid_sentence",
    de_escalate: "lower_intensity",
    escalate_distress: "heighten_distress",
  };
  return map[action] ?? "continue_natural_dialogue";
}

export function formatTurnBriefForPrompt(
  brief: TurnBrief,
  memory: MemoryEngineOutput,
): string {
  return [
    "TURN BRIEF (obey over general style):",
    `Goal: ${brief.turn_goal}`,
    `Director action: ${brief.director_action}`,
    `Disclosure class: ${brief.disclosure_class}`,
    `Alliance target: ${brief.alliance_target}`,
    `Therapist move: ${brief.therapist_move}`,
    `Clinical: ${brief.clinical_directives.join("; ")}`,
    `Emotion: ${brief.emotion_directives.join("; ")}`,
    `Behavior: ${brief.behavior_directives.join("; ")}`,
    `Delivery: ${brief.delivery_directives.join("; ")}`,
    `Voice: ${brief.voice_directives.join("; ")}`,
    `Memory summary: ${memory.relationship_summary}`,
    `Recalled: ${memory.recalled_facts.slice(-5).join("; ") || "none"}`,
    `Emotional recall: ${memory.emotional_recall.slice(-3).join("; ") || "none"}`,
    `Do not repeat: ${memory.forbidden_repetition.slice(-3).join("; ") || "none"}`,
    `Constraints: ${brief.constraints.join(" | ")}`,
  ].join("\n");
}
