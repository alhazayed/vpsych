/**
 * PatientDecisionPlan façade — aggregates Adaptation + Emotion + CBE (+ formulation).
 * Does not replace those engines. Soft-fail friendly.
 */

import type { PatientAdaptationState } from "@/lib/adaptation/types";
import type { EmotionState } from "@/lib/emotion/types";
import type { ConversationBehaviourPlan } from "@/lib/conversation-behaviour/types";
import type { TherapyModality } from "@/lib/case-engine/types";
import type {
  CognitiveMove,
  DissociationBias,
  ImprovementSignal,
  PatientDecisionPlan,
  PatientFormulation,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";

export type DecidePatientTurnInput = {
  adaptation?: Pick<
    PatientAdaptationState,
    "stance" | "effects" | "rapport" | "trust"
  > | null;
  emotion?: Pick<EmotionState, "mode" | "variables"> | null;
  behaviour?: Pick<
    ConversationBehaviourPlan,
    "disclosureGate" | "primary" | "secondary" | "directReply"
  > | null;
  formulation?: PatientFormulation | null;
  therapyProfile?: TherapyResponseProfile | null;
  modality?: TherapyModality | null;
  therapistMessage?: string;
  disorderSlug?: string | null;
  dissociationBias?: DissociationBias;
};

function pickCognitiveMove(
  message: string,
  formulation: PatientFormulation | null | undefined,
  emotionMode: string | undefined,
): { move: CognitiveMove; schemaIds: string[]; thoughtIds: string[] } {
  const t = message.toLowerCase();
  const schemaIds: string[] = [];
  const thoughtIds: string[] = [];

  if (!formulation) {
    if (emotionMode === "collapsed") return { move: "blank", schemaIds, thoughtIds };
    if (emotionMode === "activated") return { move: "ruminate", schemaIds, thoughtIds };
    return { move: "problem_solve", schemaIds, thoughtIds };
  }

  for (const at of formulation.automatic_thoughts_seed) {
    if (at.trigger_topics.some((topic) => t.includes(topic) || topic.length > 3 && message.toLowerCase().includes(topic))) {
      thoughtIds.push(at.id);
    }
  }
  for (const sch of formulation.schemas) {
    // Activate when message touches linked belief domains via rough keyword
    const linked = formulation.belief_system.core_beliefs.filter((b) =>
      sch.linked_belief_ids.includes(b.id),
    );
    for (const b of linked) {
      if (
        b.domain === "self" && /\b(you|yourself|worth|fail)\b/.test(t) ||
        b.domain === "others" && /\b(people|therapist|partner|family|friend)\b/.test(t) ||
        b.domain === "future" && /\b(future|hope|will|never)\b/.test(t) ||
        b.domain === "world" && /\b(safe|danger|world|trust)\b/.test(t)
      ) {
        schemaIds.push(sch.id);
      }
    }
  }

  if (emotionMode === "collapsed" || emotionMode === "withdrawn") {
    return { move: "blank", schemaIds, thoughtIds };
  }
  if (thoughtIds.length || schemaIds.length) {
    return { move: "activate_schema", schemaIds, thoughtIds };
  }
  if (emotionMode === "activated" || /\b(worry|what if|always|never)\b/.test(t)) {
    return { move: "ruminate", schemaIds, thoughtIds };
  }
  if (/\b(how can|what would help|values|goal)\b/.test(t)) {
    return { move: "problem_solve", schemaIds, thoughtIds };
  }
  return { move: "problem_solve", schemaIds, thoughtIds };
}

function improvementSignal(
  adaptation: DecidePatientTurnInput["adaptation"],
  emotion: DecidePatientTurnInput["emotion"],
): ImprovementSignal {
  if (!adaptation && !emotion) return "none";
  const allianceWarm =
    (adaptation?.rapport.level ?? 0) >= 60 &&
    (adaptation?.trust.level ?? 0) >= 55 &&
    (adaptation?.stance === "engaging" ||
      adaptation?.stance === "disclosing" ||
      adaptation?.stance === "opening");
  if (allianceWarm) return "alliance";
  if ((emotion?.variables.hope ?? 0) >= 55 && (emotion?.variables.motivation ?? 0) >= 55) {
    return "insight";
  }
  return "none";
}

/**
 * Build a deterministic PatientDecisionPlan from existing engine outputs.
 */
export function decidePatientTurn(
  input: DecidePatientTurnInput,
): PatientDecisionPlan {
  const disclosure = input.behaviour?.disclosureGate ?? "partial";
  const primary = input.behaviour?.primary;
  const act =
    primary ??
    (disclosure === "withhold"
      ? "avoidance"
      : disclosure === "deflect"
        ? "guardedness"
        : "cooperate");

  const affect_mode = input.emotion?.mode ?? "engaged";
  const stance = input.adaptation?.stance ?? "guarded";

  let speak: PatientDecisionPlan["speak"] = "llm";
  if (input.behaviour?.directReply) {
    speak =
      primary === "silence" || primary === "therapist_interruption"
        ? "silence_hold"
        : "direct";
  }

  const cognitive = pickCognitiveMove(
    input.therapistMessage ?? "",
    input.formulation,
    affect_mode,
  );

  const dissociation =
    input.dissociationBias ??
    (input.disorderSlug && /ptsd|trauma|cptsd|dissoc/i.test(input.disorderSlug)
      ? "mild_detachment"
      : "none");

  const therapy_bias: string[] = [];
  if (input.therapyProfile) {
    if (
      input.therapyProfile.response_biases.advice_sensitivity === "high" &&
      /\b(you should|you need to|you must)\b/i.test(input.therapistMessage ?? "")
    ) {
      therapy_bias.push("resist_advice");
    }
    if (
      input.therapyProfile.response_biases.validation_required &&
      !/\b(valid|makes sense|understandable)\b/i.test(input.therapistMessage ?? "")
    ) {
      therapy_bias.push("needs_validation");
    }
  }

  const defence_ids =
    input.formulation?.defense_mechanisms
      ?.filter((d) =>
        d.topics.some((topic) =>
          (input.therapistMessage ?? "").toLowerCase().includes(topic),
        ),
      )
      .map((d) => d.id) ?? [];

  return {
    version: 1,
    disclosure,
    act,
    affect_mode,
    stance,
    cognitive_move: cognitive.move,
    dissociation,
    improvement_signal: improvementSignal(input.adaptation, input.emotion),
    speak,
    activated_schema_ids: cognitive.schemaIds,
    activated_thought_ids: cognitive.thoughtIds,
    meta: {
      modality: input.modality ?? input.therapyProfile?.modality ?? null,
      therapy_bias,
      defence_ids,
    },
  };
}
