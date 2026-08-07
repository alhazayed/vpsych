/**
 * Phase 14 — Clinical / educational / research / ops evidence aggregation.
 * Counts and observational indices only. Never includes PHI or report narrative.
 */

export type ClinicalEvidenceInput = {
  simulations_started?: number;
  simulations_completed?: number;
  simulations_abandoned?: number;
  clinical_realism_mean?: number;
  supervisor_agreement?: number;
  assessment_reliability?: number;
  validation_consistency?: number;
  faculty_observations?: number;
};

export type EducationalEvidenceInput = {
  resident_progression?: number;
  faculty_engagement?: number;
  curriculum_completion?: number;
  competency_milestones?: number;
  certification_completion?: number;
  knowledge_retention?: number;
  skill_progression?: number;
};

export type ResearchEvidenceInput = {
  inter_rater_reliability?: number;
  multicenter_sites?: number;
  publication_ready_datasets?: number;
  longitudinal_tracks?: number;
  realism_index?: number;
};

export type EvidenceMetric = {
  id: string;
  label: string;
  value: number;
  unit?: string;
  note?: string;
};

export type EvidenceDomainBundle = {
  domain: "clinical" | "educational" | "research" | "operational";
  generated_at: string;
  metrics: EvidenceMetric[];
  phi_policy: string;
};

const PHI =
  "PHI-free aggregates only. Fictional standardized patients. No session_reports narrative.";

function n(v: number | undefined, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pct(ratio: number): number {
  return Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10;
}

export function buildClinicalEvidence(
  input: ClinicalEvidenceInput = {},
): EvidenceDomainBundle {
  const started = n(input.simulations_started);
  const completed = n(input.simulations_completed);
  const abandoned = n(input.simulations_abandoned);
  const denom = Math.max(started, completed + abandoned);
  const completion = denom === 0 ? 0 : completed / denom;
  const dropout = denom === 0 ? 0 : abandoned / denom;

  return {
    domain: "clinical",
    generated_at: new Date().toISOString(),
    phi_policy: PHI,
    metrics: [
      {
        id: "completion_rate",
        label: "Simulation completion rate",
        value: pct(completion),
        unit: "%",
      },
      {
        id: "dropout_rate",
        label: "Dropout / abandon rate",
        value: pct(dropout),
        unit: "%",
      },
      {
        id: "clinical_realism",
        label: "Clinical realism rating (mean)",
        value: pct(n(input.clinical_realism_mean)),
        unit: "%",
        note: "Observational — not a validated instrument",
      },
      {
        id: "supervisor_agreement",
        label: "Supervisor agreement",
        value: pct(n(input.supervisor_agreement)),
        unit: "%",
      },
      {
        id: "assessment_reliability",
        label: "Assessment reliability proxy",
        value: pct(n(input.assessment_reliability)),
        unit: "%",
        note: "Not scientifically validated",
      },
      {
        id: "validation_consistency",
        label: "Validation consistency",
        value: pct(n(input.validation_consistency)),
        unit: "%",
      },
      {
        id: "faculty_observations",
        label: "Faculty observations logged",
        value: n(input.faculty_observations),
      },
    ],
  };
}

export function buildEducationalEvidence(
  input: EducationalEvidenceInput = {},
): EvidenceDomainBundle {
  return {
    domain: "educational",
    generated_at: new Date().toISOString(),
    phi_policy: PHI,
    metrics: [
      {
        id: "resident_progression",
        label: "Resident progression",
        value: pct(n(input.resident_progression)),
        unit: "%",
      },
      {
        id: "faculty_engagement",
        label: "Faculty engagement",
        value: pct(n(input.faculty_engagement)),
        unit: "%",
      },
      {
        id: "curriculum_completion",
        label: "Curriculum completion",
        value: pct(n(input.curriculum_completion)),
        unit: "%",
      },
      {
        id: "competency_milestones",
        label: "Competency milestones reached",
        value: n(input.competency_milestones),
      },
      {
        id: "certification_completion",
        label: "Certification completion",
        value: pct(n(input.certification_completion)),
        unit: "%",
      },
      {
        id: "knowledge_retention",
        label: "Knowledge retention proxy",
        value: pct(n(input.knowledge_retention)),
        unit: "%",
      },
      {
        id: "skill_progression",
        label: "Skill progression",
        value: pct(n(input.skill_progression)),
        unit: "%",
      },
    ],
  };
}

export function buildResearchEvidence(
  input: ResearchEvidenceInput = {},
): EvidenceDomainBundle {
  return {
    domain: "research",
    generated_at: new Date().toISOString(),
    phi_policy: PHI,
    metrics: [
      {
        id: "inter_rater",
        label: "Inter-rater reliability",
        value: pct(n(input.inter_rater_reliability)),
        unit: "%",
      },
      {
        id: "multicenter_sites",
        label: "Multicenter participating sites",
        value: n(input.multicenter_sites),
      },
      {
        id: "publication_datasets",
        label: "Publication-ready datasets",
        value: n(input.publication_ready_datasets),
      },
      {
        id: "longitudinal_tracks",
        label: "Longitudinal tracks",
        value: n(input.longitudinal_tracks),
      },
      {
        id: "realism_index",
        label: "Realism index (observational)",
        value: pct(n(input.realism_index)),
        unit: "%",
      },
    ],
  };
}
