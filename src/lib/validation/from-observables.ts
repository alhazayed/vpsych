/**
 * Adapters: build SessionObservables from existing sealed data.
 * Read-only. Never mutates patient stores.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ClinicalCore } from "@/lib/types";
import type {
  AssessmentObservables,
  ClinicalObservables,
  ObservationalMessage,
  SessionObservables,
} from "@/lib/validation/types";

function asCore(snap: CaseInstanceSnapshot | null | undefined): ClinicalCore | null {
  return snap?.clinical_core ?? null;
}

export function clinicalObservablesFromSnapshot(input: {
  sessionId: string;
  snapshot: CaseInstanceSnapshot | null | undefined;
  locale?: string;
}): ClinicalObservables {
  const snap = input.snapshot ?? null;
  const core = asCore(snap);
  const symptoms = core?.symptom_profile ?? [];
  const teaching = snap?.clinical_teaching;
  const domains = [
    ...new Set(
      symptoms
        .map((s) => s.domain)
        .filter((d): d is NonNullable<typeof d> => Boolean(d)),
    ),
  ];
  const risk = core?.risk_profile;

  return {
    session_id: input.sessionId,
    disorder_slug: snap?.primary_diagnosis?.slug ?? null,
    disorder_name: snap?.primary_diagnosis?.name ?? null,
    dsm5_code: snap?.primary_diagnosis?.dsm5_code ?? null,
    icd11_code: snap?.primary_diagnosis?.icd11_code ?? null,
    severity: snap?.severity ?? core?.severity ?? null,
    onset_duration: core?.onset_duration ?? null,
    locale: snap?.locale ?? input.locale ?? "en-US",
    difficulty: snap?.difficulty ?? null,
    therapy_modality: snap?.therapy_modality ?? null,
    symptom_count: Array.isArray(symptoms) ? symptoms.length : 0,
    symptom_domains: domains.map(String),
    comorbidities: (snap?.comorbidities ?? []).map((c) => ({
      slug: c.slug,
      name: c.name,
    })),
    differentials_count: teaching?.differentials?.length ?? 0,
    rule_outs_count: teaching?.rule_outs?.length ?? 0,
    teaching_points_count: teaching?.teaching_points?.length ?? 0,
    has_mse: Boolean(core?.mse),
    has_protective_factors: Boolean(
      core?.protective_factors && core.protective_factors.length > 0,
    ),
    has_formulation: Boolean(core?.formulation),
    has_personality_freeze: Boolean(snap?.human_personality),
    has_scientific_meta: Boolean(snap?.scientific_meta),
    memory_scope: snap?.memory_scope ?? null,
    risk: {
      suicidal_ideation: risk?.suicidal_ideation ?? null,
      self_harm: Boolean(risk?.self_harm),
      harm_to_others: Boolean(risk?.harm_to_others),
      substance_use: Boolean(risk?.substance_use),
    },
  };
}

export function assessmentObservablesFromScores(input: {
  overall: number;
  items: Array<{
    id?: string;
    label?: string;
    score: number;
    max: number;
    weight?: number;
  }>;
  narrative?: string | null;
  excerpts?: unknown[] | null;
  language?: string | null;
  aiSource?: string | null;
  model?: string | null;
}): AssessmentObservables {
  return {
    overall: input.overall,
    items: input.items,
    narrative_length: input.narrative?.length ?? 0,
    excerpt_count: Array.isArray(input.excerpts) ? input.excerpts.length : 0,
    language: input.language ?? null,
    ai_source: input.aiSource ?? null,
    model: input.model ?? null,
  };
}

export function buildSessionObservables(input: {
  sessionId: string;
  snapshot?: CaseInstanceSnapshot | null;
  messages?: ObservationalMessage[];
  assessment?: AssessmentObservables | null;
  durationSec?: number | null;
  locale?: string;
  ledgerMetrics?: Record<string, number>;
}): SessionObservables {
  const messages = input.messages ?? [];
  const therapist = messages.filter(
    (m) => m.role === "user" || m.role === "therapist",
  );
  const patient = messages.filter(
    (m) => m.role === "assistant" || m.role === "patient",
  );
  const avg = (arr: ObservationalMessage[]) =>
    arr.length
      ? arr.reduce((s, m) => s + m.content.length, 0) / arr.length
      : 0;

  return {
    clinical: clinicalObservablesFromSnapshot({
      sessionId: input.sessionId,
      snapshot: input.snapshot,
      locale: input.locale,
    }),
    assessment: input.assessment ?? null,
    messages,
    duration_sec: input.durationSec ?? null,
    turn_count: messages.length,
    therapist_turn_count: therapist.length,
    patient_turn_count: patient.length,
    avg_patient_chars: avg(patient),
    avg_therapist_chars: avg(therapist),
    ledger_metrics: input.ledgerMetrics,
  };
}
