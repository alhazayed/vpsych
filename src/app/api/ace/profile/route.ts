import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildAnalytics,
  evaluateCertifications,
  generateLearningPlan,
} from "@/lib/ace";
import { ensureLearnerProfile } from "@/lib/ace/persist";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

/** Fields learners may self-update (instructor/scoring controls are admin-only). */
const LEARNER_PATCH_KEYS = [
  "adaptiveMode",
  "curriculumMode",
  "preferredTherapyModels",
  "institution",
  "profession",
  "trainingLevel",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`ace-profile:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  // A profile that failed to load is not shown as a blank one (already logged).
  const profile = await ensureLearnerProfile(supabase, user.id).catch(() => null);
  if (!profile) {
    return NextResponse.json(
      { error: "Learner profile unavailable", code: "learner_profile_unavailable" },
      { status: 503 },
    );
  }
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

  const limited = await rateLimit(`ace-profile:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    adaptiveMode?: boolean;
    curriculumMode?: "automatic" | "manual" | "hybrid";
    preferredTherapyModels?: string[];
    institution?: string;
    profession?: string;
    trainingLevel?: string;
    // Rejected if present — instructor controls move to /api/admin/ace/learners
    minCompetencyThreshold?: number;
    maxDifficulty?: string;
    lockedDiagnoses?: string[];
    lockedObjectives?: string[];
    requiredCompetencies?: string[];
  };

  const rejected = (
    [
      "minCompetencyThreshold",
      "maxDifficulty",
      "lockedDiagnoses",
      "lockedObjectives",
      "requiredCompetencies",
    ] as const
  ).filter((k) => body[k] !== undefined);
  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: "Instructor controls require admin",
        rejected,
      },
      { status: 403 },
    );
  }

  // Drop unknown keys (mass-assignment guard).
  for (const key of Object.keys(body)) {
    if (
      !(LEARNER_PATCH_KEYS as readonly string[]).includes(key) &&
      key !== "minCompetencyThreshold" &&
      key !== "maxDifficulty" &&
      key !== "lockedDiagnoses" &&
      key !== "lockedObjectives" &&
      key !== "requiredCompetencies"
    ) {
      delete (body as Record<string, unknown>)[key];
    }
  }

  // A profile that failed to load is not shown as a blank one (already logged).
  const profile = await ensureLearnerProfile(supabase, user.id).catch(() => null);
  if (!profile) {
    return NextResponse.json(
      { error: "Learner profile unavailable", code: "learner_profile_unavailable" },
      { status: 503 },
    );
  }
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.adaptiveMode !== undefined) patch.adaptive_mode = body.adaptiveMode;
  if (body.curriculumMode) patch.curriculum_mode = body.curriculumMode;
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
    // Never answer "ok" for a change that was not saved.
    console.error("[ace/profile] update failed", {
      userId: user.id,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not save your learning settings", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, profile: data ?? profile });
}
