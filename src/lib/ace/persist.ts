import type { SupabaseClient } from "@supabase/supabase-js";
import { COMPETENCY_IDS } from "./catalog";
import { createLearnerProfile } from "./engine";
import type {
  CoachFeedback,
  CompetencyId,
  LearnerCompetency,
  LearnerProfile,
} from "./types";

/** Missing ACE tables (migration not applied) are the one tolerated error. */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || Boolean(error.message?.includes("does not exist"));
}

/**
 * Throws when an existing learner profile cannot be read. Returning a blank
 * in-memory profile there would show default analytics as the learner's own
 * and, after a session, write those defaults over the real competency rows.
 */
export async function ensureLearnerProfile(
  supabase: SupabaseClient,
  userId: string,
  opts?: {
    language?: string;
    profession?: LearnerProfile["profession"];
    training_level?: LearnerProfile["training_level"];
  },
): Promise<LearnerProfile> {
  const { data: existing, error: readErr } = await supabase
    .from("learner_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr && !isMissingTable(readErr)) {
    console.error("[ace] learner_profiles read failed", {
      userId,
      error: readErr.message,
    });
    throw new Error("learner_profile_unavailable");
  }

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
    if (error && !isMissingTable(error)) {
      console.warn("[ace] learner_profiles insert failed; using in-memory profile", {
        userId,
        error: error.message,
      });
    }
    return draft;
  }

  // Seed competency rows
  const { error: seedErr } = await supabase.from("learner_competencies").insert(
    COMPETENCY_IDS.map((id) => ({
      learner_id: inserted.id,
      competency_id: id,
      score: 70,
      samples: 0,
      trend: 0,
    })),
  );
  if (seedErr) {
    console.warn("[ace] learner_competencies seed failed", {
      learnerId: inserted.id,
      error: seedErr.message,
    });
  }

  return mapProfile(inserted, createLearnerProfile({ user_id: userId }).competencies);
}

async function loadCompetencies(
  supabase: SupabaseClient,
  learnerId: string,
): Promise<LearnerCompetency[]> {
  const { data, error } = await supabase
    .from("learner_competencies")
    .select("competency_id, score, samples, trend, last_assessed_at, mastered_at")
    .eq("learner_id", learnerId);
  if (error && !isMissingTable(error)) {
    console.error("[ace] learner_competencies read failed", {
      learnerId,
      error: error.message,
    });
    throw new Error("learner_competencies_unavailable");
  }
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
): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  const note = (op: string, err: { message?: string } | null) => {
    if (err) failed.push(`${op}: ${err.message ?? "error"}`);
  };
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
    // Table missing — soft fail
    if (isMissingTable(error)) {
      return { failed };
    }
    console.warn("[ace] learner_profiles update failed", {
      learnerId: profile.id,
      sessionId: opts?.sessionId ?? null,
      error: error.message,
    });
    return { failed: [`learner_profiles: ${error.message}`] };
  }

  for (const c of profile.competencies) {
    if (c.samples <= 0) continue;
    const { error: compErr } = await supabase.from("learner_competencies").upsert(
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
    note("learner_competencies", compErr);

    if (opts?.sessionId) {
      const { error: scoreErr } = await supabase.from("competency_scores").insert({
        learner_id: profile.id,
        competency_id: c.competency_id,
        session_id: opts.sessionId,
        score: c.score,
        evidence: { source: "session_assessment" },
      });
      note("competency_scores", scoreErr);
    }
  }

  if (opts?.coach && opts.sessionId) {
    const { error: coachErr } = await supabase.from("coach_feedback").insert({
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
    note("coach_feedback", coachErr);
  }

  if (opts?.nextFingerprint) {
    const { error: historyErr } = await supabase.from("adaptive_case_history").upsert(
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
    note("adaptive_case_history", historyErr);
  }

  const { error: trendErr } = await supabase.from("performance_trends").upsert(
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
  note("performance_trends", trendErr);

  if (failed.length > 0) {
    console.warn("[ace] learner update partly failed", {
      learnerId: profile.id,
      sessionId: opts?.sessionId ?? null,
      failed,
    });
  }
  return { failed };
}
