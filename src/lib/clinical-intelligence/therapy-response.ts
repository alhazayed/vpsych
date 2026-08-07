/**
 * Therapy response profiles + intervention effect maps.
 * Effects modify internal state — never edit patient utterances directly.
 */

import type { TherapyModality } from "@/lib/case-engine/types";
import type {
  TherapyEffectDeltas,
  TherapyEffectProfile,
  TherapyInterventionKind,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";
import {
  defaultTherapyResponseProfile,
  normalizeTherapyResponseProfile,
} from "@/lib/clinical-intelligence/serialize";

export { defaultTherapyResponseProfile, normalizeTherapyResponseProfile };

export function buildTherapyResponseProfile(
  modality: TherapyModality,
  legacyRules?: Record<string, unknown> | null,
): TherapyResponseProfile {
  if (legacyRules && Object.keys(legacyRules).length > 0) {
    return normalizeTherapyResponseProfile(legacyRules, modality);
  }
  return defaultTherapyResponseProfile(modality);
}

/** Classify a therapist utterance into a Stage 6 therapy intervention kind. */
export function classifyTherapyIntervention(
  message: string,
  modality?: TherapyModality | null,
): TherapyInterventionKind {
  const t = message.toLowerCase();
  if (/\b(suicid|kill yourself|hurt yourself|safety plan|are you safe)\b/.test(t)) {
    return "risk_assessment";
  }
  if (/\b(homework|between sessions|practice (this|that)|worksheet|thought record)\b/.test(t)) {
    return "homework_review";
  }
  if (/\b(validat|makes sense|understandable that|of course you('d| would))\b/.test(t)) {
    return "validation";
  }
  if (/\b(what i hear|it sounds like|you('re| are) saying|reflect)\b/.test(t)) {
    return "reflection";
  }
  if (/\b(psychoeducat|often people|common (pattern|symptom)|research shows|the way this works)\b/.test(t)) {
    return "psychoeducation";
  }
  if (/\b(you (need|should|must|have to)|why don('t|t) you just)\b/.test(t)) {
    return "advice";
  }
  if (/\b(confront|you('re| are) avoiding|stop minimizing|that's not true)\b/.test(t)) {
    return "confrontation";
  }
  if (t.trim().length < 8 || /^(ok|okay|mm+|uh-huh|go on|\.\.\.)\s*$/i.test(t.trim())) {
    return "silence";
  }
  if (/\b(sorry you|that sounds (hard|painful|difficult)|i('m| am) with you)\b/.test(t)) {
    return "empathy";
  }
  if (/\b(stupid|ridiculous|attention.?seeking|manipulat)\b/.test(t)) {
    return "hostility";
  }
  // Modality-coloured default when no lexical hit
  if (modality === "cbt") return "cbt";
  if (modality === "dbt") return "dbt";
  if (modality === "act") return "act";
  if (modality === "psychodynamic") return "psychodynamic";
  if (modality === "motivational_interviewing") return "motivational_interviewing";
  if (modality === "supportive") return "supportive";
  return "other";
}

const EFFECT_TABLE: Record<TherapyInterventionKind, TherapyEffectDeltas> = {
  validation: {
    anger: -8,
    trust: 6,
    alliance_trust: 5,
    alliance_rapport: 6,
    disclosure_readiness: 5,
    self_esteem: 2,
  },
  empathy: {
    hope: 6,
    trust: 7,
    alliance_trust: 6,
    alliance_rapport: 7,
    disclosure_readiness: 6,
    motivation: 3,
  },
  reflection: {
    alliance_rapport: 4,
    alliance_trust: 3,
    disclosure_readiness: 3,
  },
  silence: {
    stress: -2,
    disclosure_readiness: 1,
  },
  psychoeducation: {
    hope: 5,
    motivation: 6,
    insight_nudge: 4,
    trust: 2,
  },
  supportive: {
    hope: 5,
    stress: -5,
    alliance_rapport: 5,
  },
  cbt: {
    insight_nudge: 3,
    motivation: 3,
    homework_adherence: 2,
    trust: 1,
  },
  dbt: {
    anger: -5,
    trust: 4,
    alliance_rapport: 4,
    disclosure_readiness: 3,
  },
  act: {
    hope: 4,
    motivation: 4,
    self_esteem: 2,
  },
  psychodynamic: {
    insight_nudge: 2,
    stress: 2,
    disclosure_readiness: -1,
  },
  motivational_interviewing: {
    motivation: 5,
    alliance_rapport: 4,
    disclosure_readiness: 3,
  },
  confrontation: {
    anger: 10,
    stress: 8,
    trust: -8,
    alliance_trust: -7,
    disclosure_readiness: -6,
  },
  advice: {
    motivation: -6,
    trust: -4,
    alliance_trust: -3,
  },
  hostility: {
    anger: 18,
    stress: 12,
    trust: -20,
    alliance_trust: -18,
    alliance_rapport: -15,
    disclosure_readiness: -20,
    hope: -10,
    self_esteem: -6,
  },
  homework_review: {
    homework_adherence: 8,
    motivation: 3,
    alliance_rapport: 2,
  },
  risk_assessment: {
    stress: -4,
    trust: 5,
    alliance_trust: 4,
  },
  other: {},
};

/**
 * Deterministic therapy-effect profile for an intervention.
 * Does not mutate speech — callers apply deltas to Emotion / Adaptation / mind state.
 */
export function therapyEffectForIntervention(
  intervention: TherapyInterventionKind,
  profile?: TherapyResponseProfile | null,
): TherapyEffectProfile {
  const base = { ...EFFECT_TABLE[intervention] };
  const notes: string[] = [`intervention=${intervention}`];

  if (profile) {
    const biases = profile.response_biases;
    if (intervention === "advice" && biases.advice_sensitivity === "high") {
      base.motivation = (base.motivation ?? 0) - 4;
      base.trust = (base.trust ?? 0) - 3;
      notes.push("MI advice_sensitivity=high");
    }
    if (
      intervention === "confrontation" &&
      profile.resists.some((r) => /confrontation/i.test(r))
    ) {
      base.anger = (base.anger ?? 0) + 4;
      base.trust = (base.trust ?? 0) - 3;
      notes.push("modality resists confrontation");
    }
    if (
      biases.validation_required &&
      intervention !== "validation" &&
      intervention !== "empathy" &&
      (intervention === "cbt" ||
        intervention === "confrontation" ||
        intervention === "advice")
    ) {
      base.anger = (base.anger ?? 0) + 6;
      base.alliance_trust = (base.alliance_trust ?? 0) - 5;
      notes.push("DBT validation_required unmet");
    }
    if (biases.trust_gate && intervention === "psychoeducation") {
      // psychoeducation gains gated — caller should check trust; we note only
      notes.push("trust_gate on psychoeducation");
    }
    if (intervention === "homework_review" && biases.homework_sensitivity === "high") {
      base.homework_adherence = (base.homework_adherence ?? 0) + 4;
      notes.push("homework_sensitivity=high");
    }
    if (
      biases.defence_on_interpretation &&
      intervention === "psychodynamic"
    ) {
      base.stress = (base.stress ?? 0) + 3;
      notes.push("defence_on_interpretation");
    }
  }

  return { intervention, deltas: base, notes };
}
