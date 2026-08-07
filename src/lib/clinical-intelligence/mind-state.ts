/**
 * case_memory.memory.clinical_intelligence namespace helpers.
 * Must never clobber emotion / patient_adaptation keys (OWN-01).
 */

import type { ClinicalIntelligenceMindState } from "@/lib/clinical-intelligence/types";
import {
  CLINICAL_INTELLIGENCE_VERSION,
  MIND_STATE_VERSION,
} from "@/lib/clinical-intelligence/types";
import {
  defaultTreatmentAdherence,
} from "@/lib/clinical-intelligence/alliance";
import {
  defaultRecoveryTrajectory,
  computeRelapseRisk,
} from "@/lib/clinical-intelligence/recovery";
import {
  deserializeMindState,
  serializeMindState,
} from "@/lib/clinical-intelligence/serialize";
import type { PatientFormulation } from "@/lib/clinical-intelligence/types";

export type CaseMemoryWithCi = {
  emotion?: unknown;
  patient_adaptation?: unknown;
  adaptation_version?: string;
  clinical_intelligence?: ClinicalIntelligenceMindState;
  [key: string]: unknown;
};

export function createMindState(input: {
  caseInstanceId?: string | null;
  formulation?: PatientFormulation | null;
  sessionsCompleted?: number;
  acuteStress?: number;
  chronicLoad?: number;
}): ClinicalIntelligenceMindState {
  const recovery = defaultRecoveryTrajectory(10);
  recovery.sessions_completed = input.sessionsCompleted ?? 0;
  const stress = {
    acute: input.acuteStress ?? 40,
    chronic_load: input.chronicLoad ?? 35,
  };
  const adherence = defaultTreatmentAdherence(null);
  const relapse_risk = computeRelapseRisk({
    recovery,
    chronicStress: stress.chronic_load,
    allianceTrust: 40,
    hope: 40,
  });

  const belief_strength_overrides: Record<string, number> = {};
  for (const b of input.formulation?.belief_system.core_beliefs ?? []) {
    belief_strength_overrides[b.id] = b.strength;
  }

  return {
    version: MIND_STATE_VERSION,
    clinical_intelligence_version: CLINICAL_INTELLIGENCE_VERSION,
    case_instance_id: input.caseInstanceId ?? null,
    active_automatic_thoughts: (
      input.formulation?.automatic_thoughts_seed ?? []
    ).map((t) => ({ ...t })),
    belief_strength_overrides,
    self_esteem_global: input.formulation?.self_esteem?.global,
    insight_band: input.formulation?.insight?.band,
    adherence,
    recovery,
    relapse_risk,
    stress_reservoir: stress,
    crisis_risk: { band: false },
    decision_traces: [],
    updated_at: new Date().toISOString(),
  };
}

export function extractMindState(
  memory: unknown,
): ClinicalIntelligenceMindState | null {
  if (!memory || typeof memory !== "object") return null;
  const blob = memory as CaseMemoryWithCi;
  return deserializeMindState(blob.clinical_intelligence ?? null);
}

/**
 * Namespaced patch — preserves emotion + patient_adaptation siblings.
 */
export function embedMindState(
  existing: CaseMemoryWithCi | null | undefined,
  state: ClinicalIntelligenceMindState,
): CaseMemoryWithCi {
  return {
    ...(existing ?? {}),
    clinical_intelligence: serializeMindState(state),
  };
}

export function appendDecisionTrace(
  state: ClinicalIntelligenceMindState,
  trace: ClinicalIntelligenceMindState["decision_traces"][number],
): ClinicalIntelligenceMindState {
  const traces = [...state.decision_traces, trace].slice(-20);
  return {
    ...state,
    decision_traces: traces,
    updated_at: new Date().toISOString(),
  };
}
