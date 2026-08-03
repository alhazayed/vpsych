import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETENCY_IDS } from "./catalog";
import { createLearnerProfile } from "./engine";
import { createServiceClient } from "@/lib/supabase/admin";
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

export async function persistLearnerUpdate(
  _supabase: SupabaseClient,
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
): Promise<void> {
  // Scoring writes must use the service role. Direct PostgREST updates are
  // blocked by enforce_learner_profile_guard, and apply_ace_session_progress
  // is revoked from authenticated (prevents clients from forging
  // certification_status / competency scores via the Data API).
  const privileged = createServiceClient();
  if (!privileged) {
    console.warn(
      "[ace] scoring persistence skipped: SUPABASE_SERVICE_ROLE_KEY not configured",
    );
    return;
  }

  const competencies = profile.competencies
    .filter((c) => c.samples > 0)
    .map((c) => ({
      competency_id: c.competency_id,
      score: c.score,
      samples: c.samples,
      trend: c.trend,
      last_assessed_at: c.last_assessed_at ?? new Date().toISOString(),
      mastered_at: c.mastered_at,
    }));

  const coach =
    opts?.coach && opts.sessionId
      ? {
          supervisor_feedback: opts.coach.supervisor_feedback,
          reflective_questions: opts.coach.reflective_questions,
          missed_opportunities: opts.coach.missed_opportunities,
          suggested_reading: opts.coach.suggested_reading,
          suggested_next_cases: opts.coach.suggested_next_cases,
          learning_goals: opts.coach.learning_goals,
          improvement_plan: opts.coach.improvement_plan,
        }
      : null;

  const { error } = await privileged.rpc("apply_ace_session_progress", {
    p_learner_id: profile.id,
    p_session_id: opts?.sessionId ?? null,
    p_completed_case_count: profile.completed_case_count,
    p_learning_velocity: profile.learning_velocity,
    p_confidence_score: profile.confidence_score,
    p_certification_status: profile.certification_status,
    p_metadata: profile.metadata ?? {},
    p_competencies: competencies,
    p_coach: coach,
    p_next_fingerprint: opts?.nextFingerprint ?? null,
    p_diagnosis_slug: opts?.diagnosisSlug ?? null,
    p_difficulty: opts?.difficulty ?? null,
    p_focus: opts?.focus ?? null,
    p_adaptation: opts?.adaptation ?? null,
  });

  if (error) {
    if (error.message?.includes("does not exist") || error.code === "42P01") {
      return;
    }
    console.warn("[ace] apply_ace_session_progress failed:", error.message);
  }
}
