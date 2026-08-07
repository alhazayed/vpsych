/**
 * Soft-fail supervisor after education / validation.
 * Observes only. Never blocks report. Never touches patient stores.
 */

import { ensureLearnerProfile } from "@/lib/ace/persist";
import { buildSupervisorDashboard, runSupervisorEngine } from "@/lib/supervisor/engine";
import { storeSupervisorBundle } from "@/lib/supervisor/store";
import type {
  SupervisorDashboard,
  SupervisorRunInput,
  SupervisorSessionBundle,
} from "@/lib/supervisor/types";
import type { EducationSessionBundle } from "@/lib/education/types";
import type { ScoreEntry } from "@/lib/types";
import type { ValidationRunResult } from "@/lib/validation/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SupervisorBridgeResult = {
  ok: boolean;
  bundle: SupervisorSessionBundle | null;
  dashboard: SupervisorDashboard | null;
  error: string | null;
};

/**
 * Best-effort Stage 9 supervisor hook.
 * Supervisor observes only. Never writes clinical_snapshot / case_memory /
 * patient_long_term_memory / DecisionPlan / patient prompt.
 * Never owns Emotion, Adaptation, Case Engine, Clinical Intelligence, or Validation.
 */
export async function runSupervisorAfterAssessment(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    sessionId: string;
    overall: number;
    items: ScoreEntry[];
    messages: Array<{ role: string; content: string }>;
    language?: string | null;
    narrative?: string | null;
    diagnosisSlug?: string | null;
    clinicalSnapshot?: SupervisorRunInput["clinicalSnapshot"];
    educationBundle?: EducationSessionBundle | null;
    validationRun?: ValidationRunResult | null;
  },
): Promise<SupervisorBridgeResult> {
  try {
    let profile = null;
    try {
      profile = await ensureLearnerProfile(supabase, opts.userId, {
        language: opts.language ?? undefined,
      });
    } catch {
      profile = null;
    }

    const input: SupervisorRunInput = {
      sessionId: opts.sessionId,
      userId: opts.userId,
      overall: opts.overall,
      items: opts.items,
      messages: opts.messages,
      language: opts.language,
      narrative: opts.narrative,
      diagnosisSlug: opts.diagnosisSlug,
      clinicalSnapshot: opts.clinicalSnapshot ?? null,
      learnerProfile: profile,
      educationBundle: opts.educationBundle ?? null,
      educationEvaluation: opts.educationBundle?.evaluation ?? null,
      educationDiagnostic: opts.educationBundle?.diagnostic ?? null,
      educationFeedback: opts.educationBundle?.feedback ?? null,
      validationRun: opts.validationRun ?? null,
    };

    const bundle = runSupervisorEngine(input);
    storeSupervisorBundle(opts.userId, bundle);
    const dashboard = buildSupervisorDashboard({ bundle });

    return { ok: true, bundle, dashboard, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "supervisor_failed";
    console.warn("[supervisor] soft-fail:", message);
    return { ok: false, bundle: null, dashboard: null, error: message };
  }
}
