import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAnalytics,
  evaluateCertifications,
  generateLearningPlan,
} from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await ensureLearnerProfile(supabase, user.id);
  const analytics = buildAnalytics(profile);
  const certifications = evaluateCertifications(profile);
  const plan = generateLearningPlan(profile);

  return NextResponse.json({
    profile,
    analytics,
    certifications,
    plan,
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

  const body = (await request.json()) as {
    adaptiveMode?: boolean;
    curriculumMode?: "automatic" | "manual" | "hybrid";
    minCompetencyThreshold?: number;
    maxDifficulty?: string;
    lockedDiagnoses?: string[];
    lockedObjectives?: string[];
    requiredCompetencies?: string[];
    preferredTherapyModels?: string[];
    institution?: string;
    profession?: string;
    trainingLevel?: string;
  };

  const profile = await ensureLearnerProfile(supabase, user.id);
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
  if (body.preferredTherapyModels) {
    patch.preferred_therapy_models = body.preferredTherapyModels;
  }
  if (body.institution !== undefined) patch.institution = body.institution;
  if (body.profession) patch.profession = body.profession;
  if (body.trainingLevel) patch.training_level = body.trainingLevel;

  const { data, error } = await supabase
    .from("learner_profiles")
    .update(patch)
    .eq("id", profile.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({
      ok: true,
      profile: { ...profile, ...body },
      source: "memory",
      warning: error.message,
    });
  }

  return NextResponse.json({ ok: true, profile: data ?? profile });
}
