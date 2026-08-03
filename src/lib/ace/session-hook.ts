import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestSessionAssessment } from "./engine";
import { ensureLearnerProfile, persistLearnerUpdate } from "./persist";
import { generateAdaptiveCase, selectActiveRules } from "./adaptive";
import {
  generateGraphAwareAdaptiveCase,
  graphSupervisorForProfile,
} from "@/lib/cge/ace-bridge";
import {
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "@/lib/cge/engine";
import { createServiceClient } from "@/lib/supabase/admin";
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

    const { data: history } = await supabase
      .from("adaptive_case_history")
      .select("fingerprint")
      .eq("learner_id", result.profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const priorFingerprints = (history ?? []).map((h) => h.fingerprint);

    const aceCase = generateAdaptiveCase(result.profile, {
      seed: `ace:${opts.sessionId}`,
      priorFingerprints,
    });
    const graphCase = generateGraphAwareAdaptiveCase(result.profile, {
      seed: `cge:${opts.sessionId}`,
      observedFailure: result.analytics.weaknesses[0],
      priorFingerprints,
    });

    // Prefer ACE remediation when high-priority rules fire; otherwise CGE-aware.
    const active = selectActiveRules(result.profile);
    const preferAce = (active[0]?.priority ?? 0) >= 80;
    const nextCase: AdaptiveCaseRequest = preferAce
      ? {
          ...aceCase,
          adaptations: [
            ...aceCase.adaptations,
            ...(graphCase.rootCause
              ? [
                  `cge_root:${graphCase.rootCause}`,
                  `cge_observed:${result.analytics.weaknesses[0] ?? ""}`,
                ]
              : []),
          ],
          rationale: graphCase.rootCause
            ? `${aceCase.rationale} [CGE annotate: ${graphCase.rootCause}]`
            : aceCase.rationale,
          explainability: {
            active_rules: aceCase.explainability?.active_rules ?? [],
            decision: `${aceCase.explainability?.decision ?? aceCase.rationale} Session-hook preferred ACE remediation over CGE override.`,
            ladder_step: aceCase.explainability?.ladder_step,
            content_signature: aceCase.explainability?.content_signature,
          },
        }
      : {
          ...graphCase,
          fingerprint: graphCase.fingerprint,
        };

    const graphReport = graphSupervisorForProfile(
      result.profile,
      result.analytics.weaknesses[0],
    );
    const coach: CoachFeedback = {
      ...result.coach,
      supervisor_feedback: [
        graphReport.supervisor_feedback,
        result.coach.supervisor_feedback,
        nextCase.explainability?.decision,
      ]
        .filter(Boolean)
        .join(" "),
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
        confidence: nextCase.confidence,
        explainability: nextCase.explainability,
        cge_root: graphCase.rootCause,
        cge_pathway: graphCase.remediationPathway,
        preferred: preferAce ? "ace" : "cge",
      },
    });

    // Persist remediation plan with privileged writer when available (RLS).
    if (graphReport.root_cause) {
      const writer = createServiceClient() ?? supabase;
      const remPlan = generateLearningPathFromGraph(
        result.profile.id,
        statesFromAceCompetencies(result.profile.competencies),
        graphReport.root_cause.observed_failure,
      );
      const { error: remErr } = await writer.from("cge_remediation_plans").insert({
        learner_id: result.profile.id,
        observed_failure: remPlan.observed_failure,
        root_cause_id: remPlan.root_cause_id,
        pathway: remPlan.pathway,
        recommended_cases: remPlan.recommended_cases,
        status: "active",
      });
      if (remErr) {
        console.warn("[ace] cge_remediation_plans insert:", remErr.message);
      }
    }

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
