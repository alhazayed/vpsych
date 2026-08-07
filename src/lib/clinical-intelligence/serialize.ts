/**
 * Serialization helpers for Clinical Intelligence blobs.
 * Readers must default-absent for legacy slim snapshots.
 */

import type {
  ClinicalIntelligenceMindState,
  PatientFormulation,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";
import {
  CLINICAL_INTELLIGENCE_VERSION,
  FORMULATION_VERSION,
  MIND_STATE_VERSION,
  THERAPY_RESPONSE_VERSION,
} from "@/lib/clinical-intelligence/types";
import { clamp01to100 } from "@/lib/clinical-intelligence/clamp";

export function serializeFormulation(f: PatientFormulation): PatientFormulation {
  return structuredClone(f);
}

export function deserializeFormulation(
  raw: unknown,
): PatientFormulation | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as PatientFormulation;
  if (f.version !== FORMULATION_VERSION) return null;
  if (!f.belief_system || !Array.isArray(f.belief_system.core_beliefs)) return null;
  return f;
}

export function serializeTherapyResponseProfile(
  p: TherapyResponseProfile,
): Record<string, unknown> {
  return {
    version: p.version,
    modality: p.modality,
    engages_with: p.engages_with,
    resists: p.resists,
    alliance_cue: p.alliance_cue,
    response_biases: p.response_biases,
  };
}

/**
 * Accepts both Stage 6 TherapyResponseProfile and legacy 3-field bags.
 */
export function normalizeTherapyResponseProfile(
  raw: unknown,
  modalityFallback: TherapyResponseProfile["modality"],
): TherapyResponseProfile {
  if (!raw || typeof raw !== "object") {
    return defaultTherapyResponseProfile(modalityFallback);
  }
  const r = raw as Record<string, unknown>;
  const engages = Array.isArray(r.engages_with)
    ? (r.engages_with as string[])
    : ["empathy", "collaboration"];
  const resists = Array.isArray(r.resists)
    ? (r.resists as string[])
    : ["premature confrontation"];
  const alliance_cue =
    typeof r.alliance_cue === "string"
      ? r.alliance_cue
      : `${modalityFallback}: patient reacts to modality-congruent stance.`;
  const modality =
    (typeof r.modality === "string"
      ? (r.modality as TherapyResponseProfile["modality"])
      : modalityFallback) ?? modalityFallback;
  const biases =
    r.response_biases && typeof r.response_biases === "object"
      ? (r.response_biases as TherapyResponseProfile["response_biases"])
      : defaultBiasesForModality(modality);

  return {
    version: THERAPY_RESPONSE_VERSION,
    modality,
    engages_with: engages,
    resists: resists,
    alliance_cue,
    response_biases: biases,
  };
}

export function defaultBiasesForModality(
  modality: TherapyResponseProfile["modality"],
): TherapyResponseProfile["response_biases"] {
  switch (modality) {
    case "cbt":
      return {
        trust_gate: true,
        homework_sensitivity: "medium",
        advice_sensitivity: "medium",
        exposure_readiness: "low",
      };
    case "dbt":
      return {
        validation_required: true,
        trust_gate: true,
        advice_sensitivity: "medium",
      };
    case "act":
      return {
        trust_gate: true,
        advice_sensitivity: "low",
      };
    case "motivational_interviewing":
      return {
        advice_sensitivity: "high",
        trust_gate: true,
      };
    case "psychodynamic":
      return {
        defence_on_interpretation: true,
        advice_sensitivity: "medium",
      };
    case "exposure_therapy":
      return {
        exposure_readiness: "moderate",
        trust_gate: true,
        homework_sensitivity: "high",
      };
    case "crisis_intervention":
      return {
        trust_gate: false,
        advice_sensitivity: "low",
        exposure_readiness: "none",
      };
    default:
      return {
        trust_gate: true,
        advice_sensitivity: "medium",
      };
  }
}

export function defaultTherapyResponseProfile(
  modality: TherapyResponseProfile["modality"],
): TherapyResponseProfile {
  const label = modality.replace(/_/g, " ");
  const engages =
    modality === "cbt"
      ? ["structured questions", "thought records"]
      : modality === "crisis_intervention"
        ? ["safety focus", "grounding"]
        : modality === "dbt"
          ? ["validation", "collaboration"]
          : modality === "motivational_interviewing"
            ? ["empathy", "collaboration", "evocation"]
            : ["empathy", "collaboration"];
  const resists =
    modality === "motivational_interviewing"
      ? ["advice-giving"]
      : modality === "dbt"
        ? ["change without validation", "premature confrontation"]
        : ["premature confrontation"];
  return {
    version: THERAPY_RESPONSE_VERSION,
    modality,
    engages_with: engages,
    resists,
    alliance_cue: `${label}: patient reacts to modality-congruent stance.`,
    response_biases: defaultBiasesForModality(modality),
  };
}

export function serializeMindState(
  state: ClinicalIntelligenceMindState,
): ClinicalIntelligenceMindState {
  return structuredClone(state);
}

export function deserializeMindState(
  raw: unknown,
): ClinicalIntelligenceMindState | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as ClinicalIntelligenceMindState;
  if (m.version !== MIND_STATE_VERSION) return null;
  if (!m.recovery || !m.adherence || !m.relapse_risk || !m.stress_reservoir) {
    return null;
  }
  return {
    ...m,
    clinical_intelligence_version:
      m.clinical_intelligence_version ?? CLINICAL_INTELLIGENCE_VERSION,
    belief_strength_overrides: m.belief_strength_overrides ?? {},
    active_automatic_thoughts: m.active_automatic_thoughts ?? [],
    decision_traces: Array.isArray(m.decision_traces)
      ? m.decision_traces.slice(-20)
      : [],
    stress_reservoir: {
      acute: clamp01to100(m.stress_reservoir.acute ?? 40),
      chronic_load: clamp01to100(m.stress_reservoir.chronic_load ?? 35),
    },
  };
}
