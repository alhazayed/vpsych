import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestSessionAssessment } from "./engine";
import { ensureLearnerProfile, persistLearnerUpdate } from "./persist";
import type { AdaptiveCaseRequest, CoachFeedback } from "./types";
import type { ScoreEntry } from "@/lib/types";

/**
 * Best-effort ACE update after a session assessment.
 * Never throws; never blocks report persistence.
 */
export async function runAceAfterAssessment(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    sessionId: string;
    overall: number;
    items: ScoreEntry[];
    language?: string | null;
    diagnosisSlug?: string | null;
    narrative?: string;
    durationSec?: number;
    timeLimitSec?: number;
  },
): Promise<{
  ok: boolean;
  nextCase?: AdaptiveCaseRequest;
  coach?: CoachFeedback;
  learnerId?: string;
}> {
  try {
    const profile = await ensureLearnerProfile(supabase, opts.userId, {
      language: opts.language ?? undefined,
    });
    if (!profile.adaptive_mode) {
      return { ok: true, learnerId: profile.id };
    }

    const result = ingestSessionAssessment(profile, {
      overall: opts.overall,
      items: opts.items,
      sessionId: opts.sessionId,
      diagnosisSlug: opts.diagnosisSlug,
      correctDiagnosis: opts.overall >= 55,
      narrative: opts.narrative,
      durationSec: opts.durationSec,
      timeLimitSec: opts.timeLimitSec,
    });

    await persistLearnerUpdate(supabase, result.profile, {
      sessionId: opts.sessionId,
      coach: result.coach,
      nextFingerprint: result.nextCase.fingerprint,
      diagnosisSlug: result.nextCase.disorderSlug,
      difficulty: result.nextCase.difficulty,
      focus: result.nextCase.focusCompetencies,
      adaptation: {
        adaptations: result.nextCase.adaptations,
        rationale: result.nextCase.rationale,
        siStyle: result.nextCase.siStyle,
      },
    });

    // Soft-link session to learner profile
    await supabase
      .from("sessions")
      .update({
        learner_profile_id: result.profile.id,
        adaptive_focus: result.nextCase.focusCompetencies,
      })
      .eq("id", opts.sessionId);

    return {
      ok: true,
      nextCase: result.nextCase,
      coach: result.coach,
      learnerId: result.profile.id,
    };
  } catch (e) {
    console.warn(
      "[ace] post-assessment hook failed:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false };
  }
}
