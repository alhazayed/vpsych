/**
 * Case mint promotion pipeline (R-C3 → R-C1 → R-C2 → R-I2 → R-I3).
 * Extends ClinicalCore / snapshot fields without mutating mid-session.
 */

import type { ClinicalCore, RiskProfile } from "@/lib/types";
import type { TherapyModality } from "@/lib/case-engine/types";
import type {
  MentalStatusExam,
  PatientFormulation,
  ProtectiveFactor,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";
import { promoteProtectiveFactors, promoteMentalStatusExam } from "@/lib/clinical-intelligence/protectives";
import { promotePatientFormulation } from "@/lib/clinical-intelligence/formulation";
import { buildTherapyResponseProfile } from "@/lib/clinical-intelligence/therapy-response";
import { findFormulationSeed } from "@/lib/clinical-intelligence/package-seeds";

export type ClinicalIntelligencePromotion = {
  clinical_core: ClinicalCore;
  formulation: PatientFormulation;
  therapy_response_profile: TherapyResponseProfile;
  pattern_tags: string[];
  dissociation_bias: "none" | "mild_detachment" | "marked";
};

export function extendRiskProfile(
  risk: RiskProfile,
  disorderSlug?: string | null,
): RiskProfile {
  const seed = findFormulationSeed(disorderSlug);
  const static_factors = [...(risk.static_factors ?? [])];
  const dynamic_factors = [...(risk.dynamic_factors ?? [])];
  if (/ptsd|trauma|cptsd/i.test(disorderSlug ?? "")) {
    if (!static_factors.includes("trauma_history")) static_factors.push("trauma_history");
    if (!dynamic_factors.includes("trigger_exposure")) dynamic_factors.push("trigger_exposure");
  }
  if (/depress|mdd/i.test(disorderSlug ?? "")) {
    if (!dynamic_factors.includes("hopelessness")) dynamic_factors.push("hopelessness");
  }
  if (/borderline|bpd/i.test(disorderSlug ?? "")) {
    if (!dynamic_factors.includes("abandonment_activation")) {
      dynamic_factors.push("abandonment_activation");
    }
  }
  // Use seed insight only as educational tag when empty
  if (!static_factors.length && seed.protective_factors.length) {
    static_factors.push("see_protective_factors");
  }
  return {
    ...risk,
    self_neglect: risk.self_neglect ?? false,
    risk_to_dependents: risk.risk_to_dependents ?? false,
    static_factors: static_factors.length ? static_factors : risk.static_factors,
    dynamic_factors: dynamic_factors.length ? dynamic_factors : risk.dynamic_factors,
  };
}

export function promoteClinicalIntelligence(input: {
  clinicalCore: ClinicalCore;
  disorderSlug?: string | null;
  difficultyInsight?: string | null;
  modality: TherapyModality;
  legacyTherapyRules?: Record<string, unknown> | null;
  personaValues?: string[] | null;
  personaProtectives?: string[] | null;
  authoredMse?: Partial<MentalStatusExam> | null;
  authoredFormulation?: PatientFormulation | null;
  authoredProtectives?: ProtectiveFactor[] | null;
}): ClinicalIntelligencePromotion {
  const seed = findFormulationSeed(input.disorderSlug);

  const protective_factors = promoteProtectiveFactors({
    disorderSlug: input.disorderSlug,
    authored: input.authoredProtectives,
    personaProtectives: input.personaProtectives,
  });

  const mse = promoteMentalStatusExam({
    disorderSlug: input.disorderSlug,
    difficultyInsight: input.difficultyInsight,
    authored: input.authoredMse,
  });

  const formulation = promotePatientFormulation({
    disorderSlug: input.disorderSlug,
    personaValues: input.personaValues,
    authored: input.authoredFormulation,
  });

  const therapy_response_profile = buildTherapyResponseProfile(
    input.modality,
    input.legacyTherapyRules,
  );

  const clinical_core: ClinicalCore = {
    ...input.clinicalCore,
    risk_profile: extendRiskProfile(
      input.clinicalCore.risk_profile,
      input.disorderSlug,
    ),
    protective_factors,
    mse,
    formulation,
  };

  return {
    clinical_core,
    formulation,
    therapy_response_profile,
    pattern_tags: seed.pattern_tags,
    dissociation_bias: seed.dissociation_bias ?? "none",
  };
}
