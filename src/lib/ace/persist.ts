import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETENCY_IDS } from "./catalog";
import { createLearnerProfile } from "./engine";
import type {
  CoachFeedback,
  CompetencyId,
  LearnerCompetency,
  LearnerProfile,
} from "./types";

export async function ensureLearnerProfile(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    language?: string;
    profession?: LearnerProfile["profession"];
    training_level?: LearnerProfile["training_level"];
  },
): Promise<LearnerProfile> {
  const { data: existing } = await supabase
    .from("learner_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const competencies = await loadCompetencies(supabase, existing.id);
    return mapProfile(existing, competencies);
  }

  const draft = createLearnerProfile({
    user_id: userId,
    language: opts?.language,
    profession: opts?.profession,
    training_level: opts?.training_level,
  });

  const { data: inserted, error } = await supabase
    .from("learner_profiles")
    .insert({
      user_id: userId,
      training_level: draft.training_level,
      profession: draft.profession,
      language: draft.language,
      preferred_therapy_models: draft.preferred_therapy_models,
      adaptive_mode: true,
      curriculum_mode: "automatic",
      min_competency_threshold: 70,
      max_difficulty: "expert",
    })
    .select("*")
    .single();

  if (error || !inserted) {
    // Migration not applied — return in-memory profile
    return draft;
  }

  // Seed competency rows
  await supabase.from("learner_competencies").insert(
    COMPETENCY_IDS.map((id) => ({
      learner_id: inserted.id,
      competency_id: id,
      score: 70,
      samples: 0,
      trend: 0,
    })),
  );

  return mapProfile(inserted, createLearnerProfile({ user_id: userId }).competencies);
}

async function loadCompetencies(
  supabase: SupabaseClient,
  learnerId: string,
): Promise<LearnerCompetency[]> {
  const { data } = await supabase
    .from("learner_competencies")
    .select("competency_id, score, samples, trend, last_assessed_at, mastered_at")
    .eq("learner_id", learnerId);
  if (!data?.length) {
    return createLearnerProfile({ user_id: "x" }).competencies;
  }
  return data.map((r) => ({
    competency_id: r.competency_id as CompetencyId,
    score: Number(r.score),
    samples: Number(r.samples),
    trend: Number(r.trend),
    last_assessed_at: r.last_assessed_at,
    mastered_at: r.mastered_at,
  }));
}

function mapProfile(
  row: Record<string, unknown>,
  competencies: LearnerCompetency[],
): LearnerProfile {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    training_level: row.training_level as LearnerProfile["training_level"],
    profession: row.profession as LearnerProfile["profession"],
    institution: (row.institution as string) ?? null,
    language: String(row.language ?? "en-US"),
    preferred_therapy_models:
      (row.preferred_therapy_models as string[]) ?? [],
    adaptive_mode: Boolean(row.adaptive_mode ?? true),
    curriculum_mode:
      (row.curriculum_mode as LearnerProfile["curriculum_mode"]) ?? "automatic",
    min_competency_threshold: Number(row.min_competency_threshold ?? 70),
    max_difficulty:
      (row.max_difficulty as LearnerProfile["max_difficulty"]) ?? "expert",
    locked_diagnoses: (row.locked_diagnoses as string[]) ?? [],
    locked_objectives: (row.locked_objectives as string[]) ?? [],
    required_competencies:
      (row.required_competencies as CompetencyId[]) ?? [],
    optional_competencies:
      (row.optional_competencies as CompetencyId[]) ?? [],
    completed_case_count: Number(row.completed_case_count ?? 0),
    learning_velocity: Number(row.learning_velocity ?? 0),
    confidence_score: Number(row.confidence_score ?? 50),
    certification_status:
      (row.certification_status as LearnerProfile["certification_status"]) ??
      "not_started",
    competencies,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function coachToJson(coach: CoachFeedback) {
  return {
    supervisor_feedback: coach.supervisor_feedback,
    reflective_questions: coach.reflective_questions ?? [],
    missed_opportunities: coach.missed_opportunities ?? [],
    suggested_reading: coach.suggested_reading ?? [],
    suggested_next_cases: coach.suggested_next_cases ?? [],
    learning_goals: coach.learning_goals ?? [],
    improvement_plan: coach.improvement_plan,
  };
}

/**
 * Persist ACE progress after assessment.
 * Prefers SECURITY DEFINER RPC (works without service role), then falls back
 * to direct table writes (service role / admin).
 */
export async function persistLearnerUpdate(
  supabase: SupabaseClient,
  profile: LearnerProfile,
  opts?: {
    sessionId?: string;
    coach?: CoachFeedback;
    nextFingerprint?: string;
    diagnosisSlug?: string;
    difficulty?: string;
    focus?: string[];
    adaptation?: Record<string, unknown>;
  },
): Promise<boolean> {
  const competencies = profile.competencies.map((c) => ({
    competency_id: c.competency_id,
    score: c.score,
    samples: c.samples,
    trend: c.trend,
    last_assessed_at: c.last_assessed_at ?? new Date().toISOString(),
    mastered_at: c.mastered_at ?? null,
  }));

  const { error: rpcError } = await supabase.rpc("apply_ace_session_progress", {
    p_learner_id: profile.id,
    p_session_id: opts?.sessionId ?? null,
    p_completed_case_count: profile.completed_case_count,
    p_learning_velocity: profile.learning_velocity,
    p_confidence_score: profile.confidence_score,
    p_certification_status: profile.certification_status,
    p_metadata: profile.metadata ?? {},
    p_competencies: competencies,
    p_coach: opts?.coach ? coachToJson(opts.coach) : null,
    p_next_fingerprint: opts?.nextFingerprint ?? null,
    p_diagnosis_slug: opts?.diagnosisSlug ?? null,
    p_difficulty: opts?.difficulty ?? null,
    p_focus: opts?.focus ?? null,
    p_adaptation: opts?.adaptation ?? null,
  });

  if (!rpcError) {
    return true;
  }

  // RPC missing (migration not applied) — attempt direct writes.
  if (
    !rpcError.message?.includes("Could not find the function") &&
    rpcError.code !== "PGRST202" &&
    rpcError.code !== "42883"
  ) {
    console.warn("[ace] apply_ace_session_progress failed:", rpcError.message);
  }

  const { error } = await supabase
    .from("learner_profiles")
    .update({
      completed_case_count: profile.completed_case_count,
      learning_velocity: profile.learning_velocity,
      confidence_score: profile.confidence_score,
      certification_status: profile.certification_status,
      metadata: profile.metadata ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      return false;
    }
    console.warn("[ace] learner_profiles update failed:", error.message);
    return false;
  }

  for (const c of profile.competencies) {
    if (c.samples <= 0) continue;
    await supabase.from("learner_competencies").upsert(
      {
        learner_id: profile.id,
        competency_id: c.competency_id,
        score: c.score,
        samples: c.samples,
        trend: c.trend,
        last_assessed_at: c.last_assessed_at ?? new Date().toISOString(),
        mastered_at: c.mastered_at,
      },
      { onConflict: "learner_id,competency_id" },
    );

    if (opts?.sessionId) {
      await supabase.from("competency_scores").insert({
        learner_id: profile.id,
        competency_id: c.competency_id,
        session_id: opts.sessionId,
        score: c.score,
        evidence: { source: "session_assessment" },
      });
    }
  }

  if (opts?.coach && opts.sessionId) {
    await supabase.from("coach_feedback").insert({
      learner_id: profile.id,
      session_id: opts.sessionId,
      supervisor_feedback: opts.coach.supervisor_feedback,
      reflective_questions: opts.coach.reflective_questions,
      missed_opportunities: opts.coach.missed_opportunities,
      suggested_reading: opts.coach.suggested_reading,
      suggested_next_cases: opts.coach.suggested_next_cases,
      learning_goals: opts.coach.learning_goals,
      improvement_plan: opts.coach.improvement_plan,
    });
  }

  if (opts?.nextFingerprint) {
    await supabase.from("adaptive_case_history").upsert(
      {
        learner_id: profile.id,
        session_id: opts.sessionId ?? null,
        focus_competencies: opts.focus ?? [],
        adaptation: opts.adaptation ?? {},
        diagnosis_slug: opts.diagnosisSlug ?? null,
        difficulty: opts.difficulty ?? null,
        fingerprint: opts.nextFingerprint,
      },
      { onConflict: "learner_id,fingerprint", ignoreDuplicates: true },
    );
  }

  await supabase.from("performance_trends").upsert(
    {
      learner_id: profile.id,
      window_label: "rolling_10",
      metrics: {
        confidence: profile.confidence_score,
        velocity: profile.learning_velocity,
        completed: profile.completed_case_count,
        competencies: profile.competencies.map((c) => ({
          id: c.competency_id,
          score: c.score,
        })),
      },
      computed_at: new Date().toISOString(),
    },
    { onConflict: "learner_id,window_label" },
  );

  return true;
}
