/**
 * Phase 16 — Institutional pilot registry (ops-owned).
 * Records only supplied institution observations. Empty registry ≠ fabricated pilots.
 */

import {
  EVIDENCE_PENDING,
  observed,
  pending,
  type EvidenceValue,
} from "@/lib/ops/phase16-evidence-state";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export const INSTITUTION_TYPES = [
  "university",
  "medical_school",
  "psychiatry_residency",
  "hospital",
  "research_centre",
  "mental_health_institute",
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

/** Observed institution pilot record — all counts must be real observations. */
export type InstitutionPilotProfile = {
  id: string;
  institution_name: string;
  institution_type: InstitutionType;
  deployment_date: string;
  software_version: string;
  administrator?: string;
  faculty_users: number;
  resident_users: number;
  active_learners: number;
  simulations_started: number;
  simulations_completed: number;
  assessments_completed: number;
  supervisor_reviews: number;
  certifications_issued: number;
};

export type InstitutionPilotDashboard = {
  generated_at: string;
  package_version: string;
  registry_state: "OBSERVED" | "EVIDENCE_PENDING";
  institutions_registered: EvidenceValue<number>;
  profiles: InstitutionPilotProfile[];
  aggregates: EvidenceValue<number>[];
  notes: string[];
};

export function buildInstitutionPilotDashboard(
  profiles: InstitutionPilotProfile[] = [],
): InstitutionPilotDashboard {
  if (profiles.length === 0) {
    return {
      generated_at: new Date().toISOString(),
      package_version: PACKAGE_VERSION,
      registry_state: "EVIDENCE_PENDING",
      institutions_registered: pending("Institutions registered", {
        source: "pilot registry",
        note: "No institution pilot profiles supplied — do not invent pilots",
      }),
      profiles: [],
      aggregates: [
        pending("Faculty users"),
        pending("Resident users"),
        pending("Active learners"),
        pending("Simulations started"),
        pending("Simulations completed"),
        pending("Assessments completed"),
        pending("Supervisor reviews"),
        pending("Certifications issued"),
      ],
      notes: [
        EVIDENCE_PENDING,
        "Institutional pilot registry is empty. Onboard via CIDP checklist; do not fabricate profiles.",
      ],
    };
  }

  const sum = (fn: (p: InstitutionPilotProfile) => number) =>
    profiles.reduce((a, p) => a + fn(p), 0);

  return {
    generated_at: new Date().toISOString(),
    package_version: PACKAGE_VERSION,
    registry_state: "OBSERVED",
    institutions_registered: observed(
      "Institutions registered",
      profiles.length,
      { source: "pilot registry" },
    ),
    profiles: profiles.map((p) => ({
      ...p,
      software_version: p.software_version || PACKAGE_VERSION,
    })),
    aggregates: [
      observed("Faculty users", sum((p) => p.faculty_users)),
      observed("Resident users", sum((p) => p.resident_users)),
      observed("Active learners", sum((p) => p.active_learners)),
      observed("Simulations started", sum((p) => p.simulations_started)),
      observed("Simulations completed", sum((p) => p.simulations_completed)),
      observed("Assessments completed", sum((p) => p.assessments_completed)),
      observed("Supervisor reviews", sum((p) => p.supervisor_reviews)),
      observed("Certifications issued", sum((p) => p.certifications_issued)),
    ],
    notes: [
      "Aggregates are sums of observed institution records only.",
      "No PHI. Fictional standardized patients only.",
    ],
  };
}
