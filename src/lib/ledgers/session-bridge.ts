/**
 * Session lifecycle bridge — writes Operational + Educational + links Quality.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  recordCorrelation,
  recordEducationalEvent,
  recordOperationalEvent,
} from "@/lib/ledgers/persist";
import { newCorrelationId } from "@/lib/ledgers/shared";

export type SessionStartLedgerInput = {
  sessionId: string;
  learnerId: string;
  instructorId?: string | null;
  institutionId?: string | null;
  templateId?: string | null;
  presetId?: string | null;
  personaId?: string | null;
  diagnosisSlug?: string | null;
  difficulty?: string | null;
  language?: string | null;
  locale?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type SessionCompleteLedgerInput = SessionStartLedgerInput & {
  correlationId?: string | null;
  durationSec?: number | null;
  scientificLedgerId?: string | null;
  overallScore?: number | null;
  competenciesBefore?: Record<string, unknown>;
  competenciesAfter?: Record<string, unknown>;
  adaptiveDecision?: Record<string, unknown>;
  aiModel?: string | null;
  fallbackUsed?: boolean;
};

/**
 * Seal operational + educational start events and open a correlation.
 */
export async function sealSessionStartLedgers(
  supabase: SupabaseClient | null,
  input: SessionStartLedgerInput,
): Promise<{ correlationId: string }> {
  const correlationId = newCorrelationId();
  try {
    await recordOperationalEvent(supabase, {
      event_type: "api.sessions.start",
      category: "api",
      outcome: "success",
      actor_id: input.learnerId,
      correlation_id: correlationId,
      resource_type: "session",
      resource_id: input.sessionId,
      ip: input.ip,
      user_agent: input.userAgent,
    });

    await recordEducationalEvent(supabase, {
      event_type: "assessment_started",
      correlation_id: correlationId,
      learner_id: input.learnerId,
      instructor_id: input.instructorId ?? input.learnerId,
      institution_id: input.institutionId,
      session_id: input.sessionId,
      assessment_id: input.sessionId,
      clinical_template_id: input.templateId,
      instructor_preset_id: input.presetId,
      persona_id: input.personaId,
      diagnosis_slug: input.diagnosisSlug,
      difficulty: input.difficulty,
      language: input.language,
      locale: input.locale,
      outcome: "started",
    });

    if (input.templateId) {
      await recordEducationalEvent(supabase, {
        event_type: "clinical_template_used",
        correlation_id: correlationId,
        learner_id: input.learnerId,
        session_id: input.sessionId,
        clinical_template_id: input.templateId,
        outcome: "used",
      });
    }
    if (input.presetId) {
      await recordEducationalEvent(supabase, {
        event_type: "instructor_preset_used",
        correlation_id: correlationId,
        learner_id: input.learnerId,
        session_id: input.sessionId,
        instructor_preset_id: input.presetId,
        outcome: "used",
      });
    }

    await recordCorrelation(supabase, {
      session_id: input.sessionId,
      learner_id: input.learnerId,
      instructor_id: input.instructorId ?? input.learnerId,
      institution_id: input.institutionId,
      assessment_id: input.sessionId,
      clinical_template_id: input.templateId,
      persona_id: input.personaId,
    }, correlationId);
  } catch (e) {
    console.warn(
      "[multi-ledger] session start seal:",
      e instanceof Error ? e.message : e,
    );
  }
  return { correlationId };
}

/**
 * Seal operational + educational completion; link scientific quality ledger id.
 */
export async function sealSessionCompleteLedgers(
  supabase: SupabaseClient | null,
  input: SessionCompleteLedgerInput,
): Promise<{ correlationId: string }> {
  const correlationId = input.correlationId ?? newCorrelationId();
  try {
    await recordOperationalEvent(supabase, {
      event_type: "api.sessions.end",
      category: "api",
      outcome: "success",
      actor_id: input.learnerId,
      correlation_id: correlationId,
      resource_type: "session",
      resource_id: input.sessionId,
      payload: {
        fallback_used: Boolean(input.fallbackUsed),
        ai_model: input.aiModel ?? null,
      },
      severity: input.fallbackUsed ? "warning" : "info",
    });

    if (input.fallbackUsed) {
      await recordOperationalEvent(supabase, {
        event_type: "ai.assessment_fallback",
        category: "ai",
        severity: "warning",
        outcome: "partial",
        actor_id: input.learnerId,
        correlation_id: correlationId,
        resource_type: "session",
        resource_id: input.sessionId,
        error_classification: "persona_fallback",
      });
    }

    await recordEducationalEvent(supabase, {
      event_type: "assessment_completed",
      correlation_id: correlationId,
      learner_id: input.learnerId,
      instructor_id: input.instructorId ?? input.learnerId,
      institution_id: input.institutionId,
      session_id: input.sessionId,
      assessment_id: input.sessionId,
      clinical_template_id: input.templateId,
      instructor_preset_id: input.presetId,
      persona_id: input.personaId,
      diagnosis_slug: input.diagnosisSlug,
      difficulty: input.difficulty,
      language: input.language,
      locale: input.locale,
      duration_sec: input.durationSec ?? null,
      outcome: "completed",
      competencies_before: input.competenciesBefore,
      competencies_after: input.competenciesAfter,
      adaptive_decision: input.adaptiveDecision,
      payload: { overall: input.overallScore ?? null },
    });

    if (input.adaptiveDecision && Object.keys(input.adaptiveDecision).length) {
      await recordEducationalEvent(supabase, {
        event_type: "adaptive_decision",
        correlation_id: correlationId,
        learner_id: input.learnerId,
        session_id: input.sessionId,
        adaptive_decision: input.adaptiveDecision,
        outcome: "recommended",
      });
    }

    if (input.competenciesAfter) {
      await recordEducationalEvent(supabase, {
        event_type: "competency_updated",
        correlation_id: correlationId,
        learner_id: input.learnerId,
        session_id: input.sessionId,
        competencies_before: input.competenciesBefore,
        competencies_after: input.competenciesAfter,
        outcome: "updated",
      });
    }

    await recordCorrelation(supabase, {
      session_id: input.sessionId,
      learner_id: input.learnerId,
      instructor_id: input.instructorId ?? input.learnerId,
      institution_id: input.institutionId,
      assessment_id: input.sessionId,
      clinical_template_id: input.templateId,
      persona_id: input.personaId,
      ai_model_id: input.aiModel,
      scientific_ledger_id: input.scientificLedgerId,
    }, correlationId);
  } catch (e) {
    console.warn(
      "[multi-ledger] session complete seal:",
      e instanceof Error ? e.message : e,
    );
  }
  return { correlationId };
}
