import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  findPresetById,
  findPresetBySlug,
  generateFromPreset,
  generateInstructorReport,
  listBuiltinPresets,
} from "@/lib/instructor-presets";
import type { PersonaRow } from "@/lib/case-engine/types";

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth;

  const body = (await request.json()) as {
    presetId?: string;
    presetSlug?: string;
    seed?: string;
    avatarId?: string;
    generateReport?: boolean;
  };

  let preset =
    (body.presetId ? findPresetById(body.presetId) : undefined) ??
    (body.presetSlug ? findPresetBySlug(body.presetSlug) : undefined);

  if (!preset && body.presetId) {
    const { data } = await supabase
      .from("instructor_presets")
      .select("*")
      .eq("id", body.presetId)
      .maybeSingle();
    if (data) {
      preset = listBuiltinPresets().find((p) => p.slug === data.slug) ?? {
        ...findPresetBySlug(data.slug)!,
        id: data.id,
        slug: data.slug,
        name: data.name,
        primary_objective: data.primary_objective,
        difficulty: data.difficulty,
        time_limit_minutes: data.time_limit_minutes,
        language: data.language,
        therapy_modality: data.therapy_modality,
        grading_mode: data.grading_mode,
        feedback_mode: data.feedback_mode,
        allow_hints: data.allow_hints,
        enabled: data.enabled,
        version: data.version,
      };
    }
  }

  if (!preset && body.presetSlug) {
    preset = findPresetBySlug(body.presetSlug);
  }

  if (!preset) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const { data: avatar } = body.avatarId
    ? await supabase
        .from("avatars")
        .select("id, name, slug, age, gender, is_active")
        .eq("id", body.avatarId)
        .maybeSingle()
    : await supabase
        .from("avatars")
        .select("id, name, slug, age, gender, is_active")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

  const persona: PersonaRow = {
    id: avatar?.id ?? "preview-persona",
    avatar_id: avatar?.id ?? "preview-avatar",
    slug: avatar?.slug ?? "preview-patient",
    display_name: avatar?.name ?? "Preview Patient",
    identity: {
      age: typeof avatar?.age === "number" ? avatar.age : 32,
      gender: (avatar?.gender as PersonaRow["identity"]["gender"]) ?? "unspecified",
      source: "preview",
    },
    traits: {},
    baseline_history: {},
    default_disorder_id: null,
    is_active: true,
  };

  const result = generateFromPreset({
    preset,
    persona,
    avatarId: persona.avatar_id ?? "preview-avatar",
    seed: body.seed ?? `preview:${preset.slug}:${Date.now()}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.issues }, { status: 400 });
  }

  const report = body.generateReport
    ? generateInstructorReport({
        preset,
        transcriptTurns: 14,
        coveredObjectives: [
          preset.primary_objective,
          ...preset.secondary_objectives.slice(0, 1),
        ],
        riskAddressed: /risk|suicide|crisis|emergency/i.test(
          preset.primary_objective,
        ),
        empathyScore: 0.75,
        diagnosisMentioned: true,
        timeUsedMinutes: Math.min(preset.time_limit_minutes - 2, 28),
      })
    : null;

  return NextResponse.json({
    ok: true,
    assessment: {
      diagnosis: result.assessment.snapshot.primary_diagnosis,
      comorbidities: result.assessment.snapshot.comorbidities,
      difficulty: result.assessment.snapshot.difficulty,
      locale: result.assessment.snapshot.locale,
      therapyModality: result.assessment.snapshot.therapy_modality,
      randomizedContext: result.assessment.snapshot.randomized_context,
      template: result.assessment.snapshot.template,
      instructorPreset: result.assessment.snapshot.instructor_preset,
      assessmentId: result.assessment.snapshot.assessment_id,
      clinicalCore: {
        disorder: result.assessment.snapshot.clinical_core.disorder,
        severity: result.assessment.snapshot.clinical_core.severity,
        dsm5_code: result.assessment.snapshot.clinical_core.dsm5_code,
        icd11_code: result.assessment.snapshot.clinical_core.icd11_code,
      },
      resolution: result.assessment.resolution,
      maxDurationSec: result.assessment.maxDurationSec,
    },
    report,
  });
}
