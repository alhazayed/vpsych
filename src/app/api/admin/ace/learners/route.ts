import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import { COMPETENCY_DOMAINS } from "@/lib/ace";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-ace:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
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
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-ace:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    learnerId?: string;
    adaptiveMode?: boolean;
    curriculumMode?: string;
    minCompetencyThreshold?: number;
    maxDifficulty?: string;
    lockedDiagnoses?: string[];
    lockedObjectives?: string[];
    requiredCompetencies?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.learnerId) {
    return NextResponse.json({ error: "learnerId required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.adaptiveMode !== undefined) patch.adaptive_mode = body.adaptiveMode;
  if (body.curriculumMode) patch.curriculum_mode = body.curriculumMode;
  if (body.minCompetencyThreshold != null) {
    if (
      typeof body.minCompetencyThreshold !== "number" ||
      body.minCompetencyThreshold < 0 ||
      body.minCompetencyThreshold > 100
    ) {
      return NextResponse.json(
        { error: "minCompetencyThreshold must be 0–100" },
        { status: 400 },
      );
    }
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
