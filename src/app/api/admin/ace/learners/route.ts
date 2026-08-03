import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { COMPETENCY_DOMAINS } from "@/lib/ace";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const url = new URL(request.url);
  const institutionId = url.searchParams.get("institution_id");

  let query = supabase
    .from("learner_profiles")
    .select(
      "id, user_id, training_level, profession, institution, institution_id, language, adaptive_mode, curriculum_mode, completed_case_count, learning_velocity, confidence_score, certification_status, min_competency_threshold, max_difficulty, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  // Soft multi-tenant: platform admin may scope to one institution.
  if (institutionId) {
    query = query.eq("institution_id", institutionId);
  }

  const { data: learners, error } = await query;

  if (error) {
    return NextResponse.json({
      source: "empty",
      learners: [],
      competencyDomains: COMPETENCY_DOMAINS,
      warning: sanitizeDbError(error.message),
    });
  }

  return NextResponse.json({
    source: "database",
    learners: learners ?? [],
    competencyDomains: COMPETENCY_DOMAINS,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const body = (await request.json()) as {
    learnerId?: string;
    adaptiveMode?: boolean;
    curriculumMode?: string;
    minCompetencyThreshold?: number;
    maxDifficulty?: string;
    lockedDiagnoses?: string[];
    lockedObjectives?: string[];
    requiredCompetencies?: string[];
  };

  if (!body.learnerId) {
    return NextResponse.json({ error: "learnerId required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.adaptiveMode !== undefined) patch.adaptive_mode = body.adaptiveMode;
  if (body.curriculumMode) patch.curriculum_mode = body.curriculumMode;
  if (body.minCompetencyThreshold != null) {
    patch.min_competency_threshold = body.minCompetencyThreshold;
  }
  if (body.maxDifficulty) patch.max_difficulty = body.maxDifficulty;
  if (body.lockedDiagnoses) patch.locked_diagnoses = body.lockedDiagnoses;
  if (body.lockedObjectives) patch.locked_objectives = body.lockedObjectives;
  if (body.requiredCompetencies) {
    patch.required_competencies = body.requiredCompetencies;
  }

  const { data, error } = await supabase
    .from("learner_profiles")
    .update(patch)
    .eq("id", body.learnerId)
    .select("*")
    .single();

  if (error) {
    console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, learner: data });
}
