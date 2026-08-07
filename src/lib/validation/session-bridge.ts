/**
 * Soft-fail validation after assessment — observational only.
 * Never blocks report persistence. Never touches patient stores.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { runValidationPipeline } from "@/lib/validation/engine";
import {
  assessmentObservablesFromScores,
  buildSessionObservables,
} from "@/lib/validation/from-observables";
import type { ValidationRunResult } from "@/lib/validation/types";

export type ValidationBridgeResult = {
  ok: boolean;
  run: ValidationRunResult | null;
  error: string | null;
};

/**
 * Best-effort Stage 8 validation hook.
 * Validation observes only. Never writes clinical_snapshot / case_memory /
 * patient_long_term_memory / DecisionPlan / patient prompt.
 */
export async function runValidationAfterAssessment(opts: {
  sessionId: string;
  overall: number;
  items: Array<{
    id?: string;
    label?: string;
    score: number;
    max: number;
    weight?: number;
  }>;
  messages: Array<{ role: string; content: string; created_at?: string }>;
  narrative?: string | null;
  excerpts?: unknown[] | null;
  language?: string | null;
  aiSource?: string | null;
  model?: string | null;
  durationSec?: number | null;
  clinicalSnapshot?: CaseInstanceSnapshot | null;
  ledgerMetrics?: Record<string, number>;
  studyId?: string | null;
}): Promise<ValidationBridgeResult> {
  try {
    const session = buildSessionObservables({
      sessionId: opts.sessionId,
      snapshot: opts.clinicalSnapshot ?? null,
      messages: opts.messages,
      durationSec: opts.durationSec ?? null,
      locale: opts.language ?? undefined,
      ledgerMetrics: opts.ledgerMetrics,
      assessment: assessmentObservablesFromScores({
        overall: opts.overall,
        items: opts.items,
        narrative: opts.narrative,
        excerpts: opts.excerpts,
        language: opts.language,
        aiSource: opts.aiSource,
        model: opts.model,
      }),
    });

    const run = runValidationPipeline({
      session,
      studyId: opts.studyId ?? null,
      persist: true,
    });

    return { ok: true, run, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "validation_failed";
    console.warn("[validation] soft-fail:", message);
    return { ok: false, run: null, error: message };
  }
}
