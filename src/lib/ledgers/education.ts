/**
 * Layer 2 — Educational Ledger (learner interaction history).
 */

import { randomUUID } from "crypto";
import {
  EDUCATIONAL_LEDGER_VERSION,
  newEventId,
  sealContent,
} from "@/lib/ledgers/shared";

export type EducationalEventType =
  | "assessment_started"
  | "assessment_completed"
  | "competency_updated"
  | "instructor_feedback"
  | "reflection_submitted"
  | "clinical_template_used"
  | "instructor_preset_used"
  | "adaptive_decision"
  | "learning_recommendation"
  | "difficulty_progression"
  | "learning_objective_achieved"
  | "competency_unlocked"
  | "prerequisite_completed"
  | "osce_simulation"
  | "learning_milestone";

export type EducationalEvent = {
  id: string;
  event_id: string;
  correlation_id: string | null;
  event_type: EducationalEventType;
  learner_id: string | null;
  instructor_id: string | null;
  institution_id: string | null;
  program_id: string | null;
  cohort_id: string | null;
  assessment_id: string | null;
  session_id: string | null;
  clinical_template_id: string | null;
  instructor_preset_id: string | null;
  persona_id: string | null;
  diagnosis_slug: string | null;
  difficulty: string | null;
  learning_path: unknown[];
  objectives: unknown[];
  competencies_before: Record<string, unknown>;
  competencies_after: Record<string, unknown>;
  adaptive_decision: Record<string, unknown>;
  duration_sec: number | null;
  outcome: string | null;
  language: string | null;
  locale: string | null;
  payload: Record<string, unknown>;
  content_hash: string;
  schema_version: string;
  platform_release_version: string | null;
  created_at: string;
};

export type EducationalEventInput = {
  event_type: EducationalEventType;
  correlation_id?: string | null;
  learner_id?: string | null;
  instructor_id?: string | null;
  institution_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  assessment_id?: string | null;
  session_id?: string | null;
  clinical_template_id?: string | null;
  instructor_preset_id?: string | null;
  persona_id?: string | null;
  diagnosis_slug?: string | null;
  difficulty?: string | null;
  learning_path?: unknown[];
  objectives?: unknown[];
  competencies_before?: Record<string, unknown>;
  competencies_after?: Record<string, unknown>;
  adaptive_decision?: Record<string, unknown>;
  duration_sec?: number | null;
  outcome?: string | null;
  language?: string | null;
  locale?: string | null;
  payload?: Record<string, unknown>;
  platform_release_version?: string | null;
};

export function buildEducationalEvent(
  input: EducationalEventInput,
): EducationalEvent {
  const id = randomUUID();
  const event_id = newEventId("edu");
  const created_at = new Date().toISOString();
  const core = {
    event_type: input.event_type,
    learner_id: input.learner_id ?? null,
    session_id: input.session_id ?? null,
    assessment_id: input.assessment_id ?? input.session_id ?? null,
    correlation_id: input.correlation_id ?? null,
    outcome: input.outcome ?? null,
  };
  return {
    id,
    event_id,
    correlation_id: input.correlation_id ?? null,
    event_type: input.event_type,
    learner_id: input.learner_id ?? null,
    instructor_id: input.instructor_id ?? null,
    institution_id: input.institution_id ?? null,
    program_id: input.program_id ?? null,
    cohort_id: input.cohort_id ?? null,
    assessment_id: input.assessment_id ?? input.session_id ?? null,
    session_id: input.session_id ?? null,
    clinical_template_id: input.clinical_template_id ?? null,
    instructor_preset_id: input.instructor_preset_id ?? null,
    persona_id: input.persona_id ?? null,
    diagnosis_slug: input.diagnosis_slug ?? null,
    difficulty: input.difficulty ?? null,
    learning_path: input.learning_path ?? [],
    objectives: input.objectives ?? [],
    competencies_before: input.competencies_before ?? {},
    competencies_after: input.competencies_after ?? {},
    adaptive_decision: input.adaptive_decision ?? {},
    duration_sec: input.duration_sec ?? null,
    outcome: input.outcome ?? null,
    language: input.language ?? null,
    locale: input.locale ?? null,
    payload: input.payload ?? {},
    content_hash: sealContent(core),
    schema_version: EDUCATIONAL_LEDGER_VERSION,
    platform_release_version: input.platform_release_version ?? MULTI_FALLBACK,
    created_at,
  };
}

const MULTI_FALLBACK = "1.0.0";

export function educationalEventToRpc(
  e: EducationalEvent,
): Record<string, unknown> {
  return { ...e };
}
