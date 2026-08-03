import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findDifficulty,
  findDisorderBySlug,
  findTherapy,
  getBuiltinCatalog,
} from "@/lib/case-engine/catalog";
import { generateCaseInstance } from "@/lib/case-engine/generator";
import type {
  CaseDifficulty,
  CaseInstanceSnapshot,
  CaseSeverity,
  DisorderRow,
  PersonaRow,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  findTemplateById,
  findTemplateBySlug,
} from "@/lib/scenario-templates/catalog";
import { generateFromTemplate } from "@/lib/scenario-templates/generate";
import type { ClinicalScenarioTemplate } from "@/lib/scenario-templates/types";
import {
  findPresetById,
  findPresetBySlug,
  generateFromPreset,
  type InstructorPreset,
} from "@/lib/instructor-presets";
import type { Avatar, ClinicalCore } from "@/lib/types";

export type StartCaseOptions = {
  avatar: Avatar;
  locale: string;
  therapistId: string;
  disorderSlug?: string;
  comorbiditySlugs?: string[];
  difficulty?: CaseDifficulty;
  therapyModality?: TherapyModality;
  severity?: CaseSeverity;
  seed?: string | number;
  /** Clinical Scenario Template Engine */
  templateId?: string;
  templateSlug?: string;
  /** Instructor Preset Engine — objectives drive diagnosis + template */
  presetId?: string;
  presetSlug?: string;
  /** Advanced Mode only (requires preset.advanced_mode). */
  disorderSlugOverride?: string;
};

function personaFromAvatar(avatar: Avatar, dbPersona?: PersonaRow | null): PersonaRow {
  if (dbPersona) return dbPersona;
  const age =
    avatar.clinical_core?.age ??
    (typeof avatar.age === "number" ? avatar.age : 30);
  const gender =
    (avatar.clinical_core?.gender as PersonaRow["identity"]["gender"]) ??
    (avatar.gender as PersonaRow["identity"]["gender"]) ??
    "unspecified";
  return {
    id: avatar.id,
    avatar_id: avatar.id,
    slug: avatar.slug ?? avatar.id,
    display_name: avatar.name,
    identity: { age, gender, source: "avatar_fallback" },
    traits: {},
    baseline_history: {},
    default_disorder_id: null,
    is_active: avatar.is_active,
  };
}

function mapDbDisorder(row: Record<string, unknown>): DisorderRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    dsm5_code: (row.dsm5_code as string) ?? null,
    icd10_code: (row.icd10_code as string) ?? null,
    icd11_code: (row.icd11_code as string) ?? null,
    category: (row.category as string) ?? null,
    min_age: (row.min_age as number) ?? null,
    max_age: (row.max_age as number) ?? null,
    allowed_genders: (row.allowed_genders as string[]) ?? [
      "female",
      "male",
      "non-binary",
      "unspecified",
    ],
    package: (row.package as DisorderRow["package"]) ?? {},
    is_active: Boolean(row.is_active),
  };
}

/**
 * Load catalog pieces from DB when available; fall back to builtins.
 * Generate + persist CaseInstance + empty case_memory.
 */
type PresetChildren = {
  secondaryObjectives: InstructorPreset["secondary_objectives"];
  constraints: InstructorPreset["clinical_constraints"];
  competencies: {
    required: InstructorPreset["required_competencies"];
    optional: InstructorPreset["optional_competencies"];
  };
  preferredTemplateSlugs: string[];
  grading?: Partial<InstructorPreset["grading"]>;
};

async function loadPresetChildren(
  supabase: SupabaseClient,
  presetId: string,
): Promise<PresetChildren> {
  const [{ data: objectives }, { data: competencies }, { data: constraints }, { data: templates }, { data: grading }] =
    await Promise.all([
      supabase
        .from("preset_objectives")
        .select("objective, is_primary, sort_order")
        .eq("preset_id", presetId)
        .order("sort_order"),
      supabase
        .from("preset_competencies")
        .select("competency_id, label, required, weight, max_score")
        .eq("preset_id", presetId)
        .order("sort_order"),
      supabase
        .from("preset_constraints")
        .select("constraint_type, value")
        .eq("preset_id", presetId),
      supabase
        .from("preset_templates")
        .select("priority, clinical_templates(slug)")
        .eq("preset_id", presetId)
        .order("priority", { ascending: false }),
      supabase
        .from("preset_grading")
        .select("*")
        .eq("preset_id", presetId)
        .maybeSingle(),
    ]);

  const secondaryObjectives = (objectives ?? [])
    .filter((o) => !o.is_primary)
    .map((o) => o.objective as InstructorPreset["secondary_objectives"][number]);

  const required = (competencies ?? [])
    .filter((c) => c.required)
    .map((c) => ({
      competency_id: c.competency_id,
      label: c.label,
      required: true,
      weight: Number(c.weight),
      max_score: Number(c.max_score),
    }));
  const optional = (competencies ?? [])
    .filter((c) => !c.required)
    .map((c) => ({
      competency_id: c.competency_id,
      label: c.label,
      required: false,
      weight: Number(c.weight),
      max_score: Number(c.max_score),
    }));

  const preferredTemplateSlugs = (templates ?? [])
    .map((t) => {
      const ct = t.clinical_templates as
        | { slug?: string }
        | { slug?: string }[]
        | null;
      if (Array.isArray(ct)) return ct[0]?.slug;
      return ct?.slug;
    })
    .filter(Boolean) as string[];

  return {
    secondaryObjectives,
    constraints: (constraints ?? []).map((c) => ({
      constraint_type: c.constraint_type as InstructorPreset["clinical_constraints"][number]["constraint_type"],
      value: c.value,
    })),
    competencies: { required, optional },
    preferredTemplateSlugs,
    grading: grading
      ? {
          pass_threshold: Number(grading.pass_threshold),
          outstanding_threshold: Number(grading.outstanding_threshold),
          critical_mistakes: (grading.critical_mistakes as string[]) ?? [],
          automatic_deductions:
            (grading.automatic_deductions as Record<string, number>) ?? {},
          dimensions: (grading.dimensions as string[]) ?? [],
          report_sections: (grading.report_sections as string[]) ?? [],
        }
      : undefined,
  };
}

function mapDbPreset(
  row: Record<string, unknown>,
  children: PresetChildren,
): InstructorPreset {
  const primaryFromChildren = undefined; // primary stays on row
  void primaryFromChildren;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: (row.description as string) ?? null,
    specialty: row.specialty as InstructorPreset["specialty"],
    target_learner: row.target_learner as InstructorPreset["target_learner"],
    learning_level: row.learning_level as InstructorPreset["learning_level"],
    clinical_rotation: (row.clinical_rotation as string) ?? null,
    assessment_type: row.assessment_type as InstructorPreset["assessment_type"],
    primary_objective:
      row.primary_objective as InstructorPreset["primary_objective"],
    secondary_objectives: children.secondaryObjectives,
    difficulty: row.difficulty as InstructorPreset["difficulty"],
    time_limit_minutes:
      row.time_limit_minutes as InstructorPreset["time_limit_minutes"],
    language: String(row.language),
    culture: (row.culture as string) ?? null,
    therapy_modality:
      row.therapy_modality as InstructorPreset["therapy_modality"],
    randomization_level:
      row.randomization_level as InstructorPreset["randomization_level"],
    grading_mode: row.grading_mode as InstructorPreset["grading_mode"],
    feedback_mode: row.feedback_mode as InstructorPreset["feedback_mode"],
    voice_enabled: Boolean(row.voice_enabled),
    assessment_enabled: Boolean(row.assessment_enabled ?? true),
    record_session: Boolean(row.record_session ?? true),
    allow_hints: Boolean(row.allow_hints),
    allow_pause: Boolean(row.allow_pause ?? true),
    allow_restart: Boolean(row.allow_restart ?? true),
    advanced_mode: Boolean(row.advanced_mode),
    scenario_template_id: (row.scenario_template_id as string) ?? null,
    preferred_template_slugs: children.preferredTemplateSlugs,
    clinical_constraints: children.constraints,
    required_competencies: children.competencies.required,
    optional_competencies: children.competencies.optional,
    grading: {
      pass_threshold: children.grading?.pass_threshold ?? 60,
      outstanding_threshold: children.grading?.outstanding_threshold ?? 85,
      critical_mistakes: children.grading?.critical_mistakes ?? [],
      automatic_deductions: children.grading?.automatic_deductions ?? {},
      dimensions: children.grading?.dimensions ?? [],
      report_sections: children.grading?.report_sections ?? [
        "score",
        "strengths",
        "weaknesses",
        "missed_opportunities",
        "recommendations",
      ],
    },
    enabled: Boolean(row.enabled),
    version: Number(row.version ?? 1),
  };
}

export async function createCaseForSession(
  supabase: SupabaseClient,
  opts: StartCaseOptions,
): Promise<
  | {
      ok: true;
      caseInstanceId: string;
      snapshot: CaseInstanceSnapshot;
      difficulty: CaseDifficulty;
      therapyModality: TherapyModality;
      preset?: InstructorPreset;
      maxDurationSec?: number;
    }
  | { ok: false; error: string; status: number }
> {
  const catalog = getBuiltinCatalog();

  const { data: dbPersona } = await supabase
    .from("personas")
    .select("*")
    .eq("avatar_id", opts.avatar.id)
    .maybeSingle();

  const persona = personaFromAvatar(opts.avatar, dbPersona as PersonaRow | null);

  // -------------------------------------------------------------------------
  // Instructor Preset path — objectives → diagnosis + template → patient
  // -------------------------------------------------------------------------
  let resolvedPreset: InstructorPreset | null = null;
  if (opts.presetId || opts.presetSlug) {
    if (opts.presetId) {
      const { data: prow } = await supabase
        .from("instructor_presets")
        .select("*")
        .eq("id", opts.presetId)
        .maybeSingle();
      if (prow) {
        resolvedPreset = mapDbPreset(prow, await loadPresetChildren(supabase, prow.id));
      }
    } else if (opts.presetSlug) {
      const { data: prow } = await supabase
        .from("instructor_presets")
        .select("*")
        .eq("slug", opts.presetSlug)
        .maybeSingle();
      if (prow) {
        resolvedPreset = mapDbPreset(prow, await loadPresetChildren(supabase, prow.id));
      }
    }
    if (!resolvedPreset) {
      resolvedPreset =
        (opts.presetId ? findPresetById(opts.presetId) : undefined) ??
        (opts.presetSlug ? findPresetBySlug(opts.presetSlug) : undefined) ??
        null;
    }
    if (!resolvedPreset) {
      return { ok: false, error: "Instructor preset not found", status: 404 };
    }

    // Prefer preset language when caller did not force a different locale path
    const presetLocale = opts.locale || resolvedPreset.language;
    const fromPreset = generateFromPreset({
      preset: { ...resolvedPreset, language: presetLocale },
      persona,
      avatarId: opts.avatar.id,
      disorderSlugOverride: opts.disorderSlugOverride ?? opts.disorderSlug,
      comorbiditySlugs: opts.comorbiditySlugs,
      seed: opts.seed,
    });
    if (!fromPreset.ok) {
      return {
        ok: false,
        error: fromPreset.issues.map((i) => i.message).join("; "),
        status: 400,
      };
    }

    const snapshot = fromPreset.assessment.snapshot;
    const difficulty = resolvedPreset.difficulty;
    const therapyModality =
      resolvedPreset.therapy_modality === "medication_management"
        ? ("supportive" as TherapyModality)
        : (resolvedPreset.therapy_modality as TherapyModality);

    const selectedSlug =
      fromPreset.assessment.resolution.selectedDisorderSlug;
    const { data: dbDisorder } = await supabase
      .from("disorders")
      .select("id")
      .eq("slug", selectedSlug)
      .maybeSingle();
    const primaryDisorder =
      findDisorderBySlug(selectedSlug, catalog) ??
      (dbDisorder ? { id: dbDisorder.id } : null);

    const { data: inserted, error: insertErr } = await supabase
      .from("case_instances")
      .insert({
        assessment_id: snapshot.assessment_id,
        persona_id: dbPersona?.id ?? null,
        avatar_id: opts.avatar.id,
        primary_disorder_id: dbDisorder?.id ?? primaryDisorder?.id ?? null,
        comorbidity_disorder_ids: snapshot.comorbidities.map((c) => c.id),
        difficulty,
        therapy_modality: therapyModality,
        locale: snapshot.locale,
        severity: snapshot.severity,
        clinical_snapshot: snapshot,
        randomized_context: snapshot.randomized_context,
        voice_profile_id: opts.avatar.voice_profile_id ?? null,
        template_id: snapshot.template?.id ?? null,
        template_version: snapshot.template?.version ?? null,
        instructor_preset_id: resolvedPreset.id,
        instructor_preset_version: resolvedPreset.version,
        created_by: opts.therapistId,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      if (
        insertErr?.message?.includes("does not exist") ||
        insertErr?.code === "42P01" ||
        insertErr?.message?.includes("instructor_preset")
      ) {
        return {
          ok: true,
          caseInstanceId: snapshot.assessment_id,
          snapshot,
          difficulty,
          therapyModality,
          preset: resolvedPreset,
          maxDurationSec: fromPreset.assessment.maxDurationSec,
        };
      }
      return {
        ok: false,
        error: insertErr?.message ?? "Failed to persist case instance",
        status: 500,
      };
    }

    snapshot.case_instance_id = inserted.id;
    await supabase.from("case_memory").insert({
      case_instance_id: inserted.id,
      memory: {
        turns: [],
        notes: [],
        scope: "case_instance",
        template_id: snapshot.template?.id,
        instructor_preset_id: resolvedPreset.id,
      },
    });
    await supabase
      .from("case_instances")
      .update({ clinical_snapshot: snapshot })
      .eq("id", inserted.id);

    return {
      ok: true,
      caseInstanceId: inserted.id,
      snapshot,
      difficulty,
      therapyModality,
      preset: resolvedPreset,
      maxDurationSec: fromPreset.assessment.maxDurationSec,
    };
  }

  // -------------------------------------------------------------------------
  // Template path — instructor templates drive generation
  // -------------------------------------------------------------------------
  let resolvedTemplate: ClinicalScenarioTemplate | null = null;
  if (opts.templateId || opts.templateSlug) {
    const { data: trow } = opts.templateId
      ? await supabase
          .from("clinical_templates")
          .select("*")
          .eq("id", opts.templateId)
          .maybeSingle()
      : await supabase
          .from("clinical_templates")
          .select("*")
          .eq("slug", opts.templateSlug!)
          .maybeSingle();

    if (trow) {
      const builtin =
        findTemplateBySlug(trow.slug) ??
        (opts.templateSlug ? findTemplateBySlug(opts.templateSlug) : undefined) ??
        (opts.templateId ? findTemplateById(opts.templateId) : undefined) ??
        null;

      const { data: objectives } = await supabase
        .from("template_objectives")
        .select("category, statement, sort_order")
        .eq("template_id", trow.id)
        .order("sort_order");
      const { data: competencies } = await supabase
        .from("template_competencies")
        .select(
          "competency_id, label, weight, max_score, critical, auto_deduction, excellent_marker, sort_order",
        )
        .eq("template_id", trow.id)
        .order("sort_order");
      const { data: comorbidities } = await supabase
        .from("template_comorbidities")
        .select("disorder_id, tier, disorders(slug)")
        .eq("template_id", trow.id);
      const { data: diagnoses } = await supabase
        .from("template_diagnoses")
        .select("role, disorders(slug)")
        .eq("template_id", trow.id);
      const { data: primaryDisorder } = await supabase
        .from("disorders")
        .select("slug")
        .eq("id", trow.primary_diagnosis_id)
        .maybeSingle();

      const disorderSlugFromJoin = (
        value: { slug?: string } | { slug?: string }[] | null | undefined,
      ): string | undefined => {
        if (Array.isArray(value)) return value[0]?.slug;
        return value?.slug;
      };

      const dbAllowedFromComorbidities = (comorbidities ?? [])
        .map((c) => disorderSlugFromJoin(c.disorders as never))
        .filter(Boolean) as string[];
      const dbAllowedFromDiagnoses = (diagnoses ?? [])
        .filter((d) => d.role === "allowed_comorbidity")
        .map((d) => disorderSlugFromJoin(d.disorders as never))
        .filter(Boolean) as string[];
      const dbExcluded = (diagnoses ?? [])
        .filter((d) => d.role === "excluded")
        .map((d) => disorderSlugFromJoin(d.disorders as never))
        .filter(Boolean) as string[];

      const dbObjectives = (objectives ?? []).map((o) => ({
        category: o.category,
        statement: o.statement,
        sort_order: o.sort_order,
      }));
      const dbCompetencies = (competencies ?? []).map((c) => ({
        competency_id: c.competency_id,
        label: c.label,
        weight: Number(c.weight),
        max_score: Number(c.max_score),
        critical: c.critical,
        auto_deduction: c.auto_deduction ? Number(c.auto_deduction) : 0,
        excellent_marker: c.excellent_marker ?? undefined,
        sort_order: c.sort_order,
      }));

      const allowedMerged = Array.from(
        new Set([...dbAllowedFromComorbidities, ...dbAllowedFromDiagnoses]),
      );

      resolvedTemplate = {
        id: trow.id,
        slug: trow.slug,
        name: trow.name,
        description: trow.description,
        specialty: trow.specialty,
        target_learners: trow.target_learners ?? builtin?.target_learners ?? [],
        estimated_duration_minutes: trow.estimated_duration_minutes,
        difficulty: trow.difficulty,
        language: opts.locale || trow.language,
        culture: trow.culture,
        therapy_modality: trow.therapy_modality,
        primary_diagnosis_id: trow.primary_diagnosis_id,
        primary_diagnosis_slug:
          primaryDisorder?.slug ?? builtin?.primary_diagnosis_slug,
        allowed_comorbidity_slugs:
          allowedMerged.length > 0
            ? allowedMerged
            : (builtin?.allowed_comorbidity_slugs ?? []),
        excluded_diagnosis_slugs:
          dbExcluded.length > 0
            ? dbExcluded
            : (builtin?.excluded_diagnosis_slugs ?? []),
        severity: trow.severity,
        risk_level: trow.risk_level,
        assessment_type: trow.assessment_type,
        voice_profile_id: trow.voice_profile_id,
        default_persona_id: trow.default_persona_id,
        default_persona_slug: builtin?.default_persona_slug ?? null,
        randomization_level: trow.randomization_level,
        memory_mode: trow.memory_mode,
        grading_rubric: trow.grading_rubric ??
          builtin?.grading_rubric ?? {
            pass_threshold: 60,
            outstanding_threshold: 85,
          },
        report_template: trow.report_template ?? builtin?.report_template ?? {},
        learning_objectives:
          dbObjectives.length > 0
            ? dbObjectives
            : (builtin?.learning_objectives ?? []),
        clinical_competencies:
          dbCompetencies.length > 0
            ? dbCompetencies
            : (builtin?.clinical_competencies ?? []),
        allow_medical_simulation: trow.allow_medical_simulation,
        enabled: trow.enabled,
        version: trow.version,
      } as ClinicalScenarioTemplate;
    } else {
      resolvedTemplate =
        (opts.templateId ? findTemplateById(opts.templateId) : undefined) ??
        (opts.templateSlug ? findTemplateBySlug(opts.templateSlug) : undefined) ??
        null;
      if (resolvedTemplate) {
        resolvedTemplate = {
          ...resolvedTemplate,
          language: opts.locale || resolvedTemplate.language,
        };
      }
    }

    if (!resolvedTemplate) {
      return { ok: false, error: "Clinical template not found", status: 404 };
    }

    const fromTemplate = generateFromTemplate({
      template: resolvedTemplate,
      persona,
      avatarId: opts.avatar.id,
      comorbiditySlugs: opts.comorbiditySlugs,
      seed: opts.seed,
      autoComorbidity: !opts.comorbiditySlugs?.length,
    });
    if (!fromTemplate.ok) {
      return {
        ok: false,
        error: fromTemplate.issues.map((i) => i.message).join("; "),
        status: 400,
      };
    }

    const snapshot = {
      ...fromTemplate.patient.snapshot,
      template: fromTemplate.patient.template,
    };
    const difficulty = resolvedTemplate.difficulty;
    const therapyModality = resolvedTemplate.therapy_modality as TherapyModality;

    const { data: inserted, error: insertErr } = await supabase
      .from("case_instances")
      .insert({
        assessment_id: snapshot.assessment_id,
        persona_id: dbPersona?.id ?? null,
        avatar_id: opts.avatar.id,
        primary_disorder_id: resolvedTemplate.primary_diagnosis_id,
        comorbidity_disorder_ids: snapshot.comorbidities.map((c) => c.id),
        difficulty,
        therapy_modality: therapyModality,
        locale: snapshot.locale,
        severity: snapshot.severity,
        clinical_snapshot: snapshot,
        randomized_context: snapshot.randomized_context,
        voice_profile_id:
          resolvedTemplate.voice_profile_id ??
          opts.avatar.voice_profile_id ??
          null,
        template_id: resolvedTemplate.id,
        template_version: resolvedTemplate.version,
        created_by: opts.therapistId,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      if (
        insertErr?.message?.includes("does not exist") ||
        insertErr?.code === "42P01" ||
        insertErr?.message?.includes("template_id")
      ) {
        return {
          ok: true,
          caseInstanceId: snapshot.assessment_id,
          snapshot,
          difficulty,
          therapyModality,
        };
      }
      return {
        ok: false,
        error: insertErr?.message ?? "Failed to persist case instance",
        status: 500,
      };
    }

    snapshot.case_instance_id = inserted.id;
    await supabase.from("case_memory").insert({
      case_instance_id: inserted.id,
      memory: {
        turns: [],
        notes: [],
        scope: "case_instance",
        template_id: resolvedTemplate.id,
      },
    });
    await supabase
      .from("case_instances")
      .update({ clinical_snapshot: snapshot })
      .eq("id", inserted.id);

    return {
      ok: true,
      caseInstanceId: inserted.id,
      snapshot,
      difficulty,
      therapyModality,
    };
  }

  let primary: DisorderRow | undefined;
  const disorderSlug =
    opts.disorderSlug ??
    (dbPersona?.default_disorder_id
      ? undefined
      : opts.avatar.slug === "maya-chen"
        ? "mdd-recurrent-moderate"
        : opts.avatar.slug === "jordan-hale"
          ? "gad-with-panic"
          : undefined);

  if (opts.disorderSlug || disorderSlug) {
    const slug = opts.disorderSlug ?? disorderSlug!;
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    primary = drow ? mapDbDisorder(drow) : findDisorderBySlug(slug, catalog);
  } else if (dbPersona?.default_disorder_id) {
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("id", dbPersona.default_disorder_id)
      .maybeSingle();
    primary = drow
      ? mapDbDisorder(drow)
      : catalog.disorders.find((d) => d.id === dbPersona.default_disorder_id);
  }

  if (!primary) {
    // Ultimate legacy fallback: synthesize disorder from avatar clinical_core
    const core = opts.avatar.clinical_core;
    primary = {
      id: "legacy-" + opts.avatar.id,
      slug: "legacy-" + (opts.avatar.slug ?? "avatar"),
      name: core?.disorder ?? opts.avatar.disorder,
      dsm5_code: core?.dsm5_code ?? null,
      icd10_code: null,
      icd11_code: core?.icd11_code ?? null,
      category: "legacy",
      min_age: 1,
      max_age: 120,
      allowed_genders: ["female", "male", "non-binary", "unspecified"],
      package: {
        severity_default: core?.severity ?? "moderate",
        symptom_profile: core?.symptom_profile,
        disclosure_rules: core?.disclosure_rules,
        session_goals: core?.session_goals,
        ideal_approach: core?.ideal_approach,
        risk_defaults: core?.risk_profile,
      },
      is_active: true,
    };
  }

  const comorbidities: DisorderRow[] = [];
  for (const slug of opts.comorbiditySlugs ?? []) {
    const { data: drow } = await supabase
      .from("disorders")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    const d = drow ? mapDbDisorder(drow) : findDisorderBySlug(slug, catalog);
    if (!d) {
      return { ok: false, error: `Unknown comorbidity: ${slug}`, status: 400 };
    }
    comorbidities.push(d);
  }

  const difficulty: CaseDifficulty = opts.difficulty ?? "intermediate";
  const therapyModality: TherapyModality =
    opts.therapyModality ?? "supportive";

  const generated = generateCaseInstance({
    persona,
    avatarId: opts.avatar.id,
    primaryDisorder: primary,
    comorbidities,
    difficulty,
    therapyModality,
    locale: opts.locale,
    severity: opts.severity,
    seed: opts.seed,
    difficultyProfile: findDifficulty(difficulty, catalog),
    therapyProfile: findTherapy(therapyModality, catalog),
    legacyClinicalCore: opts.avatar.clinical_core as ClinicalCore | null,
    voiceProfileId: opts.avatar.voice_profile_id,
    createdBy: opts.therapistId,
  });

  if (!generated.ok) {
    return {
      ok: false,
      error: generated.issues.map((i) => i.message).join("; "),
      status: 400,
    };
  }

  const snapshot = generated.snapshot;

  // Persist case_instance — if table missing (migration not applied), soft-fail to snapshot-only
  const { data: inserted, error: insertErr } = await supabase
    .from("case_instances")
    .insert({
      assessment_id: snapshot.assessment_id,
      persona_id: dbPersona?.id ?? null,
      avatar_id: opts.avatar.id,
      primary_disorder_id: primary.id.startsWith("legacy-")
        ? (dbPersona?.default_disorder_id ??
          catalog.disorders[0]!.id)
        : primary.id,
      comorbidity_disorder_ids: comorbidities.map((c) => c.id),
      difficulty,
      therapy_modality: therapyModality,
      locale: opts.locale,
      severity: snapshot.severity,
      clinical_snapshot: snapshot,
      randomized_context: snapshot.randomized_context,
      voice_profile_id: opts.avatar.voice_profile_id ?? null,
      created_by: opts.therapistId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    // Migration not applied yet — still return snapshot for session.clinical_snapshot
    if (
      insertErr?.message?.includes("does not exist") ||
      insertErr?.code === "42P01"
    ) {
      return {
        ok: true,
        caseInstanceId: snapshot.assessment_id,
        snapshot,
        difficulty,
        therapyModality,
      };
    }
    // If FK failed because legacy synthetic id — retry with default disorder
    if (primary.id.startsWith("legacy-")) {
      return {
        ok: true,
        caseInstanceId: snapshot.assessment_id,
        snapshot,
        difficulty,
        therapyModality,
      };
    }
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to persist case instance",
      status: 500,
    };
  }

  snapshot.case_instance_id = inserted.id;

  const { error: memErr } = await supabase.from("case_memory").insert({
    case_instance_id: inserted.id,
    memory: { turns: [], notes: [], scope: "case_instance" },
  });
  if (memErr) {
    console.warn("[case-engine] case_memory insert failed:", memErr.message);
  }

  // Update snapshot on row with case_instance_id filled
  await supabase
    .from("case_instances")
    .update({ clinical_snapshot: snapshot })
    .eq("id", inserted.id);

  return {
    ok: true,
    caseInstanceId: inserted.id,
    snapshot,
    difficulty,
    therapyModality,
  };
}

export function isCaseSnapshot(value: unknown): value is CaseInstanceSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as CaseInstanceSnapshot;
  return v.version === 2 && Boolean(v.clinical_core?.disorder) && Boolean(v.assessment_id);
}
