import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCY_DOMAINS } from "@/lib/ace";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: learners, error } = await supabase
    .from("learner_profiles")
    .select(
      "id, user_id, training_level, profession, institution, language, adaptive_mode, curriculum_mode, completed_case_count, learning_velocity, confidence_score, certification_status, min_competency_threshold, max_difficulty, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      source: "empty",
      learners: [],
      competencyDomains: COMPETENCY_DOMAINS,
      warning: error.message,
    });
  }

  return NextResponse.json({
    source: "database",
    learners: learners ?? [],
    competencyDomains: COMPETENCY_DOMAINS,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, learner: data });
}
