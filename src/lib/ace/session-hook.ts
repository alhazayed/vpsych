import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestSessionAssessment } from "./engine";
import {
  ensureLearnerProfile,
  persistLearnerUpdate,
} from "./persist";
import { inferMissFlagsFromNarrative } from "./analytics";
import {
  generateGraphAwareAdaptiveCase,
  graphSupervisorForProfile,
} from "@/lib/cge/ace-bridge";
import {
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "@/lib/cge/engine";
import { calculateMastery } from "@/lib/cge/mastery";
import { getBuiltinGraph } from "@/lib/cge/graph";
import type { AdaptiveCaseRequest, CoachFeedback } from "./types";
import type { ScoreEntry } from "@/lib/types";
import type { GraphCompetencyId, LearnerNodeState } from "@/lib/cge/types";

/**
 * Infer diagnostic accuracy from assessment narrative — never from overall %.
 * Overall conflates alliance/structure with differential correctness.
 */
export function inferCorrectDiagnosisFromNarrative(
  narrative: string | undefined,
  overall: number,
): boolean | undefined {
  if (!narrative?.trim()) {
    // Unknown — do not invent a false signal that caps differential_diagnosis.
    return undefined;
  }
  const n = narrative.toLowerCase();
  const missed =
    /(incorrect|wrong|missed|failed|inaccurate).{0,40}(diagnos|differential|formulation)/.test(
      n,
    ) ||
    /(diagnos|differential|formulation).{0,40}(incorrect|wrong|missed|failed|inaccurate)/.test(
      n,
    );
  const correct =
    /(correct|accurate|appropriate).{0,40}(diagnos|differential|formulation)/.test(
      n,
    ) ||
    /(diagnos|differential|formulation).{0,40}(correct|accurate|appropriate)/.test(
      n,
    );
  if (missed && !correct) return false;
  if (correct && !missed) return true;
  // Ambiguous narrative — leave undefined so EMA is not falsely capped.
  void overall;
  return undefined;
}

/**
 * Best-effort ACE update after a session assessment.
 * Never throws; never blocks report persistence.
 *
 * Scoring fields on `learner_profiles` are guarded so authenticated learners
 * cannot self-write them. Pass `writeClient` as the service-role client when
 * available; `persistLearnerUpdate` prefers the SECURITY DEFINER RPC either way.
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
    /** Privileged writer (service role). Falls back to `supabase`. */
    writeClient?: SupabaseClient | null;
  },
): Promise<{
  ok: boolean;
  nextCase?: AdaptiveCaseRequest;
  coach?: CoachFeedback;
  learnerId?: string;
  persisted?: boolean;
}> {
  try {
    const writer = opts.writeClient ?? supabase;
    const profile = await ensureLearnerProfile(supabase, opts.userId, {
      language: opts.language ?? undefined,
    });
    if (!profile.adaptive_mode) {
      return { ok: true, learnerId: profile.id, persisted: true };
    }

    const missFlags = opts.narrative
      ? inferMissFlagsFromNarrative(opts.narrative)
      : undefined;
    const correctDiagnosis = inferCorrectDiagnosisFromNarrative(
      opts.narrative,
      opts.overall,
    );

    const result = ingestSessionAssessment(profile, {
      overall: opts.overall,
      items: opts.items,
      sessionId: opts.sessionId,
      diagnosisSlug: opts.diagnosisSlug,
      correctDiagnosis,
      missFlags,
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

    const persisted = await persistLearnerUpdate(writer, result.profile, {
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
        educational: {
          correctDiagnosis: correctDiagnosis ?? null,
          missFlags: missFlags ?? null,
        },
      },
    });

    // Persist CGE mastery snapshot + remediation plan (best-effort)
    await persistCgeMasterySnapshot(writer, result.profile.id, result.profile);
    if (graphReport.root_cause) {
      const remPlan = generateLearningPathFromGraph(
        result.profile.id,
        statesFromAceCompetencies(result.profile.competencies),
        graphReport.root_cause.observed_failure,
      );
      await writer.from("cge_remediation_plans").insert({
        learner_id: result.profile.id,
        observed_failure: remPlan.observed_failure,
        root_cause_id: remPlan.root_cause_id,
        pathway: remPlan.pathway,
        recommended_cases: remPlan.recommended_cases,
        status: "active",
      });
    }

    // Soft-link session to learner profile (owner can update non-scoring cols)
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
      persisted,
    };
  } catch (e) {
    console.warn(
      "[ace] post-assessment hook failed:",
      e instanceof Error ? e.message : e,
    );
    return { ok: false };
  }
}

async function persistCgeMasterySnapshot(
  supabase: SupabaseClient,
  learnerId: string,
  profile: {
    competencies: {
      competency_id: string;
      score: number;
      samples: number;
    }[];
  },
): Promise<void> {
  try {
    const graph = getBuiltinGraph();
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const states = statesFromAceCompetencies(
      profile.competencies as Parameters<typeof statesFromAceCompetencies>[0],
    );
    const map = new Map<GraphCompetencyId, LearnerNodeState>(
      states.map((s) => [s.competency_id, s]),
    );
    for (const state of states) {
      if (state.samples <= 0) continue;
      if (!nodeIds.has(state.competency_id)) continue;
      const stage = calculateMastery(state, graph, map);
      const confidence = Math.max(
        0,
        Math.min(
          100,
          Math.round(state.score * 0.7 + Math.min(30, state.samples * 5)),
        ),
      );
      const prevStage = state.stage ?? "not_attempted";

      await supabase
        .from("learner_competencies")
        .update({
          mastery_stage: stage,
          confidence,
        })
        .eq("learner_id", learnerId)
        .eq("competency_id", state.competency_id);

      await supabase.from("cge_mastery_history").insert({
        learner_id: learnerId,
        competency_id: state.competency_id,
        from_stage: prevStage,
        to_stage: stage,
        score: state.score,
        reason: "session_assessment_ema",
      });

      await supabase.from("cge_attempts").insert({
        learner_id: learnerId,
        competency_id: state.competency_id,
        score: state.score,
        stage_before: prevStage,
        stage_after: stage,
        evidence: { source: "session_assessment_ema", samples: state.samples },
      });
    }
  } catch (e) {
    console.warn(
      "[cge] mastery snapshot failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
