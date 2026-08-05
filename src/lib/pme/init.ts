/**
 * Initialize PatientMindState from a clinical case snapshot.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { clinicalDynamicsFor } from "@/lib/pme/clinical-dynamics";
import { createDisclosureState } from "@/lib/pme/disclosure";
import { baselineForDisorder } from "@/lib/pme/emotion";
import { createRelationshipMemory } from "@/lib/pme/relationship";
import { PME_VERSION, type PatientMindState } from "@/lib/pme/types";

export function createInitialMindState(opts: {
  snapshot: CaseInstanceSnapshot | null;
  caseInstanceId?: string | null;
  therapistId?: string | null;
  learnerId?: string | null;
  longitudinalGroupId?: string | null;
  disorderSlug?: string | null;
  disorderName?: string | null;
  category?: string | null;
}): PatientMindState {
  const snap = opts.snapshot;
  const slug =
    opts.disorderSlug ??
    snap?.primary_diagnosis?.slug ??
    "unknown";
  const name =
    opts.disorderName ?? snap?.primary_diagnosis?.name ?? slug;
  const category =
    opts.category ?? snap?.primary_diagnosis?.category ?? null;
  const risk = snap?.clinical_core?.risk_profile ?? {
    suicidal_ideation: "none",
    self_harm: false,
    harm_to_others: false,
    substance_use: false,
  };

  const now = new Date().toISOString();
  return {
    pme_version: PME_VERSION,
    case_instance_id: opts.caseInstanceId ?? snap?.case_instance_id ?? null,
    longitudinal_group_id: opts.longitudinalGroupId ?? null,
    learner_id: opts.learnerId ?? null,
    diagnosis: {
      slug,
      name,
      category,
      comorbidities: (snap?.comorbidities ?? []).map((c) => c.slug),
    },
    personality: {
      interpersonal_style: "guarded-collaborative",
      cognitive_style: /ocd/i.test(slug)
        ? "detail-focused uncertain"
        : /mania/i.test(slug)
          ? "expansive associative"
          : "concrete everyday",
      attachment: /bpd|borderline/i.test(slug)
        ? "anxious-preoccupied"
        : "avoidant-leaning",
    },
    relationship: createRelationshipMemory(opts.therapistId ?? null),
    disclosure: createDisclosureState({
      suicidal: (risk.suicidal_ideation ?? "none") !== "none",
      self_harm: Boolean(risk.self_harm),
      substance: Boolean(risk.substance_use),
    }),
    current_defenses: [],
    emotional_state: baselineForDisorder(slug),
    clinical: clinicalDynamicsFor(slug, category, risk),
    therapy: {
      session_index: 1,
      phase: "opening",
      turns_in_phase: 0,
      motivation: 40,
      insight: /schizo/i.test(slug) ? 25 : 45,
      symptom_burden: snap?.severity === "severe" ? 75 : snap?.severity === "mild" ? 45 : 60,
      medication_adherence: 70,
      coping_style: "avoidant-minimizing",
    },
    life_events: [],
    memory: {
      salient_facts: [],
      avoided_topics: [],
      preferred_topics: [],
    },
    turn_traces: [],
    updated_at: now,
    created_at: now,
  };
}
