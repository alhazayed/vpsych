/**
 * Education session bridge — runs AFTER assessment / ACE.
 * Observes only. Soft-fail. Never writes patient clinical state.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runAceAfterAssessment } from "@/lib/ace/session-hook";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import type { AdaptiveCaseRequest, CoachFeedback } from "@/lib/ace/types";
import type { ScoreEntry } from "@/lib/types";
import { buildEducationAnalytics } from "@/lib/education/analytics";
import { evaluateCertificationMilestone } from "@/lib/education/certification";
import {
  buildClinicalReasoningGraph,
  buildDiagnosticReasoningReport,
} from "@/lib/education/clinical-reasoning";
import { generateEducationCurriculum } from "@/lib/education/curriculum";
import { buildDifficultyProfile } from "@/lib/education/difficulty";
import { buildExpertFeedback } from "@/lib/education/feedback";
import { buildTraineePortfolio } from "@/lib/education/portfolio";
import { projectLongitudinalLearning } from "@/lib/education/progress";
import { evaluateSession } from "@/lib/education/session-evaluation";
import type {
  EducationRunInput,
  EducationSessionBundle,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

export function buildEducationSessionBundle(
  input: EducationRunInput,
): EducationSessionBundle {
  const evaluation = evaluateSession({
    sessionId: input.sessionId,
    overall: input.overall,
    items: input.items,
    messages: input.messages,
    aceCompetencies: input.learnerProfile?.competencies,
  });

  const reasoning = buildClinicalReasoningGraph(input);
  const diagnostic = buildDiagnosticReasoningReport(input);
  const feedback = buildExpertFeedback({
    evaluation,
    diagnostic,
    coach: input.aceCoach,
  });
  const difficulty = buildDifficultyProfile(input.learnerProfile);
  const milestone = input.learnerProfile
    ? evaluateCertificationMilestone(input.learnerProfile).milestone
    : "beginner";

  const learning_path_summary: string[] = [];
  if (input.learnerProfile) {
    const plan = generateEducationCurriculum(input.learnerProfile, feedback);
    learning_path_summary.push(
      ...plan.practice_focus.slice(0, 3),
      ...plan.cge_steps.slice(0, 2),
    );
  }

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    evaluation,
    reasoning,
    diagnostic,
    feedback,
    difficulty,
    next_case: input.aceNextCase ?? null,
    learning_path_summary,
    milestone,
  };
}

/**
 * Best-effort education layer after session assessment.
 * Wraps ACE; never throws; never blocks report persistence; never touches patient stores.
 */
export async function runEducationAfterAssessment(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    sessionId: string;
    overall: number;
    items: ScoreEntry[];
    messages: Array<{ role: string; content: string }>;
    language?: string | null;
    diagnosisSlug?: string | null;
    correctDiagnosis?: boolean;
    narrative?: string;
    durationSec?: number;
    timeLimitSec?: number;
    clinicalSnapshot?: EducationRunInput["clinicalSnapshot"];
  },
): Promise<{
  ok: boolean;
  ace: Awaited<ReturnType<typeof runAceAfterAssessment>>;
  bundle: EducationSessionBundle | null;
  portfolio: ReturnType<typeof buildTraineePortfolio> | null;
  analytics: ReturnType<typeof buildEducationAnalytics> | null;
  longitudinal: ReturnType<typeof projectLongitudinalLearning> | null;
}> {
  try {
    const ace = await runAceAfterAssessment(supabase, {
      userId: opts.userId,
      sessionId: opts.sessionId,
      overall: opts.overall,
      items: opts.items,
      language: opts.language,
      diagnosisSlug: opts.diagnosisSlug,
      correctDiagnosis: opts.correctDiagnosis,
      narrative: opts.narrative,
      durationSec: opts.durationSec,
      timeLimitSec: opts.timeLimitSec,
    });

    let profile = null;
    try {
      profile = await ensureLearnerProfile(supabase, opts.userId, {
        language: opts.language ?? undefined,
      });
    } catch {
      profile = null;
    }

    const bundle = buildEducationSessionBundle({
      sessionId: opts.sessionId,
      userId: opts.userId,
      overall: opts.overall,
      items: opts.items,
      messages: opts.messages,
      language: opts.language,
      diagnosisSlug: opts.diagnosisSlug,
      narrative: opts.narrative,
      durationSec: opts.durationSec,
      timeLimitSec: opts.timeLimitSec,
      clinicalSnapshot: opts.clinicalSnapshot ?? null,
      learnerProfile: profile,
      aceCoach: ace.coach ?? null,
      aceNextCase: ace.nextCase ?? null,
    });

    const portfolio = profile
      ? buildTraineePortfolio({
          profile,
          diagnosesPracticed: opts.diagnosisSlug ? [opts.diagnosisSlug] : [],
          therapyModalities: opts.clinicalSnapshot?.therapy_modality
            ? [opts.clinicalSnapshot.therapy_modality]
            : [],
          recommendations: bundle.feedback.priority_improvements,
        })
      : null;

    const analytics = profile
      ? buildEducationAnalytics({
          profile,
          evaluation: bundle.evaluation,
          diagnosesCompleted: opts.diagnosisSlug ? [opts.diagnosisSlug] : [],
        })
      : null;

    const longitudinal = profile
      ? projectLongitudinalLearning(profile, 100)
      : null;

    return { ok: true, ace, bundle, portfolio, analytics, longitudinal };
  } catch (err) {
    console.warn("[education] runEducationAfterAssessment soft-fail", {
      sessionId: opts.sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Still try ACE alone so existing behaviour is preserved
    try {
      const ace = await runAceAfterAssessment(supabase, opts);
      return {
        ok: false,
        ace,
        bundle: null,
        portfolio: null,
        analytics: null,
        longitudinal: null,
      };
    } catch {
      return {
        ok: false,
        ace: { ok: false },
        bundle: null,
        portfolio: null,
        analytics: null,
        longitudinal: null,
      };
    }
  }
}

export type EducationAdaptiveSummary = {
  learnerId?: string;
  nextCase?: AdaptiveCaseRequest;
  coachSummary?: string;
  milestone?: string;
  educationVersion?: string;
  priorityImprovements?: string[];
  missedOpportunities?: string[];
};
