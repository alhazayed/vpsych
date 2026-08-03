import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { sanitizeDbError } from "@/lib/safe-client-error";
import {
  listBuiltinPresets,
  findPresetById,
  type InstructorPreset,
} from "@/lib/instructor-presets";
import { validateInstructorPreset } from "@/lib/instructor-presets/validation";
import { rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/rate-limit-response";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin:${auth.user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited);
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("instructor_presets")
    .select(
      "id, slug, name, description, specialty, target_learner, learning_level, assessment_type, primary_objective, difficulty, time_limit_minutes, language, culture, therapy_modality, grading_mode, feedback_mode, allow_hints, advanced_mode, enabled, version, archived_at, scenario_template_id",
    )
    .is("archived_at", null)
    .order("name");

  if (error) {
    return NextResponse.json({
      source: "builtin",
      presets: listBuiltinPresets(),
    });
  }

  return NextResponse.json({ source: "database", presets: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request);
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin:${auth.user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) return tooManyRequests(limited);
  const { supabase, user } = auth;

  const body = (await request.json()) as {
    action?:
      | "create"
      | "update"
      | "clone"
      | "archive"
      | "export"
      | "import"
      | "version";
    presetId?: string;
    slug?: string;
    name?: string;
    description?: string;
    specialty?: string;
    targetLearner?: string;
    learningLevel?: string;
    assessmentType?: string;
    primaryObjective?: string;
    secondaryObjectives?: string[];
    difficulty?: string;
    timeLimitMinutes?: number;
    language?: string;
    culture?: string;
    therapyModality?: string;
    gradingMode?: string;
    feedbackMode?: string;
    allowHints?: boolean;
    scenarioTemplateId?: string;
    changeNotes?: string;
    preset?: Partial<InstructorPreset>;
  };

  if (body.action === "archive" && body.presetId) {
    const { error } = await supabase
      .from("instructor_presets")
      .update({
        archived_at: new Date().toISOString(),
        enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.presetId);
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "export" && body.presetId) {
    const builtin = findPresetById(body.presetId);
    const { data: preset } = await supabase
      .from("instructor_presets")
      .select("*")
      .eq("id", body.presetId)
      .maybeSingle();
    if (!preset && !builtin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { data: objectives } = await supabase
      .from("preset_objectives")
      .select("*")
      .eq("preset_id", body.presetId);
    const { data: competencies } = await supabase
      .from("preset_competencies")
      .select("*")
      .eq("preset_id", body.presetId);
    const { data: grading } = await supabase
      .from("preset_grading")
      .select("*")
      .eq("preset_id", body.presetId)
      .maybeSingle();
    return NextResponse.json({
      preset: preset ?? builtin,
      objectives: objectives ?? [],
      competencies: competencies ?? [],
      grading: grading ?? null,
    });
  }

  if (body.action === "version" && body.presetId) {
    const { data: src } = await supabase
      .from("instructor_presets")
      .select("*")
      .eq("id", body.presetId)
      .single();
    if (!src) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const nextVersion = Number(src.version) + 1;
    const { error: verErr } = await supabase.from("preset_versions").insert({
      preset_id: src.id,
      version: nextVersion,
      snapshot: src,
      change_notes: body.changeNotes ?? `Version ${nextVersion}`,
      created_by: user.id,
    });
    if (verErr) {
      return NextResponse.json({ error: verErr.message }, { status: 500 });
    }
    const { error: updErr } = await supabase
      .from("instructor_presets")
      .update({ version: nextVersion, updated_at: new Date().toISOString() })
      .eq("id", src.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, version: nextVersion });
  }

  if (body.action === "clone" && body.presetId) {
    const { data: src, error } = await supabase
      .from("instructor_presets")
      .select("*")
      .eq("id", body.presetId)
      .single();
    if (error || !src) {
      const builtin = findPresetById(body.presetId);
      if (!builtin) {
        return NextResponse.json({ error: "Preset not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        preset: {
          ...builtin,
          id: crypto.randomUUID(),
          slug: `${builtin.slug}-copy-${Date.now().toString(36)}`,
          name: `${builtin.name} (Copy)`,
        },
        source: "builtin",
      });
    }
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      archived_at: _a,
      ...rest
    } = src;
    const newSlug = `${src.slug}-copy-${Date.now().toString(36)}`;
    const { data: cloned, error: cloneErr } = await supabase
      .from("instructor_presets")
      .insert({
        ...rest,
        slug: newSlug,
        name: `${src.name} (Copy)`,
        version: 1,
        created_by: user.id,
        enabled: false,
      })
      .select("*")
      .single();
    if (cloneErr || !cloned) {
      return NextResponse.json(
        { error: cloneErr?.message ?? "Clone failed" },
        { status: 500 },
      );
    }

    // Copy child rows
    const { data: objectives } = await supabase
      .from("preset_objectives")
      .select("objective, is_primary, sort_order")
      .eq("preset_id", body.presetId);
    if (objectives?.length) {
      await supabase.from("preset_objectives").insert(
        objectives.map((o) => ({ ...o, preset_id: cloned.id })),
      );
    }
    const { data: competencies } = await supabase
      .from("preset_competencies")
      .select("competency_id, label, required, weight, max_score, sort_order")
      .eq("preset_id", body.presetId);
    if (competencies?.length) {
      await supabase.from("preset_competencies").insert(
        competencies.map((c) => ({ ...c, preset_id: cloned.id })),
      );
    }
    const { data: grading } = await supabase
      .from("preset_grading")
      .select(
        "pass_threshold, outstanding_threshold, critical_mistakes, automatic_deductions, dimensions, report_sections",
      )
      .eq("preset_id", body.presetId)
      .maybeSingle();
    if (grading) {
      await supabase
        .from("preset_grading")
        .insert({ ...grading, preset_id: cloned.id });
    }

    return NextResponse.json({ ok: true, preset: cloned });
  }

  if (body.action === "import" && body.preset) {
    const p = body.preset;
    if (!p.slug || !p.name || !p.primary_objective) {
      return NextResponse.json(
        { error: "Import requires slug, name, primary_objective" },
        { status: 400 },
      );
    }
    const { data: imported, error } = await supabase
      .from("instructor_presets")
      .upsert(
        {
          slug: p.slug,
          name: p.name,
          description: p.description ?? null,
          specialty: p.specialty ?? "general_adult_psychiatry",
          target_learner: p.target_learner ?? "psychiatry_resident",
          learning_level: p.learning_level ?? "residency",
          assessment_type: p.assessment_type ?? "initial_assessment",
          primary_objective: p.primary_objective,
          difficulty: p.difficulty ?? "intermediate",
          time_limit_minutes: p.time_limit_minutes ?? 40,
          language: p.language ?? "en-US",
          culture: p.culture ?? null,
          therapy_modality: p.therapy_modality ?? "supportive",
          grading_mode: p.grading_mode ?? "practice",
          feedback_mode: p.feedback_mode ?? "end_of_session",
          allow_hints: p.allow_hints ?? true,
          enabled: p.enabled ?? false,
          version: p.version ?? 1,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      )
      .select("*")
      .single();
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, preset: imported });
  }

  if (body.action === "update" && body.presetId) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.difficulty) patch.difficulty = body.difficulty;
    if (body.timeLimitMinutes) patch.time_limit_minutes = body.timeLimitMinutes;
    if (body.language) patch.language = body.language;
    if (body.therapyModality) patch.therapy_modality = body.therapyModality;
    if (body.gradingMode) patch.grading_mode = body.gradingMode;
    if (body.feedbackMode) patch.feedback_mode = body.feedbackMode;
    if (body.allowHints !== undefined) patch.allow_hints = body.allowHints;
    if (body.scenarioTemplateId !== undefined) {
      patch.scenario_template_id = body.scenarioTemplateId;
    }
    if (body.primaryObjective) patch.primary_objective = body.primaryObjective;

    const { data, error } = await supabase
      .from("instructor_presets")
      .update(patch)
      .eq("id", body.presetId)
      .select("*")
      .single();
    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }
    return NextResponse.json({ ok: true, preset: data });
  }

  // create
  if (body.action === "create" || !body.action) {
    if (!body.slug || !body.name || !body.primaryObjective) {
      return NextResponse.json(
        { error: "slug, name, and primaryObjective required" },
        { status: 400 },
      );
    }
    const draft = {
      id: crypto.randomUUID(),
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      specialty: (body.specialty ??
        "general_adult_psychiatry") as InstructorPreset["specialty"],
      target_learner: (body.targetLearner ??
        "psychiatry_resident") as InstructorPreset["target_learner"],
      learning_level: (body.learningLevel ??
        "residency") as InstructorPreset["learning_level"],
      clinical_rotation: null,
      assessment_type: (body.assessmentType ??
        "initial_assessment") as InstructorPreset["assessment_type"],
      primary_objective:
        body.primaryObjective as InstructorPreset["primary_objective"],
      secondary_objectives: (body.secondaryObjectives ??
        []) as InstructorPreset["secondary_objectives"],
      difficulty: (body.difficulty ??
        "intermediate") as InstructorPreset["difficulty"],
      time_limit_minutes: (body.timeLimitMinutes ??
        40) as InstructorPreset["time_limit_minutes"],
      language: body.language ?? "en-US",
      culture: body.culture ?? null,
      therapy_modality: (body.therapyModality ??
        "supportive") as InstructorPreset["therapy_modality"],
      randomization_level: "moderate" as const,
      grading_mode: (body.gradingMode ??
        "practice") as InstructorPreset["grading_mode"],
      feedback_mode: (body.feedbackMode ??
        "end_of_session") as InstructorPreset["feedback_mode"],
      voice_enabled: true,
      assessment_enabled: true,
      record_session: true,
      allow_hints: body.allowHints ?? true,
      allow_pause: true,
      allow_restart: true,
      advanced_mode: false,
      preferred_template_slugs: [],
      clinical_constraints: [],
      required_competencies: [],
      optional_competencies: [],
      grading: {
        pass_threshold: 60,
        outstanding_threshold: 85,
        critical_mistakes: [],
        automatic_deductions: {},
        dimensions: [],
        report_sections: [
          "score",
          "strengths",
          "weaknesses",
          "missed_opportunities",
          "recommendations",
        ],
      },
      enabled: false,
      version: 1,
    } satisfies InstructorPreset;

    const issues = validateInstructorPreset(draft).filter(
      (i) => i.severity === "error",
    );
    if (issues.length) {
      return NextResponse.json({ error: issues }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("instructor_presets")
      .insert({
        slug: draft.slug,
        name: draft.name,
        description: draft.description,
        specialty: draft.specialty,
        target_learner: draft.target_learner,
        learning_level: draft.learning_level,
        assessment_type: draft.assessment_type,
        primary_objective: draft.primary_objective,
        difficulty: draft.difficulty,
        time_limit_minutes: draft.time_limit_minutes,
        language: draft.language,
        culture: draft.culture,
        therapy_modality: draft.therapy_modality,
        grading_mode: draft.grading_mode,
        feedback_mode: draft.feedback_mode,
        allow_hints: draft.allow_hints,
        scenario_template_id: body.scenarioTemplateId ?? null,
        enabled: false,
        version: 1,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.warn("[api]", error.message);
      return NextResponse.json({ error: sanitizeDbError(error.message) }, { status: 500 });
    }

    await supabase.from("preset_objectives").insert({
      preset_id: data.id,
      objective: draft.primary_objective,
      is_primary: true,
      sort_order: 1,
    });
    for (let i = 0; i < draft.secondary_objectives.length; i++) {
      await supabase.from("preset_objectives").insert({
        preset_id: data.id,
        objective: draft.secondary_objectives[i],
        is_primary: false,
        sort_order: i + 2,
      });
    }
    await supabase.from("preset_grading").insert({
      preset_id: data.id,
      pass_threshold: 60,
      outstanding_threshold: 85,
    });
    await supabase.from("preset_versions").insert({
      preset_id: data.id,
      version: 1,
      snapshot: data,
      change_notes: "Initial create",
      created_by: user.id,
    });

    return NextResponse.json({ ok: true, preset: data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
