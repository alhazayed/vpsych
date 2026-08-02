import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestSessionAssessment } from "./engine";
import { ensureLearnerProfile, persistLearnerUpdate } from "./persist";
import {
  generateGraphAwareAdaptiveCase,
  graphSupervisorForProfile,
} from "@/lib/cge/ace-bridge";
import {
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "@/lib/cge/engine";
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

    // Competency Graph Engine — root-cause next case + supervisor report
    const graphCase = generateGraphAwareAdaptiveCase(result.profile, {
      seed: `cge:${opts.sessionId}`,
      observedFailure: result.analytics.weaknesses[0],
    });
    const graphReport = graphSupervisorForProfile(
      result.profile,
      result.analytics.weaknesses[0],
    );
    const coach: CoachFeedback = {
      ...result.coach,
      supervisor_feedback: [
        graphReport.supervisor_feedback,
        result.coach.supervisor_feedback,
      ].join(" "),
      learning_goals: [
        ...graphReport.learning_plan.slice(0, 3),
        ...result.coach.learning_goals,
      ],
      suggested_next_cases: [
        ...graphReport.recommended_next_cases.slice(0, 3),
        ...result.coach.suggested_next_cases,
      ],
      suggested_reading: [
        ...graphReport.recommended_reading,
        ...result.coach.suggested_reading,
      ],
      improvement_plan: [
        result.coach.improvement_plan,
        graphReport.root_cause
          ? `Graph root cause: ${graphReport.root_cause.root_cause} (${graphReport.estimated_hours_to_mastery}h).`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };

    const nextCase: AdaptiveCaseRequest = {
      ...graphCase,
      fingerprint: graphCase.fingerprint,
    };

    await persistLearnerUpdate(supabase, result.profile, {
      sessionId: opts.sessionId,
      coach,
      nextFingerprint: nextCase.fingerprint,
      diagnosisSlug: nextCase.disorderSlug,
      difficulty: nextCase.difficulty,
      focus: nextCase.focusCompetencies,
      adaptation: {
        adaptations: nextCase.adaptations,
        rationale: nextCase.rationale,
        siStyle: nextCase.siStyle,
        cge_root: graphCase.rootCause,
        cge_pathway: graphCase.remediationPathway,
      },
    });

    // Persist remediation plan when tables exist
    if (graphReport.root_cause) {
      const remPlan = generateLearningPathFromGraph(
        result.profile.id,
        statesFromAceCompetencies(result.profile.competencies),
        graphReport.root_cause.observed_failure,
      );
      await supabase.from("cge_remediation_plans").insert({
        learner_id: result.profile.id,
        observed_failure: remPlan.observed_failure,
        root_cause_id: remPlan.root_cause_id,
        pathway: remPlan.pathway,
        recommended_cases: remPlan.recommended_cases,
        status: "active",
      });
    }

    // Soft-link session to learner profile
    await supabase
      .from("sessions")
      .update({
        learner_profile_id: result.profile.id,
        adaptive_focus: nextCase.focusCompetencies,
      })
      .eq("id", opts.sessionId);

    return {
      ok: true,
      nextCase,
      coach,
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
